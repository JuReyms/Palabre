/**
 * @file relay open (#219), Codex seulement : valider sans envoi, lancer une fois, observer
 * le verrou avec un budget coopératif de 15 s. Lancement, attachement et affichage sont distincts.
 * Aucun message, modèle, configuration, permission, export, retrait de verrou ou retry.
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { isSessionId, parseSessionRef } from "../externalSessions/envelope.js";
import { CodexSessionAdapter } from "../externalSessions/codex.js";
import { locateOpenRollout } from "../externalSessions/openRollout.js";
import type { ExternalTarget, RelayStatus, SessionRef, TargetProbe } from "../externalSessions/types.js";
import type { Messages } from "../messages/index.js";
import type { RelayResultV1 } from "./relay.js";

/** Budget coopératif, validation/lancement inclus ; les IO peuvent retarder le retour et Ctrl+C. */
export const DESKTOP_OPEN_TIMEOUT_MS = 15_000;
/** Intervalle d'observation, sans relance du lanceur. */
export const DESKTOP_OPEN_POLL_MS = 500;

/** Rapport du lanceur : code 1 d'Explorer non concluant ; même un succès ne prouve pas l'affichage. */
export interface DesktopLauncherReport {
  attempted: boolean;
  status: "not-attempted" | "succeeded" | "unverified" | "failed" | "not-found" | "timeout" | "cancelled";
  exitCode?: number | null;
}

/** Type JSON distinct d'un échange : aucun champ reply/delivery ni permission déduite. */
export interface RelayOpenResult {
  v: 1;
  type: "relay-open-result";
  status: RelayStatus | "attached";
  exitCode: number;
  to: RelayResultV1["to"];
  launcher: DesktopLauncherReport;
  attachment: TargetProbe["attachment"];
  reason: "validation-refused" | "lock-held" | "deadline" | "probe-unknown" | "launcher-failed" | "launcher-missing" | "cancelled" | "internal-error";
  display: "unverified";
  messageSent: false;
  error: RelayResultV1["error"];
  durationMs: number;
}

/** Validation commune à l'envoi, sans lancer la CLI cible ni écrire de configuration. */
export type DesktopOpenValidation = (args: string[], signal?: AbortSignal) => Promise<{ result: RelayResultV1; messages: Messages }>;

/** Paramètres du seul lancement ; UUID déjà validé et arguments structurés, jamais de shell. */
export interface DesktopLauncherSpec {
  command: string; args: string[]; cwd: string; timeoutMs: number; signal?: AbortSignal;
  /** Injection des processus inertes pour vérifier le nettoyage sans ouvrir d'application. */
  spawn?: typeof spawn;
}

/** IO injectables : les tests n'ouvrent aucune application et n'interrogent aucun profil réel. */
export interface DesktopOpenDeps {
  now(): number;
  locate(ref: SessionRef): ReturnType<typeof locateOpenRollout>;
  probe(target: ExternalTarget): TargetProbe;
  launch(spec: DesktopLauncherSpec): Promise<DesktopLauncherReport>;
  wait(ms: number, signal?: AbortSignal): Promise<void>;
  platform: NodeJS.Platform;
}

/**
 * Lanceur OS sans stdin/flux capturés. À échéance/annulation, détacher sans tuer : l'app peut
 * être son descendant et ne doit jamais être fermée par ce parcours. Le groupe isolé évite
 * de propager le Ctrl+C du terminal au lanceur sous POSIX. L'ouverture déjà demandée
 * n'est pas annulable. Les écouteurs/timers sont retirés, aucun message n'est transmis.
 */
export async function launchDesktopOnce(spec: DesktopLauncherSpec): Promise<DesktopLauncherReport> {
  if (spec.signal?.aborted) return { attempted: false, status: "cancelled" };
  return new Promise(resolve => {
    let child: ReturnType<typeof spawn>;
    try { child = (spec.spawn ?? spawn)(spec.command, spec.args, { cwd: spec.cwd, shell: false, windowsHide: true, detached: true, stdio: "ignore" }); }
    catch (error) { resolve({ attempted: false, status: (error as NodeJS.ErrnoException).code === "ENOENT" ? "not-found" : "failed" }); return; }
    let settled = false;
    const finish = (status: DesktopLauncherReport["status"], exitCode?: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      spec.signal?.removeEventListener("abort", cancel);
      child.removeListener("exit", exited);
      // Garder un récepteur d'erreur neutralisé pour une erreur de spawn tardive.
      child.unref();
      resolve({ attempted: child.pid !== undefined, status, ...(exitCode !== undefined ? { exitCode } : {}) });
    };
    const cancel = () => finish("cancelled");
    const exited = (code: number | null) => finish(code === 0 ? "succeeded" : "failed", code);
    const timer = setTimeout(() => finish("timeout"), Math.max(1, spec.timeoutMs));
    child.once("error", error => finish((error as NodeJS.ErrnoException).code === "ENOENT" ? "not-found" : "failed"));
    child.once("exit", exited);
    spec.signal?.addEventListener("abort", cancel, { once: true });
    if (spec.signal?.aborted) cancel();
  });
}

