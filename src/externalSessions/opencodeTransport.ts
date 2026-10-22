/**
 * @file Transport OpenCode privé : processus possédés, API locale authentifiée, lectures bornées
 * sans retry. Une cause d'arrêt serveur déjà connue prime sur les erreurs HTTP qu'elle provoque.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { request } from "node:http";
import { StringDecoder } from "node:string_decoder";
import type { ExternalExecutable } from "./adapter.js";
import type { CopyStopResult, CopyTransport } from "./copyRelay.js";
import { CopyFailure, copyObject, isOpenCodeSessionId, readCopySnapshot, type OpenCodeSnapshot } from "./opencodeCopy.js";
import { cleanExternalEnv, killProcessTree, runExternalProcess, type ExternalProcessResult } from "./process.js";
import { utf8ChildProcessEnv } from "../adapters/cli-shared.js";
import type { CopyModelRef } from "./opencodeModel.js";

const PROCESS_LIMIT = 4 * 1024 * 1024;
const API_TOTAL_LIMIT = 32 * 1024 * 1024;

/** @internal Cycle de vie du seul serveur possédé ; les tests peuvent piloter l'ordre exit/close. */
export interface OwnedServer {
  ready: Promise<string>;
  failed(): void;
  failure(): CopyFailure | undefined;
  stop(signal: AbortSignal): Promise<boolean>;
}

/** @internal Injection du processus et du kill ; jamais alimentée par les arguments utilisateur. */
export interface OwnedServerDeps {
  spawnProcess?: typeof spawn;
  killTree?: (pid: number) => void;
}

/** Attente bornée d'un enfant possédé ; aucune temporisation ni listener ne survit à la course. */
async function waitClosed(done: Promise<void>, ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([done.then(() => true), new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), ms);
      onAbort = () => resolve(false); signal.addEventListener("abort", onAbort, { once: true });
    })]);
  } finally {
    clearTimeout(timer); if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}

/** @internal Serveur stdio local ; sorties bornées et cause finale après drainage, sans données brutes rendues. */
export function startOwnedServer(executable: ExternalExecutable, cwd: string, env: NodeJS.ProcessEnv, signal: AbortSignal, deps: OwnedServerDeps = {}): OwnedServer {
  let child: ChildProcess | undefined, closed = false, exited = false, stopping = false, unexpectedExit = false, bytes = 0, pending = "";
  let failure: CopyFailure | undefined;
  let readyResolve!: (url: string) => void, readyReject!: (error: CopyFailure) => void;
  let doneResolve!: () => void;
  const done = new Promise<void>(resolve => { doneResolve = resolve; });
  const ready = new Promise<string>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  // Un rejet peut survenir avant que l'appelant entre dans await start().
  void ready.catch(() => {});
  const kill = () => { if (child?.pid && !exited) (deps.killTree ?? killProcessTree)(child.pid); };
  const fail = (status: "cli-failure" | "output-too-large", diagnostic: string) => {
    if (failure) return;
    failure = new CopyFailure(status, diagnostic); readyReject(failure); kill();
  };
  const onAbort = () => fail("cli-failure", "server-aborted");
  const startupTimer = setTimeout(() => fail("cli-failure", "server-start-timeout"), 20_000);
  const detach = () => { clearTimeout(startupTimer); signal.removeEventListener("abort", onAbort); };
  try {
    if (signal.aborted) throw Error();
    child = (deps.spawnProcess ?? spawn)(executable.command, [...executable.prefixArgs, "serve", "--stdio", "--hostname", "127.0.0.1", "--port", "0"], {
      cwd, env: cleanExternalEnv(env), shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"]
    });
    const decoder = new StringDecoder("utf8");
    const count = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > PROCESS_LIMIT) { fail("output-too-large", "server-output-limit"); return false; }
      return !failure;
    };
    child.stdout!.on("data", (chunk: Buffer) => {
      if (!count(chunk)) return;
      pending += decoder.write(chunk);
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        try {
          const value: unknown = JSON.parse(line);
          if (!copyObject(value) || typeof value.url !== "string" || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(value.url)) continue;
          const url = new URL(value.url);
          if (Number(url.port) > 65535) continue;
          clearTimeout(startupTimer); signal.removeEventListener("abort", onAbort); readyResolve(value.url);
        } catch { /* Les logs ne sont ni une URL ni une preuve. */ }
      }
    });
    child.stderr!.on("data", count);
    child.stdin!.on("error", () => { /* La fermeture est diagnostiquée par close. */ });
    child.on("error", () => { failure ??= new CopyFailure("cli-failure", "server-spawn"); readyReject(failure); });
    child.on("exit", () => {
      unexpectedExit = !stopping; exited = true; detach();
      // Ne pas attendre close pour libérer un démarrage sans URL ; des descendants peuvent
      // retenir les flux. Le booléen conserve l'attribution sans figer une cause générique.
      readyReject(failure ?? new CopyFailure("cli-failure", "server-closed"));
    });
    child.on("close", () => {
      closed = true; exited = true; detach();
      const closure = failure ?? new CopyFailure("cli-failure", "server-closed");
      if (!stopping || unexpectedExit) failure ??= closure;
      readyReject(closure); doneResolve();
    });
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  } catch {
    closed = true; detach(); doneResolve();
    failure = new CopyFailure("cli-failure", "server-spawn"); readyReject(failure);
  }
  return {
    ready,
    failed() {
      if (failure) throw failure;
      if (closed || unexpectedExit) throw new CopyFailure("cli-failure", "server-closed");
    },
    failure() { return failure; },
    async stop(cleanupSignal) {
      stopping = true; detach();
      if (closed) return true;
      child?.stdin?.end();
      if (await waitClosed(done, 3000, cleanupSignal)) return true;
      kill();
      if (await waitClosed(done, 3000, cleanupSignal)) return true;
      // Retour borné même si un descendant retient les flux ; aucune promesse d'arrêt dans ce cas.
      child?.stdin?.destroy(); child?.stdout?.destroy(); child?.stderr?.destroy(); child?.unref();
      return false;
    }
  };
}

