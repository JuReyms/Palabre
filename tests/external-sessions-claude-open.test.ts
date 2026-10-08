/**
 * @file Lecteur B2.1 (transcript Claude Code d'une conversation ouverte) : cas factices en mémoire
 * ou fichiers temporaires, et squelette anonymisé d'un transcript Claude desktop jetable. Aucun
 * envoi, aucun appel de modèle, aucune conversation réelle.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { appendFile, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureOpenBaseline, OPEN_READ_LIMITS, settleOpenDelivery, type OpenBaseline } from "../src/externalSessions/openReader.js";
import { captureOpenRollout, readOpenRollout } from "../src/externalSessions/openRollout.js";
import { inspectClaudeOpenReply as inspectWindow, isClaudeQueuedForm, type ClaudeOpenRequest } from "../src/externalSessions/claudeOpenReader.js";

const SESSION = "5e55a0b1-0000-4000-8000-000000000001";
const FOREIGN = "22222222-2222-4222-8222-222222222222";
const NONCE = "PR-0123456789abcdef";
const ENVELOPE = `[Message relayé par palabre relay · réf. ${NONCE}]\nDe : agent factice\n\nQuestion « citée », été & deuxième ligne.`;
const REPLY = "Réponse finale.\nÉté « intact ».";
type Row = Record<string, unknown>;
type Maker = (parent: string | null) => Row;

// Seulement pour les petits fixtures : le collecteur réel utilise des lectures positionnelles.
function baselineOf(text: string): OpenBaseline {
  const bytes = Buffer.from(text);
  return captureOpenBaseline({ bytes: bytes.length, firstLine: text.slice(0, text.indexOf("\n") + 1), witness: bytes.subarray(Math.max(0, bytes.length - OPEN_READ_LIMITS.witnessBytes)) });
}
function inspect(text: string, input: ClaudeOpenRequest) {
  const bytes = Buffer.from(text);
  return inspectWindow({ bytes: bytes.length, firstLine: text.slice(0, text.indexOf("\n") + 1), witness: bytes.subarray(Math.max(0, input.baseline.bytes - OPEN_READ_LIMITS.witnessBytes), input.baseline.bytes), added: bytes.subarray(input.baseline.bytes) }, input);
}
const lines = (rows: Row[]) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

let counter = 0;
const uid = () => `00000000-0000-4000-9000-${String(++counter).padStart(12, "0")}`;
/** Chaîne les entrées : chaque entrée chaînée devient le parent de la suivante. */
function chain(parent: string | null, makers: Maker[]): Row[] {
  const rows: Row[] = [];
  let current = parent;
  for (const make of makers) {
    const row = make(current);
    rows.push(row);
    if (typeof row.uuid === "string") current = row.uuid;
  }
  return rows;
}
const entry = (type: string, parent: string | null, extra: Row = {}): Row => ({ parentUuid: parent, isSidechain: false, type, uuid: uid(), sessionId: SESSION, ...extra });
// Formes relevées avec Claude Code 2.1.293 (Claude desktop), valeurs synthétiques.
function peer(options: { body?: string; promptId?: unknown; extra?: Row } = {}): Maker {
  const body = options.body ?? ENVELOPE;
  return (parent) => entry("user", parent, {
    promptId: "promptId" in options ? options.promptId : uid(), message: { role: "user", content: `<cross-session-message from="adresse-factice">\n${body}\n</cross-session-message>` },
    isMeta: true, permissionMode: "auto", origin: { kind: "peer", from: "adresse-factice", msg_id: "msg-factice", name: "pair-factice", fromMode: "auto", body },
    promptSource: "system", turnOrigin: "peer", turnPosition: { promptIndex: 1, turnIndex: 2 }, queueSkipAttachments: true, ...options.extra
  });
}
const human = (text = "Consigne humaine factice.", promptId: string = uid()): Maker => (parent) => entry("user", parent, {
  promptId, message: { role: "user", content: text }, permissionMode: "auto", origin: { kind: "human" }, promptSource: "sdk", turnOrigin: "human", turnPosition: { promptIndex: 1, turnIndex: 1 }
});
const text = (value: string) => ({ type: "text", text: value });
const thinking = { type: "thinking", thinking: "", signature: "signature-factice" };
const toolUse = (id: string) => ({ type: "tool_use", id, name: "Read", input: {} });
const assistant = (...content: Row[]): Maker => (parent) => entry("assistant", parent, {
  message: { role: "assistant", type: "message", id: "msg_factice", model: "claude-opus-5-5", stop_reason: content.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn", content }
});
function toolResult(ids: string[], promptId: () => unknown, extra: Row = {}, blocks?: Row[]): Maker {
  return (parent) => entry("user", parent, {
    promptId: promptId(), message: { role: "user", content: blocks ?? ids.map((id) => ({ type: "tool_result", tool_use_id: id, content: "Résultat factice.", is_error: false })) },
    sourceToolAssistantUUID: parent, ...extra
  });
}
const attachment = (type = "deferred_tools_delta"): Maker => (parent) => entry("attachment", parent, { attachment: { type } });
const stop = (extra: Row = {}): Maker => (parent) => entry("system", parent, {
  subtype: "stop_hook_summary", hookCount: 2, hookInfos: [], hookErrors: [], hookAdditionalContext: [], preventedContinuation: false, stopReason: "", hasOutput: false, level: "suggestion", ...extra
});
const queued = (body = ENVELOPE, mode = "auto"): Row => ({ type: "queue-operation", operation: "enqueue", sessionId: SESSION, content: `<cross-session-message from="adresse-factice" from-name="pair-factice" from-mode="${mode}">\n${body}\n</cross-session-message>` });
const dequeued: Row = { type: "queue-operation", operation: "dequeue", sessionId: SESSION };

// Référence : file, premier tour humain terminé (fin prouvée dans le témoin).
const humanTurn = chain(null, [human(), assistant(text("Réponse humaine factice.")), stop()]);
const prefix = lines([queued("Consigne humaine factice."), dequeued, ...humanTurn]);
const END = humanTurn.at(-1)!.uuid as string;
const request: ClaudeOpenRequest = { sessionId: SESSION, nonce: NONCE, envelope: ENVELOPE, baseline: baselineOf(prefix) };
const observe = (rows: Row[], input = request) => inspect(prefix + lines(rows), input);
/** Tour de pair simple (F1) : file, ancre, pièce jointe, réflexion, texte, fin. */
const simpleTurn = (parent = END, reply = REPLY) => [queued(), dequeued, ...chain(parent, [peer(), attachment(), assistant(thinking), assistant(text(reply)), stop()])];
/** Identifiant de tour de l'ancre, lu après construction (les résultats d'outils doivent le reprendre). */
function withAnchorPrompt(makers: (promptId: () => unknown) => Maker[], parent = END): Row[] {
  let anchor: Row | undefined;
  const rows = chain(parent, makers(() => anchor!.promptId).map((make, index) => index === 0 ? (p: string | null) => (anchor = make(p)) : make));
  return rows;
}

describe("B2.1 : tour de pair simple et tours successifs", () => {
  test("tour simple : réponse corrélée, réception, file et contexte relevés", () => {
    const result = observe(simpleTurn());
    assert.equal(result.status, "replied");
    assert.equal(result.reason, "correlated-final");
    assert.equal(result.reply, REPLY);
    assert.equal(result.persisted, true);
    assert.equal(result.queued, true);
    assert.match(result.promptId ?? "", /^[0-9a-f-]{36}$/);
    assert.deepEqual(result.context, { models: ["claude-opus-5-5"], permissionMode: "auto" });
    assert.deepEqual(settleOpenDelivery(result, true), { status: "replied", persisted: true, reply: REPLY });
  });
  test("tour suivant après la fin : hors segment, jamais une saisie concurrente", () => {
    const first = simpleTurn();
    const end = first.at(-1)!.uuid as string;
    const next = chain(end, [human("Nouvelle consigne humaine."), assistant(text("Autre réponse")), stop()]);
    const result = observe([...first, ...next, ...chain(next.at(-1)!.uuid as string, [peer({ body: "Autre pair" }), assistant(text("Encore une autre")), stop()])]);
    assert.equal(result.status, "replied");
    assert.equal(result.reply, REPLY);
  });
  test("tour suivant commencé mais pas terminé : la réponse déjà terminée reste corrélée", () => {
    const first = simpleTurn();
    assert.equal(observe([...first, ...chain(first.at(-1)!.uuid as string, [human(), assistant(thinking)])]).reply, REPLY);
  });
  test("deux tours de pair successifs : chacun corrélé à sa propre réponse", () => {
    const first = simpleTurn(END, "Première réponse");
    const second = simpleTurn(first.at(-1)!.uuid as string, "Seconde réponse");
    const before = prefix + lines(first);
    assert.equal(inspect(before + lines(second), { ...request, baseline: baselineOf(before) }).reply, "Seconde réponse");
  });
  test("tour humain commencé avant la référence, terminé après, puis notre tour : réponse corrélée", () => {
    const running = chain(END, [human("Consigne en cours.")]);
    const before = prefix + lines(running);
    const finish = chain(running.at(-1)!.uuid as string, [assistant(text("Réponse humaine.")), stop()]);
    const result = inspect(before + lines([...finish, ...simpleTurn(finish.at(-1)!.uuid as string)]), { ...request, baseline: baselineOf(before) });
    assert.equal(result.status, "replied");
    assert.equal(result.reply, REPLY);
  });
  test("texte final formé de plusieurs blocs, joints dans l'ordre", () => {
    const result = observe(chain(END, [peer(), assistant(text("Partie A")), assistant(thinking), assistant(text("Partie B"), text("Partie C")), stop()]));
    assert.equal(result.reply, "Partie A\nPartie B\nPartie C");
  });
  test("plusieurs blocs end_turn sans fin : on attend, sans se rabattre sur end_turn", () => {
    const result = observe(chain(END, [peer(), assistant(text("Un")), assistant(text("Deux"))]));
    assert.equal(result.status, "awaiting-reply");
    assert.equal(result.reason, "end-not-observed");
    assert.equal(result.reply, undefined);
    assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
  });
  test("texte final blanc : aucune réponse rendue", () => {
    assert.equal(observe(chain(END, [peer(), assistant(thinking), assistant(text("  \n")), stop()])).reason, "empty-final-text");
  });
});

describe("B2.1 : outils du tour", () => {
  test("tour avec outil (F2) : seul le texte après le dernier résultat est rendu", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(text("Commentaire avant outil"), toolUse("toolu_1")), toolResult(["toolu_1"], promptId), attachment(), assistant(text(REPLY)), stop()]);
    const result = observe(rows);
    assert.equal(result.status, "replied");
    assert.equal(result.reply, REPLY);
  });
  test("appel et texte dans des entrées séparées, deux outils successifs", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(text("Avant")), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId),
      assistant(toolUse("toolu_2")), toolResult(["toolu_2"], promptId), assistant(text(REPLY)), stop()]);
    assert.equal(observe(rows).reply, REPLY);
  });
  test("deux appels, un seul résultat, puis un texte et une fin : unresolved-tool-call", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1"), toolUse("toolu_2")), toolResult(["toolu_1"], promptId), assistant(text(REPLY)), stop()]);
    const result = observe(rows);
    assert.equal(result.status, "ambiguous");
    assert.equal(result.reason, "unresolved-tool-call");
    assert.equal(result.reply, undefined);
    assert.equal(result.persisted, true);
  });
  test("deux appels dans la même entrée, deux résultats liés : réponse corrélée", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1"), toolUse("toolu_2")), toolResult(["toolu_1", "toolu_2"], promptId), assistant(text(REPLY)), stop()]);
    assert.equal(observe(rows).reply, REPLY);
  });
  test("appel resté sans résultat avant la fin : unresolved-tool-call", () => {
    assert.equal(observe(withAnchorPrompt(() => [peer(), assistant(toolUse("toolu_1")), assistant(text(REPLY)), stop()])).reason, "unresolved-tool-call");
  });
  test("identifiant d'appel dupliqué : ambigu", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId), assistant(text(REPLY)), stop()]);
    assert.equal(observe(rows).reason, "duplicate-tool-call");
  });
  const invalid: Array<[string, (promptId: () => unknown) => Maker[]]> = [
    ["résultat consommé deux fois", (promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId), toolResult(["toolu_1"], promptId), assistant(text(REPLY)), stop()]],
    ["résultat orphelin", (promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_9"], promptId), assistant(text(REPLY)), stop()]],
    ["résultat au mauvais promptId", () => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], uid), assistant(text(REPLY)), stop()]],
    ["résultat sans promptId", () => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], () => undefined), assistant(text(REPLY)), stop()]],
    ["sourceToolAssistantUUID différent du parent", (promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId, { sourceToolAssistantUUID: uid() }), assistant(text(REPLY)), stop()]],
    ["blocs mêlés : résultat et consigne", (promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId, {}, [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }, text("Consigne glissée")]), assistant(text(REPLY)), stop()]],
    ["message humain pendant un appel d'outil", () => [peer(), assistant(toolUse("toolu_1")), human("Consigne pendant l'outil"), assistant(text(REPLY)), stop()]],
    ["injection entre deux appels d'outils", (promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId), human("Injection"), assistant(toolUse("toolu_2")), toolResult(["toolu_2"], promptId), assistant(text(REPLY)), stop()]],
    ["second pair dans le tour", () => [peer(), assistant(text("Début")), peer({ body: "Autre pair" }), assistant(text(REPLY)), stop()]]
  ];
  for (const [name, makers] of invalid) {
    test(`${name} : concurrent-input-in-turn, réception conservée`, () => {
      const result = observe(withAnchorPrompt(makers));
      assert.equal(result.status, "ambiguous");
      assert.equal(result.reason, "concurrent-input-in-turn");
      assert.equal(result.persisted, true);
      assert.equal(result.reply, undefined);
      assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
    });
  }
  test("résultat porteur d'une marque de tour : autre début de tour au même promptId, ambigu", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId, { turnOrigin: "human" }), assistant(text(REPLY)), stop()]);
    const result = observe(rows);
    assert.equal(result.reason, "duplicate-prompt-id");
    assert.equal(result.persisted, true);
  });
  test("résultat d'outil contenant le nonce : pas une altération de l'enveloppe", () => {
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId, {}, [{ type: "tool_result", tool_use_id: "toolu_1", content: `fichier lu : ${NONCE}` }]), assistant(text(REPLY)), stop()]);
    assert.equal(observe(rows).status, "replied");
  });
});

