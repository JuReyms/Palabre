/**
 * @file Attente et lecture OpenCode (profil qualifié) : CLIs simulées par Node, exports fictifs,
 * profils isolés par scripts/test.mjs. Aucun modèle, réseau ni profil réel.
 */
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { after, describe, test } from "node:test";
import { CliAdapter } from "../src/adapters/cli.js";
import { DEFAULT_TIMEOUT_MS, resolveTimeoutMs } from "../src/adapters/cli-shared.js";
import { decodeRecoveryReference, encodeRecoveryReference, evaluateOpenCodeExport, OpenCodeOutputError, parseOpenCodeRunOutput, sha256Hex, type OpenCodeRecoveryReference } from "../src/adapters/opencodeJson.js";
import { cliRuntimeProfile } from "../src/agentRegistry.js";
import { executeAgentResult, runOpenCodeExport, type ExportRunner } from "../src/commands/result.js";
import { getConfigIdentity, trustConfig } from "../src/configTrust.js";
import { AdapterError } from "../src/errors.js";
import { formatAgentPrompt } from "../src/prompt.js";
import type { AgentPrompt, CliAgentConfig, ConfigIdentity } from "../src/types.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-wait-recovery-"));
// Windows libère le cwd d'un faux client tué de façon asynchrone ; borne courte de nettoyage.
after(() => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
const SESSION = "ses_test0000000000AbCdEf";
const MSG = "msg_aaaaaaaa01";
const IDENTITY: ConfigIdentity = { path: path.join(root, "palabre.config.json"), sha256: "a".repeat(64) };
let counter = 0;

const prompt = (overrides: Partial<AgentPrompt> = {}): AgentPrompt => ({
  topic: "Revue lente", turn: 1, totalTurns: 1, selfName: "opencode", peerName: "independent-agents", selfRole: "reviewer", mode: "ask",
  session: { startedAt: "2026-10-29T18:00:00.000Z", localDate: "2026-10-29", timeZone: "Europe/Paris", cwd: process.cwd() },
  files: [], transcript: [], ...overrides
});
const line = (value: unknown) => `${JSON.stringify(value)}\n`;
const step = (messageID = MSG) => line({ type: "step_start", sessionID: SESSION, part: { sessionID: SESSION, messageID, type: "step-start" } });
const textEvent = (text: string, messageID = MSG) => line({ type: "text", sessionID: SESSION, part: { sessionID: SESSION, messageID, type: "text", text } });
const details = (error: unknown) => (error as AdapterError).details as Record<string, unknown>;

/** Faux `opencode run --format json` : Node sans shell ; `--` garde les arguments de modèle hors de Node. */
function fake(script: string, overrides: Partial<CliAgentConfig> = {}, identity: ConfigIdentity | null = IDENTITY): CliAdapter {
  return new CliAdapter("opencode", {
    type: "cli", command: process.execPath, args: ["-e", script, "--"], promptMode: "stdin", shell: false, role: "reviewer", timeoutMs: 3_000, ...overrides
  }, { output: "opencode-json" }, identity ?? undefined);
}

describe("attente d'un appel OpenCode qualifié", () => {
  test("arrêt non confirmé : le CLI termine quand même, sans tuer un service descendant", async () => {
    const marker = path.join(root, `unconfirmed-${++counter}.txt`);
    const adapterUrl = new URL("../src/adapters/cli.js", import.meta.url).href;
    const script = `
      import { ChildProcess } from 'node:child_process';
      import fs from 'node:fs';
      import { CliAdapter } from ${JSON.stringify(adapterUrl)};
      ChildProcess.prototype.kill = function () { fs.writeFileSync(${JSON.stringify(marker)}, String(this.pid)); return false; };
      const adapter = new CliAdapter('opencode', { type:'cli', command:process.execPath,
        args:['-e', 'process.stdin.resume();setInterval(()=>{},1000)'], role:'reviewer', timeoutMs:200 }, {output:'opencode-json'});
      try { await adapter.generate(${JSON.stringify(prompt())}); }
      catch (error) { process.stdout.write(JSON.stringify({kind:error.kind, localExit:error.details.localExit})); }
    `;
    const startedAt = Date.now();
    try {
      const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], { timeout: 8_000, windowsHide: true });
      assert.deepEqual(JSON.parse(stdout), { kind: "timeout", localExit: "unconfirmed" });
      assert.ok(Date.now() - startedAt < 7_500, "les pipes ne prolongent pas le CLI après la grâce");
    } finally {
      if (existsSync(marker)) {
        try { process.kill(Number(readFileSync(marker, "utf8"))); } catch { /* Déjà sorti. */ }
      }
    }
  });
  test("réponse lente avant l'échéance : texte du dernier message seulement, indication bornée à l'appel", async () => {
    const events: number[] = [];
    const output = step("msg_aaaaaaaa00") + textEvent("intermédiaire", "msg_aaaaaaaa00")
      + line({ type: "tool_use", sessionID: SESSION, part: { partID: "prt_aaaaaaaa01", id: "call_read_1", messageID: "msg_aaaaaaaa00", type: "tool", tool: "read", state: { status: "completed" } } }) + step()
      + line({ type: "reasoning", sessionID: SESSION, part: { sessionID: SESSION, messageID: MSG, type: "reasoning", text: "PENSEE" } }) + textEvent("REPONSE FINALE");
    const response = await fake(`setTimeout(() => process.stdout.write(${JSON.stringify(output)}), 400)`).generate(prompt({
      onWaiting: (event) => { events.push(event.elapsedMs); assert.equal(event.agent, "opencode"); assert.equal(event.timeoutMs, 3_000); },
      waitingIntervalMs: 50
    }));
    assert.equal(response.content, "REPONSE FINALE");
    assert.ok(events.length >= 2, "indication pendant l'attente");
    const count = events.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(events.length, count, "aucune indication après la fin");
  });

  test("échéance : un seul lancement, client arrêté, référence liée à la config, au modèle et au message", async () => {
    const marker = path.join(root, `launch-${++counter}.txt`);
    const input = prompt();
    const adapter = fake(`require("node:fs").appendFileSync(${JSON.stringify(marker)}, "x"); process.stdout.write(${JSON.stringify(step())}); setInterval(() => {}, 1000)`,
      { timeoutMs: 300, model: "opencode/glm-test#default" });
    await assert.rejects(adapter.generate(input), (error: unknown) => {
      assert.ok(error instanceof AdapterError && error.kind === "timeout");
      const fields = details(error);
      assert.equal(fields.localExit, "confirmed");
      assert.equal(fields.remoteWork, "unknown");
      assert.equal(fields.resent, false);
      const recovery = fields.recovery as { available: boolean; reference: string };
      assert.equal(recovery.available, true);
      const decoded = decodeRecoveryReference(recovery.reference)!;
      assert.deepEqual(decoded, {
        v: 1, agent: "opencode", command: process.execPath, config: IDENTITY, cwd: process.cwd(), session: SESSION, lastMessage: MSG,
        requestSha256: sha256Hex(formatAgentPrompt(input)), model: "opencode/glm-test#default"
      });
      assert.ok(!Buffer.from(recovery.reference, "base64url").toString("utf8").includes("Revue lente"), "le prompt n'est jamais dans la référence");
      assert.ok(error.message.includes(`palabre result --reference ${recovery.reference}`));
      return true;
    });
    assert.equal(readFileSync(marker, "utf8"), "x", "aucun second lancement");
  });

  test("référence indisponible et nommée : sans identité, sans session ou après une ligne non qualifiée", async () => {
    const reason = async (adapter: CliAdapter) => {
      const error = await adapter.generate(prompt()).then(() => undefined, (failure: unknown) => failure);
      assert.ok(error instanceof AdapterError && error.kind === "timeout");
      assert.doesNotMatch(error.message, /palabre result/);
      return (details(error).recovery as { available: boolean; reason: string });
    };
    const hang = (output: string) => `process.stdout.write(${JSON.stringify(output)}); setInterval(() => {}, 1000)`;
    assert.deepEqual(await reason(fake(hang(step()), { timeoutMs: 200 }, null)), { available: false, reason: "config-unknown" });
    assert.deepEqual(await reason(fake("setInterval(() => {}, 1000)", { timeoutMs: 200 })), { available: false, reason: "session-unknown" });
    assert.deepEqual(await reason(fake(hang(line({ type: "step_start" }) + step()), { timeoutMs: 200 })), { available: false, reason: "session-unknown" });
  });

  test("jamais une réponse : format inconnu, nouveau pas sans texte, UTF-8 invalide, exit non nul, session absente", async () => {
    const kind = (expected: string) => (error: unknown) => error instanceof AdapterError && error.kind === expected;
    await assert.rejects(fake("process.stdout.write('texte libre')").generate(prompt()), kind("unknown"));
    await assert.rejects(fake(`process.stdout.write(${JSON.stringify(step() + textEvent("ancien") + step("msg_aaaaaaaa02"))})`).generate(prompt()), kind("empty-output"));
    await assert.rejects(fake("process.stdout.write(Buffer.from([0xff, 0xfe, 0x0a]))").generate(prompt()), kind("unknown"));
    await assert.rejects(fake(`process.stdout.write(${JSON.stringify(step() + textEvent("OK"))}); process.exit(3)`).generate(prompt()), kind("non-zero-exit"));
    await assert.rejects(fake(`process.stdout.write(${JSON.stringify(line({ type: "text", part: { messageID: MSG, type: "text", text: "x" } }))})`).generate(prompt()), kind("unknown"));
  });

  test("sortie run : identifiants contradictoires et erreurs refusés", () => {
    assert.deepEqual(parseOpenCodeRunOutput(step() + textEvent("CONTROLE_RECU")), { sessionId: SESSION, lastMessage: MSG, content: "CONTROLE_RECU" });
    const reason = (output: string) => { try { parseOpenCodeRunOutput(output); return "accepted"; } catch (error) { return (error as OpenCodeOutputError).reason; } };
    assert.equal(reason(line({ type: "text", sessionID: SESSION, part: { sessionID: "ses_autre0000000000", messageID: MSG, type: "text", text: "x" } })), "session-conflict");
    assert.equal(reason(step() + step().replaceAll(SESSION, "ses_autre0000000000")), "session-conflict");
    assert.equal(reason(step() + textEvent("ancien") + line({ type: "step_start", sessionID: SESSION })), "invalid-event");
    assert.equal(reason(step() + textEvent("ancien") + line({ type: "nouveau", sessionID: SESSION })), "invalid-event");
    assert.equal(reason(step() + line({ type: "error", sessionID: SESSION })), "error-event");
    assert.equal(reason(line({ type: "step_start", sessionID: SESSION, part: { messageID: "pas-un-id" } })), "invalid-event");
  });

  test("délai invalide : jamais désactivé ni immédiat", () => {
    for (const value of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(resolveTimeoutMs(value), DEFAULT_TIMEOUT_MS);
    assert.equal(resolveTimeoutMs(1234), 1234);
    assert.equal(resolveTimeoutMs(1e12), 2_147_483_647);
  });
});

