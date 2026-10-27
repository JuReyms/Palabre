/**
 * @file Lecteurs Relay sur un historique Codex découpé en segments : localisation, dernières
 * permissions et quota, attente `--open` avec un segment créé pendant l'attente, reprise avant la
 * référence, `--then-follow` et `--follow` au-delà d'une coupure, reprise fermée (Relay A) et
 * `relay --check --open` de bout en bout. Profils et historiques factices, dépôt et verrou simulés :
 * aucun Codex réel, aucun envoi.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { executeRelay, renderRelayText } from "../src/commands/relay.js";
import { trustConfig } from "../src/configTrust.js";
import { CodexSessionAdapter } from "../src/externalSessions/codex.js";
import { buildOpenEnvelope } from "../src/externalSessions/envelope.js";
import { runFollowRelay, runOpenRelay, type OpenRelayDeps, type OpenRelayInput } from "../src/externalSessions/openRelay.js";
import { captureOpenRollout, locateOpenRollout, readLastCodexQuota, readLastTurnContext, readOpenRollout, type CodexHistoryScope, type OpenFile } from "../src/externalSessions/openRollout.js";
import { open } from "node:fs/promises";
import type { ExternalProcessResult } from "../src/externalSessions/process.js";
import { createTranslator } from "../src/i18n.js";
import { relayMessages } from "../src/messages/relay.js";
import { appendSegmentRows, writeRoot, writeSegment, type Row, type SegmentFile } from "./fixtures/external-sessions/codex-segments.js";
import { quotaEvent } from "./fixtures/external-sessions/quota.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-open-segments-"));
after(() => rmSync(root, { recursive: true, force: true }));
const THREAD = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const SEG1 = "0199bbbb-0000-7000-8000-000000000001";
const SEG2 = "0199bbbb-0000-7000-8000-000000000002";
const NONCE = "PR-0123456789abcdef";
const ENVELOPE = buildOpenEnvelope({ from: { agent: "claude", sessionId: THREAD }, to: { agent: "codex", sessionId: THREAD }, nonce: NONCE, message: "Question factice", subject: "Essai" }, relayMessages.fr);
let counter = 0;
const newHome = () => path.join(root, `home-${++counter}`);

const event = (type: string, turn: string, extra: Row = {}): Row => ({ type: "event_msg", payload: { type, turn_id: turn, ...extra } });
const context = (turn: string, approval = "never", sandbox = "read-only"): Row =>
  ({ type: "turn_context", payload: { turn_id: turn, model: "gpt-fake", approval_policy: approval, sandbox_policy: { type: sandbox, network_access: false } } });
const user = (text: string): Row => ({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
const item = (type: string, text: string, turn: string, phase?: string): Row =>
  ({ type: "event_msg", payload: { type: "item_completed", thread_id: THREAD, turn_id: turn, item: { type, content: [{ type: "text", text }], ...(phase ? { phase } : {}) } } });
const turn = (id: string, message: string, reply: string, approval?: string, sandbox?: string): Row[] => [
  event("task_started", id), context(id, approval, sandbox), user(message), item("UserMessage", message, id),
  item("AgentMessage", reply, id, "final_answer"), event("task_complete", id, { last_agent_message: reply })
];
const relayed = (reply = "Réponse factice."): Row[] => turn("relayed", ENVELOPE, reply);
const aborted = (id: string): Row[] => [event("task_started", id), context(id), user("Saisie interrompue"), event("turn_aborted", id)];

const queued = (): ExternalProcessResult => ({
  started: true, pid: 42, exitCode: 0, signal: null, forcedReturn: false,
  stdout: `Queued message item-1 for thread ${THREAD}.\n`, stderr: "", outputBytes: 0, durationMs: 1
});

/** Dépendances simulées, lectures réelles sur la chaîne de la portée. */
function harness(scope: CodexHistoryScope, options: { onRun?: () => void; onRead?: (index: number) => void; openFile?: OpenFile } = {}) {
  const clock = { now: 0 };
  const calls = { run: 0, read: 0 };
  const deps: OpenRelayDeps = {
    probe: () => ({ attachment: "attached", activity: "unknown", processes: [], evidence: [] }),
    capture: (file) => captureOpenRollout(file, undefined, scope),
    read: async (file, baseline) => { options.onRead?.(calls.read++); return readOpenRollout(file, baseline, options.openFile, scope); },
    run: async () => { calls.run += 1; options.onRun?.(); return queued(); },
    now: () => clock.now,
    sleep: async (ms, signal) => { if (!signal.aborted) clock.now += ms; }
  };
  return { deps, calls };
}

