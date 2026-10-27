import test from "node:test";
import assert from "node:assert/strict";
import { createOfflineMessengerGuard } from "../scripts/prototypes/relay/claudeMessenger.js";
import { inspectCalibrationTool, hasCorrelatedCalibrationDenial, hasQualifiedCalibrationFaultBlock, CALIBRATION_TOOL, CALIBRATION_TEXT } from "../scripts/prototypes/relay/claudeMessengerCalibration.js";

const messenger = "11111111-1111-4111-8111-111111111111";
const target = { kind: "fixture-only" as const, sessionId: "22222222-2222-4222-8222-222222222222", recipient: "fixture-recipient" };
function setup() {
  return createOfflineMessengerGuard({ messengerSessionId: messenger, target, envelope: CALIBRATION_TEXT, expiresAt: 100 },
    raw => raw as { recipient: string; text: string }, () => 1);
}
const event = { hook_event_name: "PreToolUse", session_id: messenger, tool_use_id: "fixture-call", tool_name: CALIBRATION_TOOL,
  tool_input: { recipient: target.recipient, text: CALIBRATION_TEXT } };

test("calibration : seul le faux outil peut atteindre le garde", () => {
  for (const tool_name of ["SendMessage", "ListAgents", "Bash", "mcp__other__fixture_send"]) {
    const guard = setup();
    assert.equal(inspectCalibrationTool(guard, { ...event, tool_name }, [target]).disposition, "blocked");
    assert.equal(guard.state().phase, "closed");
    assert.equal(guard.state().reservations, 0);
  }
});