describe("B2.1 : réception conservée malgré un début de tour non prouvé", () => {
  const cases: Array<[string, () => Row[], string?]> = [
    ["parent en cours de tour (cible occupée)", () => chain(humanTurn[1]!.uuid as string, [peer(), assistant(text(REPLY)), stop()])],
    ["parent inconnu", () => chain(uid(), [peer(), assistant(text(REPLY)), stop()])],
    ["parent nul", () => chain(null, [peer(), assistant(text(REPLY)), stop()])],
    ["turnOrigin absent", () => chain(END, [peer({ extra: { turnOrigin: undefined } }), assistant(text(REPLY)), stop()])],
    ["promptIndex différent de 1", () => chain(END, [peer({ extra: { turnPosition: { promptIndex: 2, turnIndex: 2 } } }), assistant(text(REPLY)), stop()])],
    ["parent égal à une fin en erreur", () => { const bad = chain(END, [human(), assistant(text("x")), stop({ hookErrors: ["échec"] })]); return [...bad, ...chain(bad.at(-1)!.uuid as string, [peer(), assistant(text(REPLY)), stop()])]; }]
  ];
  for (const [name, rows] of cases) {
    test(`${name} : turn-start-not-proven, persisted-no-reply`, () => {
      const result = observe(rows());
      assert.equal(result.status, "ambiguous");
      assert.equal(result.reason, "turn-start-not-proven");
      assert.equal(result.persisted, true);
      assert.equal(result.reply, undefined);
      assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
    });
  }
  test("tour humain en cours à la référence, message mêlé au tour : jamais de réponse", () => {
    const running = chain(END, [human("Consigne en cours."), assistant(toolUse("toolu_1"))]);
    const before = prefix + lines(running);
    const result = inspect(before + lines(chain(running.at(-1)!.uuid as string, [peer(), assistant(text("Réponse au tour humain")), stop()])), { ...request, baseline: baselineOf(before) });
    assert.equal(result.reason, "turn-start-not-proven");
    assert.equal(result.persisted, true);
  });
  test("témoin trop court pour lire la fin précédente : prudence, réception conservée", () => {
    const longEnd = chain(END, [human(), assistant(text("x")), stop({ padding: "x".repeat(OPEN_READ_LIMITS.witnessBytes + 10) })]);
    const before = prefix + lines(longEnd);
    const result = inspect(before + lines(chain(longEnd.at(-1)!.uuid as string, [peer(), assistant(text(REPLY)), stop()])), { ...request, baseline: baselineOf(before) });
    assert.equal(result.reason, "turn-start-not-proven");
    assert.equal(result.persisted, true);
  });
});