function input(historyPath: string, fields: Partial<OpenRelayInput> = {}): OpenRelayInput {
  return {
    executable: { command: "C:\\outils\\node.exe", prefixArgs: ["C:\\outils\\codex.js"] },
    sessionId: THREAD, cwd: root, historyPath, envelope: ENVELOPE, nonce: NONCE,
    timeoutMs: 10_000, signal: new AbortController().signal, ...fields
  };
}

/** Racine avec un tour terminé, puis un segment repris à sa fin : forme la plus courante. */
function twoSegments(home: string) {
  const first = writeRoot(home, THREAD, root, [...turn("a", "Bonjour", "Salut", "on-request", "workspace-write"), ...aborted("b")], { paginated: true });
  const cut = first.nextOrdinal - 4;
  const second = writeSegment(home, THREAD, root, first, SEG1, cut, turn("c", "Suite", "Suite faite", "never", "danger-full-access"));
  return { first, second };
}

describe("lecteurs sur segments : localisation, permissions, quota", () => {
  test("locate : tête de chaîne, jamais l'ancien fichier figé", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const located = await locateOpenRollout(home, THREAD);
    assert.deepEqual(located, { status: "found", historyPath: second.path, cwd: root });
  });

  test("locate : chaîne cassée refusée et nommée", async () => {
    const home = newHome();
    const { first } = twoSegments(home);
    writeSegment(home, THREAD, root, first, SEG2, first.nextOrdinal - 4, []);
    const located = await locateOpenRollout(home, THREAD);
    assert.equal(located.status, "session-not-found");
    assert.equal("history" in located ? located.history : undefined, "fork");
  });

  test("dernières permissions : celles de la tête, pas celles de l'ancien fichier", async () => {
    const home = newHome();
    twoSegments(home);
    const last = await readLastTurnContext({ home, sessionId: THREAD });
    assert.deepEqual(last?.context, { model: "gpt-fake", approvalPolicy: "never", sandbox: "danger-full-access", network: "restricted" });
  });

  test("tête sans relevé : partie active du fichier précédent, jamais sa fin abandonnée", async () => {
    const home = newHome();
    const first = writeRoot(home, THREAD, root, [...turn("a", "Bonjour", "Salut", "on-request", "workspace-write"), ...aborted("b")], { paginated: true });
    writeSegment(home, THREAD, root, first, SEG1, first.nextOrdinal - 4, []);
    const last = await readLastTurnContext({ home, sessionId: THREAD });
    assert.equal(last?.context.sandbox, "workspace-write", "le turn_context du tour interrompu (read-only) est abandonné");
  });

  test("quota : relevé de la partie active ; une chaîne refusée donne un quota absent", async () => {
    const home = newHome();
    const first = writeRoot(home, THREAD, root, [quotaEvent, ...aborted("b")], { paginated: true });
    writeSegment(home, THREAD, root, first, SEG1, first.nextOrdinal - 4, []);
    assert.equal((await readLastCodexQuota({ home, sessionId: THREAD }))?.primary.usedPercent, 52);
    writeSegment(home, THREAD, root, first, SEG2, first.nextOrdinal - 4, []);
    assert.equal(await readLastCodexQuota({ home, sessionId: THREAD }), undefined);
  });
});

