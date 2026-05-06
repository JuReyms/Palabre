import path from "node:path";
import { stat } from "node:fs/promises";
import { configExists, loadConfig, resolveDefaultConfigPath } from "./config.js";
import { discoverLocalTools, type ToolDiscovery } from "./discovery.js";
import { DEFAULT_TURNS, MAX_TURNS } from "./limits.js";
import type { AgentConfig, PalabreConfig } from "./types.js";

export interface DoctorResult {
  ok: boolean;
  output: string;
}

interface DiagnosticLine {
  level: "ok" | "warn" | "error" | "info";
  text: string;
}

export async function runDoctor(explicitConfigPath?: string, plain = false): Promise<DoctorResult> {
  const lines: DiagnosticLine[] = [];
  const configPath = explicitConfigPath ?? await resolveDefaultConfigPath();
  const hasConfig = await configExists(configPath);

  lines.push(info("PALABRE doctor"));
  lines.push(info(`Dossier courant: ${process.cwd()}`));
  lines.push(hasConfig
    ? ok(`Config trouvee: ${configPath}`)
    : error(`Config absente: ${configPath}`));

  if (!hasConfig) {
    lines.push(info("Action: lance `palabre init` pour creer la config globale, ou `palabre init --local` pour une config projet."));
    return render(lines, plain);
  }

  const config = await loadConfigSafely(configPath, lines);

  if (!config) {
    return render(lines, plain);
  }

  await inspectConfig(config, lines);

  const discovery = await discoverLocalTools();
  lines.push(info("Outils locaux:"));
  lines.push(formatCommand("Codex CLI", discovery.codex.available, discovery.codex.command, discovery.codex.path));
  lines.push(formatCommand("Claude CLI", discovery.claude.available, discovery.claude.command, discovery.claude.path));
  lines.push(formatCommand("Gemini CLI", discovery.gemini.available, discovery.gemini.command, discovery.gemini.path));
  lines.push(formatCommand("OpenCode CLI", discovery.opencode.available, discovery.opencode.command, discovery.opencode.path));
  lines.push(discovery.ollama.available
    ? ok(`Ollama API joignable: ${discovery.ollama.baseUrl} (${discovery.ollama.models.length} modele(s))`)
    : warn(discovery.ollama.commandAvailable
      ? `Ollama installe mais API non joignable: ${discovery.ollama.baseUrl}${formatErrorSuffix(discovery.ollama.error)}`
      : `Ollama non detecte et API non joignable: ${discovery.ollama.baseUrl}${formatErrorSuffix(discovery.ollama.error)}`));

  inspectDetectedMissingAgents(config, discovery, lines);
  inspectAgents(config, discovery, lines);

  return render(lines, plain);
}

async function loadConfigSafely(configPath: string, lines: DiagnosticLine[]): Promise<PalabreConfig | undefined> {
  try {
    const config = await loadConfig(configPath);
    lines.push(ok("Config JSON lisible."));
    return config;
  } catch (loadError) {
    const message = loadError instanceof Error ? loadError.message : String(loadError);
    lines.push(error(`Config illisible: ${message}`));
    lines.push(info("Action: corrige le JSON ou relance `palabre init --config <path>` vers un nouveau fichier."));
    return undefined;
  }
}

async function inspectConfig(config: PalabreConfig, lines: DiagnosticLine[]): Promise<void> {
  const agentNames = Object.keys(config.agents ?? {});

  if (agentNames.length === 0) {
    lines.push(error("Aucun agent configure."));
  } else if (agentNames.length === 1) {
    lines.push(warn(`1 agent configure: ${agentNames[0]}. Palabre fonctionne mieux avec au moins deux agents.`));
  } else {
    lines.push(ok(`${agentNames.length} agent(s) configure(s): ${agentNames.join(", ")}`));
  }

  inspectDefaultAgent("defaults.agentA", config.defaults?.agentA, config, lines);
  inspectDefaultAgent("defaults.agentB", config.defaults?.agentB, config, lines);
  inspectDefaultPair(config, lines);
  inspectDefaultTurns(config.defaults?.turns, lines);

  if (config.defaults?.summaryAgent) {
    inspectDefaultAgent("defaults.summaryAgent", config.defaults.summaryAgent, config, lines);
  } else {
    lines.push(warn("defaults.summaryAgent absent: la synthese utilisera agentB."));
  }

  await inspectOutputDir(config.outputDir, lines);
}

