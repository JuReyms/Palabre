/** @file Source, copie et délivrance testées avec transports fictifs ; aucun compte ni réseau. */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { runCopyRelay, type CopyTransport } from "../src/externalSessions/copyRelay.js";
import { CopyFailure, inspectCopyReply, parseOpenCodeRef, validateCopyFork, type OpenCodeSnapshot } from "../src/externalSessions/opencodeCopy.js";
import type { ExternalProcessResult } from "../src/externalSessions/process.js";
import { dateNotice } from "./fixtures/external-sessions/opencode-date-notice.js";

const cwd = path.resolve(".");
const prompt = "Coordination exacte PR-123 ; aucun droit supplémentaire.";
const sourceId = "ses_SourceABC", copyId = "ses_CopyXYZ";
const cloned = <T>(value: T): T => structuredClone(value);

/** Source fictive terminée et explicitement sélectionnée. */
function source(): OpenCodeSnapshot {
  return {
    info: { id: sourceId, location: { directory: cwd }, agent: "build", model: { providerID: "fake", id: "test", variant: "high" },
      permissions: [{ action: "ask" }], outcome: "succeeded", time: { idle: 10 } },
    export: { info: { id: sourceId }, messages: [] }, instructions: [], inbox: [],
    context: [
      { id: "msg_u", type: "user", text: "Retenir un contexte fictif" },
      { id: "msg_a", type: "assistant", agent: "build", model: { providerID: "fake", id: "test", variant: "high" },
        content: [{ type: "text", text: "ACK" }], finish: "stop", time: { completed: 9 } },
      { id: "msg_i", type: "idle", outcome: "succeeded" }
    ]
  };
}

function copyOf(original: OpenCodeSnapshot): OpenCodeSnapshot {
  const copy = cloned(original); copy.info.id = copyId; copy.info.fork = { sessionID: sourceId };
  copy.context.forEach(m => { m.id = `${m.id}Copy`; }); return copy;
}

function answer(before: OpenCodeSnapshot): OpenCodeSnapshot {
  const after = cloned(before);
  after.context.push({ id: "msg_newU", type: "user", text: prompt },
    { id: "msg_newA", type: "assistant", agent: "build", model: cloned(before.info.model),
      content: [{ type: "tool", state: { status: "completed" }, name: "read" }, { type: "text", text: "  Avis fictif\n" }],
      finish: "stop", time: { completed: 20 } }, { id: "msg_newI", type: "idle", outcome: "succeeded" });
  return after;
}

const success: ExternalProcessResult = { started: true, exitCode: 0, signal: null, forcedReturn: false,
  stdout: JSON.stringify({ type: "text", sessionID: copyId }), stderr: "", outputBytes: 0, durationMs: 1 };

/** Un monde indépendant par test ; tous les effets sont comptés. */
function world() {
  const original = source(), before = copyOf(original);
  let after = before;
  const calls: string[] = [];
  const transport: CopyTransport = {
    async version() { calls.push("version"); return "2.0.32"; },
    async start() { calls.push("start"); },
    async snapshot(id) { calls.push(`snapshot:${id}`); return cloned(id === sourceId ? original : after); },
    async fork(id) { calls.push(`fork:${id}`); return { id: copyId }; },
    async run(id, body) { calls.push(`run:${id}`); assert.equal(body, prompt); after = answer(before); return cloned(success); },
    async interrupt(id) { calls.push(`interrupt:${id}`); },
    async stop() { calls.push("stop"); return { confirmed: true }; }
  };
  const run = (extra: Partial<Parameters<typeof runCopyRelay>[0]> = {}) => runCopyRelay({ source: sourceId, cwd, timeoutMs: 2000,
    envelope: () => prompt, ...extra }, { transport, platform: "win32", canonicalDirectory: async dir => dir });
  return { transport, original, before, calls, run, setAfter: (value: OpenCodeSnapshot) => { after = value; } };
}