describe("profil OpenCode du registre", () => {
  const base: CliAgentConfig = { type: "cli", command: "opencode", args: ["run"], promptMode: "stdin", role: "reviewer" };

  test("défaut exact : sortie structurée et 15 min, configuration intacte", () => {
    const profile = cliRuntimeProfile(base)!;
    assert.deepEqual(profile.config.args, ["run", "--format", "json"]);
    assert.equal(profile.config.timeoutMs, 900_000);
    assert.deepEqual(profile.runtime, { output: "opencode-json" });
    assert.deepEqual(base.args, ["run"]);
    assert.equal(cliRuntimeProfile({ ...base, timeoutMs: 1234 })!.config.timeoutMs, 1234);
    assert.ok(cliRuntimeProfile({ ...base, command: "C:\\outils\\opencode.exe" })!.runtime);
  });

  test("arguments personnalisés : arguments conservés, délai par défaut, aucune lecture structurée", () => {
    for (const config of [{ ...base, args: ["run", "--agent", "plan"] }, { ...base, responseFormat: "text" as const }, { ...base, promptMode: "argument" as const }]) {
      const profile = cliRuntimeProfile(config)!;
      assert.deepEqual(profile.config.args, config.args);
      assert.equal(profile.config.timeoutMs, 900_000);
      assert.equal(profile.runtime, undefined);
    }
    assert.equal(cliRuntimeProfile({ ...base, args: ["run", "--agent", "plan"], timeoutMs: 0 })!.config.timeoutMs, 900_000);
    assert.equal(cliRuntimeProfile({ ...base, command: "codex" }), undefined);
    assert.equal(cliRuntimeProfile({ type: "cli-pty", command: "opencode", args: ["run"], role: "reviewer" }), undefined);
  });
});