function inspectDefaultAgent(
  label: string,
  agentName: string | undefined,
  config: PalabreConfig,
  lines: DiagnosticLine[]
): void {
  if (!agentName) {
    lines.push(warn(`${label} absent.`));
    return;
  }

  if (!config.agents[agentName]) {
    lines.push(error(`${label} pointe vers un agent inconnu: ${agentName}`));
    return;
  }

  lines.push(ok(`${label}: ${agentName}`));
}

function inspectDefaultPair(config: PalabreConfig, lines: DiagnosticLine[]): void {
  const { agentA, agentB } = config.defaults ?? {};

  if (!agentA || !agentB) {
    lines.push(warn("Paire par defaut incomplete. Action: `palabre config --set-defaults <agentA> <agentB>`."));
    return;
  }

  if (agentA === agentB) {
    lines.push(warn(`defaults.agentA et defaults.agentB pointent vers le meme agent (${agentA}). C'est possible, mais souvent moins utile qu'une vraie paire.`));
  }
}

function inspectDefaultTurns(turns: number | undefined, lines: DiagnosticLine[]): void {
  const value = turns ?? DEFAULT_TURNS;

  if (turns === undefined) {
    lines.push(info(`defaults.turns absent: Palabre utilisera ${DEFAULT_TURNS} reponses.`));
    return;
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_TURNS) {
    lines.push(error(`defaults.turns invalide: ${String(turns)}. Action: choisis un entier entre 1 et ${MAX_TURNS}.`));
    return;
  }

  lines.push(ok(`defaults.turns: ${value}`));
}

async function inspectOutputDir(outputDir: string | undefined, lines: DiagnosticLine[]): Promise<void> {
  const resolved = path.resolve(outputDir ?? ".");

  if (!outputDir) {
    lines.push(info(`outputDir absent: les exports seront ecrits dans le dossier courant (${resolved}).`));
    return;
  }

  try {
    const stats = await stat(resolved);

    if (!stats.isDirectory()) {
      lines.push(error(`outputDir pointe vers un fichier, pas un dossier: ${resolved}`));
      return;
    }

    lines.push(ok(`outputDir configure: ${resolved}`));
  } catch {
    lines.push(warn(`outputDir n'existe pas encore: ${resolved}. Palabre tentera de le creer au moment de l'export.`));
  }
}

function inspectDetectedMissingAgents(config: PalabreConfig, discovery: ToolDiscovery, lines: DiagnosticLine[]): void {
  const missing = detectedAgentNames(discovery).filter((name) => !config.agents[name]);

  if (missing.length === 0) {
    return;
  }

  lines.push(warn(`Agent(s) detecte(s) mais absent(s) de la config: ${missing.join(", ")}. Action: lance ` + "`palabre config --sync-agents`."));
}

function inspectAgents(
  config: PalabreConfig,
  discovery: ToolDiscovery,
  lines: DiagnosticLine[]
): void {
  lines.push(info("Agents configures:"));

  for (const [name, agent] of Object.entries(config.agents)) {
    inspectAgentShape(name, agent, lines);

    if (agent.type === "cli") {
      inspectCliAgent(name, agent, discovery, lines);
      continue;
    }

    inspectOllamaAgent(name, agent, discovery, lines);
  }
}