describe("B2.1 : promptId de l'ancre", () => {
  test("promptId absent ou hors format UUID : invalid-prompt-id", () => {
    for (const promptId of [undefined, "", "pas-un-uuid", 42]) {
      const result = observe(chain(END, [peer({ promptId }), assistant(text(REPLY)), stop()]));
      assert.equal(result.reason, "invalid-prompt-id", String(promptId));
      assert.equal(result.persisted, true);
    }
  });
  test("promptId déjà porté par un début de tour du témoin : duplicate-prompt-id", () => {
    const seen = humanTurn[0]!.promptId;
    assert.equal(observe(chain(END, [peer({ promptId: seen }), assistant(text(REPLY)), stop()])).reason, "duplicate-prompt-id");
  });
  test("promptId déjà porté par un autre début de tour de l'ajout : duplicate-prompt-id", () => {
    const promptId = uid();
    const other = chain(END, [human("Autre", promptId), assistant(text("x")), stop()]);
    assert.equal(observe([...other, ...chain(other.at(-1)!.uuid as string, [peer({ promptId }), assistant(text(REPLY)), stop()])]).reason, "duplicate-prompt-id");
  });
  test("l'ancre n'est comparée qu'aux autres débuts de tour, jamais à elle-même", () => {
    // Le promptId repris par les résultats d'outils n'est pas non plus un début de tour.
    const rows = withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId), assistant(text(REPLY)), stop()]);
    assert.equal(observe(rows).status, "replied");
  });
});