/** Attente annulable dont le timer et l'écouteur sont toujours retirés. */
async function waitForProbe(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); signal?.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
    if (signal?.aborted) done();
  });
}

/** Lanceur propre au système, sans texte libre ; cible fabriquée depuis un UUID validé. */
export function desktopLauncher(ref: SessionRef, platform: NodeJS.Platform): { command: string; args: string[] } {
  if (!isSessionId(ref.sessionId) || !["win32", "darwin", "linux"].includes(platform)) throw new Error("unsupported-desktop-launch");
  const link = `codex://threads/${ref.sessionId}`;
  return platform === "win32"
    ? { command: path.win32.join(process.env.SystemRoot ?? "C:\\Windows", "explorer.exe"), args: [link] }
    : { command: platform === "darwin" ? "/usr/bin/open" : "xdg-open", args: [link] };
}

/** Analyse stricte de cette sous-commande : aucune option de message ou d'approbation n'est acceptée. */
function openingArgs(args: string[]): { ref: SessionRef; check: string[] } | undefined {
  const seen = new Set<string>();
  const check = ["relay", "--check", "--open"];
  let ref: SessionRef | undefined;
  for (let i = 2; i < args.length; i++) {
    const flag = args[i] === "--lang" ? "--language" : args[i]!;
    if (!["--to", "--config", "--language", "--json"].includes(flag) || seen.has(flag)) return undefined;
    seen.add(flag);
    if (flag === "--json") continue;
    const value = args[++i];
    if (!value || value.startsWith("-")) return undefined;
    check.push(flag, value);
    if (flag === "--to") {
      const parsed = parseSessionRef(value);
      if (!parsed.ok) return undefined;
      ref = parsed.value;
    }
  }
  return ref ? { ref, check } : undefined;
}

/**
 * Exécute uniquement l'ouverture : la validation réutilise --check --open. Un target-not-open
 * est attendu avant lancement et prouve la localisation ; tout autre refus arrête. Annulation
 * et échéance sont vérifiées après chaque IO, avant d'accepter un verrou tardif. Le code 1 du
 * seul lanceur Explorer Windows reste non concluant : conserver ce code et sonder, sans relancer.
 */
