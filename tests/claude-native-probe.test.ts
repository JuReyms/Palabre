/** @file Essai natif préparé : fixtures opaques, aucun SDK/Claude ou destinataire réel. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseNativeProbePlan, nativeFirstProbePolicy, nativeHookDeny, createNativeDenyProbe, hasNativeHookDenial } from "../scripts/prototypes/relay/claudeNativeProbe.js";

const sessionId = "11111111-1111-4111-8111-111111111111";
const plan = () => ({ v: 1, target: { sessionId: "22222222-2222-4222-8222-222222222222", directory: "C:\\fictif", recipient: "fixture-only" }, message: "Test fictif\r\ncafé 🙂" });
// fixtureBody n'est PAS un schéma d'entrée natif : ces clés servent uniquement au recoupement opaque.
const input = () => ({ fixtureBody: "texte inchangé\r\n🙂", arbitrary: { flag: true } });
const event = () => ({ hook_event_name: "PreToolUse", session_id: sessionId, tool_name: "SendMessage", tool_use_id: "fixture-call", tool_input: input() });
function evidence() {
  const probe = createNativeDenyProbe(sessionId);
  probe.hook(event(), "fixture-call");
  const events: any[] = [
    { type: "system", subtype: "init", session_id: sessionId, claude_code_version: "2.1.302", model: "claude-opus-5-5", tools: ["SendMessage"], mcp_servers: [] },
    { type: "assistant", session_id: sessionId, message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id: "fixture-call", name: "SendMessage", input: input() }] } },
    { type: "user", session_id: sessionId, message: { content: [{ type: "tool_result", tool_use_id: "fixture-call", is_error: true, content: "Denied" }] },
      tool_result_meta: [{ id: "fixture-call", permission_decision: { decision: "reject", source: "hook" } }] },
    { type: "result", session_id: sessionId, subtype: "success", is_error: false, modelUsage: { "claude-opus-5-5": {} },
      permission_denials: [{ tool_name: "SendMessage", tool_use_id: "fixture-call" }] }
  ];
  return { probe, events };
}

test("essai natif : plan strict, texte inchangé et copie privée sans autorité implicite", () => {
  const raw = plan(), parsed = parseNativeProbePlan(raw);
  assert.deepEqual(parsed, raw);
  raw.message = "changed";
  raw.target.recipient = "other";
  assert.equal(parsed.message, "Test fictif\r\ncafé 🙂");
  assert.equal(parsed.target.recipient, "fixture-only");
  assert.equal(Object.isFrozen(parsed.target), true);
});

test("essai natif : plans inconnus, cibles implicites et tailles UTF-8 invalides refusés", () => {
  for (const raw of [null, [], { ...plan(), extra: true }, { ...plan(), v: 2 },
    { ...plan(), target: { ...plan().target, extra: true } }, { ...plan(), target: { ...plan().target, sessionId: "last" } },
    { ...plan(), target: { ...plan().target, directory: "relative" } }, { ...plan(), target: { ...plan().target, recipient: "x\ny" } },
    { ...plan(), target: { ...plan().target, recipient: " x" } }, { ...plan(), message: "" }, { ...plan(), message: "x\0y" },
    { ...plan(), message: "🙂".repeat(1025) }]) assert.throws(() => parseNativeProbePlan(raw));
  assert.equal(parseNativeProbePlan({ ...plan(), message: "🙂".repeat(1024) }).message.length, 2048);
});

test("essai natif : politique du premier contrôle sans ask, préapprobation ni MCP", () => {
  const policy = nativeFirstProbePolicy();
  assert.deepEqual(policy.tools, ["SendMessage"]);
  assert.deepEqual(policy.allowedTools, []);
  assert.equal(policy.permissionMode, "default");
  assert.equal("permissions" in policy.settings, false);
  assert.deepEqual(policy.mcpServers, {});
  assert.equal(policy.strictMcpConfig, true);
  assert.deepEqual(policy.settingSources, []);
  policy.tools.push("Bash");
  assert.deepEqual(nativeFirstProbePolicy().tools, ["SendMessage"]);
});

test("essai natif : tout outil, toute session et toute répétition reçoivent deny", () => {
  const probe = createNativeDenyProbe(sessionId);
  for (const tool of ["SendMessage", "ListAgents", "Bash", "mcp__fixture__send"]) {
    assert.deepEqual(probe.hook({ ...event(), tool_name: tool, session_id: "foreign" }, "other"), nativeHookDeny());
  }
  assert.deepEqual(probe.hook(event(), "fixture-call"), nativeHookDeny());
  assert.equal(probe.state().hookCalls, 5);
  assert.equal(probe.state().hooks.length, 4);
  assert.equal(hasNativeHookDenial([], sessionId, probe.state()), false);
});

test("essai natif : entrée inconnue, accesseur ou proxy en erreur n'empêche jamais deny", () => {
  let getterCalled = false;
  const accessor = { get tool_input() { getterCalled = true; throw new Error("secret"); } };
  const cycle: any = {}; cycle.self = cycle;
  for (const raw of [undefined, () => {}, accessor, cycle, new Proxy({}, { ownKeys() { throw new Error("secret"); } }),
    { ...event(), tool_input: "x".repeat(16385) }, { ...event(), tool_input: new Array(1_000_000) }]) {
    const probe = createNativeDenyProbe(sessionId);
    assert.deepEqual(probe.hook(raw, "fixture-call"), nativeHookDeny());
    assert.equal(probe.state().captureFailed, true);
  }
  assert.equal(getterCalled, false);
});

test("essai natif : journal indépendant et borné, même plusieurs grosses propositions", () => {
  const probe = createNativeDenyProbe(sessionId), original = event();
  probe.hook(original, "fixture-call");
  original.tool_input.fixtureBody = "changed";
  const state = probe.state();
  state.hooks[0].event.tool_input.fixtureBody = "changed again";
  assert.equal(probe.state().hooks[0].event.tool_input.fixtureBody, input().fixtureBody);
  for (let i = 0; i < 8; i++) probe.hook({ ...event(), tool_input: "a".repeat(12000) }, "fixture-call");
  assert.equal(probe.state().hooks.length, 4);
  assert.equal(probe.state().hookCalls, 9);
});

test("essai natif : refus de permissions sans mise à jour des droits, même entrée invalide", () => {
  const probe = createNativeDenyProbe(sessionId);
  for (const raw of [input(), undefined]) assert.deepEqual(probe.permission("SendMessage", raw, "fixture-call"),
    { behavior: "deny", message: "Palabre native probe: no permission granted" });
  assert.equal(probe.state().permissionCalls, 2);
  assert.equal(probe.state().captureFailed, true);
});

test("essai natif : refus corrélé partiel sur fixture, sans preuve de réception ou schéma natif", () => {
  const { probe, events } = evidence();
  assert.equal(hasNativeHookDenial(events, sessionId, probe.state()), true);
});

test("essai natif : forme observée avec summary supplémentaire au hook, verdict strict négatif conservé", () => {
  const { events } = evidence(), probe = createNativeDenyProbe(sessionId);
  // Forme relevée après l'essai autorisé, avec uniquement des noms/textes/ID fictifs.
  // Ce n'est pas une déclaration de schéma natif : les champs supplémentaires restent opaques.
  const proposal = { to: "fixture-native-name", message: "Texte fictif sans action.",
    type: "message", recipient: "fixture-native-name", recipient_kind: "name", content: "Texte fictif…" };
  events[1].message.content[0].input = proposal;
  assert.deepEqual(probe.hook({ ...event(), tool_input: { to: proposal.to, summary: proposal.message,
    message: proposal.message, type: proposal.type, recipient: proposal.recipient,
    recipient_kind: proposal.recipient_kind, content: proposal.content } }, "fixture-call"), nativeHookDeny());
  assert.equal(probe.state().captureFailed, false);
  assert.equal(probe.state().hookCalls, 1);
  assert.equal(hasNativeHookDenial(events, sessionId, probe.state()), false);
});

test("essai natif : compteur de hook et prose ne remplacent aucun événement lié", () => {
  for (let i = 0; i < 4; i++) {
    const { probe, events } = evidence();
    events.splice(i, 1);
    events.push({ type: "assistant", session_id: sessionId, message: { model: "claude-opus-5-5", content: [{ type: "text", text: "No message sent" }] } });
    assert.equal(hasNativeHookDenial(events, sessionId, probe.state()), false);
  }
});

test("essai natif : autres versions/outils/modèles/ID/sessions et métadonnées refusés", () => {
  const mutations = [
    (rows: any[]) => { rows[0].tools.push("Bash"); }, (rows: any[]) => { rows[0].mcp_servers.push({ name: "fixture" }); },
    (rows: any[]) => { rows[0].claude_code_version = "2.1.303"; }, (rows: any[]) => { rows[1].message.model = "other"; },
    (rows: any[]) => { rows[1].session_id = "foreign"; }, (rows: any[]) => { rows[1].message.content[0].name = "mcp__fixture__SendMessage"; },
    (rows: any[]) => { rows[1].message.content[0].input.fixtureBody = input().fixtureBody.replace("\r\n", "\n"); },
    (rows: any[]) => { rows[2].message.content[0].tool_use_id = "foreign"; },
    (rows: any[]) => { rows[2].tool_result_meta[0].permission_decision.source = "user_reject"; },
    (rows: any[]) => { rows[3].permission_denials[0].tool_use_id = "foreign"; }, (rows: any[]) => { rows[3].is_error = true; },
    (rows: any[]) => { rows.push(rows[1]); }
  ];
  for (const mutate of mutations) { const { probe, events } = evidence(); mutate(events); assert.equal(hasNativeHookDenial(events, sessionId, probe.state()), false); }
});

test("essai natif : ID du callback absent/étranger ou seconde demande invalide le constat", () => {
  for (const id of [undefined, "foreign", "x".repeat(513)]) {
    const { events } = evidence(), probe = createNativeDenyProbe(sessionId);
    probe.hook(event(), id);
    assert.equal(hasNativeHookDenial(events, sessionId, probe.state()), false);
  }
  const { probe, events } = evidence();
  probe.permission("SendMessage", input(), "fixture-call");
  assert.equal(hasNativeHookDenial(events, sessionId, probe.state()), false);
});

test("essai natif : aide et arguments invalides n'importent pas le SDK ni ne lancent Claude", () => {
  const script = fileURLToPath(new URL("../../../scripts/prototypes/relay/claudeNativeProbe.mjs", import.meta.url));
  assert.match(execFileSync(process.execPath, [script, "--help"], { encoding: "utf8" }), /Accord humain distinct requis/);
  for (const args of [[], ["--run"], ["--run", "relative", "relative", "relative", "relative"], ["--second-control"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Arguments refusés/);
    assert.equal(result.stdout, "");
  }
});
