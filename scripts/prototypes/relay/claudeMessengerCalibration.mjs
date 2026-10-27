/** Essai MANUEL à quota réel, jamais importé par la CLI ni lancé par pnpm test.
 * Usage après pnpm build:test : node scripts/prototypes/relay/claudeMessengerCalibration.mjs
 *   --run <dossier-sdk-isolé> <claude.exe-absolu> <trace-nouvelle.json> <scénario>
 * Scénarios historiques : changed|throw|timeout ; préparés : guarded-valid|guarded-throw|guarded-timeout.
 * Uniquement un faux outil en mémoire ; aucun transport natif ou outil système.
 */
import { createRequire } from "node:module";
import { resolve, isAbsolute, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";

const [consent, sdkDirectory, executable, evidenceFile, scenario = "changed"] = process.argv.slice(2);
if (consent !== "--run" || !sdkDirectory || !executable || !evidenceFile || !isAbsolute(executable)
  || !["changed", "throw", "timeout", "guarded-valid", "guarded-throw", "guarded-timeout"].includes(scenario) || process.argv.length > 7) {
  throw new Error("Explicit --run, isolated SDK directory, absolute Claude executable, new evidence file and known scenario required");
}
const evidencePath = resolve(evidenceFile);
if (existsSync(evidencePath)) throw new Error("Evidence already exists: no replay");
const requireSdk = createRequire(resolve(sdkDirectory, "package.json"));
const sdkEntry = requireSdk.resolve("@anthropic-ai/claude-agent-sdk");
const sdkManifest = JSON.parse(readFileSync(resolve(dirname(sdkEntry), "package.json"), "utf8"));
if (sdkManifest.version !== "0.3.302") throw new Error("Calibration requires SDK 0.3.302; no fallback or install");
const { query, tool, createSdkMcpServer } = await import(pathToFileURL(sdkEntry).href);
const { z } = requireSdk("zod");
const { createOfflineMessengerGuard } = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeMessenger.js");
const { inspectCalibrationTool, hasCorrelatedCalibrationDenial, hasQualifiedCalibrationFaultBlock, CALIBRATION_TOOL, CALIBRATION_TEXT } = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeMessengerCalibration.js");
const { createGuardedCalibration, guardedFixturePolicy } = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeMessengerGuarded.js");
const cwd = resolve(sdkDirectory, "empty-project");
mkdirSync(cwd, { recursive: true });
const sessionId = randomUUID();
const target = { kind: "fixture-only", sessionId: randomUUID(), recipient: "fixture-recipient-not-a-conversation" };
const abortController = new AbortController();
const isGuarded = scenario.startsWith("guarded-");
const envelope = isGuarded ? "PALABRE GUARDED FIXTURE" : CALIBRATION_TEXT;
const plan = { messengerSessionId: sessionId, target, envelope, expiresAt: Date.now() + 120_000 };
const guard = createOfflineMessengerGuard(plan, raw => {
  if (!raw || typeof raw !== "object" || Object.keys(raw).sort().join(",") !== "recipient,text") return null;
  return { recipient: raw.recipient, text: raw.text };
}, Date.now);
const guardedPolicy = guardedFixturePolicy();
const guarded = isGuarded ? createGuardedCalibration(plan, {
  now: Date.now, schedule: (delay, expire) => { const timer = setTimeout(expire, delay); return () => { clearTimeout(timer); }; }
}, () => {
  if (scenario === "guarded-throw") throw new Error("Fixture calibration: intentional guarded failure");
  if (scenario === "guarded-timeout") return new Promise(() => {});
}) : undefined;
const report = { kind: "fixture-only-sdk-calibration", sdk: sdkManifest.version, scenario, requestedModel: "claude-opus-5-5",
  startedAt: new Date().toISOString(), sessionId, handlerCalls: 0, inventoryValidated: false,
  hookDecisions: [], permissionDecisions: [], events: [], stderr: [], error: null, outerTimedOut: false,
  profile: isGuarded ? "guarded-deny-only-unqualified" : "historical-preapproved" };
const fakeServer = createSdkMcpServer({ name: "palabre_fixture", version: "1.0.0", tools: [
  tool("fixture_send", "Fake in-memory counter only; cannot contact any conversation.",
    { recipient: z.string(), text: z.string() }, async () => {
      report.handlerCalls++;
      return { content: [{ type: "text", text: "Fake counter incremented; nothing sent." }] };
    })
] });
if (isGuarded) fakeServer.tools = guardedPolicy.mcpToolPolicy;
// OS/auth paths only. No API key, custom gateway, inherited Claude session or model override.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|TEMP|TMP|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|USERNAME)$/i.test(key)));
const timeout = setTimeout(() => { report.outerTimedOut = true; guard.cancel(); guarded?.cancel(); abortController.abort(); }, 120_000);
let faultStarted;
try {
  const stream = query({ prompt: (async function* () {
    yield { type: "user", session_id: sessionId, parent_tool_use_id: null, message: { role: "user", content:
      `Call ${CALIBRATION_TOOL} exactly once with recipient ${JSON.stringify(target.recipient)} and text ${JSON.stringify(envelope + (scenario === "changed" ? " CHANGED" : ""))}. This is an authorized fake-tool calibration (${scenario}). Whatever happens, do not correct, repeat, retry or seek another tool. Then finish in one sentence.` } };
  })(), options: {
    cwd, pathToClaudeCodeExecutable: executable, env, model: "claude-opus-5-5", sessionId,
    abortController, maxTurns: 2, persistSession: false, tools: [], skills: [], plugins: [],
    settingSources: [], strictMcpConfig: true, mcpServers: { palabre_fixture: fakeServer },
    allowedTools: isGuarded ? guardedPolicy.allowedTools : [CALIBRATION_TOOL], permissionMode: "default",
    settings: { hooks: {}, enabledPlugins: {}, syncClaudeAiSkills: false, syncClaudeAiPlugins: false },
    extraArgs: { "disable-slash-commands": null },
    systemPrompt: "You are running an isolated fake-tool calibration. Use only the provided fake tool, once as requested. Never retry or seek other tools. No real messages are being sent.",
    canUseTool: async toolName => {
      const decision = guarded ? await guarded.canUseTool() : { behavior: "deny", message: "Calibration: no additional permission granted" };
      report.permissionDecisions.push({ tool: toolName, behavior: decision.behavior });
      return decision;
    },
    hooks: { PreToolUse: [{ hooks: [async (input, toolUseId, { signal }) => {
      if (guarded) {
        if (!report.inventoryValidated) guarded.cancel();
        const output = await guarded.hook(input, signal);
        report.hookDecisions.push({ tool: input.tool_name, toolUseId, sessionMatches: input.session_id === sessionId,
          disposition: output.hookSpecificOutput ? "blocked" : "continue-permissions", reason: "guarded" });
        return output;
      }
      if (scenario !== "changed" && report.inventoryValidated && report.hookDecisions.length === 0
        && input.hook_event_name === "PreToolUse" && input.tool_name === CALIBRATION_TOOL
        && input.session_id === sessionId && typeof input.tool_use_id === "string" && input.tool_use_id.length > 0
        && (toolUseId === undefined || toolUseId === input.tool_use_id)) {
        faultStarted = performance.now();
        const observation = { tool: input.tool_name, toolUseId: input.tool_use_id, sessionMatches: true,
          disposition: "injected-fault", reason: scenario, signalAborted: signal.aborted };
        report.hookDecisions.push(observation);
        // Empêche un éventuel deuxième appel du modèle, sans masquer le résultat
        // du premier : le faux gestionnaire ne consulte pas ce garde.
        guard.cancel();
        signal.addEventListener("abort", () => { observation.signalAborted = true; }, { once: true });
        if (scenario === "throw") throw new Error("Fixture calibration: intentional hook failure");
        // Ne renvoie ni deny, ni allow, ni {} : le vrai SDK doit gérer son propre délai.
        return await new Promise(() => {});
      }
      const decision = inspectCalibrationTool(guard, input, report.inventoryValidated ? [target] : []);
      report.hookDecisions.push({ tool: input.tool_name, toolUseId, sessionMatches: input.session_id === sessionId,
        disposition: decision.disposition, reason: decision.reason });
      return decision.hook;
    }], timeout: 5 }] },
    stderr: data => { if (report.stderr.length < 40) report.stderr.push(data.slice(0, 4096)); }
  } });
  for await (const event of stream) {
    report.events.push(event);
    if (faultStarted !== undefined && report.faultElapsedMs === undefined && event.type === "user"
      && event.message?.content?.some?.(block => block.type === "tool_result" && block.tool_use_id === report.hookDecisions[0]?.toolUseId)) {
      report.faultElapsedMs = performance.now() - faultStarted;
    }
    if (event.type === "system" && event.subtype === "init") {
      const tools = event.tools ?? [];
      report.inventoryValidated = tools.length === 1 && tools[0] === CALIBRATION_TOOL
        && event.session_id === sessionId && event.model === report.requestedModel
        && event.claude_code_version === "2.1.302" && event.mcp_servers?.length === 1
        && event.mcp_servers[0].name === "palabre_fixture" && event.mcp_servers[0].source === "sdk"
        && event.mcp_servers[0].status === "connected";
      if (!report.inventoryValidated) { guard.cancel(); guarded?.cancel(); abortController.abort(); }
    }
  }
} catch (error) {
  report.error = { name: error?.name ?? "Error", message: String(error?.message ?? error).slice(0, 2048) };
} finally {
  clearTimeout(timeout);
  report.guard = guarded ? guarded.state() : guard.state();
  report.finishedAt = new Date().toISOString();
  // Profil préparé seulement : les compteurs seront des observations, pas une qualification
  // automatique du nouveau chemin canUseTool dont la trace réelle reste inconnue.
  report.passed = isGuarded ? false : scenario === "changed" ? !report.error && report.inventoryValidated && report.handlerCalls === 0
    && report.hookDecisions.length === 1 && report.hookDecisions[0].reason === "message-changed"
    && hasCorrelatedCalibrationDenial(report.events, sessionId)
    : hasQualifiedCalibrationFaultBlock(report);
  writeFileSync(evidencePath, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ scenario, passed: report.passed, inventoryValidated: report.inventoryValidated,
    handlerCalls: report.handlerCalls, hookDecisions: report.hookDecisions, permissionDecisions: report.permissionDecisions,
    faultElapsedMs: report.faultElapsedMs, outerTimedOut: report.outerTimedOut,
    result: report.events.find(event => event.type === "result")?.subtype,
    error: report.error?.name ?? null }));
  if (!report.passed) process.exitCode = 1;
}
