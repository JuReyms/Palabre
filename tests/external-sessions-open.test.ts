/** @file Cas factices B1, en mémoire ou fichiers temporaires : aucun appel d'agent réel. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mkdtemp, open, appendFile, writeFile, rm, truncate } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureOpenBaseline as captureReference, inspectOpenReply as inspectWindow, OPEN_READ_LIMITS, settleOpenDelivery, type OpenRequest, type OpenBaseline } from "../src/externalSessions/openReader.js";
import { captureOpenRollout, readOpenRollout } from "../src/externalSessions/openRollout.js";

// Seulement pour les petits fixtures : le collecteur réel ci-dessus utilise des lectures
// positionnelles. Cette conversion ne fait pas partie de l'API du prototype.
function captureOpenBaseline(snapshot: string): OpenBaseline {
  const bytes = Buffer.from(snapshot);
  return captureReference({ bytes: bytes.length, firstLine: snapshot.slice(0, snapshot.indexOf("\n") + 1), witness: bytes.subarray(Math.max(0, bytes.length - OPEN_READ_LIMITS.witnessBytes)) });
}
function inspectOpenReply(snapshot: string, input: OpenRequest) {
  const bytes = Buffer.from(snapshot);
  return inspectWindow({ bytes: bytes.length, firstLine: snapshot.slice(0, snapshot.indexOf("\n") + 1), witness: bytes.subarray(Math.max(0, input.baseline.bytes - OPEN_READ_LIMITS.witnessBytes), input.baseline.bytes), added: bytes.subarray(input.baseline.bytes) }, input);
}

const THREAD = "11111111-1111-4111-8111-111111111111";
const FOREIGN = "22222222-2222-4222-8222-222222222222";
const NONCE = "PR-0123456789abcdef";
const ENVELOPE = `[Message relayé par palabre relay · réf. ${NONCE}]\nDe : agent factice\n\nSujet « cité », été & deuxième ligne.\nRéponds simplement.`;
type Row = Record<string, unknown>;
const meta: Row = { type: "session_meta", payload: { id: THREAD } };
const lines = (rows: Row[]) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
const prefix = lines([meta]);
const request: OpenRequest = { threadId: THREAD, nonce: NONCE, envelope: ENVELOPE, baseline: captureOpenBaseline(prefix) };
function user(envelope = ENVELOPE): Row {
  return { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: envelope }] } };
}
function item(type: string, turnId: string, text: string, phase?: string, threadId = THREAD): Row {
  return { type: "event_msg", payload: { type: "item_completed", thread_id: threadId, turn_id: turnId, item: { type, content: [{ type: type === "AgentMessage" ? "Text" : "text", text }], ...(phase ? { phase } : {}) } } };
}
const bound = (turnId = "turn-a", envelope = ENVELOPE) => item("UserMessage", turnId, envelope);
const started = (turnId = "turn-a"): Row => ({ type: "event_msg", payload: { type: "task_started", turn_id: turnId } });
const final = (turnId = "turn-a", reply = "Réponse finale.\nÉté « intact »." ) => item("AgentMessage", turnId, reply, "final_answer");
function complete(turnId = "turn-a", reply = "Réponse finale.\nÉté « intact »." ): Row {
  return { type: "event_msg", payload: { type: "task_complete", turn_id: turnId, last_agent_message: reply } };
}
const observe = (rows: Row[], input = request) => inspectOpenReply(prefix + lines([started(), ...rows]), input);
const success = () => [user(), bound(), final(), complete()];

describe("B1 : le tour doit commencer après la référence", () => {
  test("régression : un tour humain en cours avant dépôt ne donne aucun replied", () => {
    const before = prefix + lines([started(), user("Consigne humaine"), bound("turn-a", "Consigne humaine")]);
    const input = { ...request, baseline: captureOpenBaseline(before) };
    const result = inspectOpenReply(before + lines([user(), bound(), final("turn-a", "Réponse humaine"), complete("turn-a", "Réponse humaine")]), input);
    assert.equal(result.status, "ambiguous");
    assert.equal(result.reason, "turn-start-not-observed-after-baseline");
    assert.equal(result.persisted, true);
    assert.equal(result.reply, undefined);
    assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
  });
  test("un ancien tour terminé puis un nouveau tour identifié donnent la bonne réponse", () => {
    const before = prefix + lines([started("old"), user("Consigne humaine"), bound("old", "Consigne humaine"), final("old", "Ancienne réponse"), complete("old", "Ancienne réponse")]);
    assert.equal(inspectOpenReply(before + lines([started(), ...success()]), { ...request, baseline: captureOpenBaseline(before) }).status, "replied");
  });
  test("début manquant, même avec une réponse finale cohérente", () => {
    assert.equal(inspectOpenReply(prefix + lines(success()), request).reason, "turn-start-not-observed-after-baseline");
  });
  test("le début d'un autre tour ne suffit pas", () => {
    assert.equal(inspectOpenReply(prefix + lines([started("other"), ...success()]), request).status, "ambiguous");
  });
  test("début écrit après le message utilisateur", () => {
    assert.equal(inspectOpenReply(prefix + lines([user(), started(), bound(), final(), complete()]), request).reason, "invalid-event-order");
  });
  test("deux débuts du même tour interdisent un succès", () => {
    assert.equal(observe([started(), ...success()]).reason, "duplicate-turn-start");
  });
  test("environment_context antérieur à la référence n'est pas une saisie concurrente", () => {
    const before = prefix + lines([user("<environment_context>ancien dossier</environment_context>")]);
    assert.equal(inspectOpenReply(before + lines([started(), ...success()]), { ...request, baseline: captureOpenBaseline(before) }).status, "replied");
  });
  for (const beforeRelay of [true, false]) {
    test(`environment_context pendant le tour, ${beforeRelay ? "avant" : "après"} le relay : ambiguïté prudente`, () => {
      const context = user("<environment_context>nouveau dossier</environment_context>");
      const rows = beforeRelay ? [context, ...success()] : [user(), bound(), context, final(), complete()];
      assert.equal(observe(rows).reason, "unbound-concurrent-user");
    });
  }
  // Forme observée avec Codex desktop 0.160.1 au premier tour après un changement de permissions.
  function environmentContext(turnId = "turn-a", kinds: unknown = ["environments.environment_context"], text = "<environment_context>\n  <cwd>C:\\factice</cwd>\n</environment_context>"): Row {
    const row = user(text);
    (row.payload as Row).internal_chat_message_metadata_passthrough = { turn_id: turnId, create_time: 1, content_item_kinds: kinds };
    return row;
  }
  test("environment_context avec la métadonnée du tour, avant le relay : réponse corrélée", () => {
    const result = observe([environmentContext(), ...success()]);
    assert.equal(result.status, "replied");
    assert.equal(result.reply, "Réponse finale.\nÉté « intact ».");
  });
  const rejected: Array<[string, () => Row[]]> = [
    ["après le relay", () => [user(), bound(), environmentContext(), final(), complete()]],
    ["métadonnée d'un autre tour", () => [environmentContext("turn-other"), ...success()]],
    ["métadonnée absente", () => { const row = environmentContext(); delete (row.payload as Row).internal_chat_message_metadata_passthrough; return [row, ...success()]; }],
    ["types de contenu mêlés", () => [environmentContext("turn-a", ["plugins.recommendations", "environments.environment_context"]), ...success()]],
    ["type de contenu différent", () => [environmentContext("turn-a", ["user.text"]), ...success()]],
    ["texte hors du bloc", () => [environmentContext("turn-a", undefined, "<environment_context></environment_context>\nAutre consigne"), ...success()]],
    ["deux blocs", () => [environmentContext("turn-a", undefined, "<environment_context>a</environment_context><environment_context>b</environment_context>"), ...success()]],
    ["deux parties", () => { const row = environmentContext(); ((row.payload as Row).content as Row[]).push({ type: "input_text", text: "suite" }); return [row, ...success()]; }],
    ["lié à un UserMessage du même tour", () => { const row = environmentContext(); const text = (((row.payload as Row).content as Row[])[0]!).text as string; return [row, bound("turn-a", text), ...success()]; }]
  ];
  const limited: Array<[string, string, () => Row[]]> = [
    ["nonce de la demande dans le contexte", "nonce-in-environment-context",
      () => [environmentContext("turn-a", undefined, `<environment_context>\n  <note>${NONCE}</note>\n</environment_context>`), ...success()]],
    ["contextes dupliqués", "multiple-environment-contexts", () => [environmentContext(), environmentContext(), ...success()]],
    ["contextes distincts", "multiple-environment-contexts",
      () => [environmentContext(), environmentContext("turn-a", undefined, "<environment_context>\n  <cwd>C:\\autre</cwd>\n</environment_context>"), ...success()]]
  ];
  for (const [label, reason, rows] of limited) {
    test(`environment_context refusé (${label}) : ambigu, sans réponse, réception conservée`, () => {
      const result = observe(rows());
      assert.deepEqual(result, { status: "ambiguous", persisted: true, reason, turnId: "turn-a" });
      assert.deepEqual(settleOpenDelivery(result, true), { status: "persisted-no-reply", persisted: true });
    });
  }
  for (const [label, rows] of rejected) {
    test(`environment_context refusé (${label}) : ambiguïté prudente`, () => {
      const result = observe(rows());
      assert.equal(result.status, "ambiguous");
      assert.equal(result.reply, undefined);
    });
  }
  for (const beforeRelay of [true, false]) {
    test(`message developer pendant le tour, ${beforeRelay ? "avant" : "après"} le relay : aucune saisie concurrente`, () => {
      const context = user("<environment_context>nouveau dossier</environment_context>");
      (context.payload as Row).role = "developer";
      const rows = beforeRelay ? [context, ...success()] : [user(), bound(), context, final(), complete()];
      const result = observe(rows);
      assert.equal(result.status, "replied");
      assert.equal(result.reply, "Réponse finale.\nÉté « intact ».");
    });
  }
  test("le nonce dans un message developer ne prouve pas la réception du relay", () => {
    const context = user(ENVELOPE);
    (context.payload as Row).role = "developer";
    const result = observe([context, final(), complete()]);
    assert.equal(result.status, "awaiting-message");
    assert.equal(result.persisted, false);
    assert.equal(result.reply, undefined);
    assert.equal(settleOpenDelivery(result, true).status, "unknown");
  });
  for (const changed of [ENVELOPE.replaceAll("\n", "\r\n"), ENVELOPE.replace("De :", "De  :"), ENVELOPE.slice(0, -10)]) {
    test("enveloppe modifiée avec nonce : diagnostic explicite, sans preuve ni réponse", () => {
      const result = observe([user(changed), bound("turn-a", changed), final(), complete()]);
      assert.equal(result.reason, "envelope-altered");
      assert.equal(result.persisted, "unknown");
      assert.equal(settleOpenDelivery(result, true).status, "unknown");
      assert.equal(result.reply, undefined);
    });
  }
});

describe("B1 : réponse finale liée au bon tour", () => {
  test("réponse finale exacte, Unicode et lignes multiples conservés", () => {
    const result = observe(success());
    assert.deepEqual(result, { status: "replied", persisted: true, reason: "correlated-final", turnId: "turn-a", reply: "Réponse finale.\nÉté « intact »." });
    assert.deepEqual(settleOpenDelivery(result, true), { status: "replied", persisted: true, reply: result.reply });
  });
  test("un commentaire préalable n'est pas la réponse", () => {
    const result = observe([user(), bound(), item("AgentMessage", "turn-a", "Analyse en cours", "commentary"), final(), complete()]);
    assert.equal(result.reply, "Réponse finale.\nÉté « intact ».");
  });
  test("un commentaire sans réponse finale ne devient pas un succès", () => {
    assert.equal(observe([user(), bound(), item("AgentMessage", "turn-a", "Analyse en cours", "commentary"), complete("turn-a", "Analyse en cours")]).status, "awaiting-reply");
  });
  test("deux relays dans des tours distincts, même entrelacés, gardent leurs réponses", () => {
    const otherNonce = "PR-fedcba9876543210";
    const otherEnvelope = ENVELOPE.replace(NONCE, otherNonce);
    const rows = [user(), bound(), started("turn-b"), user(otherEnvelope), bound("turn-b", otherEnvelope), final("turn-b", "Réponse B"), complete("turn-b", "Réponse B"), final(), complete()];
    assert.equal(observe(rows).reply, "Réponse finale.\nÉté « intact ».");
    assert.equal(observe(rows, { ...request, nonce: otherNonce, envelope: otherEnvelope }).reply, "Réponse B");
  });
  test("la fin d'un autre tour ne termine pas le relay", () => {
    const result = observe([user(), bound(), final(), complete("turn-other")]);
    assert.equal(result.status, "awaiting-reply");
    assert.equal(result.reply, undefined);
  });
  test("la réponse d'un autre tour ne termine pas le relay", () => {
    assert.equal(observe([user(), bound(), final("turn-other"), complete()]).status, "awaiting-reply");
  });
  test("une erreur du tour cible interdit un succès même avec du texte", () => {
    const result = observe([...success(), { type: "event_msg", payload: { type: "error", turn_id: "turn-a", message: "quota" } }]);
    assert.equal(result.status, "failed");
    assert.equal(result.reply, undefined);
  });
  for (const type of ["turn_aborted", "task_cancelled", "task_failed"]) {
    test(`${type} du tour cible conserve seulement la preuve de réception`, () => {
      const result = observe([user(), bound(), final(), { type: "event_msg", payload: { type, turn_id: "turn-a" } }]);
      assert.equal(result.status, "failed");
      assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
    });
  }
  // Forme observée avec Codex 0.151.0 quand le modèle est refusé par le compte.
  function completeWithError(turnId = "turn-a", reply: string | null = null): Row {
    return { type: "event_msg", payload: { type: "task_complete", turn_id: turnId, last_agent_message: reply, error: { message: "modèle refusé", codex_error_info: "other" } } };
  }
  test("task_complete avec error et sans réponse finale : échec, preuve de réception conservée", () => {
    const result = observe([user(), bound(), completeWithError()]);
    assert.deepEqual(result, { status: "failed", persisted: true, reason: "completion-error", turnId: "turn-a" });
    assert.deepEqual(settleOpenDelivery(result, true), { status: "persisted-no-reply", persisted: true });
  });
  test("task_complete avec error et texte final identique : pas de faux succès", () => {
    const result = observe([user(), bound(), final(), completeWithError("turn-a", "Réponse finale.\nÉté « intact »." )]);
    assert.equal(result.status, "failed");
    assert.equal(result.reason, "completion-error");
    assert.equal(result.reply, undefined);
  });
  test("task_complete avec error d'un autre tour : la réponse corrélée reste valable", () => {
    assert.equal(observe([...success(), completeWithError("turn-other")]).status, "replied");
  });
  test("task_complete avec error: null n'est pas un échec", () => {
    const row = complete();
    (row.payload as Row).error = null;
    assert.equal(observe([user(), bound(), final(), row]).status, "replied");
  });
  test("une erreur d'un autre tour ne remplace pas une réponse corrélée", () => {
    assert.equal(observe([...success(), { type: "event_msg", payload: { type: "error", turn_id: "turn-other" } }]).status, "replied");
  });
  test("erreur sans turn_id et sans terminaison valide : attendre, pas inventer un échec corrélé", () => {
    const result = observe([user(), bound(), { type: "event_msg", payload: { type: "error", message: "forme non vérifiée" } }]);
    assert.equal(result.status, "awaiting-reply");
    assert.equal(settleOpenDelivery(result, true).status, "persisted-no-reply");
    assert.equal(result.reply, undefined);
  });
});

describe("B1 : ambiguïtés, pas de réponse attribuée au hasard", () => {
  test("enveloppe présente mais événement d'identification absent", () => {
    const result = observe([user(), final(), complete()]);
    assert.equal(result.status, "awaiting-reply");
    assert.equal(result.persisted, true);
  });
  test("deux occurrences neuves de la même enveloppe", () => {
    assert.equal(observe([user(), user(), bound(), final(), complete()]).reason, "duplicate-envelope");
  });
  test("deux identifications de tour pour la même enveloppe", () => {
    assert.equal(observe([user(), bound(), bound("turn-b"), final(), complete()]).reason, "duplicate-turn-binding");
  });
  test("message relayé mêlé à une saisie humaine dans le même tour", () => {
    const result = observe([user(), bound(), user("Autre consigne"), bound("turn-a", "Autre consigne"), final(), complete()]);
    assert.equal(result.reason, "multiple-users-in-turn");
    assert.equal(result.reply, undefined);
  });
  test("un second utilisateur dans un autre tour après la réponse est indépendant", () => {
    assert.equal(observe([...success(), user("Autre consigne"), bound("turn-b", "Autre consigne")]).status, "replied");
  });
  test("saisie concurrente sans identification de tour", () => {
    const result = observe([user(), bound(), user("Autre consigne"), final(), complete()]);
    assert.equal(result.reason, "unbound-concurrent-user");
    assert.equal(result.reply, undefined);
  });
  test("saisie concurrente avec un contenu inconnu", () => {
    const extra = user("Autre consigne");
    (extra.payload as Row).content = [{ type: "image", image_url: "factice" }];
    assert.equal(observe([user(), bound(), extra, final(), complete()]).reason, "unbound-concurrent-user");
  });
  test("liaison de la saisie concurrente arrivée après la terminaison", () => {
    assert.equal(observe([user(), bound(), user("Autre consigne"), final(), complete(), bound("turn-b", "Autre consigne")]).reason, "unbound-concurrent-user");
  });
  test("identification du relay avant sa présence dans l'historique", () => {
    assert.equal(observe([bound(), user(), final(), complete()]).reason, "invalid-event-order");
  });
  test("réponse finale sans identité de conversation", () => {
    const row = final();
    delete (row.payload as Row).thread_id;
    assert.equal(observe([user(), bound(), row, complete()]).reason, "unidentified-final-thread");
  });
  test("une réponse contenant une partie non textuelle reste ambiguë", () => {
    const row = final();
    ((row.payload as Row).item as Row).content = [{ type: "Text", text: "Réponse" }, { type: "image" }];
    assert.equal(observe([user(), bound(), row, complete("turn-a", "Réponse")]).reason, "completion-text-mismatch");
  });
  test("l'événement lié au nonce annonce une autre conversation", () => {
    const result = observe([user(), item("UserMessage", "turn-a", ENVELOPE, undefined, FOREIGN), final(), complete()]);
    assert.equal(result.reason, "invalid-turn-binding");
  });
  test("l'événement n'annonce aucun tour", () => {
    const row = bound();
    delete (row.payload as Row).turn_id;
    assert.equal(observe([user(), row, final(), complete()]).reason, "invalid-turn-binding");
  });
  test("événement d'une autre conversation avec le même identifiant de tour", () => {
    assert.equal(observe([user(), bound(), item("AgentMessage", "turn-a", "Autre réponse", "final_answer", FOREIGN), complete()]).reason, "foreign-thread-event");
  });
  test("deux réponses finales, pas de sélection de la première ou dernière", () => {
    assert.equal(observe([user(), bound(), final(), final("turn-a", "Encore une réponse"), complete()]).status, "ambiguous");
  });
  test("deux terminaisons du même tour", () => {
    assert.equal(observe([...success(), complete()]).status, "ambiguous");
  });
  test("texte final différent du texte de terminaison", () => {
    assert.equal(observe([user(), bound(), final(), complete("turn-a", "Autre texte")]).reason, "completion-text-mismatch");
  });
  test("réponse vide", () => {
    assert.equal(observe([user(), bound(), final("turn-a", "  "), complete("turn-a", "  ")]).status, "ambiguous");
  });
  test("terminaison non réussie", () => {
    const row = complete();
    (row.payload as Row).status = "failed";
    assert.equal(observe([user(), bound(), final(), row]).status, "failed");
  });
  test("terminaison avant la réponse finale", () => {
    assert.equal(observe([user(), bound(), complete(), final()]).reason, "invalid-event-order");
  });
  test("réponse finale avant l'identification de l'utilisateur", () => {
    assert.equal(observe([user(), final(), bound(), complete()]).reason, "invalid-event-order");
  });
  test("l'ancien algorithme accepte ce faux positif, le prototype n'attribue rien", () => {
    const rows: Row[] = [
      { type: "event_msg", payload: { type: "user_message", message: ENVELOPE } },
      { type: "event_msg", payload: { type: "agent_message", message: "Analyse en cours" } },
      { type: "event_msg", payload: { type: "user_message", message: "Autre question" } },
      complete("turn-other", "Autre réponse")
    ];
    const oldAlgorithm = rows.find((row) => (row.payload as Row).type === "agent_message")?.payload as Row;
    assert.equal(oldAlgorithm.message, "Analyse en cours");
    const result = observe(rows);
    assert.notEqual(result.status, "replied");
    assert.equal(result.reply, undefined);
    assert.equal(settleOpenDelivery(result, true).status, "unknown");
  });
});

describe("B1 : instantanés et preuve de réception", () => {
  test("la mention du nonce par l'assistant seul ne prouve pas la réception", () => {
    assert.equal(observe([final("turn-a", ENVELOPE), complete("turn-a", ENVELOPE)]).status, "awaiting-message");
  });
  test("la présence du nonce dans un texte utilisateur différent reste incertaine", () => {
    const result = observe([user("Citation : " + ENVELOPE), bound("turn-a", "Citation : " + ENVELOPE), final(), complete()]);
    assert.equal(result.reason, "envelope-altered");
    assert.equal(result.persisted, "unknown");
    assert.equal(result.reply, undefined);
  });
  test("une ancienne occurrence avant le dépôt n'est pas une réception nouvelle", () => {
    const old = prefix + lines(success());
    const result = inspectOpenReply(old, { ...request, baseline: captureOpenBaseline(old) });
    assert.equal(result.status, "awaiting-message");
  });
  test("une ligne utilisateur encore partielle n'est pas analysée", () => {
    const tail = JSON.stringify(user()).slice(0, -2);
    assert.equal(inspectOpenReply(prefix + tail, request).status, "awaiting-message");
  });
  test("la terminaison complète attend sa fin de ligne", () => {
    const head = prefix + lines([started(), user(), bound(), final()]);
    const tail = JSON.stringify(complete());
    assert.equal(inspectOpenReply(head + tail, request).status, "awaiting-reply");
    assert.equal(inspectOpenReply(head + tail + "\n", request).status, "replied");
  });
  test("la référence avant dépôt refuse une ligne incomplète", () => {
    assert.throws(() => captureOpenBaseline(prefix.slice(0, -1)), /baseline-incomplete/);
  });
  test("ligne JSON terminée mais invalide", () => {
    assert.equal(inspectOpenReply(prefix + "{corrompu}\n", request).reason, "invalid-json-line");
  });
  test("ligne JSON scalaire", () => {
    assert.equal(inspectOpenReply(prefix + "42\n", request).reason, "invalid-record");
  });
  test("préfixe remplacé, même si le nonce réapparaît ensuite", () => {
    const result = inspectOpenReply(prefix.trimEnd() + " \n" + lines(success()), request);
    assert.equal(result.reason, "history-replaced");
    assert.equal(result.persisted, "unknown");
  });
  test("historique tronqué", () => {
    assert.equal(inspectOpenReply("", request).reason, "history-replaced");
  });
  test("UTF-8 dans le préfixe : position en octets et non en caractères", () => {
    const head = lines([meta, { type: "test_metadata", text: "Été « é »" }]);
    assert.equal(inspectOpenReply(head + lines([started(), ...success()]), { ...request, baseline: captureOpenBaseline(head) }).status, "replied");
  });
  test("CRLF dans le préfixe et le nouveau tour", () => {
    const head = prefix.replaceAll("\n", "\r\n");
    assert.equal(inspectOpenReply(head + lines([started(), ...success()]).replaceAll("\n", "\r\n"), { ...request, baseline: captureOpenBaseline(head) }).status, "replied");
  });
  test("identité de session absente ou différente", () => {
    assert.equal(inspectOpenReply(lines(success()), request).reason, "identity-mismatch");
    assert.equal(inspectOpenReply(lines([{ type: "session_meta", payload: { id: FOREIGN } }, ...success()]), request).reason, "identity-mismatch");
  });
  test("deux identités dans le même historique", () => {
    assert.equal(observe([meta, ...success()]).reason, "identity-mismatch");
  });
  test("nonce absent de l'enveloppe demandée", () => {
    assert.equal(observe(success(), { ...request, nonce: "absent" }).reason, "invalid-request");
  });
  test("empreinte ou longueur de référence invalides", () => {
    assert.equal(observe(success(), { ...request, baseline: { ...request.baseline, bytes: -1 } }).reason, "invalid-baseline");
    assert.equal(observe(success(), { ...request, baseline: { ...request.baseline, sha256: "incorrect" } }).reason, "invalid-baseline");
  });
});

describe("B1 : délivrance au timeout ou à l'annulation", () => {
  test("aucun dépôt tenté : not-delivered", () => {
    assert.equal(settleOpenDelivery(observe([]), false).status, "not-delivered");
  });
  test("queue accepté mais sans entrée dans le rollout : unknown", () => {
    assert.deepEqual(settleOpenDelivery(observe([]), true), { status: "unknown", persisted: false });
  });
  test("entrée utilisateur présente sans réponse : persisted-no-reply", () => {
    assert.deepEqual(settleOpenDelivery(observe([user(), bound()]), true), { status: "persisted-no-reply", persisted: true });
  });
  test("lecture impossible après dépôt : unknown, pas de renvoi annoncé sans risque", () => {
    assert.deepEqual(settleOpenDelivery(inspectOpenReply(prefix + "{corrompu}\n", request), true), { status: "unknown", persisted: "unknown" });
  });
  test("une réception déjà observée n'est pas oubliée si la lecture suivante échoue", () => {
    const result = inspectOpenReply(prefix + "{corrompu}\n", request);
    assert.deepEqual(settleOpenDelivery(result, true, true), { status: "persisted-no-reply", persisted: true });
  });
  test("une preuve de réception l'emporte sur un état d'envoi contradictoire", () => {
    assert.equal(settleOpenDelivery(observe([user()]), false).status, "persisted-no-reply");
  });
  test("un échange ambigu conserve la réception sans exposer une réponse", () => {
    const result = settleOpenDelivery(observe([user(), bound(), final(), complete("turn-a", "Mauvais texte")]), true);
    assert.equal(result.status, "persisted-no-reply");
    assert.equal(result.reply, undefined);
  });
});

describe("B1 : lectures positionnelles sur fichiers factices", () => {
  async function temporary(run: (filename: string) => Promise<void>) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "palabre-b1-"));
    try { await run(path.join(directory, "rollout.jsonl")); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
  test("historique de 151 Mio : seuls identité, témoin et ajout sont fournis au lecteur", async () => {
    await temporary(async (filename) => {
      const size = 151 * 1024 * 1024;
      const file = await open(filename, "w");
      try {
        await file.write(Buffer.from(prefix), 0, Buffer.byteLength(prefix), 0);
        await file.truncate(size);
        await file.write(Buffer.from("\n"), 0, 1, size - 1);
      } finally { await file.close(); }
      const baseline = await captureOpenRollout(filename);
      assert.equal(baseline.bytes, size);
      const appended = lines([started(), ...success()]);
      await appendFile(filename, appended);
      const snapshot = await readOpenRollout(filename, baseline);
      assert.equal(snapshot.bytes, size + Buffer.byteLength(appended));
      assert.equal(snapshot.firstLine, prefix);
      assert.equal(snapshot.witness.byteLength, OPEN_READ_LIMITS.witnessBytes);
      assert.equal(snapshot.added.byteLength, Buffer.byteLength(appended));
      assert.equal(inspectWindow(snapshot, { ...request, baseline }).status, "replied");
    });
  });
  test("ajout trop grand : refus avant son chargement, pas de plafond sur l'ancien historique", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix);
      const baseline = await captureOpenRollout(filename);
      await truncate(filename, baseline.bytes + OPEN_READ_LIMITS.addedBytes + 1);
      await assert.rejects(readOpenRollout(filename, baseline), /added-too-large/);
      assert.equal(inspectWindow({ bytes: baseline.bytes + OPEN_READ_LIMITS.addedBytes + 1, firstLine: prefix, witness: Buffer.from(prefix), added: Buffer.alloc(0) }, { ...request, baseline }).reason, "added-too-large");
    });
  });
  test("deux lectures après le même offset suivent la réception puis la réponse", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix);
      const baseline = await captureOpenRollout(filename);
      await appendFile(filename, lines([started(), user(), bound()]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).status, "awaiting-reply");
      await appendFile(filename, lines([final(), complete()]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).status, "replied");
    });
  });
  test("témoin modifié sans troncature : pas de réponse", async () => {
    await temporary(async (filename) => {
      const before = prefix + lines([{ type: "factice", value: "ancien" }]);
      await writeFile(filename, before);
      const baseline = await captureOpenRollout(filename);
      await writeFile(filename, before.replace("ancien", "change") + lines([started(), ...success()]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).reason, "history-replaced");
    });
  });
  test("première ligne remplacée : identité différente refusée", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix);
      const baseline = await captureOpenRollout(filename);
      await writeFile(filename, prefix.replace(THREAD, FOREIGN) + lines([started(), ...success()]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).reason, "identity-mismatch");
    });
  });
  test("identité contrôlée en première ligne, sans parser les anciennes lignes", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix + "ancien contenu non parsé\n");
      const baseline = await captureOpenRollout(filename);
      await appendFile(filename, lines([started(), ...success()]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).status, "replied");
    });
  });
  test("historique tronqué : erreur explicite du collecteur", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix);
      const baseline = await captureOpenRollout(filename);
      await truncate(filename, 0);
      await assert.rejects(readOpenRollout(filename, baseline), /history-replaced/);
    });
  });
  test("ancienne fin de ligne partielle : référence refusée avant dépôt", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix + '{"type":"incomplet"');
      await assert.rejects(captureOpenRollout(filename), /baseline-incomplete/);
    });
  });
  test("caractère UTF-8 partiel en fin d'ajout : ignoré jusqu'à complétion", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix);
      const baseline = await captureOpenRollout(filename);
      const done = Buffer.from(lines([started(), ...success()]));
      await appendFile(filename, Buffer.concat([done, Buffer.from([0xc3])]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).status, "replied");
      await appendFile(filename, Buffer.from([10]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).reason, "invalid-utf8");
    });
  });
  test("première ligne trop grande : lecture bornée", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, "x");
      await truncate(filename, OPEN_READ_LIMITS.firstLineBytes + 1);
      await assert.rejects(captureOpenRollout(filename), /identity-too-large/);
    });
  });
  test("une réécriture hors identité et témoin est indétectable : limite documentée", async () => {
    await temporary(async (filename) => {
      await writeFile(filename, prefix + "ancien milieu" + "x".repeat(OPEN_READ_LIMITS.witnessBytes) + "\n");
      const baseline = await captureOpenRollout(filename);
      const file = await open(filename, "r+");
      try { await file.write(Buffer.from("change"), 0, 6, Buffer.byteLength(prefix)); }
      finally { await file.close(); }
      await appendFile(filename, lines([started(), ...success()]));
      assert.equal(inspectWindow(await readOpenRollout(filename, baseline), { ...request, baseline }).status, "replied");
    });
  });
});
