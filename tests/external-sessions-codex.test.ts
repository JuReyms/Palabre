/** @file Tests de l'adapter de session externe Codex : rollouts, verrou, liste MCP, sortie et échange avec une CLI simulée. */
import assert from "node:assert/strict";
import { closeSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { exchange, exchangeOutcome, type ExternalExecutable } from "../src/externalSessions/adapter.js";
import {
  codexResumeArgs,
  CodexSessionAdapter,
  exclusiveOpenProbe,
  findNonceInCodexRollout,
  interpretCodexOutput,
  mcpNeutralizationArgs,
  parseMcpServerNames,
  probeCodexLock
} from "../src/externalSessions/codex.js";
import { buildEnvelope, createNonce } from "../src/externalSessions/envelope.js";
import { assessTarget, classifyDelivery } from "../src/externalSessions/outcome.js";
import { relayMessages } from "../src/messages/relay.js";

const SESSION = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const OTHER = "99999999-9999-4999-8999-999999999999";
const fakeCodex = path.resolve("tests", "fixtures", "external-sessions", "fake-codex.cjs");
const root = mkdtempSync(path.join(os.tmpdir(), "palabre-external-codex-"));
after(() => rmSync(root, { recursive: true, force: true }));

let counter = 0;
const jsonl = (entries: object[]) => entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
const meta = (cwd: string, id = SESSION) => ({ timestamp: "t", type: "session_meta", payload: { id, cwd, cli_version: "0.151.0" } });
const context = (model: string) => ({ timestamp: "t", type: "turn_context", payload: { model, cwd: "ignoré" } });

/** Installation Codex jetable : dossier de travail et rollout de la cible. */
function makeHome(options: { rollout?: (cwd: string) => object[]; archived?: boolean } = {}) {
  const base = path.join(root, `case-${++counter}`);
  const home = path.join(base, "codex-home");
  const cwd = path.join(base, "workspace");
  mkdirSync(cwd, { recursive: true });
  const day = path.join(home, options.archived ? "archived_sessions" : "sessions", "2026", "10", "07");
  mkdirSync(day, { recursive: true });
  const rollout = path.join(day, `rollout-2026-10-07T11-34-08-${SESSION}.jsonl`);
  writeFileSync(rollout, jsonl(options.rollout ? options.rollout(cwd) : [meta(cwd), context("gpt-ancien"), context("gpt-test")]));
  return { base, home, cwd, rollout, adapter: new CodexSessionAdapter({ home }) };
}

describe("parseMcpServerNames : validation stricte", () => {
  test("tableau d'objets avec noms valides : noms dédoublonnés", () => {
    assert.deepEqual(parseMcpServerNames('[{"name":"linear","enabled":true},{"name":"node_repl"},{"name":"linear"}]'), ["linear", "node_repl"]);
    assert.deepEqual(parseMcpServerNames("[]"), []);
  });

  test("toute autre forme est refusée", () => {
    for (const raw of ["[{}]", '[{"name":42}]', '[{"name":null}]', '[{"name":""}]', '[{"name":"a b"}]', '[{"name":"a.b"}]', "[null]", '["linear"]', '[["linear"]]', '{"name":"linear"}', "null", "", "pas du json"]) {
      assert.equal(parseMcpServerNames(raw), undefined, raw);
    }
  });
});

describe("codexResumeArgs", () => {
  test("neutralisation, lecture seule, hooks et notify coupés, modèle enregistré, message sur stdin", () => {
    assert.deepEqual(codexResumeArgs(SESSION, mcpNeutralizationArgs(["linear"]), "gpt-test"), [
      "exec", "resume",
      "--disable", "plugins", "--disable", "apps", "-c", "mcp_servers.linear.enabled=false",
      "--json", "--skip-git-repo-check", "--disable", "memories", "--disable", "hooks", "-c", "notify=[]",
      "-m", "gpt-test",
      "-c", "sandbox_mode=\"read-only\"", "-c", "approval_policy=\"never\"",
      SESSION, "-"
    ]);
  });

  test("sans modèle enregistré : -m omis", () => {
    assert.equal(codexResumeArgs(SESSION, mcpNeutralizationArgs([])).includes("-m"), false);
  });

  test("une reprise sans neutralisation MCP est impossible", () => {
    assert.throws(() => codexResumeArgs(SESSION, []), /neutralisation MCP absente/);
    assert.throws(() => codexResumeArgs(SESSION, ["--disable", "plugins"]), /neutralisation MCP absente/);
  });
});

describe("CodexSessionAdapter.locate", () => {
  test("rollout trouvé : dossier de session_meta, modèle du dernier turn_context", () => {
    const { adapter, cwd, rollout } = makeHome();
    assert.deepEqual(adapter.locate({ agent: "codex-5.5", sessionId: SESSION }), {
      status: "found",
      target: { agent: "codex-5.5", provider: "codex", sessionId: SESSION, cwd, model: "gpt-test" },
      historyPath: rollout,
      evidence: []
    });
  });

  test("rollout archivé : trouvé", () => {
    assert.equal(makeHome({ archived: true }).adapter.locate({ agent: "codex", sessionId: SESSION }).status, "found");
  });

  test("sans modèle enregistré : trouvé, -m omis et signalé", () => {
    const { adapter } = makeHome({ rollout: (cwd) => [meta(cwd)] });
    const located = adapter.locate({ agent: "codex", sessionId: SESSION });
    assert.ok(located.status === "found");
    assert.equal(located.target.model, undefined);
    assert.equal(located.evidence.length, 1);
  });

  test("absent, ambigu, incohérent ou identifiant non conforme : session-not-found", () => {
    const { adapter, home } = makeHome();
    assert.equal(adapter.locate({ agent: "codex", sessionId: OTHER }).status, "session-not-found");
    assert.equal(adapter.locate({ agent: "codex", sessionId: `../${SESSION}` }).status, "session-not-found");
    assert.equal(new CodexSessionAdapter({ home: path.join(root, "absent") }).locate({ agent: "codex", sessionId: SESSION }).status, "session-not-found");
    const other = makeHome({ rollout: (cwd) => [meta(cwd, OTHER)] });
    assert.equal(other.adapter.locate({ agent: "codex", sessionId: SESSION }).status, "session-not-found");
    const noMeta = makeHome({ rollout: (cwd) => [context("gpt-test"), meta(cwd)] });
    assert.equal(noMeta.adapter.locate({ agent: "codex", sessionId: SESSION }).status, "session-not-found");
    const archived = path.join(home, "archived_sessions");
    mkdirSync(archived, { recursive: true });
    writeFileSync(path.join(archived, `rollout-2026-10-06T10-00-00-${SESSION}.jsonl`), "{}\n");
    const ambiguous = adapter.locate({ agent: "codex", sessionId: SESSION });
    assert.ok(ambiguous.status === "session-not-found");
    assert.match(ambiguous.detail, /ambiguë/);
  });

  test("dossier de travail absent ou non renseigné : invalid-working-directory, sans repli", () => {
    const missing = makeHome({ rollout: () => [meta(path.join(root, "dossier-absent"))] });
    assert.equal(missing.adapter.locate({ agent: "codex", sessionId: SESSION }).status, "invalid-working-directory");
    const none = makeHome({ rollout: () => [{ type: "session_meta", payload: { id: SESSION } }] });
    assert.equal(none.adapter.locate({ agent: "codex", sessionId: SESSION }).status, "invalid-working-directory");
  });
});

describe("verrou d'écriture", () => {
  test("absent : detached ; tenu : attached ; libre : detached ; invérifiable : unknown", () => {
    assert.equal(probeCodexLock({ exists: false }).attachment, "detached");
    assert.equal(probeCodexLock({ exists: true, held: true }).attachment, "attached");
    assert.equal(probeCodexLock({ exists: true, held: false }).attachment, "detached");
    assert.equal(probeCodexLock({ exists: true, code: "unsupported-platform" }).attachment, "unknown");
    assert.deepEqual(assessTarget(probeCodexLock({ exists: true, held: true })), { allowed: false, status: "target-busy" });
    assert.deepEqual(assessTarget(probeCodexLock({ exists: true })), { allowed: false, status: "target-state-unknown" });
  });

  test("l'adapter sonde le verrou de la session dans thread-writer-locks", () => {
    const { home, cwd } = makeHome();
    const probed: string[] = [];
    const adapter = new CodexSessionAdapter({ home, lockProbe: (file) => { probed.push(file); return { exists: true, held: true }; } });
    assert.equal(adapter.probe({ agent: "codex", provider: "codex", sessionId: SESSION, cwd }).attachment, "attached");
    assert.deepEqual(probed, [path.join(home, "thread-writer-locks", `${SESSION}.lock`)]);
  });

  test("Windows : un verrou ouvert en exclusivité est vu tenu, puis libre une fois refermé", { skip: process.platform !== "win32" }, () => {
    const lock = path.join(root, `verrou-${++counter}.lock`);
    writeFileSync(lock, "");
    const exlock = (constants as Record<string, number>).UV_FS_O_EXLOCK ?? 0x10000000;
    const fd = openSync(lock, constants.O_RDWR | exlock);
    try {
      assert.equal(exclusiveOpenProbe(lock).held, true);
    } finally {
      closeSync(fd);
    }
    assert.deepEqual(exclusiveOpenProbe(lock), { exists: true, held: false });
  });

  test("hors Windows : verrou présent invérifiable", { skip: process.platform === "win32" }, () => {
    const lock = path.join(root, `verrou-${++counter}.lock`);
    writeFileSync(lock, "");
    assert.equal(exclusiveOpenProbe(lock).held, undefined);
  });
});

describe("interpretCodexOutput", () => {
  const started = [{ type: "thread.started", thread_id: SESSION }, { type: "turn.started" }];
  const message = (text: unknown) => ({ type: "item.completed", item: { type: "agent_message", text } });
  const completed = { type: "turn.completed", usage: {} };

  test("réponse : dernier agent_message, texte original conservé", () => {
    const text = "\n  Réponse finale  \n";
    const interpretation = interpretCodexOutput(jsonl([...started, message("commentaire"), message(text), completed]), 0, SESSION);
    assert.equal(interpretation.isError, false);
    assert.equal(interpretation.reply, text);
    assert.equal(interpretation.identity, "same-as-target");
  });

  test("autre thread ou threads multiples : mismatch", () => {
    assert.equal(interpretCodexOutput(jsonl([{ type: "thread.started", thread_id: OTHER }, message("OK"), completed]), 0, SESSION).identity, "mismatch");
    assert.equal(interpretCodexOutput(jsonl([...started, { type: "thread.started", thread_id: OTHER }, message("OK"), completed]), 0, SESSION).identity, "mismatch");
  });

  test("sortie non conforme : échec, aucune réponse rendue", () => {
    const cases: Record<string, [object[], number]> = {
      "turn.failed": [[...started, message("OK"), { type: "turn.failed", error: { message: "x" } }], 0],
      "événement error": [[...started, message("OK"), { type: "error", message: "x" }, completed], 0],
      "sans turn.completed": [[...started, message("OK")], 0],
      "deux turn.completed": [[...started, message("OK"), completed, completed], 0],
      "sans agent_message": [[...started, completed], 0],
      "réponse blanche": [[...started, message("  \n "), completed], 0],
      "réponse non textuelle": [[...started, message(["OK"]), completed], 0],
      "exit non nul": [[...started, message("OK"), completed], 1]
    };
    for (const [label, [events, exitCode]] of Object.entries(cases)) {
      const interpretation = interpretCodexOutput(jsonl(events), exitCode, SESSION);
      assert.equal(interpretation.isError, true, label);
      assert.equal(interpretation.reply, undefined, label);
      assert.equal(interpretation.identity, "unavailable", label);
    }
  });
});

describe("CodexSessionAdapter.interpret : refus certains", () => {
  const adapter = new CodexSessionAdapter({ home: path.join(root, "inutilisé") });
  const target = { agent: "codex", provider: "codex" as const, sessionId: SESSION, cwd: root };
  const run = (fields: { exitCode: number; stdout?: string; stderr?: string }) => ({
    started: true, pid: 1, signal: null, forcedReturn: false, outputBytes: 0, durationMs: 1, stdout: "", stderr: "", ...fields
  });
  const busy = `Error: thread/resume: thread/resume failed: thread ${SESSION} already has an active writer (code -32600)`;

  test("refus documentés, sans tour commencé : certains", () => {
    assert.equal(adapter.interpret(run({ exitCode: 1, stderr: busy }), target).certainRefusal, "target-busy");
    assert.equal(adapter.interpret(run({ exitCode: 1, stderr: `no rollout found for thread id ${SESSION}` }), target).certainRefusal, "session-not-found");
  });

  test("tour commencé, ou exit 0 : jamais un refus certain", () => {
    const turnStarted = jsonl([{ type: "thread.started", thread_id: SESSION }, { type: "turn.started" }]);
    assert.equal(adapter.interpret(run({ exitCode: 1, stdout: turnStarted, stderr: busy }), target).certainRefusal, undefined);
    assert.equal(adapter.interpret(run({ exitCode: 0, stderr: busy }), target).certainRefusal, undefined);
  });
});

describe("findNonceInCodexRollout", () => {
  const user = (text: string) => ({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } });

  test("nonce dans un message utilisateur : persisté, rollout linéaire", () => {
    assert.deepEqual([findNonceInCodexRollout(jsonl([user("PR-1 bonjour")]), "PR-1").persisted, findNonceInCodexRollout(jsonl([user("PR-1")]), "PR-1").inActiveBranch], [true, true]);
  });

  test("nonce seulement dans une réponse, ou absent : persisted false", () => {
    const content = jsonl([{ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "PR-1" }] } }]);
    assert.equal(findNonceInCodexRollout(content, "PR-1").persisted, false);
  });
});

