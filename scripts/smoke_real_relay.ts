/**
 * @file Smoke réel de `palabre relay` (lot A5, issue #96), hors `pnpm test`.
 *
 * Lance de vrais agents Claude Code et Codex sur des sessions **jetables**, créées dans un dossier
 * temporaire dédié. Aucune session de travail n'est lue, reprise ni modifiée. Prérequis : `pnpm build`.
 *
 * Cas vérifiés :
 * 1. relay vers une conversation fermée, Claude puis Codex : réponse, contexte conservé (nom de
 *    projet fictif mémorisé à la création), délivrance, identité, export, modèle effectif ;
 * 2. relay vers une conversation attachée (TUI ouvert dans un pseudo-terminal) : refus
 *    `target-busy`, code 3, historique inchangé ;
 * 3. neutralisation MCP Codex : liste stricte dans le dossier de la cible, puis comparaison des
 *    journaux (`RUST_LOG=info`) entre une reprise témoin non neutralisée et l'échange du relay ;
 *    côté Claude, outils et serveurs MCP annoncés par `system/init` pendant l'échange du relay ;
 * 4. versions des CLIs.
 *
 * Effets de bord assumés, tous sur des données jetables : les deux sessions créées restent dans
 * l'historique des CLIs (`~/.claude/projects`, `~/.codex/sessions`), identifiables par leur dossier
 * temporaire ; `--trust-config` enregistre l'approbation de la config temporaire dans
 * `~/.palabre/trusted-configs.json` ; la reprise témoin démarre les serveurs MCP de l'utilisateur.
 *
 * La trace complète (identifiants de session compris) est écrite dans `.tmp/relay-smoke/`, ignoré
 * par git. La sortie console ne contient aucun identifiant.
 *
 * Usage : pnpm build && pnpm smoke:real-relay
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn as spawnPty, type IPty } from "node-pty";

const repo = process.cwd();
const dist = (file: string) => pathToFileURL(path.join(repo, "dist", file)).href;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const root = path.join(os.tmpdir(), `palabre-relay-smoke-${stamp}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const code = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
const trace: Record<string, unknown> = { stamp, root };

function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "ÉCHEC"} ${name} — ${detail}`);
}

/** Lance la CLI Palabre compilée, sans stdin. */
function palabre(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string; json: any }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repo, "dist", "index.js"), ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
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

function lineCount(file: string): number {
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).length;
}

/** Serveurs mentionnés dans les journaux d'une reprise Codex : indice de démarrage, pas preuve d'exposition. */
function mentioned(stderr: string, names: string[]): string[] {
  return names.filter((name) => new RegExp(`\\b${name.replace(/[-]/g, "\\-")}\\b`).test(stderr));
}

const strip = (text: string) => text.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b\[[0-9;?<>=]*[ -/]*[@-~]/g, "");