/**
 * Implémentation réelle du transport. Le constructeur ne lance rien ; version précède le
 * serveur. Le profil est conservé, seuls PWD et le mot de passe de contrôle sont remplacés.
 */
export class OpenCodeCopyTransport implements CopyTransport {
  private server?: OwnedServer;
  private url?: string;
  private apiBytes = 0;
  private readonly env: NodeJS.ProcessEnv;
  private readonly password = randomBytes(32).toString("base64url");
  constructor(private readonly executable: ExternalExecutable, private readonly cwd: string, private readonly timeoutMs: number) {
    this.env = { ...utf8ChildProcessEnv() };
    // Windows fusionne les noms sans égard à la casse ; ne pas laisser un doublon hérité gagner.
    for (const key of Object.keys(this.env)) if (/^(PWD|OPENCODE_PASSWORD|OPENCODE_SERVER_PASSWORD)$/i.test(key)) delete this.env[key];
    Object.assign(this.env, { PWD: cwd, OPENCODE_PASSWORD: this.password, OPENCODE_SERVER_PASSWORD: this.password });
  }

  async version(signal: AbortSignal): Promise<string | undefined> {
    const run = await runExternalProcess({ command: this.executable.command, args: [...this.executable.prefixArgs, "--version"],
      cwd: this.cwd, stdin: "", env: this.env, signal, timeoutMs: Math.min(10_000, this.timeoutMs), maxOutputBytes: 65536, killGraceMs: 1000 });
    return run.started && !run.stopReason && !run.forcedReturn && run.exitCode === 0 && /^(?:opencode v)?2\.0\.32\s*$/.test(run.stdout) ? "2.0.32" : undefined;
  }

  async start(signal: AbortSignal): Promise<void> {
    this.server = startOwnedServer(this.executable, this.cwd, this.env, signal);
    this.url = await this.server.ready; this.server.failed();
  }

