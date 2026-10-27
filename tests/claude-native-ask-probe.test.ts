/** @file Second contrôle natif : fixtures inventées, aucun SDK, compte, processus ou destinataire réel. */
import test from "node:test";
import assert from "node:assert/strict";
import { createNativeAskProbe, hasNativeAskDenial, nativeAskProbePolicy, parseNativeAskPlan } from "../scripts/prototypes/relay/claudeNativeAskProbe.js";
import { nativeFirstProbePolicy, nativeHookDeny } from "../scripts/prototypes/relay/claudeNativeProbe.js";

const sessionId = "11111111-1111-4111-8111-111111111111";
const plan = () => ({ v: 1, target: { sessionId: "22222222-2222-4222-8222-222222222222", directory: "C:\\fixture-only", recipient: "fixture-ask" }, message: "Texte fictif 🙂" });
// Hypothèse étroite avant essai : pas un schéma natif validé.
const input = () => ({ to: plan().target.recipient, message: plan().message, type: "message", recipient: plan().target.recipient,
  recipient_kind: "name", content: plan().message, summary: plan().message });
const event = () => ({ hook_event_name: "PreToolUse", session_id: sessionId, tool_name: "SendMessage", tool_use_id: "fixture-call", tool_input: input() });
const context = () => ({ toolUseID: "fixture-call", matchedAskRule: { source: "flagSettings", toolName: "SendMessage" } });
const handshake = () => ({ claude_code_version: "2.1.302", hooks_applied: true });
const denial = { behavior: "deny", message: "Palabre native probe: no permission granted" };
const setup = () => createNativeAskProbe(sessionId, plan(), { now: () => 1, deadline: 10 });
function prepared() { const probe = setup(); assert.equal(probe.arm(handshake()), true); return probe; }
function evidence() {
  const probe = prepared();
  assert.deepEqual(probe.hook(event(), "fixture-call"), {});
  assert.deepEqual(probe.permission("SendMessage", input(), context()), denial);
  const { summary: _preview, ...assistantInput } = input(); // Fixture distincte ; aucun événement runtime réécrit.
  const events: any[] = [
    { type: "system", subtype: "init", session_id: sessionId, claude_code_version: "2.1.302", model: "claude-opus-5-5", permissionMode: "default", tools: ["SendMessage"], mcp_servers: [] },
    { type: "assistant", session_id: sessionId, message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id: "fixture-call", name: "SendMessage", input: assistantInput }] } },
    { type: "user", session_id: sessionId, message: { content: [{ type: "tool_result", tool_use_id: "fixture-call", is_error: true }] },
      tool_result_meta: [{ id: "fixture-call", non_execution_kind: "permission-rule", permission_decision: { decision: "reject", source: "user_reject" } }] },
    { type: "result", session_id: sessionId, subtype: "success", is_error: false, modelUsage: { "claude-opus-5-5": {} }, permission_denials: [{ tool_name: "SendMessage", tool_use_id: "fixture-call" }] }
  ];
  return { probe, events };
}