async function main(): Promise<void> {
  if (!existsSync(path.join(repo, "dist", "index.js"))) throw new Error("dist/index.js absent : lancer pnpm build.");
  const { runExternalProcess, killProcessTree, cleanExternalEnv } = await import(dist("externalSessions/process.js"));
  const { resolveExternalExecutable } = await import(dist("externalSessions/resolve.js"));
  const { ClaudeSessionAdapter, claudeResumeArgs, interpretClaudeOutput } = await import(dist("externalSessions/claude.js"));
  const { CodexSessionAdapter, parseMcpServerNames, mcpNeutralizationArgs } = await import(dist("externalSessions/codex.js"));
  const { exchange, exchangeOutcome } = await import(dist("externalSessions/adapter.js"));
  const { buildEnvelope, createNonce } = await import(dist("externalSessions/envelope.js"));
  const { relayMessages } = await import(dist("messages/relay.js"));

  // `PALABRE_SMOKE_CLAUDE_COMMAND` : exécutable Claude à tester (par exemple une autre version
  // installée) ; par défaut, `claude` résolu dans le PATH comme le ferait la config.
  const claudeCommand = process.env.PALABRE_SMOKE_CLAUDE_COMMAND || "claude";
  const wsClaude = path.join(root, "claude");
  const wsCodex = path.join(root, "codex");
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
  const createdClaude = await launch(claudeExe, [
    "-p", "--output-format", "stream-json", "--verbose", "--model", claudeModel, "--permission-mode", "plan",
    "--tools", "Read,Glob,Grep", "--strict-mcp-config", "--settings", JSON.stringify({ disableAllHooks: true })
  ], wsClaude, fact(claudeCode), 240_000);
  const claudeEvents = parse(createdClaude.stdout);
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
  if (!claudeSession || !codexSession) {
    trace.creation = { claude: createdClaude, codex: createdCodex };
    throw new Error(`création d'une session jetable impossible : Claude ${claudeSession ? "ok" : "échec"}, Codex ${codexSession ? "ok" : `échec ${(trace.creationModels as any).codexErrors.join(" ")}`}`);
  }
  check("sessions jetables créées", true, `Claude (--model ${claudeModel}) et Codex (${codexModel ? `-m ${codexModel}` : "modèle de la config"}), réponses valides`);

  // Même cadre opérateur que la commande avec une config en français (D22).
  const claudeAdapter = new ClaudeSessionAdapter({ operatorFrame: relayMessages.fr.operatorFrame });
  const codexAdapter = new CodexSessionAdapter();
  const claudeLocated = claudeAdapter.locate({ agent: "claude", sessionId: claudeSession });
  const codexLocated = codexAdapter.locate({ agent: "codex", sessionId: codexSession });
  if (claudeLocated.status !== "found" || codexLocated.status !== "found") throw new Error("session jetable non localisée.");
  check("localisation", true, `dossiers d'origine retrouvés ; modèle Codex enregistré : ${codexLocated.target.model ?? "absent"}`);

  const relayArgs = (from: string, to: string, message: string) =>
    ["relay", "--from", from, "--to", to, message, "--json", "--config", configPath, "--trust-config", "--timeout", "600"];

  // 1. Conversations fermées : réponse et contexte conservé.
  const toClaude = await palabre(relayArgs(`codex:${codexSession}`, `claude:${claudeSession}`, "Comment s'appelle le projet de test mentionné au début de cette conversation ? Réponds uniquement par son nom."));
  trace.closedClaude = toClaude.json ?? { stdout: toClaude.stdout, stderr: toClaude.stderr };
  check("Claude fermé : replied", toClaude.code === 0 && toClaude.json?.status === "replied", `code ${toClaude.code}, statut ${toClaude.json?.status}`);
  check("Claude fermé : contexte conservé", String(toClaude.json?.reply ?? "").trim() === claudeCode, "réponse égale au seul nom du projet attendu (une citation dans un refus ne suffit pas)");
  check("Claude fermé : délivrance et identité", toClaude.json?.delivery?.status === "replied" && toClaude.json?.delivery?.persisted === true && toClaude.json?.identity === "same-as-target",
    `délivrance ${toClaude.json?.delivery?.status}, persisted ${toClaude.json?.delivery?.persisted}, identité ${toClaude.json?.identity}, modèles ${(toClaude.json?.observedModels ?? []).join(", ")}`);
  check("Claude fermé : export", Boolean(toClaude.json?.exportPath && existsSync(toClaude.json.exportPath)), "export .relay.md écrit");
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
      buildEnvelope({ from: { agent: "codex", sessionId: codexSession }, nonce: createNonce(), message: "Comment s'appelle le projet de test mentionné au début de cette conversation ? Réponds uniquement par son nom." }, relayMessages.fr),
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

  // 3. Neutralisation MCP.
  // Claude : outils et serveurs annoncés par `system/init` pendant un échange du relay.
  const claudeExchange = await exchange(claudeAdapter, claudeExe.executable, claudeLocated.target,
    buildEnvelope({ from: { agent: "codex", sessionId: codexSession }, nonce: createNonce(), message: "Réponds uniquement : OK." }, relayMessages.fr),
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

  // Codex : reprise témoin sans neutralisation, puis échange du relay, journaux comparés.
  const logEnv = { ...process.env, RUST_LOG: "info" };
  const watched = [...mcpNames, "codex_apps"];
  const control = await launch(codexExe, [
    "exec", "resume", "--json", "--skip-git-repo-check", "--disable", "memories", "--disable", "hooks", "-c", "notify=[]",
    ...(codexLocated.target.model ? ["-m", codexLocated.target.model] : []),
    "-c", "sandbox_mode=\"read-only\"", "-c", "approval_policy=\"never\"", codexSession, "-"
  ], wsCodex, "Témoin MCP : n'appelle aucun outil. Réponds uniquement : OK.", 300_000, logEnv);
  const controlMentions = mentioned(control.stderr, watched);
  const controlEvents = String(control.stdout).split(/\r?\n/).map((line: string) => { try { return JSON.parse(line); } catch { return undefined; } });
  // Témoin exploitable : reprise réussie, et au moins un serveur mentionné. Sans serveur déclaré,
  // la comparaison n'a pas d'objet et le contrôle échoue explicitement.
  const controlValid = control.exitCode === 0 && controlEvents.some((event: any) => event?.type === "turn.completed") && controlMentions.length > 0;
  const relayed = await exchange(codexAdapter, codexExe.executable, codexLocated.target,
    buildEnvelope({ from: { agent: "claude", sessionId: claudeSession }, nonce: createNonce(), message: "Réponds uniquement : OK." }, relayMessages.fr),
    { timeoutMs: 300_000, env: logEnv });
  const relayedOutcome = exchangeOutcome(relayed).outcome;
  const relayMentions = mentioned(String(relayed.process?.stderr ?? ""), watched);
  trace.mcp = { watched, controlValid, controlExit: control.exitCode, controlMentions, relayMentions, relayOutcome: relayedOutcome, relayIdentity: relayed.verdict?.interpretation.identity, relayPreparation: relayed.preparation, relayRefusal: relayed.refusal };
  check("Codex : témoin exploitable (sans neutralisation)", controlValid,
    `reprise témoin exit ${control.exitCode} ; serveurs mentionnés dans ses journaux : ${controlMentions.join(", ") || "aucun"}${mcpNames.length === 0 ? " (aucun serveur déclaré : comparaison sans objet)" : ""}`);
  check("Codex : MCP neutralisés pendant le relay (indice par journaux)",
    controlValid && relayedOutcome.status === "replied" && relayed.verdict?.interpretation.identity === "same-as-target" && relayMentions.length === 0,
    `issue ${relayedOutcome.status}, identité ${relayed.verdict?.interpretation.identity ?? "?"}, réponse ${JSON.stringify(relayed.verdict?.interpretation.reply ?? null)} ; serveurs mentionnés dans les journaux du relay : ${relayMentions.join(", ") || "aucun"}. Les journaux sont un indice, pas une preuve d'absence d'exposition`);

  // 2. Conversations attachées : TUI ouvert dans un pseudo-terminal, puis relay refusé.
  async function attached(label: string, file: string, args: string[], cwd: string, history: string, adapter: any, target: any, relay: string[]): Promise<void> {
    let screen = "";
    const pty: IPty = spawnPty(file, args, { name: "xterm-256color", cols: 140, rows: 50, cwd, env: cleanExternalEnv(process.env) as Record<string, string> });
    pty.onData((data) => { screen += data; });
    let probe: any;
    for (let waited = 0; waited < 60_000; waited += 1_000) {
      await sleep(1_000);
      probe = adapter.probe(target);
      if (probe.attachment === "attached") break;
    }
    await sleep(3_000);
    const before = lineCount(history);
    const result = await palabre(relay);
    await sleep(2_000);
    const after = lineCount(history);
    trace[`attached${label}`] = { probe, result: result.json ?? { stdout: result.stdout, stderr: result.stderr }, linesBefore: before, linesAfter: after, screenTail: strip(screen).split(/\r?\n/).filter((line) => line.trim()).slice(-8) };
    check(`${label} attaché : sonde`, probe?.attachment === "attached", `attachement ${probe?.attachment}, activité ${probe?.activity} ; ${(probe?.evidence ?? []).join(" | ")}`);
    check(`${label} attaché : refus`, result.code === 3 && result.json?.status === "target-busy" && result.json?.delivery?.status === "not-delivered",
      `code ${result.code}, statut ${result.json?.status}, délivrance ${result.json?.delivery?.status}`);
    check(`${label} attaché : historique inchangé`, before === after, `${before} → ${after} entrée(s)`);
    pty.write("\x03");
    await sleep(800);
    pty.write("\x03");
    await sleep(1_500);
    // `pty.kill()` lancerait l'agent de liste de console de node-pty, qui échoue une fois le processus terminé.
    try { killProcessTree(pty.pid); } catch { /* déjà terminé */ }
    await sleep(2_000);
  }

  await attached("Claude", claudeExe.executable.command, [...claudeExe.executable.prefixArgs, "--resume", claudeSession, "--permission-mode", "plan",
    "--tools", "Read,Glob,Grep", "--strict-mcp-config", "--settings", JSON.stringify({ disableAllHooks: true })],
    wsClaude, claudeLocated.historyPath, claudeAdapter, claudeLocated.target,
    relayArgs(`codex:${codexSession}`, `claude:${claudeSession}`, "Ce message doit être refusé : la conversation est ouverte."));
  const trust = `projects={${JSON.stringify(wsCodex)}={trust_level="trusted"}}`;
  await attached("Codex", codexExe.executable.command, [...codexExe.executable.prefixArgs, "resume", codexSession, "-s", "read-only", ...neutralization,
    "--disable", "memories", "--disable", "hooks", "--no-alt-screen", "-c", "check_for_update_on_startup=false", "-c", trust],
    wsCodex, codexLocated.historyPath, codexAdapter, codexLocated.target,
    relayArgs(`claude:${claudeSession}`, `codex:${codexSession}`, "Ce message doit être refusé : la conversation est ouverte."));
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
    console.log(`\n${checks.length - failed.length}/${checks.length} vérifications réussies. Trace locale : ${path.relative(repo, file)}`);
    process.exit(failed.length === 0 ? 0 : 1);
  });
