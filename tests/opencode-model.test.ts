/**
 * @file Contrat pur de sélection. Fixtures synthétiques dérivées des sources officielles
 * anomalyco/opencode v2.0.32 (843a6c514e606b436a7fe713422ace0a93ad3d61) : schema/model.ts,
 * protocol/groups/model.ts, protocol/groups/session.ts, core/session/{session,message-updater,info}.ts.
 * Aucun compte, catalogue utilisateur, serveur ou appel modèle réel.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCopyModel, validateCopyModelCatalogue, validateCopyModelSelection } from "../src/externalSessions/opencodeModel.js";
import type { OpenCodeSnapshot } from "../src/externalSessions/opencodeCopy.js";

const chosen = { providerID: "fake", id: "other", variant: "default" };
const catalogue = [{ providerID: "fake", id: "other", modelID: "remote-alias", enabled: true, variants: [{ id: "high" }] }];

/** Relevés minimaux fictifs, avant/après l'unique changement de modèle de la copie. */
function snapshots() {
  const before: OpenCodeSnapshot = { info: { id: "ses_Copy", model: { providerID: "fake", id: "old", variant: "high" },
    agent: "build", permissions: [], location: { directory: "C:/fake" }, fork: { sessionID: "ses_Source" }, outcome: "succeeded" },
    context: [{ id: "msg_old", type: "idle", outcome: "succeeded" }], inbox: [], instructions: [], export: {} };
  const after = structuredClone(before);
  after.info.model = chosen;
  after.context.push({ id: "msg_switch", type: "model-switched", model: chosen, previous: before.info.model, time: { created: 12 } });
  return { before, after };
}

test("référence exacte : variante default explicite sans héritage, id avec slash, aucune correction", () => {
  assert.deepEqual(parseCopyModel("fake/other"), chosen);
  assert.deepEqual(parseCopyModel("fake/org/model#high"), { providerID: "fake", id: "org/model", variant: "high" });
  for (const input of ["", "auto", "/model", "fake/", "fake/model#", "fake/model#high#x", "fake#x/model", " fake/model", "fake/model\n", "fake/model\u001b", `fake/${"x".repeat(513)}`]) {
    assert.throws(() => parseCopyModel(input), /model-reference/, input);
  }
});

test("catalogue : provider + id (pas modelID), enabled, variante ; aucun substitut", () => {
  validateCopyModelCatalogue(catalogue, chosen);
  validateCopyModelCatalogue(catalogue, { ...chosen, variant: "high" });
  for (const request of [{ ...chosen, providerID: "other" }, { ...chosen, id: "remote-alias" }, { ...chosen, variant: "max" }])
    assert.throws(() => validateCopyModelCatalogue(catalogue, request), /model-unavailable/);
  assert.throws(() => validateCopyModelCatalogue([{ ...catalogue[0], enabled: false }], chosen), /model-unavailable/);
  for (const value of [null, {}, [null], [catalogue[0], catalogue[0]], [{ ...catalogue[0], variants: null }], [{ ...catalogue[0], enabled: "true" }]])
    assert.throws(() => validateCopyModelCatalogue(value, chosen), /model-catalogue-schema/);
});

test("sélection : seul delta model-switched exact permis ; préfixe, état et précédent contrôlés", () => {
  const valid = snapshots(); validateCopyModelSelection(valid.before, valid.after, chosen);
  const changes: ((s: OpenCodeSnapshot) => void)[] = [
    s => { s.info.id = "ses_Foreign"; }, s => { s.info.agent = "other"; }, s => { s.info.permissions = ["allow"]; },
    s => { s.info.model = { ...chosen, variant: null }; }, s => { s.info.model = { ...chosen, variant: "high" }; },
    s => { s.context[0]!.outcome = "failed"; }, s => { s.context[1]!.previous = chosen; },
    s => { s.context[1]!.model = { ...chosen, variant: "high" }; }, s => { s.context[1]!.id = "msg_old"; },
    s => { s.context[1]!.error = "unknown"; }, s => { s.context[1]!.time = { created: 12, other: true }; },
    s => { s.context[1]!.time = { created: -1 }; }, s => { s.context.push({ id: "msg_user", type: "user", text: "Concurrent" }); },
    s => { s.instructions = ["changed"]; }, s => { s.inbox = ["pending"]; }, s => { s.context.pop(); }
  ];
  for (const change of changes) { const { before, after } = snapshots(); change(after); assert.throws(() => validateCopyModelSelection(before, after, chosen)); }
});

test("no-op : default et absence équivalents, mais état exact inchangé et aucun événement supplémentaire", () => {
  const { before } = snapshots(); before.info.model = { providerID: "fake", id: "other" };
  validateCopyModelSelection(before, structuredClone(before), chosen);
  before.info.model = chosen; validateCopyModelSelection(before, structuredClone(before), chosen);
  const after = structuredClone(before); after.context.push({ id: "extra", type: "model-switched", model: chosen });
  assert.throws(() => validateCopyModelSelection(before, after, chosen));
});