describe("--open sur segments : rotation pendant l'attente", () => {
  test("réponse écrite dans un segment créé après le dépôt : replied, un seul dépôt", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const scope = { home, sessionId: THREAD };
    let third: SegmentFile | undefined;
    const h = harness(scope, { onRun: () => {
      // Un tour en cours est interrompu puis repris : la fin de l'ancrage est abandonnée.
      appendSegmentRows(second, aborted("x"));
      third = writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal - 4, relayed());
    } });
    const result = await runOpenRelay(input(second.path), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.reply, "Réponse factice.");
    assert.equal(result.delivery.status, "replied");
    assert.equal(h.calls.run, 1);
    assert.ok(third);
  });

  test("segment dont la première ligne s'écrit encore : ignoré, puis suivi à la lecture suivante", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const scope = { home, sessionId: THREAD };
    const cut = second.nextOrdinal;
    const h = harness(scope, {
      onRun: () => { writeSegment(home, THREAD, root, second, SEG2, cut, [], { header: '{"ordinal":' }); },
      onRead: (index) => { if (index === 2) writeSegment(home, THREAD, root, second, SEG2, cut, relayed()); }
    });
    const result = await runOpenRelay(input(second.path), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.ok(h.calls.read >= 3);
  });

  test("historique repris avant la référence : refus clair, aucune réponse devinée", async () => {
    const home = newHome();
    const first = writeRoot(home, THREAD, root, turn("a", "Bonjour", "Salut"), { paginated: true });
    // Un tour humain est en cours au moment de la référence.
    appendSegmentRows(first, [event("task_started", "human"), context("human"), user("Saisie")]);
    const humanStart = first.nextOrdinal - 3;
    const h = harness({ home, sessionId: THREAD }, { onRun: () => {
      appendSegmentRows(first, [event("turn_aborted", "human")]);
      writeSegment(home, THREAD, root, first, SEG1, humanStart, relayed());
    } });
    const result = await runOpenRelay(input(first.path), h.deps);
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.diagnostic, "history-rewound");
    assert.equal(result.reply, undefined);
    assert.equal(result.delivery.status, "unknown", "message déposé : jamais not-delivered");
    assert.equal(h.calls.run, 1);
  });

  test("embranchement apparu pendant l'attente : refus, jamais le segment le plus récent", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const h = harness({ home, sessionId: THREAD }, { onRun: () => {
      writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal, relayed(), { day: "28" });
      writeSegment(home, THREAD, root, second, "0199bbbb-0000-7000-8000-000000000003", second.nextOrdinal, relayed("Autre"), { day: "29" });
    } });
    const result = await runOpenRelay(input(second.path), h.deps);
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.diagnostic, "history-fork");
    assert.equal(result.reply, undefined);
  });

  test("ancre qui n'est plus la tête au moment de la référence : refus avant tout dépôt", async () => {
    const home = newHome();
    const { first } = twoSegments(home);
    const h = harness({ home, sessionId: THREAD });
    const result = await runOpenRelay(input(first.path), h.deps);
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.diagnostic, "reference-history-rotated");
    assert.equal(result.delivery.status, "not-delivered");
    assert.equal(h.calls.run, 0);
  });

  test("--then-follow : réponse dans l'ancrage, suite dans un nouveau segment", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const h = harness({ home, sessionId: THREAD }, { onRun: () => {
      appendSegmentRows(second, relayed());
      writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal, turn("next", "Validation", "Suite validée"));
    } });
    const result = await runOpenRelay(input(second.path, { thenFollowMs: 10_000 }), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.nextTurn?.status, "followed");
    assert.equal(result.nextTurn?.reply, "Suite validée");
  });

  test("--then-follow : réponse et suite toutes deux dans le nouveau segment", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const h = harness({ home, sessionId: THREAD }, { onRun: () => {
      writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal, [...relayed(), ...turn("next", "Validation", "Suite validée")]);
    } });
    const result = await runOpenRelay(input(second.path, { thenFollowMs: 10_000 }), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.nextTurn?.reply, "Suite validée");
  });

  test("--follow seul : premier tour terminé dans un segment créé pendant le suivi", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const h = harness({ home, sessionId: THREAD }, { onRead: (index) => {
      if (index === 1) writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal, turn("app", "Depuis l'app", "Fait dans l'app"));
    } });
    const followed = await runFollowRelay({ sessionId: THREAD, historyPath: second.path, timeoutMs: 10_000, signal: new AbortController().signal }, h.deps);
    assert.equal(followed.outcome.status, "followed");
    assert.equal(followed.reply, "Fait dans l'app");
  });
});