  /** HTTP natif : pas de proxy global, de redirect ou d'URL distante fournie par l'utilisateur. */
  private api(route: string, signal: AbortSignal, body?: object, noContent = false): Promise<unknown> {
    this.server?.failed();
    if (!this.url || signal.aborted) return Promise.reject(new CopyFailure("cli-failure", "api-unavailable"));
    return new Promise((resolve, reject) => {
      // Le kill pour plafond coupe les sockets : ne pas remplacer sa cause par ECONNRESET.
      const rejectIO = (diagnostic: string) => {
        try { this.server?.failed(); }
        catch (failure) { reject(failure); return; }
        reject(new CopyFailure("cli-failure", diagnostic));
      };
      const req = request(new URL(route, this.url), {
        method: body ? "POST" : "GET", signal,
        headers: { Authorization: `Basic ${Buffer.from(`opencode:${this.password}`).toString("base64")}`,
          ...(body ? { "Content-Type": "application/json" } : {}) }
      }, response => {
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length; this.apiBytes += chunk.length;
          if (size > PROCESS_LIMIT || this.apiBytes > API_TOTAL_LIMIT) {
            reject(new CopyFailure("output-too-large", "api-output-limit")); response.destroy(); req.destroy(); return;
          }
          chunks.push(chunk);
        });
        response.on("error", () => rejectIO("api-read"));
        response.on("end", () => {
          try {
            this.server?.failed();
            if (response.statusCode === 404) throw new CopyFailure("session-not-found", "api-not-found");
            if (noContent) {
              if (response.statusCode !== 204 || size !== 0) throw new CopyFailure("cli-failure", "model-selection-ack");
              resolve(undefined); return;
            }
            if (response.statusCode !== 200) throw new CopyFailure("cli-failure", "api-status");
            const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!copyObject(value) || !("data" in value)) throw new CopyFailure("no-valid-reply", "api-schema");
            resolve(value.data);
          } catch (error) { reject(error instanceof CopyFailure ? error : new CopyFailure("no-valid-reply", "api-schema")); }
        });
      });
      req.on("error", () => rejectIO("api-request"));
      // Les API locales ordinaires ne doivent pas monopoliser toute une longue attente modèle.
      req.setTimeout(20_000, () => req.destroy());
      req.end(body ? JSON.stringify(body) : undefined);
    });
  }

  async snapshot(id: string, signal: AbortSignal): Promise<OpenCodeSnapshot> {
    if (!isOpenCodeSessionId(id)) throw new CopyFailure("identity-mismatch", "api-session-id");
    const base = `/api/session/${id}`;
    const [info, exported, context, inbox, instructions] = await Promise.all([
      this.api(base, signal), this.api(`/api/experimental/session/${id}/export`, signal), this.api(`${base}/context`, signal),
      this.api(`${base}/inbox`, signal), this.api(`/api/experimental/session/${id}/instructions/entries`, signal)
    ]);
    return readCopySnapshot({ info, export: exported, context, inbox, instructions });
  }

  async fork(id: string, signal: AbortSignal): Promise<unknown> {
    if (!isOpenCodeSessionId(id)) throw new CopyFailure("identity-mismatch", "api-session-id");
    return this.api(`/api/session/${id}/fork`, signal, {});
  }

  /** Catalogue du serveur possédé, sans sonde de génération ni lecture de credentials. */
  async models(signal: AbortSignal): Promise<unknown> { return this.api("/api/model", signal); }

  /** Seule mutation de sélection : copie explicite, accusé 204 strict, sans retry. */
  async selectModel(id: string, model: CopyModelRef, signal: AbortSignal): Promise<void> {
    if (!isOpenCodeSessionId(id)) throw new CopyFailure("identity-mismatch", "api-session-id");
    await this.api(`/api/session/${id}/model`, signal, { model }, true);
  }

  async run(id: string, envelope: string, signal: AbortSignal): Promise<ExternalProcessResult> {
    this.server?.failed();
    if (!isOpenCodeSessionId(id) || !this.url) throw new CopyFailure("identity-mismatch", "client-session-id");
    return runExternalProcess({ command: this.executable.command,
      args: [...this.executable.prefixArgs, "run", "--server", this.url, "--session", id, "--format", "json"],
      cwd: this.cwd, stdin: envelope, timeoutMs: this.timeoutMs, maxOutputBytes: PROCESS_LIMIT, signal, env: this.env, killGraceMs: 1000 });
  }

  async interrupt(id: string, signal: AbortSignal): Promise<void> {
    if (!isOpenCodeSessionId(id)) return;
    await this.api(`/api/session/${id}/interrupt`, signal, {});
  }

  /** Le bilan de cause est figé après l'attente de close, donc après les derniers chunks acceptés. */
  async stop(signal: AbortSignal): Promise<CopyStopResult> {
    if (!this.server) return { confirmed: true };
    const confirmed = await this.server.stop(signal);
    return { confirmed, failure: this.server.failure() };
  }
}