function inspectAgentShape(name: string, agent: AgentConfig, lines: DiagnosticLine[]): void {
  if (!agent.role) {
    lines.push(error(`${name}: role absent.`));
  }

  if (agent.type === "cli") {
    if (!agent.command || !agent.command.trim()) {
      lines.push(error(`${name}: command CLI absent.`));
    }

    if (agent.promptMode && !["stdin", "argument"].includes(agent.promptMode)) {
      lines.push(error(`${name}: promptMode invalide (${agent.promptMode}). Valeurs attendues: stdin ou argument.`));
    }

    if (agent.timeoutMs !== undefined && (!Number.isFinite(agent.timeoutMs) || agent.timeoutMs <= 0)) {
      lines.push(error(`${name}: timeoutMs doit etre un nombre positif.`));
    }

    if (agent.idleTimeoutMs !== undefined && (!Number.isFinite(agent.idleTimeoutMs) || agent.idleTimeoutMs <= 0)) {
      lines.push(error(`${name}: idleTimeoutMs doit etre un nombre positif.`));
    }

    return;
  }

  if (!agent.model || !agent.model.trim()) {
    lines.push(error(`${name}: modele Ollama absent.`));
  }

  if (agent.baseUrl && !/^https?:\/\//.test(agent.baseUrl)) {
    lines.push(error(`${name}: baseUrl Ollama invalide (${agent.baseUrl}). Attendu: http://... ou https://...`));
  }

  if (agent.timeoutMs !== undefined && (!Number.isFinite(agent.timeoutMs) || agent.timeoutMs <= 0)) {
    lines.push(error(`${name}: timeoutMs doit etre un nombre positif.`));
  }
}

function inspectCliAgent(
  name: string,
  agent: Extract<AgentConfig, { type: "cli" }>,
  discovery: ToolDiscovery,
  lines: DiagnosticLine[]
): void {
  const known = knownCliDetection(agent.command, discovery);
  const prefix = `${name} [cli:${agent.role}] command=${agent.command}`;

  if (!known) {
    lines.push(info(`${prefix} (commande custom non verifiee par doctor)`));
    return;
  }

  lines.push(known.available
    ? ok(`${prefix} detectee (${known.path ?? known.command})`)
    : warn(`${prefix} non detectee dans PATH. Action: installe/authentifie la CLI ou corrige command dans la config.`));
}

function inspectOllamaAgent(
  name: string,
  agent: Extract<AgentConfig, { type: "ollama" }>,
  discovery: ToolDiscovery,
  lines: DiagnosticLine[]
): void {
  const prefix = `${name} [ollama:${agent.role}] model=${agent.model}`;

  if (!discovery.ollama.available) {
    lines.push(warn(`${prefix} non verifiable: API Ollama non joignable. Action: demarre Ollama ou corrige baseUrl.`));
    return;
  }

  if (agent.validateModel === false) {
    lines.push(info(`${prefix} non valide car validateModel=false.`));
    return;
  }

  const installed = discovery.ollama.models.includes(agent.model);
  lines.push(installed
    ? ok(`${prefix} installe.`)
    : warn(`${prefix} absent. Action: lance ` + "`ollama pull " + agent.model + "`" + " ou utilise `--pull-models`."));
}

function detectedAgentNames(discovery: ToolDiscovery): string[] {
  return [
    discovery.codex.available ? "codex" : undefined,
    discovery.claude.available ? "claude" : undefined,
    discovery.gemini.available ? "gemini" : undefined,
    discovery.opencode.available ? "opencode" : undefined,
    discovery.ollama.available ? "ollama-local" : undefined
  ].filter((name): name is string => Boolean(name));
}

function formatCommand(label: string, available: boolean, command: string, resolvedPath?: string): DiagnosticLine {
  return available
    ? ok(`${label}: detecte (${resolvedPath ?? command})`)
    : warn(`${label}: non detecte dans PATH.`);
}

function knownCliDetection(
  command: string,
  discovery: ToolDiscovery
): { available: boolean; command: string; path?: string } | undefined {
  const normalized = path.basename(command).toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");

  if (normalized === "codex") return discovery.codex;
  if (normalized === "claude") return discovery.claude;
  if (normalized === "gemini") return discovery.gemini;
  if (normalized === "opencode") return discovery.opencode;
  return undefined;
}

