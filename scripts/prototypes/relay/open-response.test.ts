/** @file Cas factices B1 : jamais de CLI, session, socket ni appel de modèle réel. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { captureOpenBaseline, inspectOpenReply, settleOpenDelivery, type OpenRequest } from "./open-response.js";

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
const final = (turnId = "turn-a", reply = "Réponse finale.\nÉté « intact »." ) => item("AgentMessage", turnId, reply, "final_answer");
function complete(turnId = "turn-a", reply = "Réponse finale.\nÉté « intact »." ): Row {
  return { type: "event_msg", payload: { type: "task_complete", turn_id: turnId, last_agent_message: reply } };
}
const observe = (rows: Row[], input = request) => inspectOpenReply(prefix + lines(rows), input);
const success = () => [user(), bound(), final(), complete()];

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
    const rows = [user(), bound(), user(otherEnvelope), bound("turn-b", otherEnvelope), final("turn-b", "Réponse B"), complete("turn-b", "Réponse B"), final(), complete()];
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
  test("une erreur d'un autre tour ne remplace pas une réponse corrélée", () => {
    assert.equal(observe([...success(), { type: "event_msg", payload: { type: "error", turn_id: "turn-other" } }]).status, "replied");
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
  test("la présence du nonce dans un texte utilisateur différent ne suffit pas", () => {
    assert.equal(observe([user("Citation : " + ENVELOPE), bound("turn-a", "Citation : " + ENVELOPE), final(), complete()]).status, "awaiting-message");
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
    const head = prefix + lines([user(), bound(), final()]);
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
    const result = inspectOpenReply(prefix.replace(THREAD, FOREIGN) + lines(success()), request);
    assert.equal(result.reason, "history-replaced");
    assert.equal(result.persisted, "unknown");
  });
  test("historique tronqué", () => {
    assert.equal(inspectOpenReply("", request).reason, "history-replaced");
  });
  test("UTF-8 dans le préfixe : position en octets et non en caractères", () => {
    const head = lines([meta, { type: "test_metadata", text: "Été « é »" }]);
    assert.equal(inspectOpenReply(head + lines(success()), { ...request, baseline: captureOpenBaseline(head) }).status, "replied");
  });
  test("CRLF dans le préfixe et le nouveau tour", () => {
    const head = prefix.replaceAll("\n", "\r\n");
    assert.equal(inspectOpenReply(head + lines(success()).replaceAll("\n", "\r\n"), { ...request, baseline: captureOpenBaseline(head) }).status, "replied");
  });
  test("identité de session absente ou différente", () => {
    const empty = captureOpenBaseline("");
    assert.equal(inspectOpenReply(lines(success()), { ...request, baseline: empty }).reason, "identity-mismatch");
    assert.equal(inspectOpenReply(lines([{ type: "session_meta", payload: { id: FOREIGN } }, ...success()]), { ...request, baseline: empty }).reason, "identity-mismatch");
  });
  test("deux identités dans le même historique", () => {
    assert.equal(observe([meta, ...success()]).reason, "identity-mismatch");
  });
  test("nonce absent de l'enveloppe demandée", () => {
    assert.equal(observe(success(), { ...request, nonce: "absent" }).reason, "invalid-request");
  });
  test("empreinte ou longueur de référence invalides", () => {
    assert.equal(observe(success(), { ...request, baseline: { bytes: -1, sha256: request.baseline.sha256 } }).reason, "invalid-baseline");
    assert.equal(observe(success(), { ...request, baseline: { bytes: 0, sha256: "incorrect" } }).reason, "invalid-baseline");
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