describe("--open sur segments : régressions de la relecture de la PR", () => {
  test("coupure avant la référence --then-follow, témoin identique : history-rewound, jamais followed", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    // Réponse de plus de 64 Kio : le témoin ne contient que la fin de last_agent_message.
    const big = "R".repeat(70_000);
    let third: SegmentFile | undefined;
    const h = harness({ home, sessionId: THREAD }, {
      onRun: () => { third = writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal, relayed(big)); },
      onRead: (index) => {
        if (index !== 1 || !third) return;
        // Un nouveau segment coupe juste avant la fin du tour et la remplace par une ligne de même
        // longueur attribuée à un autre tour, puis un tour suivant se termine.
        const completion = third.nextOrdinal - 1;
        assert.equal(String(completion).length, String(completion + 1).length, "ordinal de même longueur");
        writeSegment(home, THREAD, root, third, "0199bbbb-0000-7000-8000-000000000003", completion, [
          event("task_complete", "relayer", { last_agent_message: big }), ...turn("next", "Validation", "Suite validée")
        ]);
      }
    });
    const result = await runOpenRelay(input(second.path, { thenFollowMs: 10_000 }), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.reply, big);
    assert.equal(result.nextTurn?.status, "no-valid-reply");
    assert.equal(result.nextTurn?.reason, "history-rewound");
    assert.equal(result.nextTurn?.reply, undefined);
  });

  test("réponse complète dans l'ancienne tête pendant qu'un segment s'écrit : aucune conclusion, puis abandon respecté", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const relayStart = second.nextOrdinal;
    const h = harness({ home, sessionId: THREAD }, {
      onRun: () => {
        appendSegmentRows(second, relayed());
        writeSegment(home, THREAD, root, second, SEG2, relayStart, [], { header: '{"ordinal":' });
      },
      // Le segment complété coupe avant le tour relayé : sa réponse est abandonnée.
      onRead: (index) => { if (index === 3) writeSegment(home, THREAD, root, second, SEG2, relayStart, turn("autre", "Autre saisie", "Autre réponse")); }
    });
    const result = await runOpenRelay(input(second.path, { timeoutMs: 5_000 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.reply, undefined);
    assert.equal(result.correlation?.reason, "envelope-not-observed");
  });

  test("segment en cours d'écriture jusqu'à l'échéance : timeout avec diagnostic history-rotating", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const h = harness({ home, sessionId: THREAD }, { onRun: () => {
      appendSegmentRows(second, relayed());
      writeSegment(home, THREAD, root, second, SEG2, second.nextOrdinal - 6, [], { header: '{"ordinal":' });
    } });
    const result = await runOpenRelay(input(second.path, { timeoutMs: 3_000 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.reply, undefined);
    assert.equal(result.diagnostic, "history-rotating");
    assert.match(createTranslator("fr").relay.historyChain.changed, /Vérifiez la conversation/);
  });

  test("segment complet apparu pendant une lecture : la lecture n'est pas conclue", async () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const relayStart = second.nextOrdinal;
    let opens = 0;
    let armed = false;
    // Simule la course : la chaîne change entre la résolution et la fin de la lecture.
    const racing: OpenFile = async (name, flags) => {
      if (armed && ++opens === 2) writeSegment(home, THREAD, root, second, SEG2, relayStart, turn("autre", "Autre saisie", "Autre réponse"));
      return open(name, flags);
    };
    const h = harness({ home, sessionId: THREAD }, { openFile: racing, onRun: () => { appendSegmentRows(second, relayed()); armed = true; } });
    const result = await runOpenRelay(input(second.path, { timeoutMs: 3_000 }), h.deps);
    assert.notEqual(result.outcome.status, "replied");
    assert.equal(result.reply, undefined);
  });
});