export async function executeRelayOpen(args: string[], validate: DesktopOpenValidation, initialMessages: Messages, options: { signal?: AbortSignal; deps?: Partial<DesktopOpenDeps> } = {}): Promise<{ result: RelayOpenResult; messages: Messages }> {
  const deps: DesktopOpenDeps = {
    now: () => performance.now(), platform: process.platform,
    locate: ref => locateOpenRollout(path.join(os.homedir(), ".codex"), ref.sessionId),
    probe: target => new CodexSessionAdapter().probe(target), launch: launchDesktopOnce, wait: waitForProbe,
    ...options.deps
  };
  const start = deps.now();
  const deadline = start + DESKTOP_OPEN_TIMEOUT_MS;
  let messages = initialMessages;
  const result: RelayOpenResult = { v: 1, type: "relay-open-result", status: "invalid-request", exitCode: 8, to: null,
    launcher: { attempted: false, status: "not-attempted" }, attachment: "unknown", reason: "validation-refused",
    display: "unverified", messageSent: false, error: null, durationMs: 0 };
  const finish = (status: RelayOpenResult["status"], exitCode: number, reason: RelayOpenResult["reason"], message?: string) => {
    result.status = status; result.exitCode = exitCode; result.reason = reason;
    result.error = message ? { kind: status as RelayStatus, message, ...(status === "invalid-request" ? { reason: "invalid-arguments" as const } : {}) } : null;
    result.durationMs = Math.max(0, Math.round(deps.now() - start));
    return { result, messages };
  };
  const stopped = () => options.signal?.aborted
    ? finish("cancelled", 130, "cancelled", messages.relayDesktopOpen.cancelled)
    : deps.now() >= deadline ? finish("timeout", 4, "deadline", messages.relayDesktopOpen.deadline) : undefined;
  try {
    const parsed = openingArgs(args);
    if (!parsed) return finish("invalid-request", 8, "validation-refused", messages.relayDesktopOpen.invalid);
    const before = stopped(); if (before) return before;
    const checked = await validate(parsed.check, options.signal);
    messages = checked.messages;
    result.to = checked.result.to;
    const after = stopped(); if (after) return after;
    if (checked.result.status !== "checked" && checked.result.status !== "target-not-open") {
      result.error = checked.result.error;
      result.status = checked.result.status; result.exitCode = checked.result.exitCode;
      result.durationMs = Math.max(0, Math.round(deps.now() - start));
      return { result, messages };
    }
    // Défense de l'IO injectée : même identité et fournisseur, pas d'acceptation par seul code 0.
    if (result.to?.provider !== "codex" || result.to.session !== parsed.ref.sessionId || result.to.agent !== parsed.ref.agent)
      return finish("invalid-request", 8, "validation-refused", messages.relayDesktopOpen.invalid);
    const located = await deps.locate(parsed.ref);
    const late = stopped(); if (late) return late;
    if (located.status !== "found") return finish("session-not-found", 6, "validation-refused", located.status === "session-not-found" && located.history
      ? messages.relay.historyChain.refused(located.history) : messages.relay.status("session-not-found"));
    const target: ExternalTarget = { ...parsed.ref, provider: "codex", cwd: located.cwd };
    const spec = desktopLauncher(parsed.ref, deps.platform);
    result.launcher = await deps.launch({ ...spec, cwd: located.cwd, timeoutMs: deadline - deps.now(), signal: options.signal });
    // Observé lors de deux ouvertures confirmées par l'humain : ce code d'Explorer ne suffit
    // ni à refuser l'observation ni à annoncer un succès. Aucun autre lanceur/code n'est assoupli.
    if (deps.platform === "win32" && result.launcher.attempted && result.launcher.status === "failed" && result.launcher.exitCode === 1)
      result.launcher.status = "unverified";
    const launched = stopped(); if (launched) return launched;
    if (!["succeeded", "unverified"].includes(result.launcher.status) || !result.launcher.attempted) {
      const text = messages.relayDesktopOpen;
      if (result.launcher.status === "cancelled") return finish("cancelled", 130, "cancelled", text.cancelled);
      if (result.launcher.status === "timeout") return finish("timeout", 4, "deadline", text.deadline);
      return result.launcher.status === "not-found"
        ? finish("command-not-found", 7, "launcher-missing", text.missing)
        : finish("cli-failure", 2, "launcher-failed", text.launcher);
    }
    for (;;) {
      const stop = stopped(); if (stop) return stop;
      result.attachment = deps.probe(target).attachment;
      const afterProbe = stopped(); if (afterProbe) return afterProbe;
      if (result.attachment === "attached") return finish("attached", 0, "lock-held");
      if (result.attachment === "unknown") return finish("target-state-unknown", 3, "probe-unknown", messages.relayDesktopOpen.unknown);
      if (deadline - deps.now() <= 0) return finish("target-not-open", 3, "deadline", messages.relayDesktopOpen.deadline);
      await deps.wait(Math.min(DESKTOP_OPEN_POLL_MS, deadline - deps.now()), options.signal);
      if (deps.now() >= deadline && !options.signal?.aborted) return finish("target-not-open", 3, "deadline", messages.relayDesktopOpen.deadline);
    }
  } catch { return stopped() ?? finish("internal-error", 1, "internal-error", messages.relayDesktopOpen.internal); }
}

/** Sortie humaine : conserver les deux preuves et ne jamais dire « Desktop affiché ». */
export function renderRelayOpen(result: RelayOpenResult, messages: Messages): string {
  const text = messages.relayDesktopOpen;
  const lines = [text.notice, `${text.launch}: ${result.launcher.status}`, `${text.attachment}: ${result.attachment}`, text.display];
  if (result.launcher.status === "unverified") lines.push(text.launcherUnverified);
  if (result.error) lines.push(result.error.message.replaceAll("<agent>:<uuid>", result.to ? `${result.to.agent}:${result.to.session}` : "codex:<uuid>"));
  if (result.status === "attached") lines.push(text.ready);
  return sanitizeTerminalText(lines.join("\n")) + "\n";
}

/** Entrée CLI avec un seul gestionnaire Ctrl+C, retiré même après erreur. */
export async function runRelayOpenCommand(args: string[], validate: DesktopOpenValidation, messages: Messages): Promise<void> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  try {
    const outcome = await executeRelayOpen(args, validate, messages, { signal: controller.signal });
    process.stdout.write(args.includes("--json") ? JSON.stringify(outcome.result) + "\n" : renderRelayOpen(outcome.result, outcome.messages));
    process.exitCode = outcome.result.exitCode;
  } finally { process.removeListener("SIGINT", cancel); }
}