test("ask natif : plan privé court, copié, figé et distinct du premier essai", () => {
  const raw = plan(), parsed = parseNativeAskPlan(raw);
  raw.message = "changed"; raw.target.recipient = "changed";
  assert.equal(parsed.message, plan().message); assert.equal(parsed.target.recipient, plan().target.recipient);
  assert.equal(Object.isFrozen(parsed.target), true);
  for (const message of ["x\ny", "x\ry", "x\ty", "x\u2028y", "x\u2029y", "x\u200by", "🙂".repeat(41)]) {
    assert.throws(() => parseNativeAskPlan({ ...plan(), message }));
  }
  assert.equal(parseNativeAskPlan({ ...plan(), message: "🙂".repeat(40) }).message.length, 80);
});
test("ask natif : règle candidate isolée, aucun allow et premier profil inchangé", () => {
  const policy = nativeAskProbePolicy();
  assert.deepEqual(policy.settings.permissions, { ask: ["SendMessage"] });
  assert.deepEqual(policy.tools, ["SendMessage"]); assert.deepEqual(policy.allowedTools, []);
  assert.equal(policy.permissionMode, "default"); assert.deepEqual(policy.settingSources, []);
  assert.deepEqual(policy.mcpServers, {}); assert.equal(policy.strictMcpConfig, true);
  policy.settings.permissions.ask.push("Bash");
  assert.deepEqual(nativeAskProbePolicy().settings.permissions.ask, ["SendMessage"]);
  assert.equal("permissions" in nativeFirstProbePolicy().settings, false);
});
test("ask natif : sans handshake, pas de neutralité ni armement tardif", () => {
  const probe = setup();
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  assert.equal(probe.arm(handshake()), false); assert.equal(probe.state().neutralCount, 0);
});
test("ask natif : handshake inconnu, répété ou avec accesseur ferme définitivement", () => {
  let reads = 0;
  for (const raw of [null, {}, { ...handshake(), hooks_applied: false }, { ...handshake(), claude_code_version: "new" },
    { get hooks_applied() { reads++; return true; }, claude_code_version: "2.1.302" }]) {
    const probe = setup(); assert.equal(probe.arm(raw), false); assert.equal(probe.arm(handshake()), false);
    assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  }
  const probe = prepared(); assert.equal(probe.arm(handshake()), false);
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny()); assert.equal(reads, 0);
});
test("ask natif : unique passage neutre, jamais allow ; second callback refuse même la forme intacte", () => {
  const { probe, events } = evidence();
  assert.equal(probe.state().phase, "denied"); assert.equal(probe.state().neutralCount, 1);
  assert.equal(probe.state().possibleSend, true); // Pas de preuve générale de non-exécution, même avec deny.
  assert.equal(hasNativeAskDenial(events, sessionId, plan(), probe.state()), true);
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  assert.equal(hasNativeAskDenial(events, sessionId, plan(), probe.state()), false);
});
test("ask natif : neutralité sans callback signale un envoi possible, même après fermeture", () => {
  const probe = prepared(); assert.equal(probe.state().possibleSend, false);
  assert.deepEqual(probe.hook(event(), "fixture-call"), {});
  assert.equal(probe.state().possibleSend, true); assert.equal(probe.state().capture.permissionCalls, 0);
  probe.close(); assert.equal(probe.state().possibleSend, true); assert.equal(probe.state().phase, "closed");
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  assert.equal(probe.state().possibleSend, true);
});
test("ask natif : destinataire, textes, clé supplémentaire ou manquante refusés sans normalisation", () => {
  for (const changed of [{ ...input(), to: "other" }, { ...input(), recipient: "other" },
    { ...input(), message: "changed" }, { ...input(), summary: "preview" }, { ...input(), content: "preview" },
    { ...input(), type: "other" }, { ...input(), recipient_kind: "id" }, { ...input(), extra: "x" },
    { ...input(), message: plan().message + " " }, Object.fromEntries(Object.entries(input()).filter(([key]) => key !== "summary"))]) {
    const probe = prepared(); assert.deepEqual(probe.hook({ ...event(), tool_input: changed }, "fixture-call"), nativeHookDeny());
    assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny()); assert.equal(probe.state().neutralCount, 0);
  }
});
test("ask natif : événement, session, outil et ID doivent concorder avant neutralité", () => {
  for (const changed of [{ ...event(), hook_event_name: "PostToolUse" }, { ...event(), session_id: "foreign" },
    { ...event(), tool_name: "Bash" }, { ...event(), tool_use_id: "other" }, { ...event(), tool_use_id: "" }]) {
    assert.deepEqual(prepared().hook(changed, "fixture-call"), nativeHookDeny());
  }
  for (const id of [undefined, "", "other", "x".repeat(513)]) assert.deepEqual(prepared().hook(event(), id), nativeHookDeny());
});
test("ask natif : capture hostile ne lit pas les accesseurs, demeure bornée et ferme", () => {
  let reads = 0;
  const cycle: any = {}; cycle.self = cycle;
  for (const raw of [undefined, cycle, { ...event(), tool_input: "x".repeat(16385) },
    { get tool_input() { reads++; return input(); } }, new Proxy({}, { ownKeys() { throw new Error("private"); } })]) {
    const probe = prepared(); assert.deepEqual(probe.hook(raw, "fixture-call"), nativeHookDeny());
    for (let i = 0; i < 8; i++) probe.hook(event(), "fixture-call");
    assert.equal(probe.state().capture.hooks.length <= 4, true); assert.equal(probe.state().neutralCount, 0);
  }
  assert.equal(reads, 0);
});
test("ask natif : permission avant hook et appel répété refusés sans preuve positive", () => {
  const probe = prepared(); assert.deepEqual(probe.permission("SendMessage", input(), context()), denial);
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  const { probe: second, events } = evidence();
  assert.deepEqual(second.permission("SendMessage", input(), context()), denial);
  assert.equal(hasNativeAskDenial(events, sessionId, plan(), second.state()), false);
});
test("ask natif : matchedAskRule absente, restreinte, étrangère ou mal formée ne qualifie rien", () => {
  for (const changed of [{ toolUseID: "fixture-call" }, { ...context(), toolUseID: "other" },
    { ...context(), matchedAskRule: null }, { ...context(), matchedAskRule: { source: "session", toolName: "SendMessage" } },
    { ...context(), matchedAskRule: { source: "flagSettings", toolName: "Bash" } },
    { ...context(), matchedAskRule: { ...context().matchedAskRule, ruleContent: "" } },
    { ...context(), matchedAskRule: { ...context().matchedAskRule, extra: true } }]) {
    const probe = prepared(); probe.hook(event(), "fixture-call");
    assert.deepEqual(probe.permission("SendMessage", input(), changed), denial); assert.equal(probe.state().phase, "closed");
  }
});
test("ask natif : autre outil, entrée altérée ou contexte hostile toujours deny", () => {
  let reads = 0;
  for (const [tool, body, ctx] of [["Bash", input(), context()], ["SendMessage", { ...input(), summary: "changed" }, context()],
    ["SendMessage", input(), { get toolUseID() { reads++; return "fixture-call"; } }],
    ["SendMessage", input(), new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("private"); } })],
    ["SendMessage", undefined, context()]] as const) {
    const probe = prepared(); probe.hook(event(), "fixture-call");
    assert.deepEqual(probe.permission(tool, body, ctx), denial); assert.equal(probe.state().phase, "closed");
  }
  assert.equal(reads, 0);
});
test("ask natif : état et observations indépendants, mutations extérieures sans effet", () => {
  const probe = prepared(), raw = event(); probe.hook(raw, "fixture-call"); raw.tool_input.content = "changed";
  const state = probe.state(); state.capture.hooks[0].event.tool_input.content = "changed again";
  assert.deepEqual(probe.permission("SendMessage", input(), context()), denial);
  assert.equal(probe.state().phase, "denied");
});
test("ask natif : échéance, annulation et défaut d'horloge ferment sans retour neutre", () => {
  for (const at of [10, 11, NaN, Infinity]) {
    const probe = createNativeAskProbe(sessionId, plan(), { now: () => at, deadline: 10 });
    assert.equal(probe.arm(handshake()), false);
  }
  let at = 1; const abort = new AbortController();
  const probe = createNativeAskProbe(sessionId, plan(), { now: () => at, deadline: 10, signal: abort.signal });
  probe.arm(handshake()); at = 10; assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  const cancelled = createNativeAskProbe(sessionId, plan(), { now: () => 1, deadline: 10, signal: abort.signal });
  cancelled.arm(handshake()); cancelled.hook(event(), "fixture-call"); abort.abort();
  assert.deepEqual(cancelled.permission("SendMessage", input(), context()), denial); assert.equal(cancelled.state().phase, "closed");
  const failed = createNativeAskProbe(sessionId, plan(), { now: () => { throw new Error("clock"); }, deadline: 10 });
  assert.equal(failed.arm(handshake()), false);
});
test("ask natif : fermeture terminale même pendant l'horloge ou réentrée de capture", () => {
  let closeDuringClock = false;
  const probe = createNativeAskProbe(sessionId, plan(), { now: () => { if (closeDuringClock) probe.close(); return 1; }, deadline: 10 });
  probe.arm(handshake()); closeDuringClock = true;
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  let reentered = false; const second = prepared();
  const hostile = new Proxy(event(), { ownKeys(target) {
    if (!reentered) { reentered = true; assert.deepEqual(second.hook(event(), "fixture-call"), nativeHookDeny()); }
    return Reflect.ownKeys(target);
  } });
  assert.deepEqual(second.hook(hostile, "fixture-call"), nativeHookDeny()); assert.equal(second.state().neutralCount, 0);
});
test("ask natif : échéance après neutralité refuse le callback, sans effacer l'envoi possible", () => {
  let at = 1; const probe = createNativeAskProbe(sessionId, plan(), { now: () => at, deadline: 10 });
  probe.arm(handshake()); assert.deepEqual(probe.hook(event(), "fixture-call"), {});
  at = 10; assert.deepEqual(probe.permission("SendMessage", input(), context()), denial);
  assert.equal(probe.state().phase, "closed"); assert.equal(probe.state().possibleSend, true);
  assert.equal(hasNativeAskDenial(evidence().events, sessionId, plan(), probe.state()), false);
});
test("ask natif : deux tool_use dans un même événement assistant invalident le constat", () => {
  const { probe, events } = evidence();
  events[1].message.content.push({ ...events[1].message.content[0], id: "fixture-second-call" });
  assert.equal(hasNativeAskDenial(events, sessionId, plan(), probe.state()), false);
});
test("ask natif : refus runtime et règle liés exigés, pas prose, success ou source non-hook seuls", () => {
  const { probe, events } = evidence();
  for (const [before, after] of [["\"source\":\"user_reject\"", "\"source\":\"hook\""],
    ["\"source\":\"user_reject\"", "\"source\":\"config\""], ["\"decision\":\"reject\"", "\"decision\":\"accept\""],
    ["\"non_execution_kind\":\"permission-rule\"", "\"non_execution_kind\":\"unknown\""],
    ["\"permissionMode\":\"default\"", "\"permissionMode\":\"bypassPermissions\""],
    ["\"claude_code_version\":\"2.1.302\"", "\"claude_code_version\":\"new\""],
    ["\"is_error\":true", "\"is_error\":false"]]) {
    assert.equal(hasNativeAskDenial(JSON.parse(JSON.stringify(events).replace(before!, after!)), sessionId, plan(), probe.state()), false);
  }
  for (const rows of [[], events.slice(1), events.slice(0, 3), [...events, events[1]], [events[1], events[0], ...events.slice(2)],
    [events[0], events[1], events[3], events[2]]]) assert.equal(hasNativeAskDenial(rows, sessionId, plan(), probe.state()), false);
});
test("ask natif : preuve altérée ou premier contrôle bloquant ne remplace pas le callback", () => {
  const { probe, events } = evidence();
  for (const mutate of [(s: any) => { s.neutralCount = 0; }, (s: any) => { s.capture.permissionCalls = 0; },
    (s: any) => { s.possibleSend = false; },
    (s: any) => { s.capture.captureFailed = true; }, (s: any) => { s.capture.permissions[0].callId = "other"; },
    (s: any) => { s.capture.permissions[0].input.matchedAskRule.source = "unknown"; },
    (s: any) => { s.capture.hooks[0].event.tool_input.summary = "preview"; }]) {
    const state = probe.state(); mutate(state); assert.equal(hasNativeAskDenial(events, sessionId, plan(), state), false);
  }
  const wrongPlan = { ...plan(), message: "other" };
  assert.equal(hasNativeAskDenial(events, sessionId, wrongPlan, probe.state()), false);
  assert.equal(hasNativeAskDenial(events, plan().target.sessionId, plan(), probe.state()), false);
});