// Forme MCP observée lors de l'essai SDK 0.3.302 / CLI 2.1.302 du 27/10/2026.
// Texte, UUID et identifiant d'appel remplacés ; aucun schéma SendMessage natif.
function trace() {
  return [
    { type: "system", subtype: "init", session_id: messenger, model: "claude-opus-5-5", claude_code_version: "2.1.302", tools: [CALIBRATION_TOOL] },
    { type: "assistant", session_id: messenger, message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id: "fixture-call", name: CALIBRATION_TOOL, input: { recipient: "fixture", text: "altered" } }] } },
    { type: "user", session_id: messenger, message: { content: [{ type: "tool_result", tool_use_id: "fixture-call", is_error: true }] }, tool_result_meta: [{ id: "fixture-call", permission_decision: { decision: "reject", source: "hook" } }] },
    { type: "result", subtype: "success", is_error: false, session_id: messenger, modelUsage: { "claude-opus-5-5": {}, "claude-haiku-5-5": {} }, permission_denials: [{ tool_name: CALIBRATION_TOOL, tool_use_id: "fixture-call" }] }
  ];
}
test("calibration : refus corrélé au runtime, pas à la prose ni à un compteur nul seul", () => {
  assert.equal(hasCorrelatedCalibrationDenial(trace(), messenger), true);
  assert.equal(hasCorrelatedCalibrationDenial([], messenger), false);
  assert.equal(hasCorrelatedCalibrationDenial(trace(), target.sessionId), false);
  assert.equal(hasCorrelatedCalibrationDenial(trace().filter(item => item.type !== "user"), messenger), false);
  assert.equal(hasCorrelatedCalibrationDenial([...trace(), trace()[1]], messenger), false);
  for (const [before, after] of [
    ['"source":"hook"', '"source":"rule"'],
    ['"tool_use_id":"fixture-call"', '"tool_use_id":"other"'],
    ['"is_error":false', '"is_error":true'],
    ['"claude_code_version":"2.1.302"', '"claude_code_version":"unknown"'],
    ['"model":"claude-opus-5-5"', '"model":"other-model"']
  ]) {
    assert.equal(hasCorrelatedCalibrationDenial(JSON.parse(JSON.stringify(trace()).replace(before!, after!)), messenger), false);
  }
});
test("calibration : proposition intacte neutre, altération refusée sans normalisation", () => {
  assert.deepEqual(inspectCalibrationTool(setup(), event, [target]), { disposition: "continue-permissions", hook: {} });
  const result = inspectCalibrationTool(setup(), { ...event, tool_input: { ...event.tool_input, text: CALIBRATION_TEXT + " CHANGED" } }, [target]);
  assert.equal(result.disposition, "blocked");
  if (result.disposition === "blocked") assert.equal(result.reason, "message-changed");
});
test("calibration : inventaire non validé, session étrangère et entrée non JSON refusés", () => {
  assert.equal(inspectCalibrationTool(setup(), event, []).disposition, "blocked");
  assert.equal(inspectCalibrationTool(setup(), { ...event, session_id: target.sessionId }, [target]).disposition, "blocked");
  let reads = 0;
  const accessor = { ...event, get tool_name() { reads++; return CALIBRATION_TOOL; } };
  assert.equal(inspectCalibrationTool(setup(), accessor, [target]).disposition, "blocked");
  assert.equal(reads, 0);
});
for (const scenario of ["throw", "timeout"]) {
  test(`calibration ${scenario} : panne attribuée et rejet runtime exigés, sans verdict sur la prose`, () => {
    const evidence = { scenario, sessionId: messenger, inventoryValidated: true, handlerCalls: 0, outerTimedOut: false, error: null,
      faultElapsedMs: 5100, events: trace(), hookDecisions: [{ tool: CALIBRATION_TOOL, toolUseId: "fixture-call", sessionMatches: true, disposition: "injected-fault", reason: scenario }] };
    assert.equal(hasQualifiedCalibrationFaultBlock(evidence), true);
    for (const patch of [{ handlerCalls: 1 }, { outerTimedOut: true }, { inventoryValidated: false }, { error: "failed" },
      { events: [] }, { hookDecisions: [] }, { hookDecisions: [...evidence.hookDecisions, ...evidence.hookDecisions] },
      { hookDecisions: [{ ...evidence.hookDecisions[0]!, toolUseId: "other-call" }] },
      { hookDecisions: [{ ...evidence.hookDecisions[0]!, reason: "other-fault" }] }]) {
      assert.equal(hasQualifiedCalibrationFaultBlock({ ...evidence, ...patch }), false);
    }
    if (scenario === "timeout") for (const faultElapsedMs of [undefined, NaN, 0, 4499, 5501, 60000]) {
      assert.equal(hasQualifiedCalibrationFaultBlock({ ...evidence, faultElapsedMs }), false);
    }
  });
}
test("calibration : formes négatives réellement observées conservées sans les faire passer", () => {
  // Essais autorisés du 27/10/2026, SDK0.3.302/CLI2.1.302. Identifiants et texte factices.
  // Exception : outil exécuté, accept/config ; timeout : is_error mais pas de métadonnée
  // permission_decision ni de permission_denials. Ne pas reconstituer ces preuves absentes.
  for (const scenario of ["throw", "timeout"]) {
    const base = trace();
    const observedResult = scenario === "throw"
      ? { type: "user", session_id: messenger, message: { content: [{ type: "tool_result", tool_use_id: "fixture-call", is_error: false }] },
        tool_result_meta: [{ id: "fixture-call", permission_decision: { decision: "accept", source: "config" } }] }
      : { type: "user", session_id: messenger, message: { content: [{ type: "tool_result", tool_use_id: "fixture-call", is_error: true }] } };
    const records: unknown[] = [base[0], base[1], observedResult, { ...base[3]!, permission_denials: [] }];
    assert.equal(hasQualifiedCalibrationFaultBlock({ scenario, sessionId: messenger, inventoryValidated: true,
      handlerCalls: scenario === "throw" ? 1 : 0, outerTimedOut: false, error: null, faultElapsedMs: scenario === "throw" ? 64 : 5001,
      events: records, hookDecisions: [{ tool: CALIBRATION_TOOL, toolUseId: "fixture-call", sessionMatches: true, disposition: "injected-fault", reason: scenario }] }), false);
  }
});
test("calibration : panne injectée ferme le garde, tout deuxième appel reste refusé", () => {
  const guard = setup();
  guard.cancel(); // Même fermeture que le lanceur avant son throw ou son attente infinie.
  let fakeCalls = 0;
  for (const tool_use_id of ["retry-1", "retry-2"]) {
    const decision = inspectCalibrationTool(guard, { ...event, tool_use_id }, [target]);
    if (decision.disposition === "continue-permissions") fakeCalls++;
    assert.equal(decision.disposition, "blocked");
  }
  assert.equal(fakeCalls, 0);
  assert.equal(guard.state().reservations, 0);
});
