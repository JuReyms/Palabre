/** @file Lanceur du second contrôle : faux SDK injecté, aucun query SDK, processus Claude ou compte réel. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getEventListeners } from "node:events";
import { parseNativeAskRunPlan, runNativeAskProbe } from "../scripts/prototypes/relay/claudeNativeAskRunner.js";

const sessionId = "11111111-1111-4111-8111-111111111111";
const plan = () => ({ v: 1, target: { sessionId: "22222222-2222-4222-8222-222222222222", directory: "C:\\fixture-recipient", recipient: "fixture-only" }, message: "Texte fictif" });
const body = () => ({ to: "fixture-only", message: plan().message, type: "message", recipient: "fixture-only", recipient_kind: "name", content: plan().message });
const hookBody = () => ({ ...body(), summary: plan().message });
const hookEvent = () => ({ hook_event_name: "PreToolUse", session_id: sessionId, tool_name: "SendMessage", tool_use_id: "fixture-call", tool_input: hookBody() });
const initEvent = () => ({ type: "system", subtype: "init", session_id: sessionId, claude_code_version: "2.1.302", model: "claude-opus-5-5", permissionMode: "default", tools: ["SendMessage"], mcp_servers: [] });

/** Faux runtime : peut volontairement ignorer ask pour matérialiser le pire cas sans envoyer. */
function fixture(scenario = "valid") {
  const controller = new AbortController();
  let requests = 0, prompts = 0, closes = 0, timerRemoved = 0, fakeExecutions = 0;
  let expire = () => {}, options: any, preflightPromptSeen = false;
  const query = (request: any) => {
    requests++; options = request.options;
    const prompt = request.prompt[Symbol.asyncIterator]().next().then((item: any) => { if (!item.done) prompts++; return item; });
    return {
      async initializationResult() {
        await Promise.resolve(); preflightPromptSeen = prompts > 0;
        if (scenario === "init-timeout") { expire(); return new Promise(() => {}); }
        return scenario === "bad-handshake" ? { claude_code_version: "future", hooks_applied: true }
          : { claude_code_version: "2.1.302", hooks_applied: true };
      },
      close() {
        closes++;
        if (["close-callback", "timeout-close-callback"].includes(scenario)) {
          void options.canUseTool("SendMessage", hookBody(), { toolUseID: "fixture-call",
            matchedAskRule: { source: "flagSettings", toolName: "SendMessage" } });
        }
        if (scenario === "close-hook") void options.hooks.PreToolUse[0].hooks[0](hookEvent(), "fixture-call");
        if (scenario === "close-error") throw new Error("private diagnostic");
      },
      async *[Symbol.asyncIterator]() {
        if ((await prompt).done) return;
        for (let i = 0; i < 20; i++) options.stderr("private fixture ".repeat(300));
        const hook = options.hooks.PreToolUse[0].hooks[0];
        if (scenario === "early-hook") assert.equal((await hook(hookEvent(), "fixture-call")).hookSpecificOutput.permissionDecision, "deny");
        yield scenario === "bad-inventory" ? { ...initEvent(), tools: ["SendMessage", "Bash"] }
          : scenario === "bad-mode" ? { ...initEvent(), permissionMode: "bypassPermissions" } : initEvent();
        if (scenario === "event-count") { for (let i = 0; i < 260; i++) yield { type: "system", subtype: "fixture-progress" }; return; }
        yield { type: "assistant", session_id: sessionId, message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id: "fixture-call", name: "SendMessage", input: body() }] } };
        const decision = await hook(scenario === "changed" ? { ...hookEvent(), tool_input: { ...hookBody(), content: "preview" } } : hookEvent(), "fixture-call");
        let denied = !!decision.hookSpecificOutput;
        if (!denied) {
          if (scenario === "iterator-error") throw new Error("private diagnostic");
          if (["stream-timeout", "timeout-close-callback"].includes(scenario)) { expire(); await new Promise(() => {}); }
          if (scenario === "cancel") { controller.abort(); await new Promise(() => {}); }
          if (scenario === "event-bytes") { yield { type: "system", data: "x".repeat(4 * 1024 * 1024) }; return; }
          if (["without-callback", "close-callback"].includes(scenario)) fakeExecutions++;
          else {
            const result = await options.canUseTool("SendMessage", hookBody(), { toolUseID: "fixture-call",
              matchedAskRule: { source: scenario === "other-rule" ? "session" : "flagSettings", toolName: "SendMessage" } });
            assert.deepEqual(result, { behavior: "deny", message: "Palabre native probe: no permission granted" }); denied = true;
          }
        }
        const source = decision.hookSpecificOutput ? "hook" : denied ? "user_reject" : "config";
        yield { type: "user", session_id: sessionId, message: { content: [{ type: "tool_result", tool_use_id: "fixture-call", is_error: denied }] },
          tool_result_meta: [{ id: "fixture-call", non_execution_kind: "permission-rule", permission_decision: { decision: denied ? "reject" : "accept", source } }] };
        yield { type: "result", session_id: sessionId, subtype: "success", is_error: false, modelUsage: { "claude-opus-5-5": {} },
          permission_denials: denied ? [{ tool_name: "SendMessage", tool_use_id: "fixture-call" }] : [] };
      }
    };
  };
  return {
    controller,
    run: () => runNativeAskProbe({ sessionId, plan: plan(), directory: "C:\\fixture-messenger", executable: "C:\\fixture\\claude.exe",
      env: { FIXTURE_ONLY: "value" }, query, abortController: controller, now: () => 1,
      scheduleDeadline: (callback, milliseconds) => { assert.equal(milliseconds, 120000); expire = callback; return () => { timerRemoved++; }; } }),
    counts: () => ({ requests, prompts, closes, timerRemoved, fakeExecutions, preflightPromptSeen }),
    options: () => options
  };
}