function render(lines: DiagnosticLine[], plain: boolean): DoctorResult {
  const hasErrors = lines.some((line) => line.level === "error");

  return {
    ok: !hasErrors,
    output: plain ? renderPlain(lines) : renderPretty(lines)
  };
}

function renderPlain(lines: DiagnosticLine[]): string {
  return lines.map(formatLine).join("\n");
}

function renderPretty(lines: DiagnosticLine[]): string {
  const configLines: DiagnosticLine[] = [];
  const toolLines: DiagnosticLine[] = [];
  const agentLines: DiagnosticLine[] = [];
  const actionLines: DiagnosticLine[] = [];
  let current: "config" | "tools" | "agents" = "config";
  let cwd = process.cwd();

  for (const line of lines) {
    if (line.text === "PALABRE doctor") continue;

    if (line.text.startsWith("Dossier courant: ")) {
      cwd = line.text.replace("Dossier courant: ", "");
      continue;
    }

    if (line.text === "Outils locaux:") {
      current = "tools";
      continue;
    }

    if (line.text === "Agents configures:") {
      current = "agents";
      continue;
    }

    if (line.level === "error" || line.level === "warn") {
      actionLines.push(line);
    }

    if (current === "tools") {
      toolLines.push(line);
    } else if (current === "agents") {
      agentLines.push(line);
    } else {
      configLines.push(line);
    }
  }

  const errorCount = lines.filter((line) => line.level === "error").length;
  const warnCount = lines.filter((line) => line.level === "warn").length;
  const status = errorCount > 0
    ? `${errorCount} erreur(s), ${warnCount} avertissement(s)`
    : warnCount > 0 ? `${warnCount} avertissement(s)` : "OK";

  return [
    ...renderDoctorHeader(status),
    "",
    ...renderSection("Configuration", [info(`Dossier courant: ${cwd}`), ...configLines]),
    "",
    ...renderSection("Outils locaux", toolLines),
    "",
    ...renderSection("Agents", agentLines),
    ...(actionLines.length > 0 ? ["", ...renderSection("A verifier", actionLines)] : []),
    ""
  ].join("\n");
}

function renderDoctorHeader(status: string): string[] {
  const title = "PALABRE doctor";

  return [
    `┌─ ${title} ${"─".repeat(Math.max(1, 58 - title.length))}`,
    `│ Statut: ${status}`,
    `└${"─".repeat(73)}`
  ];
}

function renderSection(title: string, lines: DiagnosticLine[]): string[] {
  if (lines.length === 0) {
    return [title, "  INFO  Rien a afficher."];
  }

  return [
    title,
    "─".repeat(Math.max(16, title.length + 8)),
    ...lines.map((line) => `  ${formatPrettyLine(line)}`)
  ];
}

function formatPrettyLine(line: DiagnosticLine): string {
  const labels: Record<DiagnosticLine["level"], string> = {
    ok: "OK    ",
    warn: "WARN  ",
    error: "ERREUR",
    info: "INFO  "
  };

  return `${labels[line.level]} ${line.text}`;
}

function formatLine(line: DiagnosticLine): string {
  const labels: Record<DiagnosticLine["level"], string> = {
    ok: "OK",
    warn: "WARN",
    error: "ERREUR",
    info: "INFO"
  };

  return `[${labels[line.level]}] ${line.text}`;
}

function ok(text: string): DiagnosticLine {
  return { level: "ok", text };
}

function warn(text: string): DiagnosticLine {
  return { level: "warn", text };
}

function error(text: string): DiagnosticLine {
  return { level: "error", text };
}

function info(text: string): DiagnosticLine {
  return { level: "info", text };
}

function formatErrorSuffix(errorMessage: string | undefined): string {
  return errorMessage ? ` (${errorMessage})` : "";
}
