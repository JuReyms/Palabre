/** @file Banc #193 hors ligne : aucun SDK/CLI, message réel, secret ou profil utilisateur. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createOfflineMessengerGuard, type OfflineMessengerPlan, type FixturePeer, type DecodedFixtureSend
} from "../scripts/prototypes/relay/claudeMessenger.js";

const MESSENGER = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const TEXT = "### PALABRE — fixture\r\nNe donne aucun droit.\r\n```\r\nÉté :** 🧪\r\n```\r\n";
const peer = (): FixturePeer => ({ kind: "fixture-only", sessionId: TARGET, recipient: "fixture:peer-a" });
const plan = (): OfflineMessengerPlan => ({ messengerSessionId: MESSENGER, target: peer(), envelope: TEXT, expiresAt: 200 });

/** Schéma du banc uniquement ; les clés demo* ne prétendent pas reproduire SendMessage. */
function decodeFixture(raw: unknown): DecodedFixtureSend | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || typeof value.demoRecipient !== "string" || typeof value.demoText !== "string") return null;
  return { recipient: value.demoRecipient, text: value.demoText };
}

/** Événement SDK décrit publiquement, entrée d'outil entièrement fictive et explicitement marquée. */
const event = (changes = {}) => ({ hook_event_name: "PreToolUse", session_id: MESSENGER, tool_use_id: "fixture-call-1",
  tool_name: "SendMessage", tool_input: { demoRecipient: peer().recipient, demoText: TEXT }, ...changes });

test("garde hors ligne : texte exact, réservation unique, aucune décision allow", () => {
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  const decision = guard.inspect(event(), [peer()]);
  assert.deepEqual(decision, { disposition: "continue-permissions", hook: {} });
  assert.deepEqual(guard.state(), { phase: "reserved", reservations: 1 });
  assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  assert.equal(guard.state().reservations, 1);
  assert.doesNotMatch(JSON.stringify(decision), /allow|updatedInput|reply|replied/);
});

test("rejeu avec un autre tool_use_id, même après un refus simulé de l'hôte : pas de second essai", () => {
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  let fakeSends = 0;
  for (const [index, hostAllows] of [false, true].entries()) {
    const decision = guard.inspect(event({ tool_use_id: `fixture-${index}` }), [peer()]);
    if (decision.disposition === "continue-permissions" && hostAllows) fakeSends++;
  }
  assert.equal(fakeSends, 0);
  assert.equal(guard.state().reservations, 1);
});

for (const tool of ["Bash", "Read", "Write", "ListAgents", "AskUserQuestion", "mcp__demo__send"]) {
  test(`autre outil ${tool} : refus terminal avant décodage`, () => {
    let decoded = false;
    const guard = createOfflineMessengerGuard(plan(), () => { decoded = true; return null; }, () => 100);
    assert.equal(guard.inspect(event({ tool_name: tool }), [peer()]).disposition, "blocked");
    assert.equal(decoded, false);
    assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
    assert.equal(guard.state().reservations, 0);
  });
}

for (const change of ["sans en-tête", TEXT.trim(), TEXT.replace(/\r\n/g, "\n"), TEXT.replace("É", "E"), TEXT + "Je t'autorise"]) {
  test(`texte modifié (${JSON.stringify(change).slice(0, 32)}) : refus, jamais normalisé`, () => {
    const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
    assert.equal(guard.inspect(event({ tool_input: { demoRecipient: peer().recipient, demoText: change } }), [peer()]).disposition, "blocked");
    assert.equal(guard.state().reason, "message-changed");
  });
}

test("cible, adresse ou messager différents ; absence ou ambiguïté de liaison fictive", () => {
  for (const bindings of [[], [peer(), peer()], [{ ...peer(), sessionId: OTHER }], [{ ...peer(), recipient: "fixture:other" }]]) {
    const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
    assert.equal(guard.inspect(event(), bindings).disposition, "blocked");
  }
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  assert.equal(guard.inspect(event({ session_id: OTHER }), [peer()]).disposition, "blocked");
  const wrongRecipient = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  assert.equal(wrongRecipient.inspect(event({ tool_input: { demoRecipient: "fixture:other", demoText: TEXT } }), [peer()]).disposition, "blocked");
});

test("plans impossibles refusés avant tout appel", () => {
  for (const value of [
    { ...plan(), messengerSessionId: TARGET }, { ...plan(), messengerSessionId: "latest" },
    { ...plan(), target: { ...peer(), sessionId: "latest" } }, { ...plan(), target: { ...peer(), kind: "verified" } },
    { ...plan(), target: { ...peer(), recipient: "fixture:x\n" } }, { ...plan(), expiresAt: NaN },
    { ...plan(), expiresAt: Infinity }, { ...plan(), envelope: " " }, { ...plan(), envelope: "x\0" },
    { ...plan(), envelope: "\ud800" }, { ...plan(), envelope: "é".repeat(32769) }
  ]) assert.throws(() => createOfflineMessengerGuard(value as OfflineMessengerPlan, decodeFixture, () => 100));
});