const requestText = "PROMPT EXACT\r\nligne é";
const user = { id: "msg_uuuuuuuu01", type: "user", text: requestText, time: { created: 1 } };
const assistant = (id: string, finish: string, content: unknown[], extra: Record<string, unknown> = {}) =>
  ({ id, type: "assistant", finish, content, model: { providerID: "opencode", id: "glm-test", variant: "default" }, time: { created: 2, completed: 3 }, ...extra });
const idle = (outcome = "succeeded") => ({ id: "msg_iiiiiiii01", type: "idle", outcome });
const system = { id: "msg_ssssssss01", type: "system", metadata: { notice: "instructions", instructionSources: ["core/codemode"] }, time: { created: 2 }, description: "Instructions updated" };
const exportOf = (messages: unknown[], cwd = process.cwd(), info: Record<string, unknown> = {}) => ({
  info: { id: SESSION, outcome: "succeeded", model: { providerID: "opencode", id: "glm-test", variant: "default" }, location: { directory: cwd }, ...info }, messages
});
const final = (content: unknown[] = [{ type: "reasoning", text: "PENSEE" }, { type: "text", text: "FINALE" }], extra: Record<string, unknown> = {}) => assistant(MSG, "stop", content, extra);
const turn = (last = final()) => [user, assistant("msg_aaaaaaaa00", "tool-calls", [{ type: "text", text: "étape" }]), system, last, idle()];

