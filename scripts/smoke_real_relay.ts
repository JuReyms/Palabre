/**
 * @file Smoke réel de `palabre relay` (lot A5, issue #96), hors `pnpm test`.
 *
 * Lance de vrais agents Claude Code et Codex sur des sessions **jetables**. Codex travaille sous
 * `.tmp/relay-smoke/` du checkout, avec sa confiance existante, jamais forcée ; Claude utilise un
 * dossier temporaire dédié. Aucune session de travail n'est reprise. Prérequis : `pnpm build`.
 * `--codex-checks` crée seulement une session Codex et qualifie ses MCP et son refus attaché ;
 * les autres scénarios ne sont ni rejoués ni annoncés comme réussis par ce passage ciblé.
 *
 * Cas vérifiés :
 * 1. relay vers une conversation fermée, Claude puis Codex : réponse, contexte conservé (nom de
 *    projet fictif mémorisé à la création), délivrance, identité, export, modèle effectif ;
 * 2. relay vers une conversation attachée (Claude : processus non interactif sans message ;
 *    Codex : TUI ouvert dans un pseudo-terminal) : refus
 *    `target-busy`, code 3, historique inchangé (fichiers et lignes, segments Codex compris). Le
 *    message n'est envoyé que si la sonde établit l'attachement ;
 * 3. neutralisation MCP Codex : liste stricte, compteur natif positif chez le témoin puis nul dans
 *    le relay, sans mention inexpliquée de serveur (`RUST_LOG=info`) ;
 *    côté Claude, outils et serveurs MCP annoncés par `system/init` pendant l'échange du relay ;
 * 4. versions des CLIs.
 *
 * Effets de bord assumés, tous sur des données jetables : les deux sessions créées restent dans
 * l'historique des CLIs (`~/.claude/projects`, `~/.codex/sessions`), identifiables par leur dossier
 * temporaire ; `--trust-config` enregistre l'approbation de la config temporaire dans
 * `~/.palabre/trusted-configs.json` ; la reprise témoin démarre les serveurs MCP de l'utilisateur.
 *
 * La trace complète (identifiants et journaux MCP pouvant contenir des données de compte) reste
 * dans `.tmp/relay-smoke/`, ignoré par git. Ne pas la publier. La console ne contient aucun identifiant.
 *
 * Tous les appels imposent `--background` (`smoke_relay_plan.ts`) : avec `relay.view: auto`, une
 * Codex attachée serait jointe en mode ouvert et recevrait le message censé être refusé.
 *
 * Usage : pnpm build, puis pnpm smoke:real-relay [--codex-checks].
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn as spawnPty, type IPty } from "node-pty";
import { CLAUDE_ATTACHED_LABEL, blockedSmokeStartup, claudeAttachedArgs, claudeRefusalPrecondition, codexAttachedArgs, codexMcpLogEvidence, codexPtyEnv,
  historyFootprint, ownedClaudeAttachment, refusalChecks, refusalPrecondition, smokeProcessStopCheck, smokePtyStopCheck, shouldStopSmokePty,
  smokeRelayArgs, type HistoryFootprint, type SmokeProcessOwner } from "./smoke_relay_plan.js";

const repo = process.cwd();
const dist = (file: string) => pathToFileURL(path.join(repo, "dist", file)).href;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const root = path.join(os.tmpdir(), `palabre-relay-smoke-${stamp}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const code = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const cliArgs = process.argv.slice(2);
if (cliArgs.length > 1 || (cliArgs.length === 1 && cliArgs[0] !== "--codex-checks")) {
  console.error("Usage : pnpm smoke:real-relay [--codex-checks]");
  process.exit(2);
}
const codexOnly = cliArgs[0] === "--codex-checks";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
const trace: Record<string, unknown> = { stamp, root, selection: codexOnly ? "codex-checks" : "full" };

function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "ÉCHEC"} ${name} — ${detail}`);
}

/** Lance la CLI Palabre compilée, sans stdin. */
function palabre(args: string[], signal?: AbortSignal): Promise<{ code: number | null; stdout: string; stderr: string; json: any }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repo, "dist", "index.js"), ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"], signal });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      let json: any = undefined;
      try { json = JSON.parse(stdout); } catch { /* sortie texte */ }
      resolve({ code: exitCode, stdout, stderr, json });
    });
  });
}

const strip = (text: string) => text.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b\[[0-9;?<>=]*[ -/]*[@-~]/g, "");