describe("reprise fermée (Relay A) sur segments", () => {
  test("locate : tête, dossier et modèle du dernier tour actif", () => {
    const home = newHome();
    const { second } = twoSegments(home);
    const located = new CodexSessionAdapter({ home }).locate({ agent: "codex", sessionId: THREAD });
    assert.equal(located.status, "found");
    if (located.status !== "found") return;
    assert.equal(located.historyPath, second.path);
    assert.equal(located.target.model, "gpt-fake");
    assert.equal(located.target.cwd, root);
  });

  test("findNonce : partie active, fin abandonnée, absence", () => {
    const home = newHome();
    const first = writeRoot(home, THREAD, root, [...turn("a", "Bonjour", "Salut"), event("task_started", "r"), user(`Relais ${NONCE}`), event("turn_aborted", "r")], { paginated: true });
    const cut = first.nextOrdinal - 3;
    const target = { agent: "codex", provider: "codex" as const, sessionId: THREAD, cwd: root };
    const adapter = new CodexSessionAdapter({ home });
    assert.deepEqual(adapter.findNonce(target, NONCE).persisted, true, "fichier seul : actif");
    const second = writeSegment(home, THREAD, root, first, SEG1, cut, turn("c", "Suite", "Suite faite"));
    const abandoned = adapter.findNonce(target, NONCE);
    assert.equal(abandoned.persisted, true);
    assert.equal(abandoned.inActiveBranch, false, "nonce seulement dans la fin abandonnée");
    appendSegmentRows(second, [user(`Relais ${NONCE}`)]);
    assert.equal(adapter.findNonce(target, NONCE).inActiveBranch, true);
    assert.equal(adapter.findNonce(target, "PR-ffffffffffffffff").persisted, false);
  });

  test("chaîne refusée : session-not-found nommée, nonce inconnu", () => {
    const home = newHome();
    const { first } = twoSegments(home);
    writeSegment(home, THREAD, root, first, SEG2, first.nextOrdinal - 4, []);
    const adapter = new CodexSessionAdapter({ home });
    const located = adapter.locate({ agent: "codex", sessionId: THREAD });
    assert.equal(located.status, "session-not-found");
    assert.equal("history" in located ? located.history : undefined, "fork");
    assert.equal(adapter.findNonce({ agent: "codex", provider: "codex", sessionId: THREAD, cwd: root }, NONCE).persisted, "unknown");
  });
});

describe("relay --check --open de bout en bout sur segments", () => {
  async function world(t: import("node:test").TestContext) {
    const profile = path.join(root, `profile-${++counter}`);
    mkdirSync(profile, { recursive: true });
    t.mock.method(os, "homedir", () => profile);
    const exe = process.platform === "win32" ? "codex.exe" : "codex";
    writeFileSync(path.join(profile, exe), "", { mode: 0o755 });
    const file = path.join(profile, "palabre.config.json");
    await writeFile(file, JSON.stringify({ language: "fr", agents: { codex: { type: "cli", command: path.join(profile, exe) } } }));
    await trustConfig(file);
    t.mock.method(CodexSessionAdapter.prototype, "probe", () => ({ attachment: "attached", activity: "unknown", processes: [], evidence: [] }));
    return { profile, file, home: path.join(profile, ".codex") };
  }

  test("permissions relevées dans la tête, pas dans le fichier figé", async (t) => {
    const w = await world(t);
    twoSegments(w.home);
    const result = await executeRelay(["relay", "--check", "--open", "--config", w.file, "--to", `codex:${THREAD}`]);
    assert.equal(result.status, "checked");
    assert.deepEqual(result.check?.lastPermissions, { approvalPolicy: "never", sandbox: "danger-full-access", network: "restricted" });
  });

  test("chaîne ambiguë : session-not-found, message clair fr et en, rien d'envoyé", async (t) => {
    const w = await world(t);
    const { first } = twoSegments(w.home);
    writeSegment(w.home, THREAD, root, first, SEG2, first.nextOrdinal - 4, []);
    const result = await executeRelay(["relay", "--check", "--open", "--config", w.file, "--to", `codex:${THREAD}`]);
    assert.equal(result.status, "session-not-found");
    assert.equal(result.exitCode, 6);
    assert.equal(result.delivery.status, "not-delivered");
    assert.match(result.error?.message ?? "", /plusieurs fichiers.*\(fork\).*Rien n'a été envoyé/);
    assert.match(renderRelayText(result, createTranslator("fr")).stderr, /\(fork\)/);
    assert.match(createTranslator("en").relay.historyChain.refused("fork"), /several files.*Nothing was sent/);
  });
});