describe("lecture d'un export contre la demande exacte", () => {
  const reference: Pick<OpenCodeRecoveryReference, "session" | "lastMessage" | "requestSha256" | "cwd" | "model"> = { session: SESSION, lastMessage: MSG, requestSha256: sha256Hex(requestText), cwd: process.cwd(), model: "opencode/glm-test#default" };
  const verdict = (value: unknown, overrides: Partial<typeof reference> = {}) => evaluateOpenCodeExport(value, { ...reference, ...overrides });

  test("réponse acceptée seulement terminée, réussie, sans erreur et non vide", () => {
    assert.deepEqual(verdict(exportOf(turn())), { status: "replied", reply: "FINALE" });
    assert.deepEqual(verdict(exportOf(turn(), process.cwd(), { model: { id: "autre" } }), { model: null }), { status: "replied", reply: "FINALE" });
    assert.deepEqual(verdict(exportOf([user, final()])), { status: "pending" });
    assert.deepEqual(verdict(exportOf(turn(final(undefined, { time: { created: 2 } })))), { status: "not-succeeded", reason: "incomplete" });
    assert.deepEqual(verdict(exportOf(turn(final(undefined, { error: { name: "APIError" } })))), { status: "not-succeeded", reason: "error" });
    assert.deepEqual(verdict(exportOf(turn(final(undefined, { model: { providerID: "autre", id: "modele" } })))), { status: "mismatch", reason: "model" });
    assert.deepEqual(verdict(exportOf(turn(), process.cwd(), { outcome: "failed" })), { status: "not-succeeded", reason: "outcome", outcome: "failed" });
    assert.deepEqual(verdict(exportOf([...turn().slice(0, 4), idle("aborted")])), { status: "not-succeeded", reason: "outcome", outcome: "aborted" });
    assert.deepEqual(verdict(exportOf(turn(final([{ type: "text", text: "\u001b[31m\u001b[0m" }])))), { status: "not-succeeded", reason: "empty-text" });
    assert.deepEqual(verdict(exportOf(turn(assistant(MSG, "tool-calls", [{ type: "text", text: "x" }])))), { status: "not-succeeded", reason: "not-stopped" });
  });

  test("non-correspondance ou forme non qualifiée : refus nommé, jamais une autre réponse", () => {
    const mismatch = (value: unknown, reason: string, overrides: Partial<typeof reference> = {}) => assert.deepEqual(verdict(value, overrides), { status: "mismatch", reason });
    mismatch(exportOf([user, final(), { ...user, id: "msg_uuuuuuuu02" }, idle()]), "ambiguous");
    mismatch(exportOf([{ ...user, text: "autre demande" }, ...turn().slice(1)]), "request");
    mismatch(exportOf(turn(), process.cwd(), { id: "ses_autre0000000000" }), "session");
    mismatch(exportOf(turn(), path.join(root, "ailleurs")), "cwd");
    mismatch(exportOf(turn(), process.cwd(), { model: { providerID: "opencode", id: "autre", variant: "default" } }), "model");
    mismatch(exportOf(turn()), "message", { lastMessage: "msg_zzzzzzzz01" });
    const unknown = { status: "unreadable", reason: "unknown-format" };
    assert.deepEqual(verdict(exportOf([user, { ...system, metadata: { notice: "autre" } }, final(), idle()])), unknown);
    assert.deepEqual(verdict(exportOf([user, { type: "compaction" }, final(), idle()])), unknown);
    assert.deepEqual(verdict("pas un objet"), unknown);
  });

  test("référence opaque : validation stricte, sans prompt", () => {
    const value: OpenCodeRecoveryReference = { v: 1, agent: "opencode", command: "opencode", config: IDENTITY, cwd: process.cwd(), session: SESSION, lastMessage: MSG, requestSha256: sha256Hex("x"), model: null };
    const encoded = encodeRecoveryReference(value)!;
    assert.deepEqual(decodeRecoveryReference(encoded), value);
    const tampered = Buffer.from(JSON.stringify({ ...value, extra: 1 }), "utf8").toString("base64url");
    assert.equal(decodeRecoveryReference(tampered), undefined);
    assert.equal(encodeRecoveryReference({ ...value, cwd: "relatif" }), undefined);
    assert.equal(encodeRecoveryReference({ ...value, command: "opencode\u0007" }), undefined);
    assert.equal(decodeRecoveryReference(`${encoded}=`), undefined);
  });
});