describe("échange avec une CLI Codex simulée", () => {
  const executable: ExternalExecutable = { command: process.execPath, prefixArgs: [fakeCodex] };
  const from = { agent: "claude", sessionId: OTHER };
  type Call = { argv: string[]; cwd: string; stdin: string; envKeys: string[] };

  async function relay(mode: string, options: { timeoutMs?: number; env?: Record<string, string> } = {}) {
    const home = makeHome();
    const marker = path.join(home.base, "marker.jsonl");
    const located = home.adapter.locate({ agent: "codex", sessionId: SESSION });
    if (located.status !== "found") throw new Error("cible introuvable");
    assert.deepEqual(assessTarget(home.adapter.probe(located.target)), { allowed: true });
    const nonce = createNonce();
    const envelope = buildEnvelope({ from, nonce, message: "Peux-tu relire ce plan ?" }, relayMessages.fr);
    const env = { ...process.env, FAKE_CODEX_MODE: mode, FAKE_CODEX_ROLLOUT: home.rollout, FAKE_CODEX_MARKER: marker, ...options.env };
    const result = await exchange(home.adapter, executable, located.target, envelope, { timeoutMs: options.timeoutMs ?? 10_000, env });
    const { outcome, launched } = exchangeOutcome(result);
    const delivery = classifyDelivery({ outcome, launched, evidence: home.adapter.findNonce(located.target, nonce) });
    const calls = existsSync(marker) ? readFileSync(marker, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line) as Call) : [];
    return { home, envelope, result, outcome, delivery, calls, resumes: calls.filter((call) => call.argv[0] === "exec") };
  }

  test("réponse de la cible : replied, nonce persisté", async () => {
    const { outcome, delivery, result } = await relay("ok");
    assert.deepEqual(outcome, { status: "replied", exitCode: 0 });
    assert.deepEqual(delivery, { status: "replied", persisted: true, inActiveBranch: true });
    assert.equal(result.verdict?.interpretation.reply, "FAKE-OK");
  });

  test("liste MCP puis reprise : même dossier, neutralisation transmise, environnement nettoyé", async () => {
    process.env.CODEX_THREAD_ID = "thread-de-l-appelant";
    try {
      const { calls, home, envelope } = await relay("ok", { env: { FAKE_CODEX_MCP: '[{"name":"linear"},{"name":"node_repl"}]' } });
      assert.equal(calls.length, 2);
      const [list, resume] = calls;
      assert.deepEqual(list!.argv, ["mcp", "list", "--json", "--disable", "plugins", "--disable", "apps"]);
      assert.deepEqual(resume!.argv, codexResumeArgs(SESSION, mcpNeutralizationArgs(["linear", "node_repl"]), "gpt-test"));
      for (const call of calls) {
        assert.equal(path.resolve(call.cwd).toLowerCase(), path.resolve(home.cwd).toLowerCase());
        assert.equal(call.envKeys.some((key) => key.toUpperCase() === "CODEX_THREAD_ID"), false);
      }
      assert.equal(list!.stdin, "");
      assert.equal(resume!.stdin, envelope);
    } finally {
      delete process.env.CODEX_THREAD_ID;
    }
  });

  test("liste MCP non conforme ou en échec : neutralization-failed, aucune reprise lancée", async () => {
    const variants: Array<Record<string, string>> = [
      { FAKE_CODEX_MCP: "[{}]" },
      { FAKE_CODEX_MCP: '[{"name":42}]' },
      { FAKE_CODEX_MCP: '[{"name":null}]' },
      { FAKE_CODEX_MCP: "pas du json" },
      { FAKE_CODEX_MCP_EXIT: "1" }
    ];
    for (const env of variants) {
      const { outcome, delivery, resumes, result } = await relay("ok", { env });
      assert.deepEqual(outcome, { status: "neutralization-failed", exitCode: 3 }, JSON.stringify(env));
      assert.equal(delivery.status, "not-delivered");
      assert.equal(resumes.length, 0, "aucun exec resume");
      assert.equal(result.process, undefined);
    }
  });

  test("exécutable introuvable dès la liste MCP : command-not-found, aucune reprise", async () => {
    const home = makeHome();
    const located = home.adapter.locate({ agent: "codex", sessionId: SESSION });
    if (located.status !== "found") throw new Error("cible introuvable");
    const result = await exchange(home.adapter, { command: path.join(root, "absent-codex.exe"), prefixArgs: [] }, located.target, "x", { timeoutMs: 5_000 });
    assert.deepEqual(exchangeOutcome(result), { outcome: { status: "command-not-found", exitCode: 7 }, launched: false });
  });

  test("dossier de travail disparu avant la liste MCP : invalid-working-directory, aucune reprise", async () => {
    const home = makeHome();
    const located = home.adapter.locate({ agent: "codex", sessionId: SESSION });
    if (located.status !== "found") throw new Error("cible introuvable");
    const target = { ...located.target, cwd: path.join(root, "dossier-disparu") };
    const result = await exchange(home.adapter, executable, target, "x", { timeoutMs: 5_000 });
    assert.deepEqual(exchangeOutcome(result), { outcome: { status: "invalid-request", exitCode: 8, reason: "invalid-working-directory" }, launched: false });
  });

  test("écrivain actif (course perdue) : target-busy, not-delivered", async () => {
    const { outcome, delivery } = await relay("active-writer");
    assert.deepEqual(outcome, { status: "target-busy", exitCode: 3 });
    assert.equal(delivery.status, "not-delivered");
  });

  test("thread inconnu : session-not-found, not-delivered", async () => {
    const { outcome, delivery } = await relay("not-found");
    assert.deepEqual(outcome, { status: "session-not-found", exitCode: 6 });
    assert.equal(delivery.status, "not-delivered");
  });

  test("tour en échec après écriture : cli-failure, persisted-no-reply", async () => {
    const { outcome, delivery } = await relay("turn-failed");
    assert.equal(outcome.status, "cli-failure");
    assert.equal(delivery.status, "persisted-no-reply");
  });

  test("sortie non conforme malgré exit 0 : no-valid-reply, aucune réponse rendue", async () => {
    for (const mode of ["no-message", "blank", "two-completed"]) {
      const { outcome, delivery, result } = await relay(mode);
      assert.deepEqual(outcome, { status: "no-valid-reply", exitCode: 2 }, mode);
      assert.equal(result.verdict?.interpretation.reply, undefined, mode);
      assert.equal(delivery.status, "persisted-no-reply", mode);
    }
  });

  test("réponse d'un autre thread : identity-mismatch", async () => {
    const { outcome, delivery } = await relay("mismatch");
    assert.deepEqual(outcome, { status: "identity-mismatch", exitCode: 5 });
    assert.equal(delivery.status, "persisted-no-reply");
  });

  test("limite d'usage : usage-limit, code 2", async () => {
    const { outcome, delivery } = await relay("usage-limit");
    assert.deepEqual(outcome, { status: "usage-limit", exitCode: 2 });
    assert.equal(delivery.status, "unknown");
  });

  test("CLI bloquée : timeout", async () => {
    const { outcome, delivery } = await relay("hang", { timeoutMs: 800 });
    assert.deepEqual(outcome, { status: "timeout", exitCode: 4 });
    assert.equal(delivery.status, "persisted-no-reply");
  });
});
