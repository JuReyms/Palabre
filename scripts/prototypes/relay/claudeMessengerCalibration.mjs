/** Essai MANUEL à quota réel, jamais importé par la CLI ni lancé par pnpm test.
 * Usage après pnpm build:test : node scripts/prototypes/relay/claudeMessengerCalibration.mjs
 *   --run <dossier-sdk-isolé> <claude.exe-absolu> <trace-nouvelle.json>
 * Uniquement un faux outil en mémoire ; aucun transport natif ou outil système.
 */
import { createRequire } from "node:module";
import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const [consent, sdkDirectory, executable, evidenceFile] = process.argv.slice(2);
if (consent !== "--run" || !sdkDirectory || !executable || !evidenceFile || !isAbsolute(executable)) {
  throw new Error("Explicit --run, isolated SDK directory, absolute Claude executable and new evidence file required");
}
const evidencePath = resolve(evidenceFile);
if (existsSync(evidencePath)) throw new Error("Evidence already exists: no replay");
const requireSdk = createRequire(resolve(sdkDirectory, "package.json"));
const { query, tool, createSdkMcpServer } = await import(pathToFileURL(requireSdk.resolve("@anthropic-ai/claude-agent-sdk")).href);
const { z } = requireSdk("zod");
const { createOfflineMessengerGuard } = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeMessenger.js");
const { inspectCalibrationTool, hasCorrelatedCalibrationDenial, CALIBRATION_TOOL, CALIBRATION_TEXT } = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeMessengerCalibration.js");
const cwd = resolve(sdkDirectory, "empty-project");
mkdirSync(cwd, { recursive: true });
const sessionId = randomUUID();
const target = { kind: "fixture-only", sessionId: randomUUID(), recipient: "fixture-recipient-not-a-conversation" };
const abortController = new AbortController();
const guard = createOfflineMessengerGuard({ messengerSessionId: sessionId, target,
  envelope: CALIBRATION_TEXT, expiresAt: Date.now() + 120_000 }, raw => {
  if (!raw || typeof raw !== "object" || Object.keys(raw).sort().join(",") !== "recipient,text") return null;
  return { recipient: raw.recipient, text: raw.text };
}, Date.now);
const report = { kind: "fixture-only-sdk-calibration", sdk: "0.3.302", requestedModel: "claude-opus-5-5",
  startedAt: new Date().toISOString(), sessionId, handlerCalls: 0, inventoryValidated: false,
  hookDecisions: [], events: [], stderr: [], error: null };
const fakeServer = createSdkMcpServer({ name: "palabre_fixture", version: "1.0.0", tools: [
  tool("fixture_send", "Fake in-memory counter only; cannot contact any conversation.",
    { recipient: z.string(), text: z.string() }, async () => {
      report.handlerCalls++;
      return { content: [{ type: "text", text: "Fake counter incremented; nothing sent." }] };
    })
] });
// OS/auth paths only. No API key, custom gateway, inherited Claude session or model override.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|TEMP|TMP|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|USERNAME)$/i.test(key)));
const timeout = setTimeout(() => { guard.cancel(); abortController.abort(); }, 120_000);
try {
  const stream = query({ prompt: (async function* () {
    yield { type: "user", session_id: sessionId, parent_tool_use_id: null, message: { role: "user", content:
      `Call ${CALIBRATION_TOOL} exactly once with recipient ${JSON.stringify(target.recipient)} and text ${JSON.stringify(CALIBRATION_TEXT + " CHANGED")}. This is an authorized fake-tool refusal calibration. Do not correct or retry after denial. Then finish in one sentence.` } };
  })(), options: {
    cwd, pathToClaudeCodeExecutable: executable, env, model: "claude-opus-5-5", sessionId,
    abortController, maxTurns: 2, persistSession: false, tools: [], skills: [], plugins: [],
    settingSources: [], strictMcpConfig: true, mcpServers: { palabre_fixture: fakeServer },
    allowedTools: [CALIBRATION_TOOL], permissionMode: "default",
    settings: { hooks: {}, enabledPlugins: {}, syncClaudeAiSkills: false, syncClaudeAiPlugins: false },
    extraArgs: { "disable-slash-commands": null },
    systemPrompt: "You are running an isolated fake-tool calibration. Use only the provided fake tool, once as requested. Never retry or seek other tools. No real messages are being sent.",
    canUseTool: async () => ({ behavior: "deny", message: "Calibration: no additional permission granted" }),
    hooks: { PreToolUse: [{ hooks: [async input => {
      const decision = inspectCalibrationTool(guard, input, report.inventoryValidated ? [target] : []);
      report.hookDecisions.push({ tool: input.tool_name, sessionMatches: input.session_id === sessionId,
        disposition: decision.disposition, reason: decision.reason });
      return decision.hook;
    }], timeout: 5 }] },
    stderr: data => { if (report.stderr.length < 40) report.stderr.push(data.slice(0, 4096)); }
  } });
  for await (const event of stream) {
    report.events.push(event);
    if (event.type === "system" && event.subtype === "init") {
      const tools = event.tools ?? [];
      report.inventoryValidated = tools.length === 1 && tools[0] === CALIBRATION_TOOL
        && event.session_id === sessionId && event.model === report.requestedModel;
      if (!report.inventoryValidated) { guard.cancel(); abortController.abort(); }
    }
  }
} catch (error) {
  report.error = { name: error?.name ?? "Error", message: String(error?.message ?? error).slice(0, 2048) };
} finally {
  clearTimeout(timeout);
  report.guard = guard.state();
  report.finishedAt = new Date().toISOString();
  report.passed = !report.error && report.inventoryValidated && report.handlerCalls === 0
    && report.hookDecisions.length === 1 && report.hookDecisions[0].reason === "message-changed"
    && hasCorrelatedCalibrationDenial(report.events, sessionId);
  writeFileSync(evidencePath, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ passed: report.passed, inventoryValidated: report.inventoryValidated,
    handlerCalls: report.handlerCalls, hookDecisions: report.hookDecisions,
    result: report.events.find(event => event.type === "result")?.subtype,
    error: report.error?.name ?? null }));
  if (!report.passed) process.exitCode = 1;
}