test("ID OpenCode : casse conservée, UUID/Mission non élargis, chemins/contrôles/longueur refusés", () => {
  assert.deepEqual(parseOpenCodeRef("opencode:ses_SourceABC"), { ok: true, value: { agent: "opencode", sessionId: sourceId } });
  for (const value of ["opencode:../ses_test", "opencode:ses_a/b", "opencode:ses_a\n", "opencode:ses_", `opencode:ses_${"a".repeat(125)}`,
    "opencode:11111111-1111-4111-8111-111111111111", ":ses_test"]) assert.equal(parseOpenCodeRef(value).ok, false, value);
});

test("succès : un fork, un run dans la copie, réponse originale et modèle conservés", async () => {
  const w = world(), result = await w.run();
  assert.equal(result.outcome.status, "replied"); assert.equal(result.delivery.status, "replied");
  assert.equal(result.reply, "  Avis fictif\n"); assert.deepEqual(result.observedModels, ["fake/test#high"]);
  assert.equal(result.identity, "same-as-target"); assert.equal(result.copy.sourceCheck, "unchanged");
  assert.equal(result.copy.serverStop, "confirmed"); assert.equal(result.copy.retention, "retained");
  assert.equal(w.calls.filter(c => c.startsWith("fork:")).length, 1);
  assert.deepEqual(w.calls.filter(c => c.startsWith("run:")), [`run:${copyId}`]);
});

test("notice de date qualifiée avant l'enveloppe : réponse et délivrance, un seul envoi", async () => {
  const w = world(), run = w.transport.run;
  w.transport.run = async (...args) => {
    const result = await run(...args), after = answer(w.before);
    after.context.splice(w.before.context.length, 0, dateNotice()); w.setAfter(after);
    return result;
  };
  const result = await w.run();
  assert.equal(result.outcome.status, "replied"); assert.equal(result.delivery.status, "replied");
  assert.equal(result.reply, "  Avis fictif\n"); assert.equal(result.copy.sourceCheck, "unchanged");
  assert.deepEqual(w.calls.filter(c => c.startsWith("run:")), [`run:${copyId}`]);
});

test("notice de date : calendrier réel et jour de semaine, sans dépendre de la date du test", () => {
  const before = copyOf(source());
  for (const text of ["Today's date is now: Thu Oct 22 2026", "Today's date is now: Thu Feb 29 2024", "Today's date is now: Wed Jan 01 2025"]) {
    const after = answer(before); after.context.splice(before.context.length, 0, { ...dateNotice(), text });
    assert.equal(inspectCopyReply(before, after, prompt).reply, "  Avis fictif\n");
  }
});

test("notice non qualifiée après admission : copie et preuve conservées sans renvoi", async () => {
  const w = world(), run = w.transport.run;
  w.transport.run = async (...args) => {
    const result = await run(...args), after = answer(w.before);
    after.context.splice(w.before.context.length, 0, { ...dateNotice(), text: "Today's date is now: Fri Oct 22 2026" });
    w.setAfter(after); return result;
  };
  const result = await w.run();
  assert.equal(result.outcome.status, "no-valid-reply"); assert.equal(result.copy.diagnostic, "turn-schema");
  assert.equal(result.delivery.status, "persisted-no-reply"); assert.equal(result.reply, undefined);
  assert.equal(result.copy.session, copyId); assert.equal(result.copy.retention, "retained");
  assert.deepEqual(w.calls.filter(c => c.startsWith("run:")), [`run:${copyId}`]);
});