describe("B2.1 : formes inconnues, fins et chaîne", () => {
  test("type chaîné inconnu dans le segment : unknown-entry-in-turn", () => {
    assert.equal(observe(chain(END, [peer(), (parent) => entry("progress", parent), assistant(text(REPLY)), stop()])).reason, "unknown-entry-in-turn");
  });
  test("pièce jointe d'un type non relevé : jamais assimilée à une annexe", () => {
    assert.equal(observe(chain(END, [peer(), attachment("queued_command"), assistant(text(REPLY)), stop()])).reason, "unknown-entry-in-turn");
  });
  test("bloc assistant inconnu : unknown-entry-in-turn", () => {
    assert.equal(observe(chain(END, [peer(), assistant({ type: "image" }), assistant(text(REPLY)), stop()])).reason, "unknown-entry-in-turn");
  });
  test("entrée de branche latérale dans le segment : unknown-entry-in-turn", () => {
    assert.equal(observe(chain(END, [peer(), (parent) => ({ ...assistant(text("x"))(parent), isSidechain: true }), assistant(text(REPLY)), stop()])).reason, "unknown-entry-in-turn");
  });
  const terminals: Array<[string, Row]> = [
    ["continuation empêchée", { preventedContinuation: true }],
    ["erreurs de hook", { hookErrors: ["échec"] }],
    ["sous-type system inconnu", { subtype: "turn_duration" }]
  ];
  for (const [name, extra] of terminals) {
    test(`fin inconnue (${name}) : unknown-terminal, jamais de lecture au-delà`, () => {
      const result = observe(chain(END, [peer(), assistant(text(REPLY)), stop(extra), assistant(text("Texte plus loin")), stop()]));
      assert.equal(result.status, "ambiguous");
      assert.equal(result.reason, "unknown-terminal");
      assert.equal(result.reply, undefined);
    });
  }
  test("pièce jointe entre la dernière réponse et la fin : forme admise", () => {
    // Relevé : la fin du premier tour humain du transcript jetable a une pièce jointe pour parent.
    assert.equal(observe(chain(END, [peer(), assistant(text(REPLY)), attachment("total_tokens_reminder"), stop()])).reply, REPLY);
  });
  test("fin directement après un résultat d'outil : unknown-terminal", () => {
    assert.equal(observe(withAnchorPrompt((promptId) => [peer(), assistant(toolUse("toolu_1")), toolResult(["toolu_1"], promptId), stop()])).reason, "unknown-terminal");
  });
  test("erreur d'assistant synthétique (hypothèse défensive) : failed, réception conservée", () => {
    const result = observe(chain(END, [peer(), (parent) => ({ ...assistant(text("API Error"))(parent), isApiErrorMessage: true }), stop()]));
    assert.equal(result.status, "failed");
    assert.equal(result.reason, "assistant-error");
    assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
  });
  test("branches concurrentes : deux enfants d'une même entrée du segment", () => {
    const rows = chain(END, [peer(), assistant(text("Début"))]);
    const branch = chain(rows.at(-1)!.uuid as string, [human("Branche réécrite")]);
    assert.equal(observe([...rows, ...chain(rows.at(-1)!.uuid as string, [assistant(text(REPLY)), stop()]), ...branch]).reason, "concurrent-branch");
  });
  test("deux tours ouverts depuis la même fin : concurrent-branch", () => {
    assert.equal(observe([...chain(END, [human("Concurrent")]), ...chain(END, [peer(), assistant(text(REPLY)), stop()])]).reason, "concurrent-branch");
  });
  test("compaction ou lien rompu après l'ancre, sans fin : broken-chain", () => {
    const rows = chain(END, [peer(), assistant(thinking)]);
    const compacted = chain(null, [(parent) => entry("system", parent, { subtype: "compact_boundary" }), assistant(text(REPLY)), stop()]);
    assert.equal(observe([...rows, ...compacted]).reason, "broken-chain");
  });
  test("lien rompu entre l'ancre et la fin : broken-chain", () => {
    const head = chain(END, [peer(), assistant(thinking)]);
    const orphan = chain(uid(), [assistant(text("Orphelin"))]);
    assert.equal(observe([...head, ...orphan, ...chain(head.at(-1)!.uuid as string, [assistant(text(REPLY)), stop()])]).reason, "broken-chain");
  });
  test("uuid dupliqué dans le segment : duplicate-uuid", () => {
    const rows = chain(END, [peer(), assistant(text(REPLY)), stop()]);
    assert.equal(observe([...rows, { ...rows[1]!, parentUuid: rows.at(-1)!.uuid }]).reason, "duplicate-uuid");
  });
  test("enfant écrit avant son parent : invalid-chain-order", () => {
    const rows = chain(END, [peer(), assistant(text(REPLY)), stop()]);
    assert.equal(observe([rows[1]!, rows[0]!, rows[2]!]).reason, "invalid-chain-order");
  });
});