test("lanceur ask : format distinct du premier plan, sans autorité ou valeur d'accord", () => {
  assert.deepEqual(parseNativeAskRunPlan({ v: 1, kind: "native-ask-deny-probe", plan: plan() }), plan());
  let reads = 0;
  for (const raw of [plan(), {}, { v: 1, kind: "first", plan: plan() }, { v: 1, kind: "native-ask-deny-probe", plan: plan(), approved: true },
    { v: 1, kind: "native-ask-deny-probe", get plan() { reads++; return plan(); } }]) assert.throws(() => parseNativeAskRunPlan(raw));
  assert.equal(reads, 0);
});
for (const scenario of ["close-callback", "timeout-close-callback", "close-hook"]) {
  test(`lanceur ask : ${scenario}, le nettoyage ne réécrit pas le constat du tour`, async () => {
    const result = await fixture(scenario).run();
    assert.equal(result.possibleSend, true); assert.equal(result.correlatedCallbackDenial, false);
    assert.equal(result.delivery, "unverified"); assert.ok(result.error);
    if (scenario === "close-hook") {
      assert.equal(result.probe.capture.hookCalls, 1); assert.equal(result.lateHookCalls, 1);
    } else {
      assert.equal(result.probe.capture.permissionCalls, 0); assert.equal(result.latePermissionCalls, 1);
      assert.equal(result.attention, "possible-send-without-callback");
    }
    if (scenario === "timeout-close-callback") assert.equal(result.outerTimedOut, true);
  });
}
test("lanceur ask : un seul faux query, handshake avant prompt, politique fermée et nettoyage", async () => {
  const run = fixture(), result = await run.run();
  assert.deepEqual(run.counts(), { requests: 1, prompts: 1, closes: 1, timerRemoved: 1, fakeExecutions: 0, preflightPromptSeen: false });
  assert.equal(result.correlatedCallbackDenial, true); assert.equal(result.passed, false); assert.equal(result.delivery, "unverified");
  assert.equal(result.possibleSend, true); assert.equal(result.closeRequested, true); assert.equal(result.error, null);
  assert.deepEqual(run.options().settings.permissions, { ask: ["SendMessage"] });
  assert.deepEqual(run.options().allowedTools, []); assert.deepEqual(run.options().tools, ["SendMessage"]);
  assert.equal(run.options().cwd, "C:\\fixture-messenger"); assert.equal(run.options().model, "claude-opus-5-5");
  assert.equal(result.stderr.length, 16); assert.equal(result.stderr.every(line => line.length <= 2048), true);
  assert.equal(getEventListeners(run.controller.signal, "abort").length, 0);
});
test("lanceur ask : mauvais handshake ne libère jamais le prompt", async () => {
  const run = fixture("bad-handshake"), result = await run.run();
  assert.equal(run.counts().requests, 1); assert.equal(run.counts().prompts, 0);
  assert.equal(result.initializationVerified, false); assert.equal(result.promptReleased, false);
  assert.equal(result.error?.kind, "initialization-unverified"); assert.equal(run.counts().closes, 1);
});
test("lanceur ask : annulation préalable ne construit aucun query", async () => {
  const run = fixture(); run.controller.abort(); const result = await run.run();
  assert.equal(run.counts().requests, 0); assert.equal(result.promptReleased, false); assert.equal(result.error?.kind, "cancelled");
});
for (const scenario of ["bad-inventory", "bad-mode", "early-hook"]) {
  test(`lanceur ask : ${scenario}, aucun passage neutre ni faux positif`, async () => {
    const run = fixture(scenario), result = await run.run();
    assert.equal(result.probe.neutralCount, 0); assert.equal(result.correlatedCallbackDenial, false);
    assert.equal(run.counts().fakeExecutions, 0); assert.ok(result.error); assert.equal(run.counts().closes, 1);
  });
}
test("lanceur ask : premier hook bloquant ne qualifie pas le callback absent", async () => {
  const result = await fixture("changed").run();
  assert.equal(result.probe.capture.permissionCalls, 0); assert.equal(result.possibleSend, false);
  assert.equal(result.correlatedCallbackDenial, false); assert.equal(result.delivery, "unverified");
});
test("lanceur ask : règle étrangère toujours refusée mais constat négatif", async () => {
  const result = await fixture("other-rule").run();
  assert.equal(result.probe.capture.permissionCalls, 1); assert.equal(result.correlatedCallbackDenial, false);
  assert.equal(result.possibleSend, true); assert.equal(result.delivery, "unverified");
});
test("lanceur ask : runtime factice ignorant ask peut exécuter, sans faux non-envoi", async () => {
  const run = fixture("without-callback"), result = await run.run();
  assert.equal(run.counts().fakeExecutions, 1); assert.equal(result.probe.capture.permissionCalls, 0);
  assert.equal(result.possibleSend, true); assert.equal(result.attention, "possible-send-without-callback");
  assert.equal(result.correlatedCallbackDenial, false); assert.equal(result.passed, false); assert.equal(result.delivery, "unverified");
});
for (const scenario of ["init-timeout", "stream-timeout", "cancel", "iterator-error", "close-error", "event-count", "event-bytes"]) {
  test(`lanceur ask : ${scenario}, fermeture demandée, trace partielle et aucune relance`, async () => {
    const run = fixture(scenario), result = await run.run();
    assert.equal(run.counts().requests, 1); assert.equal(run.counts().closes, 1); assert.equal(run.counts().timerRemoved, 1);
    assert.ok(result.error); assert.equal(result.correlatedCallbackDenial, false); assert.equal(result.passed, false);
    assert.equal(result.delivery, "unverified"); assert.equal(result.events.length <= 256, true);
    assert.equal(getEventListeners(run.controller.signal, "abort").length, 0);
    if (["stream-timeout", "cancel", "iterator-error", "event-bytes"].includes(scenario)) {
      assert.equal(result.possibleSend, true); assert.equal(result.attention, "possible-send-without-callback");
    }
    if (scenario.endsWith("timeout")) assert.equal(result.outerTimedOut, true);
    if (scenario.startsWith("event-")) assert.equal(result.truncated, true);
  });
}
test("lanceur ask : aide et arguments invalides sans runtime SDK ni conversation", () => {
  const script = fileURLToPath(new URL("../../../scripts/prototypes/relay/claudeNativeAskProbe.mjs", import.meta.url));
  const help = execFileSync(process.execPath, [script, "--help"], { encoding: "utf8" });
  assert.match(help, /Accord humain distinct requis/); assert.match(help, /Un accord de quota ne suffit pas/);
  for (const args of [[], ["--run"], ["--run", "relative", "relative", "relative", "relative"], ["--second-control"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2); assert.equal(result.stdout, ""); assert.match(result.stderr, /Arguments refusés/);
  }
});