describe("palabre result : lecture sans envoi", () => {
  const defaultAgent = { type: "cli", command: "opencode", args: ["run"], promptMode: "stdin", role: "reviewer" };
  async function world(agent: Record<string, unknown> = defaultAgent, trusted = true, language = "fr") {
    const dir = path.join(root, `result-${++counter}`);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "palabre.config.json");
    writeFileSync(file, JSON.stringify({ language, agents: { opencode: agent } }));
    if (trusted) await trustConfig(file);
    const identity = await getConfigIdentity(file);
    const ref = (overrides: Partial<OpenCodeRecoveryReference> = {}) => encodeRecoveryReference({
      v: 1, agent: "opencode", command: "opencode", config: identity, cwd: dir, session: SESSION, lastMessage: MSG, requestSha256: sha256Hex(requestText), model: null, ...overrides
    })!;
    return { dir, file, identity, ref };
  }
  const runner = (stdout: string, calls: Parameters<ExportRunner>[0][]): ExportRunner => async (input) => {
    calls.push(input);
    return { status: "completed", exitCode: 0, stdout };
  };
  const read = (reference: string, deps: Parameters<typeof executeAgentResult>[1] = {}) => executeAgentResult(["--reference", reference, "--json"], deps);

  test("réponse exacte : une seule lecture, même commande, même dossier, rien d'envoyé", async () => {
    const w = await world();
    const calls: Parameters<ExportRunner>[0][] = [];
    const { result } = await read(w.ref(), { runExport: runner(JSON.stringify(exportOf(turn(), w.dir)), calls) });
    assert.equal(result?.status, "replied");
    assert.equal(result?.reply, "FINALE");
    assert.equal(result?.sent, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.cwd, w.dir);
    assert.equal(calls[0]!.session, SESSION);
    assert.equal(calls[0]!.config.command, "opencode");
  });

  test("configuration modifiée, autre configuration, non approuvée, commande ou profil changés : aucun lancement", async () => {
    const calls: Parameters<ExportRunner>[0][] = [];
    const reason = async (reference: string) => (await read(reference, { runExport: runner("{}", calls) })).result?.error?.reason;
    const changed = await world();
    const reference = changed.ref();
    appendFileSync(changed.file, " ");
    assert.equal(await reason(reference), "config-changed");
    const first = await world();
    const second = await world(defaultAgent, true, "en");
    assert.equal(await reason(first.ref({ config: { path: first.identity.path, sha256: second.identity.sha256 } })), "config-changed");
    assert.equal(await reason((await world(defaultAgent, false)).ref()), "config-untrusted");
    assert.equal(await reason(first.ref({ command: path.join(root, "autre", "opencode.exe") })), "agent-changed");
    assert.equal(await reason((await world({ ...defaultAgent, args: ["run", "--agent", "plan"] })).ref()), "unsupported-agent");
    assert.equal(await reason(first.ref({ cwd: path.join(root, "absent") })), "cwd-unavailable");
    assert.equal(await reason("pas-une-reference-valide"), "invalid-reference");
    const aborted = new AbortController();
    aborted.abort();
    assert.equal((await read(first.ref(), { runExport: runner("{}", calls), signal: aborted.signal })).result?.status, "cancelled");
    assert.equal(calls.length, 0);
  });

  test("états honnêtes : en cours, non-correspondance, format inconnu ; langue anglaise", async () => {
    const w = await world();
    const pending = (await executeAgentResult(["--reference", w.ref(), "--language", "en"], { runExport: runner(JSON.stringify(exportOf([user, final()], w.dir)), []) })).result!;
    assert.equal(pending.status, "pending"); assert.equal(pending.exitCode, 2); assert.equal(pending.reply, undefined);
    assert.match(pending.error!.message, /has not finished/);
    const other = (await read(w.ref({ requestSha256: sha256Hex("autre") }), { runExport: runner(JSON.stringify(exportOf(turn(), w.dir)), []) })).result!;
    assert.equal(other.status, "mismatch"); assert.equal(other.exitCode, 3);
    assert.equal((await read(w.ref(), { runExport: runner("oops", []) })).result?.error?.reason, "unknown-format");
  });
});