describe("B2.1 : contrôles globaux de l'ajout", () => {
  test("autre identité dans l'ajout : identity-mismatch", () => {
    const rows = simpleTurn();
    assert.equal(observe([...rows, { type: "last-prompt", sessionId: FOREIGN }]).reason, "identity-mismatch");
  });
  test("première ligne d'une autre conversation : identity-mismatch", () => {
    const other = prefix.replace(SESSION, FOREIGN);
    assert.equal(inspect(other + lines(simpleTurn()), { ...request, baseline: baselineOf(other) }).reason, "identity-mismatch");
  });
  test("entrées sans sessionId (instantané de fichiers) : admises hors segment", () => {
    assert.equal(observe([{ type: "file-history-snapshot", messageId: uid(), isSnapshotUpdate: false }, ...simpleTurn()]).status, "replied");
  });
  test("nonce cité dans un corps de pair modifié, sans ancre exacte : envelope-altered", () => {
    const result = observe(chain(END, [peer({ body: `${ENVELOPE}\nAjout` }), assistant(text(REPLY)), stop()]));
    assert.equal(result.status, "ambiguous");
    assert.equal(result.reason, "envelope-altered");
    assert.equal(result.persisted, "unknown");
    assert.equal(settleOpenDelivery(result, true).status, "unknown");
  });
  test("nonce cité par un message humain, ancre exacte présente : envelope-altered, réception conservée", () => {
    const first = simpleTurn();
    const result = observe([...first, ...chain(first.at(-1)!.uuid as string, [human(`As-tu reçu ${NONCE} ?`)])]);
    assert.equal(result.reason, "envelope-altered");
    assert.equal(result.persisted, true);
  });
  test("doublon de l'enveloppe exacte : duplicate-envelope", () => {
    const first = simpleTurn();
    const result = observe([...first, ...chain(first.at(-1)!.uuid as string, [peer(), assistant(text(REPLY)), stop()])]);
    assert.equal(result.reason, "duplicate-envelope");
    assert.equal(result.persisted, true);
  });
  test("ancre d'une branche latérale : pas une réception", () => {
    const result = observe(chain(END, [peer({ extra: { isSidechain: true } })]));
    assert.equal(result.reason, "envelope-altered");
    assert.equal(result.persisted, "unknown");
  });
  test("ligne terminée corrompue : invalid-json-line ; ligne partielle : attente", () => {
    assert.equal(inspect(prefix + "{corrompu\n", request).reason, "invalid-json-line");
    assert.equal(inspect(prefix + lines(simpleTurn()).slice(0, -20), request).status, "awaiting-reply");
  });
  test("témoin modifié : history-replaced", () => {
    const changed = prefix.replace("Réponse humaine factice.", "Réponse humaine modifiée");
    assert.equal(inspect(changed + lines(simpleTurn()), request).reason, "history-replaced");
  });
  test("requête invalide : sessionId hors format ou nonce absent de l'enveloppe", () => {
    assert.equal(observe(simpleTurn(), { ...request, sessionId: "pas-un-uuid" }).reason, "invalid-request");
    assert.equal(observe(simpleTurn(), { ...request, nonce: "PR-absent" }).reason, "invalid-request");
  });
});

