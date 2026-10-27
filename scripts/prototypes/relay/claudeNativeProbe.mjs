/** Lanceur MANUEL non qualifié, hors CLI et pnpm test. --help n'importe aucun SDK.
 * --run <SDK-absolu> <claude.exe-absolu> <plan-prive-absolu.json> <trace-nouvelle-absolue.json>
 * Premier contrôle seulement, toujours deny. Un essai réel exige un accord humain
 * sur une conversation jetable et le risque d'envoi si le contrôle natif échoue.
 */
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { readFileSync, statSync, openSync, writeFileSync, closeSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log("Essai natif MANUEL, premier contrôle refusant tout. Préparation hors ligne seulement ; runtime non qualifié.\nUsage après pnpm build:test : node scripts/prototypes/relay/claudeNativeProbe.mjs --run <SDK-absolu> <claude.exe-absolu> <plan-prive-absolu.json> <trace-nouvelle-absolue.json>\nAccord humain distinct requis : conversation jetable, destinataire, dossier, message bénin, Opus5.5 et effets possibles. Aucun retry. --run ne prouve pas cet accord.");
} else if (args.length !== 5 || args[0] !== "--run" || args.slice(1).some(path => !isAbsolute(path))) {
  console.error("Arguments refusés. Utiliser --help ; aucun lancement ni installation implicite.");
  process.exitCode = 2;
} else {
  // Ce branchement n'est jamais parcouru par les tests automatisés avec des arguments valides.
  const [, sdkDirectory, executable, planFile, evidencePath] = args;
  const { parseNativeProbePlan, nativeFirstProbePolicy, nativeHookDeny, createNativeDenyProbe, hasNativeHookDenial }
    = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeNativeProbe.js");
  if (process.platform !== "win32" || !/\.exe$/i.test(executable) || !statSync(executable).isFile()) throw new Error("Windows et CLI native .exe explicite requis");
  if (statSync(planFile).size > 16_384) throw new Error("Plan privé trop grand");
  const plan = parseNativeProbePlan(JSON.parse(readFileSync(planFile, "utf8")));
  if (!statSync(plan.target.directory).isDirectory()) throw new Error("Dossier de la conversation jetable introuvable");
  const requireSdk = createRequire(join(sdkDirectory, "package.json"));
  const sdkEntry = requireSdk.resolve("@anthropic-ai/claude-agent-sdk");
  if (JSON.parse(readFileSync(join(dirname(sdkEntry), "package.json"), "utf8")).version !== "0.3.302") throw new Error("SDK0.3.302 requis ; aucun repli ni installation");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|TEMP|TMP|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|USERNAME)$/i.test(key)));
  const version = execFileSync(executable, ["--version"], { env, encoding: "utf8", timeout: 3000, maxBuffer: 32_768, windowsHide: true }).trim();
  if (version !== "2.1.302 (Claude Code)") throw new Error("CLI2.1.302 requise ; aucune autre installation choisie");
  // Réservation exclusive AVANT tout query : même vide après un crash, ne jamais supprimer pour rejouer.
  const evidence = openSync(evidencePath, "wx", 0o600);
  const sessionId = randomUUID(), abortController = new AbortController();
  const probe = createNativeDenyProbe(sessionId);
  const report = { kind: "native-first-deny-probe", sdk: "0.3.302", sessionId, plan,
    startedAt: new Date().toISOString(), initializationVerified: false, promptReleased: false,
    inventoryValidated: false, events: [], stderr: [], truncated: false, outerTimedOut: false,
    error: null, passed: false, delivery: "unverified" };
  let queryHandle, releasePrompt;
  const promptGate = new Promise(resolve => { releasePrompt = resolve; });
  let budget = 0;
  const abort = () => { releasePrompt(false); abortController.abort(); };
  const onInterrupt = () => { report.error ??= { kind: "cancelled" }; abort(); };
  const timeout = setTimeout(() => { report.outerTimedOut = true; abort(); }, 120_000);
  process.once("SIGINT", onInterrupt);
  try {
    const cwd = mkdtempSync(join(sdkDirectory, "native-deny-project-"));
    report.messengerDirectory = cwd; // Dossier conservé, jamais celui de la conversation destinataire.
    const { query } = await import(pathToFileURL(sdkEntry).href);
    queryHandle = query({ prompt: (async function* () {
      if (!(await promptGate)) return;
      if (abortController.signal.aborted) return;
      report.promptReleased = true;
      yield { type: "user", session_id: sessionId, parent_tool_use_id: null, message: { role: "user", content:
        `Prepare exactly one SendMessage tool call using this operator-selected data: ${JSON.stringify({ recipient: plan.target.recipient, message: plan.message })}. Do not discover sessions, change the recipient or text, retry or call any other tool. This is a negative permission probe: the host intends to reject every tool call. After rejection, finish without retrying.` } };
    })(), options: {
      ...nativeFirstProbePolicy(), cwd, env, pathToClaudeCodeExecutable: executable,
      model: "claude-opus-5-5", sessionId, abortController,
      extraArgs: { "disable-slash-commands": null },
      systemPrompt: "Negative permission probe only. All tool calls must be denied by the host. Use only the operator's explicit recipient and message, at most once. Do not use any fallback, alternative recipient or discovery tool.",
      hooks: { PreToolUse: [{ timeout: 5, hooks: [async (input, id) => {
        try { return probe.hook(input, id); } catch { return nativeHookDeny(); }
      }] }] },
      canUseTool: async (tool, input, context) => {
        try { return probe.permission(tool, input, context.toolUseID); }
        catch { return { behavior: "deny", message: "Palabre native probe: no permission granted" }; }
      },
      stderr: chunk => {
        if (report.stderr.length < 16) report.stderr.push(String(chunk).slice(0, 2048));
      }
    } });
    // Le prompt attend le handshake : une version ou inscription de hooks non vérifiée ne lance aucun tour.
    const init = await queryHandle.initializationResult();
    report.initializationVerified = init.claude_code_version === "2.1.302" && init.hooks_applied === true;
    releasePrompt(report.initializationVerified && !abortController.signal.aborted);
    if (!report.initializationVerified) { report.error = { kind: "initialization-unverified" }; abort(); }
    let initCount = 0;
    for await (const event of queryHandle) {
      const encoded = JSON.stringify(event);
      budget += Buffer.byteLength(encoded);
      if (budget > 4 * 1024 * 1024 || report.events.length >= 256) { report.truncated = true; abort(); break; }
      report.events.push(event);
      if (event.type === "system" && event.subtype === "init") {
        initCount++;
        report.inventoryValidated = initCount === 1 && event.session_id === sessionId
          && event.model === "claude-opus-5-5" && event.claude_code_version === "2.1.302"
          && JSON.stringify(event.tools) === '["SendMessage"]' && Array.isArray(event.mcp_servers) && event.mcp_servers.length === 0;
        if (!report.inventoryValidated) { report.error = { kind: "inventory-unverified" }; abort(); }
      }
    }
  } catch (error) {
    report.error ??= { kind: "probe-error", name: error?.name ?? "Error" };
    abort();
  } finally {
    clearTimeout(timeout);
    process.removeListener("SIGINT", onInterrupt);
    releasePrompt(false);
    try { queryHandle?.close(); } catch { report.error ??= { kind: "close-error" }; }
    report.probe = probe.state();
    report.correlatedHookDenial = report.initializationVerified && report.promptReleased && report.inventoryValidated
      && !report.error && !report.outerTimedOut && !report.truncated && hasNativeHookDenial(report.events, sessionId, report.probe);
    report.finishedAt = new Date().toISOString();
    try { writeFileSync(evidence, JSON.stringify(report, null, 2)); } finally { closeSync(evidence); }
    // Aucun UUID, texte, compte ou chemin privé sur stdout. Pas de voyant "messagerie qualifiée".
    console.log(JSON.stringify({ kind: report.kind, initializationVerified: report.initializationVerified,
      promptReleased: report.promptReleased, inventoryValidated: report.inventoryValidated,
      hookCalls: report.probe.hookCalls, permissionCalls: report.probe.permissionCalls,
      correlatedHookDenial: report.correlatedHookDenial, passed: false, delivery: "unverified",
      truncated: report.truncated, outerTimedOut: report.outerTimedOut, error: report.error?.kind ?? null }));
    process.exitCode = 1;
  }
}