async function main(): Promise<void> {
  if (!existsSync(path.join(repo, "dist", "index.js"))) throw new Error("dist/index.js absent : lancer pnpm build.");
  const { runExternalProcess, killProcessTree, cleanExternalEnv, pidLiveness } = await import(dist("externalSessions/process.js"));
  const { resolveExternalExecutable } = await import(dist("externalSessions/resolve.js"));
  const { ClaudeSessionAdapter, claudeResumeArgs, interpretClaudeOutput } = await import(dist("externalSessions/claude.js"));
  const { CodexSessionAdapter, parseMcpServerNames, mcpNeutralizationArgs } = await import(dist("externalSessions/codex.js"));
  const { findCodexHistoryFiles } = await import(dist("externalSessions/codexHistory.js"));
  const { exchange, exchangeOutcome } = await import(dist("externalSessions/adapter.js"));
  const { buildEnvelope, createNonce } = await import(dist("externalSessions/envelope.js"));
  const { relayMessages } = await import(dist("messages/relay.js"));

  // `PALABRE_SMOKE_CLAUDE_COMMAND` : exécutable Claude à tester (par exemple une autre version
  // installée) ; par défaut, `claude` résolu dans le PATH comme le ferait la config.
  const claudeCommand = process.env.PALABRE_SMOKE_CLAUDE_COMMAND || "claude";
  const wsClaude = path.join(root, "claude");
  // Respecter la confiance déjà choisie pour le workspace ; ne jamais la forcer sur un dossier temporaire.
  const wsCodex = path.join(repo, ".tmp", "relay-smoke", stamp, "codex");
  mkdirSync(wsClaude, { recursive: true });
  mkdirSync(wsCodex, { recursive: true });
  const configPath = path.join(root, "palabre.config.json");
  writeFileSync(configPath, JSON.stringify({
    language: "fr",
    outputDir: path.join(root, "exports"),
    agents: {
      claude: { type: "cli", command: claudeCommand, role: "reviewer" },
      codex: { type: "cli", command: "codex", role: "implementer" }
    }
  }, null, 2));

  // Exécutables : même résolution que la commande (D21).
  const claudeExe = resolveExternalExecutable(claudeCommand);
  const codexExe = resolveExternalExecutable("codex");
  if (claudeExe.status !== "resolved" || codexExe.status !== "resolved") throw new Error("claude ou codex introuvable.");
  trace.executables = { claude: claudeExe, codex: codexExe };
  const launch = (exe: any, args: string[], cwd: string, stdin: string, timeoutMs: number, env?: NodeJS.ProcessEnv) =>
    runExternalProcess({ command: exe.executable.command, args: [...exe.executable.prefixArgs, ...args], cwd, stdin, timeoutMs, env });

  // 4. Versions.
  const claudeVersion = (await launch(claudeExe, ["--version"], wsClaude, "", 60_000)).stdout.trim();
  const codexVersion = (await launch(codexExe, ["--version"], wsCodex, "", 60_000)).stdout.trim();
  trace.versions = { claude: claudeVersion, codex: codexVersion, node: process.version, platform: `${process.platform} ${os.release()}` };
  console.log(`Versions : Claude Code ${claudeVersion} (${claudeExe.kind}), Codex ${codexVersion} (${codexExe.kind}), Node ${process.version}`);

  // Liste MCP stricte dans le dossier Codex (config utilisateur réelle, lecture seule).
  const listed = await launch(codexExe, ["mcp", "list", "--json", "--disable", "plugins", "--disable", "apps"], wsCodex, "", 60_000);
  const mcpNames: string[] | undefined = listed.exitCode === 0 ? parseMcpServerNames(listed.stdout) : undefined;
  if (!mcpNames) throw new Error("liste MCP Codex non conforme ou en échec.");
  const neutralization: string[] = mcpNeutralizationArgs(mcpNames);
  trace.mcpServers = mcpNames;
  check("liste MCP Codex stricte", true, `${mcpNames.length} serveur(s) déclaré(s) en config : ${mcpNames.join(", ") || "aucun"}`);

  // Création des sessions jetables, avec un fait neutre à retrouver par le relay. Un « mot de code »
  // à révéler à une autre session est traité par Claude comme une tentative d'injection : refusé.
  // Modèles de création : `PALABRE_SMOKE_CLAUDE_MODEL` (haiku par défaut) et
  // `PALABRE_SMOKE_CODEX_MODEL` (modèle de la config Codex par défaut). Le relay reprend ensuite
  // le modèle enregistré, sans le choisir.
  const claudeModel = process.env.PALABRE_SMOKE_CLAUDE_MODEL || "haiku";
  const codexModel = process.env.PALABRE_SMOKE_CODEX_MODEL || undefined;
  const claudeCode = code("ORCHIDEE");
  const codexCode = code("BASALTE");
  const fact = (name: string) => `Contexte pour la suite : le projet de test de cette conversation s'appelle ${name}. Réponds uniquement : OK.`;
  const parse = (stdout: string) => stdout.split(/\r?\n/).map((line: string) => { try { return JSON.parse(line); } catch { return undefined; } }).filter(Boolean);
  const createdClaude = codexOnly ? undefined : await launch(claudeExe, [
    "-p", "--output-format", "stream-json", "--verbose", "--model", claudeModel, "--permission-mode", "plan",
    "--tools", "Read,Glob,Grep", "--strict-mcp-config", "--settings", JSON.stringify({ disableAllHooks: true })
  ], wsClaude, fact(claudeCode), 240_000);
  const claudeEvents = parse(createdClaude?.stdout ?? "");
  const claudeResult = claudeEvents.find((event: any) => event?.type === "result");
  const claudeSession = claudeResult?.is_error === false ? claudeResult.session_id as string : undefined;
  const createdCodex = await launch(codexExe, [
    "exec", ...neutralization, "--json", "--skip-git-repo-check", "--disable", "memories", "--disable", "hooks", "-c", "notify=[]",
    ...(codexModel ? ["-m", codexModel] : []),
    "-c", "sandbox_mode=\"read-only\"", "-c", "approval_policy=\"never\"", "-"
  ], wsCodex, fact(codexCode), 300_000);
  const codexEvents = parse(createdCodex.stdout);
  const codexCompleted = createdCodex.exitCode === 0 && codexEvents.some((event: any) => event?.type === "turn.completed");
  const codexSession = codexCompleted ? codexEvents.find((event: any) => event?.type === "thread.started")?.thread_id as string | undefined : undefined;
  trace.sessions = { claude: claudeSession, codex: codexSession, claudeCode, codexCode, claudeModel, codexModel: codexModel ?? "config" };
  trace.creationModels = {
    claude: claudeEvents.filter((event: any) => event?.type === "assistant").map((event: any) => event.message?.model),
    codexErrors: codexEvents.filter((event: any) => event?.type === "error" || event?.type === "turn.failed").map((event: any) => JSON.stringify(event).slice(0, 300))
  };
  if ((!codexOnly && !claudeSession) || !codexSession) {
    trace.creation = { claude: createdClaude, codex: createdCodex };
    throw new Error(`création d'une session jetable impossible : Claude ${claudeSession ? "ok" : "échec"}, Codex ${codexSession ? "ok" : `échec ${(trace.creationModels as any).codexErrors.join(" ")}`}`);
  }
  check("sessions jetables créées", true, `${codexOnly ? "Codex seul" : `Claude (--model ${claudeModel}) et Codex`} (${codexModel ? `-m ${codexModel}` : "modèle de la config"}), réponses valides`);

  // Même cadre opérateur que la commande avec une config en français (D22).
  const claudeAdapter = new ClaudeSessionAdapter({ operatorFrame: relayMessages.fr.operatorFrame });
  const codexAdapter = new CodexSessionAdapter();
  const claudeLocated = claudeSession ? claudeAdapter.locate({ agent: "claude", sessionId: claudeSession }) : undefined;
  const codexLocated = codexAdapter.locate({ agent: "codex", sessionId: codexSession });
  if ((!codexOnly && claudeLocated?.status !== "found") || codexLocated.status !== "found") throw new Error("session jetable non localisée.");
  check("localisation", true, `dossiers d'origine retrouvés ; modèle Codex enregistré : ${codexLocated.target.model ?? "absent"}`);

  const relayArgs = (from: string, to: string, message: string) => smokeRelayArgs({ from, to, message, configPath });
  const backgroundMode = (json: any) => json?.mode === "background" && json?.modeSource === "explicit";

  if (!codexOnly) {
  // 1. Conversations fermées : réponse et contexte conservé.
  const toClaude = await palabre(relayArgs(`codex:${codexSession}`, `claude:${claudeSession}`, "Comment s'appelle le projet de test mentionné au début de cette conversation ? Réponds uniquement par son nom."));
  trace.closedClaude = toClaude.json ?? { stdout: toClaude.stdout, stderr: toClaude.stderr };
  check("Claude fermé : replied", toClaude.code === 0 && toClaude.json?.status === "replied", `code ${toClaude.code}, statut ${toClaude.json?.status}`);
  check("Claude fermé : contexte conservé", String(toClaude.json?.reply ?? "").trim() === claudeCode, "réponse égale au seul nom du projet attendu (une citation dans un refus ne suffit pas)");
  check("Claude fermé : délivrance et identité", toClaude.json?.delivery?.status === "replied" && toClaude.json?.delivery?.persisted === true && toClaude.json?.identity === "same-as-target",
    `délivrance ${toClaude.json?.delivery?.status}, persisted ${toClaude.json?.delivery?.persisted}, identité ${toClaude.json?.identity}, modèles ${(toClaude.json?.observedModels ?? []).join(", ")}`);
  check("Claude fermé : export", Boolean(toClaude.json?.exportPath && existsSync(toClaude.json.exportPath)), "export .relay.md écrit");
  check("Claude fermé : arrière-plan explicite", backgroundMode(toClaude.json), `mode ${toClaude.json?.mode} (${toClaude.json?.modeSource})`);
  // Observation, pas une vérification : modèle de création et modèle effectif de la reprise.
  console.log(`Observation : Claude créé avec --model ${claudeModel} (${(trace.creationModels as any).claude.filter(Boolean).join(", ")}), repris sans --model avec ${(toClaude.json?.observedModels ?? []).join(", ") || "?"}`);

  // Observation : même question sans cadre opérateur, sur une session neuve (aucune influence sur
  // la session vérifiée). Ce témoin isolé ne prouve pas que le cadre est nécessaire ou sans effet.
  const controlCode = code("TEMOIN");
  const controlCreated = await launch(claudeExe, [
    "-p", "--output-format", "stream-json", "--verbose", "--model", claudeModel, "--permission-mode", "plan",
    "--tools", "Read,Glob,Grep", "--strict-mcp-config", "--settings", JSON.stringify({ disableAllHooks: true })
  ], wsClaude, fact(controlCode), 240_000);
  const controlSession = parse(controlCreated.stdout).find((event: any) => event?.type === "result" && event.is_error === false)?.session_id as string | undefined;
  if (controlSession) {
    const withFrame = claudeResumeArgs(controlSession, relayMessages.fr.operatorFrame);
    const withoutFrame = withFrame.filter((arg: string, index: number) => arg !== "--append-system-prompt" && withFrame[index - 1] !== "--append-system-prompt");
    const controlRun = await launch(claudeExe, withoutFrame, wsClaude,
      buildEnvelope({ from: { agent: "codex", sessionId: codexSession }, to: { agent: "claude", sessionId: claudeSession }, nonce: createNonce(), message: "Comment s'appelle le projet de test mentionné au début de cette conversation ? Réponds uniquement par son nom." }, relayMessages.fr),
      300_000);
    const controlReply = interpretClaudeOutput(controlRun.stdout, controlRun.exitCode, controlSession).reply ?? "";
    const answers = controlReply.trim() === controlCode;
    const mentionsProject = controlReply.includes(controlCode);
    trace.claudeControlWithoutFrame = { session: controlSession, answers, mentionsProject, reply: controlReply };
    const observation = answers ? "rend la réponse attendue" : mentionsProject ? "cite le nom dans une autre réponse, à relire (un refus peut aussi le citer)" : "ne rend pas la réponse attendue, à relire";
    console.log(`Observation : sans cadre opérateur, Claude ${observation}. Ce témoin ne suffit pas à établir l'effet du cadre avec cette version.`);
  }

  const toCodex = await palabre(relayArgs(`claude:${claudeSession}`, `codex:${codexSession}`, "Comment s'appelle le projet de test mentionné au début de cette conversation ? Réponds uniquement par son nom."));
  trace.closedCodex = toCodex.json ?? { stdout: toCodex.stdout, stderr: toCodex.stderr };
  check("Codex fermé : replied", toCodex.code === 0 && toCodex.json?.status === "replied", `code ${toCodex.code}, statut ${toCodex.json?.status}`);
  check("Codex fermé : contexte conservé", String(toCodex.json?.reply ?? "").trim() === codexCode, "réponse égale au seul nom du projet attendu (une citation dans un refus ne suffit pas)");
  check("Codex fermé : délivrance et identité", toCodex.json?.delivery?.status === "replied" && toCodex.json?.delivery?.persisted === true && toCodex.json?.identity === "same-as-target",
    `délivrance ${toCodex.json?.delivery?.status}, persisted ${toCodex.json?.delivery?.persisted}, identité ${toCodex.json?.identity}`);
  check("Codex fermé : arrière-plan explicite", backgroundMode(toCodex.json), `mode ${toCodex.json?.mode} (${toCodex.json?.modeSource})`);

  // 3. Neutralisation MCP.
  // Claude : outils et serveurs annoncés par `system/init` pendant un échange du relay.
  const claudeExchange = await exchange(claudeAdapter, claudeExe.executable, claudeLocated.target,
    buildEnvelope({ from: { agent: "codex", sessionId: codexSession }, to: { agent: "claude", sessionId: claudeSession }, nonce: createNonce(), message: "Réponds uniquement : OK." }, relayMessages.fr),
    { timeoutMs: 300_000 });
  const init = String(claudeExchange.process?.stdout ?? "").split(/\r?\n/).map((line: string) => { try { return JSON.parse(line); } catch { return undefined; } })
    .find((event: any) => event?.type === "system" && event.subtype === "init");
  // Critères stricts : un `system/init` présent, avec des listes `tools` et `mcp_servers` réelles,
  // et un échange réussi sur la bonne session. Une absence d'`init` n'est jamais un succès.
  const claudeOutcome = exchangeOutcome(claudeExchange).outcome;
  const initValid = Boolean(init) && Array.isArray(init.tools) && init.tools.length > 0 && Array.isArray(init.mcp_servers);
  const tools: string[] = initValid ? init.tools : [];
  const claudeMcp: unknown[] = initValid ? init.mcp_servers : [];
  trace.claudeInit = { present: Boolean(init), initValid, tools, mcp_servers: claudeMcp, model: init?.model, outcome: claudeOutcome, identity: claudeExchange.verdict?.interpretation.identity };
  const writeTools = tools.filter((tool) => !["Read", "Glob", "Grep"].includes(tool));
  check("Claude : outils et MCP pendant le relay",
    initValid && writeTools.length === 0 && claudeMcp.length === 0 && claudeOutcome.status === "replied" && claudeExchange.verdict?.interpretation.identity === "same-as-target",
    `init ${init ? "présent" : "absent"} ; outils : ${tools.join(", ") || "aucun"} ; serveurs MCP : ${claudeMcp.length} ; issue ${claudeOutcome.status}`);
  }

  // Codex : reprise témoin sans neutralisation, puis échange du relay, journaux comparés.
  const logEnv = { ...process.env, RUST_LOG: "info" };
  const watched = [...mcpNames, "codex_apps"];
  const control = await launch(codexExe, [
    "exec", "resume", "--json", "--skip-git-repo-check", "--disable", "memories", "--disable", "hooks", "-c", "notify=[]",
    ...(codexLocated.target.model ? ["-m", codexLocated.target.model] : []),
    "-c", "sandbox_mode=\"read-only\"", "-c", "approval_policy=\"never\"", codexSession, "-"
  ], wsCodex, "Témoin MCP : n'appelle aucun outil. Réponds uniquement : OK.", 300_000, logEnv);
  const controlEvidence = codexMcpLogEvidence(control.stderr, watched);
  const controlEvents = String(control.stdout).split(/\r?\n/).map((line: string) => { try { return JSON.parse(line); } catch { return undefined; } });
  // Témoin exploitable : reprise réussie, compteur positif et mention hors métadonnées. Absence
  // de compteur reconnu ou de serveur configuré : échec, jamais une comparaison validée par défaut.
  const controlValid = mcpNames.length > 0 && control.exitCode === 0 && controlEvents.some((event: any) => event?.type === "turn.completed")
    && controlEvidence.serverCount !== undefined && controlEvidence.serverCount > 0 && controlEvidence.unexplainedMentions.length > 0;
  const relayed = await exchange(codexAdapter, codexExe.executable, codexLocated.target,
    buildEnvelope({ from: { agent: "claude", ...(claudeSession ? { sessionId: claudeSession } : {}) }, to: { agent: "codex", sessionId: codexSession }, nonce: createNonce(), message: "Réponds uniquement : OK." }, relayMessages.fr),
    { timeoutMs: 300_000, env: logEnv });
  const relayedOutcome = exchangeOutcome(relayed).outcome;
  const relayEvidence = codexMcpLogEvidence(String(relayed.process?.stderr ?? ""), watched);
  trace.mcp = { watched, controlValid, controlExit: control.exitCode, controlEvidence, relayEvidence, relayOutcome: relayedOutcome,
    relayIdentity: relayed.verdict?.interpretation.identity, relayPreparation: relayed.preparation, relayRefusal: relayed.refusal,
    controlLogs: { stdout: control.stdout, stderr: control.stderr }, relayLogs: { stdout: relayed.process?.stdout, stderr: relayed.process?.stderr } };
  check("Codex : témoin exploitable (sans neutralisation)", controlValid,
    `reprise témoin exit ${control.exitCode} ; compteur annoncé ${controlEvidence.serverCount ?? "inconnu"} ; mentions hors fonctionnalités : ${controlEvidence.unexplainedMentions.join(", ") || "aucune"}`);
  check("Codex : MCP neutralisés pendant le relay (indice par journaux)",
    controlValid && relayedOutcome.status === "replied" && relayed.verdict?.interpretation.identity === "same-as-target"
      && relayEvidence.serverCount === 0 && relayEvidence.unexplainedMentions.length === 0,
    `issue ${relayedOutcome.status}, identité ${relayed.verdict?.interpretation.identity ?? "?"} ; compteur annoncé ${relayEvidence.serverCount ?? "inconnu"} ; mentions inexpliquées : ${relayEvidence.unexplainedMentions.join(", ") || "aucune"}. Indice de journaux, pas preuve universelle d'absence d'exposition`);

  /**
   * TUI Codex sur la seule session jetable créée ici. TERM correspond au PTY, sans réponse à une
   * invite ni confiance forcée. Sonde refaite et PID propre vivant avant l'appel ; sortie plafonnée
   * à 1 Mio. Le finally arrête uniquement le processus lancé et vérifie sortie et mort du PID.
   */
  async function attached(label: string, file: string, args: string[], cwd: string, historyFiles: () => string[], adapter: any, target: any, relay: string[]): Promise<void> {
    if (adapter.probe(target).attachment !== "detached") throw new Error("cible jetable déjà attachée ou indéterminée : aucun TUI lancé");
    let screen = "";
    let outputBytes = 0;
    let failure: string | undefined;
    const controller = new AbortController();
    const interrupt = () => { failure ??= "annulation"; controller.abort(); };
    const pty: IPty = spawnPty(file, args, { name: "xterm-256color", cols: 140, rows: 50, cwd,
      env: codexPtyEnv(cleanExternalEnv(process.env)) as Record<string, string> });
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    pty.onData((data) => {
      const bytes = Buffer.from(data, "utf8");
      const available = Math.max(0, 1024 * 1024 - outputBytes);
      screen += bytes.subarray(0, available).toString("utf8");
      outputBytes += Math.min(bytes.length, available);
      if (bytes.length > available) { failure ??= "output-too-large"; controller.abort(); }
    });
    let ptyExited = false;
    pty.onExit(() => { ptyExited = true; });
    let probe: any;
    let before: HistoryFootprint | undefined;
    let after: HistoryFootprint | undefined;
    let result: Awaited<ReturnType<typeof palabre>> | undefined;
    let reason: string | undefined;
    let stopConfirmed = false;
    const waitForExit = async (ms: number): Promise<void> => {
      const deadline = Date.now() + ms;
      while (!ptyExited && Date.now() < deadline) await sleep(50);
    };
    try {
      for (let waited = 0; waited < 60_000 && !ptyExited && !failure; waited += 1_000) {
        await sleep(1_000);
        probe = adapter.probe(target);
        if (probe.attachment === "attached") break;
      }
      await sleep(3_000);
      try { before = historyFootprint(historyFiles()); }
      catch { reason = "historique illisible : aucun message envoyé"; }
      if (!reason) {
        // Sonde et vivacité propres refaites au plus près de l'appel ; jamais le texte de l'écran.
        probe = adapter.probe(target);
        const decision = refusalPrecondition(probe, { ptyExited, history: before });
        if (decision.send && !failure && pidLiveness(pty.pid) === "alive") {
          result = await palabre(relay, controller.signal);
          await sleep(2_000);
          after = historyFootprint(historyFiles());
        } else reason = failure ? "scénario interrompu : aucun message envoyé"
          : decision.send || probe?.attachment !== "attached" ? blockedSmokeStartup() : decision.reason;
      }
      for (const item of refusalChecks(label, { probe, call: result ? { code: result.code, json: result.json } : undefined, before, after, reason })) check(item.name, item.ok, item.detail);
    } finally {
      const exitedBeforeCleanup = ptyExited;
      // Ctrl+C annule seulement. Aucune réponse de confiance, aucun PID lu dans un registre tiers.
      if (shouldStopSmokePty({ exited: ptyExited, liveness: pidLiveness(pty.pid) })) {
        try { pty.write("\x03"); } catch (error) { failure ??= String(error); }
        await waitForExit(800);
      }
      if (shouldStopSmokePty({ exited: ptyExited, liveness: pidLiveness(pty.pid) })) {
        try { killProcessTree(pty.pid); } catch (error) { failure ??= String(error); }
      }
      await waitForExit(3_000);
      const liveness = pidLiveness(pty.pid);
      const stopped = smokePtyStopCheck(label, { exited: ptyExited, liveness, failure });
      stopConfirmed = stopped.ok;
      check(stopped.name, stopped.ok, stopped.detail);
      trace[`attached${label}`] = { probe, pid: pty.pid, exitedBeforeCleanup, ptyExited, liveness, stopConfirmed,
        sent: result !== undefined, reason, failure, result: result ? result.json ?? { stdout: result.stdout, stderr: result.stderr } : null,
        historyBefore: before, historyAfter: after, screenTail: strip(screen).split(/\r?\n/).filter((line) => line.trim()).slice(-8) };
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
    if (!stopConfirmed || controller.signal.aborted) throw new Error("arrêt du TUI non confirmé ou scénario interrompu");
  }

  /**
   * Maintient une reprise Claude sans aucun octet sur stdin, puis vérifie le refus du Relay.
   * Seul son propre PID vivant, absent de la sonde préalable, établit l'attachement. Mesures
   * d'historique avant/après le refus AVANT fermeture de stdin : Claude peut écrire à l'arrêt.
   * Aucun accord de confiance ; aucune qualification du TUI ou de Desktop. Nettoyage borné sur
   * fin normale, erreur ou signal, sans jamais arrêter un PID trouvé dans le registre d'un tiers.
   */
  async function attachedClaude(sessionId: string): Promise<void> {
    const label = CLAUDE_ATTACHED_LABEL;
    const preexistingPids = claudeAdapter.probe(claudeLocated.target).processes.map((item: { pid: number }) => item.pid);
    const child = spawn(claudeExe.executable.command,
      [...claudeExe.executable.prefixArgs, ...claudeAttachedArgs(sessionId)], {
        cwd: wsClaude, env: cleanExternalEnv(process.env), shell: false, windowsHide: true,
        detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"]
      });
    let exited = false;
    let closed = false;
    let failure: string | undefined;
    let exitCode: number | null = null;
    const controller = new AbortController();
    const interrupt = () => { failure ??= "annulation"; controller.abort(); };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    child.once("exit", (status) => { exited = true; exitCode = status; });
    child.once("close", () => { closed = true; });
    child.once("error", (error) => { failure ??= error.message; controller.abort(); });
    child.stdin.on("error", (error) => { if (!exited) { failure ??= error.message; controller.abort(); } });
    // Budget cumulé stdout/stderr : conserver au plus 1 Mio, puis arrêter sans poursuivre le test.
    const output: { stdout: Buffer[]; stderr: Buffer[]; bytes: number } = { stdout: [], stderr: [], bytes: 0 };
    const limit = 1024 * 1024;
    for (const stream of ["stdout", "stderr"] as const) child[stream].on("data", (chunk: Buffer) => {
      const available = Math.max(0, limit - output.bytes);
      if (available > 0) output[stream].push(Buffer.from(chunk.subarray(0, available)));
      output.bytes += Math.min(chunk.length, available);
      if (chunk.length > available) { failure ??= "output-too-large"; controller.abort(); }
    });
    const owner = (): SmokeProcessOwner => ({ pid: child.pid, exited, preexistingPids });
    let stopConfirmed = false;
    let probe: ReturnType<typeof claudeAdapter.probe> | undefined;
    let before: HistoryFootprint | undefined;
    let after: HistoryFootprint | undefined;
    let result: Awaited<ReturnType<typeof palabre>> | undefined;
    let reason: string | undefined;
    /** Attente courte uniquement pour le drainage/arrêt ; aucune relance du processus. */
    const waitForClose = async (ms: number): Promise<void> => {
      const deadline = Date.now() + ms;
      while (!closed && Date.now() < deadline) await sleep(50);
    };
    try {
      const deadline = Date.now() + 30_000;
      while (!exited && !failure && Date.now() < deadline) {
        probe = claudeAdapter.probe(claudeLocated.target);
        if (ownedClaudeAttachment(probe, owner())) break;
        await sleep(250);
      }
      if (!ownedClaudeAttachment(probe, owner()) || failure) reason = blockedSmokeStartup();
      else {
        try { before = historyFootprint([claudeLocated.historyPath]); }
        catch { reason = "historique illisible : aucun message envoyé"; }
        if (!reason) {
          probe = claudeAdapter.probe(claudeLocated.target);
          const decision = claudeRefusalPrecondition(probe, owner(), before);
          if (decision.send && !failure) {
            result = await palabre(relayArgs(`codex:${codexSession}`, `claude:${sessionId}`,
              "Ce message doit être refusé : la conversation est attachée."), controller.signal);
            await sleep(2_000);
            after = historyFootprint([claudeLocated.historyPath]);
          } else reason = decision.send ? blockedSmokeStartup() : decision.reason;
        }
      }
      for (const item of refusalChecks(label, { probe, owner: owner(),
        call: result ? { code: result.code, json: result.json } : undefined, before, after, reason })) check(item.name, item.ok, item.detail);
    } finally {
      // EOF seulement : ni prompt, ni touche, ni réponse à un dialogue de confiance.
      try { child.stdin.end(); } catch (error) { failure ??= String(error); }
      await waitForClose(2_000);
      if (!exited && child.pid !== undefined) {
        try { killProcessTree(child.pid); } catch (error) { failure ??= String(error); }
      }
      await waitForClose(3_000);
      const liveness = child.pid === undefined ? "unverifiable" : pidLiveness(child.pid);
      const stopped = smokeProcessStopCheck(label, { exited, closed, liveness, failure });
      stopConfirmed = stopped.ok;
      check(stopped.name, stopped.ok, stopped.detail);
      trace.attachedClaude = { probe, pid: child.pid, preexistingPids, exited, closed, exitCode, liveness,
        sent: result !== undefined, result: result?.json ?? null, historyBefore: before, historyAfter: after,
        reason, failure, stdout: Buffer.concat(output.stdout).toString("utf8"), stderr: Buffer.concat(output.stderr).toString("utf8") };
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      // Un arrêt non confirmé reste un échec ; ne pas laisser les pipes retenir le lanceur.
      if (!closed) { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref(); }
    }
    // Une annulation ou un nettoyage incertain ne doit pas lancer ensuite le scénario Codex.
    if (!stopConfirmed || controller.signal.aborted) throw new Error("scénario Claude interrompu ou arrêt non confirmé : aucun autre scénario lancé");
  }

  if (!codexOnly) await attachedClaude(claudeSession!);
  await attached("Codex", codexExe.executable.command, [...codexExe.executable.prefixArgs, ...codexAttachedArgs(codexSession, neutralization)],
    wsCodex, () => findCodexHistoryFiles(path.join(os.homedir(), ".codex"), codexSession).map((entry: { path: string }) => entry.path), codexAdapter, codexLocated.target,
    relayArgs(claudeSession ? `claude:${claudeSession}` : "claude", `codex:${codexSession}`, "Ce message doit être refusé : la conversation est ouverte."));
}

main()
  .catch((error: unknown) => {
    check("exécution du smoke", false, error instanceof Error ? error.message : String(error));
  })
  .finally(() => {
    const dir = path.join(repo, ".tmp", "relay-smoke");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${stamp}.json`);
    writeFileSync(file, JSON.stringify({ ...trace, checks }, null, 2));
    const failed = checks.filter((item) => !item.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} vérifications ${codexOnly ? "ciblées Codex" : "de la campagne complète"} réussies. Trace locale : ${path.relative(repo, file)}`);
    process.exit(failed.length === 0 ? 0 : 1);
  });