describe("B2.1 : forme de file, diagnostic seulement", () => {
  test("file exacte sans ancre : queued, persisted false, délivrance inconnue", () => {
    const result = observe([queued()]);
    assert.equal(result.status, "awaiting-message");
    assert.equal(result.queued, true);
    assert.equal(result.persisted, false);
    assert.equal(settleOpenDelivery(result, true).status, "unknown");
  });
  test("message retenu dans la file, puis nouveau tour : réponse corrélée", () => {
    const pending = [queued()];
    assert.equal(observe(pending).status, "awaiting-message");
    const result = observe([...pending, dequeued, ...chain(END, [peer(), assistant(text(REPLY)), stop()])]);
    assert.equal(result.status, "replied");
    assert.equal(result.queued, true);
  });
  test("aucune file observée : queued false, la réponse reste corrélée", () => {
    const result = observe(chain(END, [peer(), assistant(text(REPLY)), stop()]));
    assert.equal(result.queued, false);
    assert.equal(result.status, "replied");
  });
  const form = (body: string) => `<cross-session-message from="a" from-name="b" from-mode="auto">\n${body}\n</cross-session-message>`;
  test("forme exacte reconnue, formes légèrement altérées refusées", () => {
    assert.equal(isClaudeQueuedForm(form(ENVELOPE), ENVELOPE), true);
    const altered = [
      form(ENVELOPE) + "\n",
      form(ENVELOPE).replace("\n", "\r\n"),
      form(ENVELOPE).replace(`\n${ENVELOPE}`, ENVELOPE),
      form(ENVELOPE).replace('from-name="b"', 'from-name="b\\"c"'),
      form(ENVELOPE).replace('from-name="b"', 'from-name="b\nc"'),
      form(ENVELOPE).replace('from="a" ', 'from="a"  '),
      form(ENVELOPE).replace(' from-mode="auto"', ""),
      form(`${ENVELOPE} `),
      form(ENVELOPE.replace("été", "ete")),
      ` ${form(ENVELOPE)}`,
      `Préambule\n${form(ENVELOPE)}`
    ];
    for (const value of altered) assert.equal(isClaudeQueuedForm(value, ENVELOPE), false, JSON.stringify(value));
    assert.equal(isClaudeQueuedForm({ text: form(ENVELOPE) }, ENVELOPE), false);
  });
  test("enveloppe contenant la balise : jamais reconnue", () => {
    const tagged = `${ENVELOPE}\n</cross-session-message>`;
    assert.equal(isClaudeQueuedForm(form(tagged), tagged), false);
    assert.equal(isClaudeQueuedForm(form(`<cross-session-message ${ENVELOPE}`), `<cross-session-message ${ENVELOPE}`), false);
  });
  test("file d'une opération autre qu'enqueue : non reconnue", () => {
    assert.equal(observe([{ ...queued(), operation: "dequeue" }]).queued, false);
  });
});