describe("lecture d'export bornée", () => {
  const config = (overrides: Partial<CliAgentConfig> = {}): CliAgentConfig => ({ type: "cli", command: process.execPath, args: ["run"], promptMode: "stdin", shell: false, role: "reviewer", ...overrides });
  /** Node exécute le fichier `session` du dossier : `session export <id>` devient un script fictif. */
  function exportDir(script: string): string {
    const dir = path.join(root, `export-${++counter}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "session"), script);
    return dir;
  }
  const input = (dir: string, overrides: Partial<Parameters<ExportRunner>[0]> = {}) => ({ agent: "opencode", config: config(), session: SESSION, cwd: dir, timeoutMs: 5_000, ...overrides });

  test("arguments exacts, sortie bornée, UTF-8 strict, annulation et signal déjà annulé", async () => {
    const ok = await runOpenCodeExport(input(exportDir("process.stdout.write(JSON.stringify(process.argv.slice(2)))")));
    assert.equal(ok.status, "completed");
    assert.deepEqual(JSON.parse((ok as { stdout: string }).stdout), ["export", SESSION]);
    assert.equal((await runOpenCodeExport(input(exportDir("process.stdout.write('x'.repeat(1000))"), { config: config({ maxOutputBytes: 64 }) }))).status, "output-too-large");
    assert.equal((await runOpenCodeExport(input(exportDir("process.stdout.write(Buffer.from([0xff]))")))).status, "invalid-output");
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    assert.equal((await runOpenCodeExport(input(exportDir("setInterval(() => {}, 1000)"), { signal: controller.signal }))).status, "cancelled");
    const marker = path.join(root, `export-launch-${++counter}.txt`);
    const aborted = new AbortController();
    aborted.abort();
    const dir = exportDir(`require("node:fs").writeFileSync(${JSON.stringify(marker)}, "x")`);
    assert.equal((await runOpenCodeExport(input(dir, { signal: aborted.signal }))).status, "cancelled");
    assert.equal(existsSync(marker), false, "aucun lancement après annulation");
  });
});