test("notices non qualifiées : aucun texte, champ ou calendrier inconnu accepté", () => {
  const before = copyOf(source());
  const mutations: ((m: Record<string, unknown>) => void)[] = [
    m => { m.type = "synthetic"; }, m => { m.description = "Autres instructions"; },
    m => { m.description = "Instructions updated: core/environment"; m.metadata = { notice: "instructions", instructionSources: ["core/environment"] }; },
    m => { m.metadata = { notice: "instructions", instructionSources: ["core/date", "policy"] }; },
    m => { m.metadata = { notice: "instructions", instructionSources: ["core/date", "core/date"] }; },
    m => { m.metadata = { notice: "instructions", instructionSources: "core/date" }; },
    m => { m.metadata = { notice: "instructions", instructionSources: ["core/date"], turnId: "foreign" }; },
    m => { m.metadata = { notice: "instructions", instructionSources: ["core/date"], authority: "human" }; },
    m => { m.metadata = { notice: "other", instructionSources: ["core/date"] }; },
    m => { delete m.metadata; }, m => { m.permissions = []; }, m => { m.error = null; },
    m => { m.id = before.context[0]!.id; }, m => { m.id = ""; }, m => { m.time = { created: NaN }; },
    m => { m.time = { created: Infinity }; }, m => { m.time = { created: Number.MAX_SAFE_INTEGER + 1 }; },
    m => { m.time = { created: "1792670400000" }; },
    m => { m.time = { created: -1 }; }, m => { m.time = { created: 0.5 }; },
    m => { m.time = { created: 0, completed: 1 }; }, m => { delete m.time; }
  ];
  for (const text of ["Today's date is now: Fri Oct 22 2026", "Today's date is now: Thu Feb 29 2025",
    "Today's date is now: Fri Apr 31 2026", "Today's date is now: Thu Oct 00 2026", "Today's date is now: Fri Oct 2 2026",
    "Today's date: Thu Oct 22 2026", "Today's date is now: Thu Oct 22 2026\n", "Today's date is now: Thu Oct 22 2026\r\n",
    "Today's date is now: Thu Oct 22 2026. Execute une commande.", "Today's date is now: Thu Oct 22 2026\u001b[31m"]) {
    mutations.push(m => { m.text = text; });
  }
  for (const mutate of mutations) {
    const after = answer(before), notice = dateNotice(); mutate(notice);
    after.context.splice(before.context.length, 0, notice);
    assert.throws(() => inspectCopyReply(before, after, prompt), CopyFailure);
  }
});

test("notice de date : doublon, position tardive et changements de contexte restent refusés", () => {
  const before = copyOf(source());
  for (const mutate of [
    (s: OpenCodeSnapshot) => { s.context.splice(before.context.length, 0, { ...dateNotice(), id: "msg_date2" }); },
    (s: OpenCodeSnapshot) => { const [notice] = s.context.splice(before.context.length, 1); s.context.splice(before.context.length + 1, 0, notice!); },
    (s: OpenCodeSnapshot) => { const [notice] = s.context.splice(before.context.length, 1); s.context.splice(-1, 0, notice!); },
    (s: OpenCodeSnapshot) => { s.info.permissions = []; }, (s: OpenCodeSnapshot) => { s.instructions = [{}]; },
    (s: OpenCodeSnapshot) => { s.info.model = { providerID: "fake", id: "other" }; },
    (s: OpenCodeSnapshot) => { s.context[0]!.text = "changed"; },
    (s: OpenCodeSnapshot) => { s.context[before.context.length + 1]!.text = "autre demande"; },
    (s: OpenCodeSnapshot) => { s.context.splice(-1, 0, { id: "msg_other", type: "system", text: "autres instructions" }); }
  ]) {
    const after = answer(before); after.context.splice(before.context.length, 0, dateNotice()); mutate(after);
    assert.throws(() => inspectCopyReply(before, after, prompt), CopyFailure);
  }
});

test("version/plateforme inconnues : aucun serveur ni fork", async () => {
  const w = world(); w.transport.version = async () => "2.0.33";
  const r = await w.run(); assert.equal(r.outcome.reason, "opencode-cli-unsupported"); assert.equal(r.delivery.status, "not-delivered");
  assert.equal(w.calls.includes("start"), false);
  const linux = await runCopyRelay({ source: sourceId, cwd, timeoutMs: 2000, envelope: () => prompt }, { transport: w.transport, platform: "linux" });
  assert.equal(linux.outcome.reason, "opencode-cli-unsupported");
});

test("source non admissible ou dossier différent : aucun fork ni run", async () => {
  for (const mutate of [
    (s: OpenCodeSnapshot) => { s.info.model = undefined; },
    (s: OpenCodeSnapshot) => { s.inbox = [{}]; },
    (s: OpenCodeSnapshot) => { s.info.location = { directory: path.resolve("other") }; },
    (s: OpenCodeSnapshot) => { s.context.push({ type: "compaction", id: "msg_c" }); }
  ]) {
    const w = world(); mutate(w.original); const r = await w.run();
    assert.notEqual(r.outcome.status, "replied"); assert.equal(r.delivery.status, "not-delivered");
    assert.equal(w.calls.some(c => c.startsWith("fork:") || c.startsWith("run:")), false);
  }
});