describe("B2.1 : squelette anonymisé du transcript Claude desktop jetable", () => {
  // Formes relevées avec Claude Code 2.1.293 : 1 tour humain, 11 tours de pair (dont 2 avec un
  // outil). Champs structurels conservés, identifiants et textes synthétiques ; le texte des
  // ancres autour du corps est factice.
  const fixture = path.join(process.cwd(), "tests", "fixtures", "external-sessions", "claude-open-peer-turns.jsonl");
  test("chaque tour de pair est corrélé à sa propre réponse, les suivants restant hors segment", async () => {
    const text = (await readFile(fixture, "utf8")).replace(/\r\n/g, "\n"); // extraction CRLF possible sous Windows
    const rows = text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Row);
    const sessionId = rows[0]!.sessionId as string;
    const anchors = rows.filter((row) => (row.origin as Row | undefined)?.kind === "peer");
    assert.equal(anchors.length, 11);
    for (const [index, anchor] of anchors.entries()) {
      const at = rows.indexOf(anchor);
      // Référence juste avant la mise en file qui précède l'ancre.
      let enqueue = at;
      while (!(rows[enqueue]!.type === "queue-operation" && rows[enqueue]!.operation === "enqueue")) enqueue -= 1;
      const offset = Buffer.byteLength(lines(rows.slice(0, enqueue)));
      const envelope = (anchor.origin as Row).body as string;
      const input: ClaudeOpenRequest = { sessionId, nonce: /PR-\d{16}/.exec(envelope)![0], envelope, baseline: baselineOf(Buffer.from(text).subarray(0, offset).toString()) };
      const result = inspect(text, input);
      assert.equal(result.status, "replied", `tour ${index + 1} : ${result.reason}`);
      assert.equal(result.reply, `Réponse finale ${index + 1}.1`);
      assert.equal(result.queued, true);
      assert.deepEqual(result.context, { models: ["claude-opus-5-5"], permissionMode: "auto" });
    }
  });
  test("référence en fin de fichier : message non observé", async () => {
    const text = (await readFile(fixture, "utf8")).replace(/\r\n/g, "\n"); // extraction CRLF possible sous Windows
    const sessionId = (JSON.parse(text.slice(0, text.indexOf("\n"))) as Row).sessionId as string;
    const envelope = `[Message relayé par palabre relay · réf. ${NONCE}]`;
    assert.equal(inspect(text, { sessionId, nonce: NONCE, envelope, baseline: baselineOf(text) }).status, "awaiting-message");
  });
});