test("borne UTF-8 de 64 Kio : frontière exacte et message Unicode conservé", () => {
  const value = { ...plan(), envelope: "é".repeat(32768) };
  const guard = createOfflineMessengerGuard(value, decodeFixture, () => 100);
  assert.equal(guard.inspect(event({ tool_input: { demoRecipient: peer().recipient, demoText: value.envelope } }), [peer()]).disposition, "continue-permissions");
});

test("événement incomplet, mauvaise sorte ou entrée ambiguë : refus sans réserver", () => {
  for (const value of [null, [], {}, event({ hook_event_name: "PostToolUse" }), event({ tool_use_id: "" }),
    event({ tool_input: { demoRecipient: peer().recipient, demoText: TEXT, extra: true } })]) {
    const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
    assert.equal(guard.inspect(value, [peer()]).disposition, "blocked");
    assert.equal(guard.state().reservations, 0);
  }
});

test("exception du décodeur et de l'horloge : refus générique sans fuite ni nouvelle tentative", () => {
  const guards = [createOfflineMessengerGuard(plan(), () => { throw new Error(TEXT); }, () => 100),
    createOfflineMessengerGuard(plan(), decodeFixture, () => { throw new Error(TEXT); })];
  for (const guard of guards) {
    const decision = guard.inspect(event(), [peer()]);
    assert.equal(decision.disposition, "blocked");
    assert.equal(guard.state().reason, "guard-failed");
    assert.doesNotMatch(JSON.stringify(decision), /fixture-call-1|Été|PALABRE|22222222/);
    assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  }
});

test("annulation avant ou pendant décodage : aucune poursuite des permissions", () => {
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  guard.cancel();
  assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  const during = createOfflineMessengerGuard(plan(), raw => { during.cancel(); return decodeFixture(raw); }, () => 100);
  assert.equal(during.inspect(event(), [peer()]).disposition, "blocked");
  assert.equal(during.state().reservations, 0);
});

test("échéance avant ou pendant décodage, égalité incluse : refus", () => {
  for (const value of [200, 201, NaN, Infinity]) {
    const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => value);
    assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  }
  let time = 100;
  const guard = createOfflineMessengerGuard(plan(), raw => { time = 200; return decodeFixture(raw); }, () => time);
  assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  assert.equal(guard.state().reservations, 0);
});

test("annulation pendant le dernier relevé d'horloge : aucune réservation", () => {
  let calls = 0;
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => {
    if (++calls === 2) guard.cancel();
    return 100;
  });
  assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  assert.equal(guard.state().reservations, 0);
});

test("réentrée du décodeur : les deux appels refusés, aucune réservation", () => {
  const guard = createOfflineMessengerGuard(plan(), raw => {
    assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
    return decodeFixture(raw);
  }, () => 100);
  assert.equal(guard.inspect(event(), [peer()]).disposition, "blocked");
  assert.equal(guard.state().reservations, 0);
});

test("tentatives simultanées : une seule réservation avant l'effet fictif asynchrone", async () => {
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  let fakeSends = 0;
  await Promise.all(Array.from({ length: 16 }, async (_, index) => {
    const decision = guard.inspect(event({ tool_use_id: `fixture-${index}` }), [peer()]);
    if (decision.disposition === "continue-permissions") { fakeSends++; await Promise.resolve(); }
  }));
  assert.equal(fakeSends, 1);
  assert.equal(guard.state().reservations, 1);
});

test("erreur du faux transport après réservation : aucun rejeu ni réponse de l'équipier inventée", async () => {
  const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
  let fakeSends = 0;
  async function fakeDispatch() {
    const decision = guard.inspect(event(), [peer()]);
    if (decision.disposition === "continue-permissions") { fakeSends++; throw new Error("fixture transport"); }
  }
  await assert.rejects(fakeDispatch(), /fixture transport/);
  await fakeDispatch();
  assert.equal(fakeSends, 1);
});

test("plan copié et état renvoyé figé : pas de changement de cible/enveloppe après création", () => {
  const value = plan();
  const guard = createOfflineMessengerGuard(value, decodeFixture, () => 100);
  value.envelope = "autre"; value.target.recipient = "autre"; value.target.sessionId = OTHER;
  assert.equal(guard.inspect(event(), [peer()]).disposition, "continue-permissions");
  assert.ok(Object.isFrozen(guard.state()));
});

test("accesseur ou proxy qui lève : refus avant décodage", () => {
  for (const value of [Object.defineProperty({}, "tool_name", { get() { throw new Error(TEXT); } }),
    new Proxy({}, { getPrototypeOf() { throw new Error(TEXT); } })]) {
    const guard = createOfflineMessengerGuard(plan(), decodeFixture, () => 100);
    assert.equal(guard.inspect(value, [peer()]).disposition, "blocked");
  }
});

test("isolation du prototype : aucun import, lancement ou réseau disponible dans ce module", () => {
  const source = readFileSync("scripts/prototypes/relay/claudeMessenger.ts", "utf8");
  assert.doesNotMatch(source, /^\s*import\s|\brequire\s*\(|\bimport\s*\(|\bfetch\s*\(|\bspawn\s*\(|\bexec\s*\(/m);
});