test("source changeante : arrêt avant fork", async () => {
  const w = world(), snapshot = w.transport.snapshot; let n = 0;
  w.transport.snapshot = async (id, signal) => { const s = await snapshot(id, signal); if (++n > 1) s.info.title = "changed"; return s; };
  const r = await w.run(); assert.equal(r.outcome.status, "target-state-unknown");
  assert.equal(w.calls.some(c => c.startsWith("fork:")), false);
});

test("fork reçu mais invalide : ID retenu sans aucune admission de message", async () => {
  const w = world(); w.before.info.model = { providerID: "fake", id: "other" };
  const r = await w.run(); assert.equal(r.copy.session, copyId); assert.equal(r.copy.verified, false);
  assert.equal(r.delivery.status, "not-delivered"); assert.equal(w.calls.some(c => c.startsWith("run:")), false);
  for (const key of ["agent", "model", "permissions", "location"]) {
    const changed = copyOf(source()); changed.info[key] = "changed";
    assert.throws(() => validateCopyFork(source(), changed, copyId), CopyFailure);
  }
});

test("POST fork incertain : jamais de second POST ni de recherche de copie", async () => {
  const w = world(); let n = 0;
  w.transport.fork = async () => { n++; throw Error("lost response / credential must not leak"); };
  const r = await w.run(); assert.equal(n, 1); assert.equal(r.copy.retention, "unknown"); assert.equal(r.copy.session, undefined);
  assert.equal(r.delivery.status, "not-delivered"); assert.equal(JSON.stringify(r).includes("credential"), false);
});

test("corrélation : nonce cité, corps altéré, concurrent, changement, erreur outil ou final partiel refusés", () => {
  const before = copyOf(source());
  for (const mutate of [
    (s: OpenCodeSnapshot) => { s.context[before.context.length]!.text = "Citation PR-123"; },
    (s: OpenCodeSnapshot) => { s.context.push({ id: "msg_concurrent", type: "user", text: "autre demande" }); },
    (s: OpenCodeSnapshot) => { s.context[0]!.text = "changed"; },
    (s: OpenCodeSnapshot) => { s.context.splice(-1, 0, { id: "msg_unknown", type: "unknown" }); },
    (s: OpenCodeSnapshot) => { s.context.splice(-1, 0, { id: "msg_switch", type: "model-switched", model: {} }); },
    (s: OpenCodeSnapshot) => { s.context[before.context.length + 1]!.finish = "length"; },
    (s: OpenCodeSnapshot) => { s.context.pop(); },
    (s: OpenCodeSnapshot) => { s.info.permissions = []; },
    (s: OpenCodeSnapshot) => { s.instructions = [{}]; },
    (s: OpenCodeSnapshot) => { s.context[before.context.length + 1]!.content = [{ type: "tool", state: { status: "error" } }]; }
  ]) { const after = answer(before); mutate(after); assert.throws(() => inspectCopyReply(before, after, prompt), CopyFailure); }
});

test("client en échec après admission : preuve exacte préservée, aucun retry", async () => {
  const w = world(), run = w.transport.run;
  w.transport.run = async (...args) => ({ ...await run(...args), exitCode: 1 });
  const r = await w.run(); assert.equal(r.outcome.status, "cli-failure"); assert.equal(r.delivery.status, "persisted-no-reply");
  assert.equal(r.reply, undefined); assert.equal(w.calls.filter(c => c.startsWith("run:")).length, 1);
});

test("contradictions client structurées : identité étrangère, erreur, flux inconnu ou vide", async () => {
  for (const [stdout, expected] of [
    [JSON.stringify({ type: "error", sessionID: "ses_Foreign", error: {} }), "identity-mismatch"],
    [JSON.stringify({ type: "error", sessionID: copyId, error: { message: "quota in prose" } }), "cli-failure"],
    [JSON.stringify({ type: "text", sessionID: copyId, part: { state: { status: "error" } } }), "cli-failure"],
    [JSON.stringify({ type: "unknown", sessionID: copyId }), "no-valid-reply"], ["", "no-valid-reply"], ["not-json", "no-valid-reply"]
  ]) {
    const w = world(), run = w.transport.run;
    w.transport.run = async (...args) => ({ ...await run(...args), stdout: stdout! });
    const r = await w.run(); assert.equal(r.outcome.status, expected); assert.equal(r.reply, undefined);
    assert.equal(r.delivery.status, "persisted-no-reply");
  }
});