describe("B2.1 : lectures bornées sur fichiers factices", () => {
  async function temporary(run: (filename: string) => Promise<void>) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "palabre-b2-"));
    try { await run(path.join(directory, `${SESSION}.jsonl`)); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
  test("transcript de 151 Mio : identité, témoin et ajout seulement, réponse corrélée", async () => {
    await temporary(async (filename) => {
      const size = 151 * 1024 * 1024;
      const first = lines([queued("Consigne humaine factice.")]);
      const tail = "\n" + lines([dequeued, ...humanTurn]);
      const file = await open(filename, "w");
      try {
        await file.write(Buffer.from(first), 0, Buffer.byteLength(first), 0);
        await file.truncate(size);
        await file.write(Buffer.from(tail), 0, Buffer.byteLength(tail), size - Buffer.byteLength(tail));
      } finally { await file.close(); }
      const baseline = await captureOpenRollout(filename);
      assert.equal(baseline.bytes, size);
      await appendFile(filename, lines(simpleTurn()));
      const snapshot = await readOpenRollout(filename, baseline);
      assert.equal(snapshot.witness.byteLength, OPEN_READ_LIMITS.witnessBytes);
      const result = inspectWindow(snapshot, { ...request, baseline });
      assert.equal(result.status, "replied");
      assert.equal(result.reply, REPLY);
    });
  });
  test("réception, puis réponse, observées par deux lectures après le même offset", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix);
      const baseline = await captureOpenRollout(filename);
      const turn = chain(END, [peer(), assistant(thinking), assistant(text(REPLY)), stop()]);
      await appendFile(filename, lines([queued(), dequeued, ...turn.slice(0, 2)]));
      const pending = inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline });
      assert.equal(pending.status, "awaiting-reply");
      assert.equal(pending.persisted, true);
      await appendFile(filename, lines(turn.slice(2)));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).reply, REPLY);
    });
  });
});