test("réponse validée : erreurs finales de source ou arrêt ne l'effacent jamais", async () => {
  for (const fail of ["source", "stop", "throw"]) {
    const w = world(); let ran = false;
    const run = w.transport.run; w.transport.run = async (...args) => { const r = await run(...args); ran = true; return r; };
    const snapshot = w.transport.snapshot;
    if (fail === "source") w.transport.snapshot = async (id, signal) => { const s = await snapshot(id, signal); if (ran && id === sourceId) s.info.title = "changed"; return s; };
    else w.transport.stop = async () => { if (fail === "throw") throw Error("secret"); return { confirmed: false }; };
    const r = await w.run(); assert.equal(r.outcome.status, "cli-failure"); assert.equal(r.delivery.status, "replied");
    assert.equal(r.reply, "  Avis fictif\n"); assert.equal(r.copy.session, copyId);
  }
});

test("annulation avant lancement : aucun effet ; après admission : interruption de la copie et preuve conservée", async () => {
  const first = world(), early = new AbortController(); early.abort();
  const refused = await first.run({ signal: early.signal }); assert.equal(refused.outcome.status, "cancelled"); assert.deepEqual(first.calls, []);
  const w = world(), abort = new AbortController(), run = w.transport.run;
  w.transport.run = async (...args) => { const r = await run(...args); abort.abort(); return r; };
  const r = await w.run({ signal: abort.signal }); assert.equal(r.outcome.status, "cancelled");
  assert.equal(r.delivery.status, "persisted-no-reply"); assert.ok(w.calls.includes(`interrupt:${copyId}`));
  assert.equal(w.calls.includes(`interrupt:${sourceId}`), false);
});

test("lanceur qui lève après admission : preuve relue et conservée", async () => {
  const w = world(), run = w.transport.run;
  w.transport.run = async (...args) => { await run(...args); throw Error("unexpected exception"); };
  const r = await w.run(); assert.equal(r.delivery.status, "persisted-no-reply"); assert.equal(r.copy.session, copyId);
});

test("délai et plafond : causes primaires préservées, envoi unique", async () => {
  for (const reason of ["timeout", "output-too-large"] as const) {
    const w = world(), run = w.transport.run;
    w.transport.run = async (...args) => ({ ...await run(...args), stopReason: reason });
    const r = await w.run(); assert.equal(r.outcome.status, reason); assert.equal(r.delivery.status, "persisted-no-reply");
  }
  const w = world(); w.transport.version = signal => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Error()), { once: true }));
  const r = await w.run({ timeoutMs: 10 }); assert.equal(r.outcome.status, "timeout"); assert.equal(r.delivery.status, "not-delivered");
});

test("cause tardive au drainage : refus/annulation/délai primaires et preuves conservés", async () => {
  for (const primary of ["replied", "cancelled", "timeout", "output-too-large", "invalid-request"] as const) {
    const w = world(), run = w.transport.run, abort = new AbortController();
    w.transport.run = async (...args) => {
      const r = await run(...args);
      if (primary === "cancelled") abort.abort();
      if (primary === "timeout" || primary === "output-too-large") r.stopReason = primary;
      return r;
    };
    w.transport.stop = async () => ({ confirmed: true, failure: new CopyFailure("output-too-large", "server-output-limit") });
    const r = await w.run({ signal: abort.signal, ...(primary === "invalid-request" ? { envelope: () => "X".repeat(65537) } : {}) });
    assert.equal(r.outcome.status, primary === "replied" ? "output-too-large" : primary);
    assert.equal(r.copy.serverStop, "confirmed"); assert.equal(r.copy.session, copyId);
    assert.equal(r.delivery.status, primary === "replied" ? "replied" : primary === "invalid-request" ? "not-delivered" : "persisted-no-reply");
    if (primary === "replied") { assert.equal(r.reply, "  Avis fictif\n"); assert.equal(r.copy.diagnostic, "server-output-limit"); }
  }
});
