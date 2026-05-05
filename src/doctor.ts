import path from "node:path";
import { configExists, loadConfig, resolveDefaultConfigPath } from "./config.js";
import { discoverLocalTools } from "./discovery.js";
import type { AgentConfig, PalabreConfig } from "./types.js";

export interface DoctorResult {
  ok: boolean;
  output: string;
}

interface DiagnosticLine {
  level: "ok" | "warn" | "error" | "info";
  text: string;
}

export async function runDoctor(explicitConfigPath?: string): Promise<DoctorResult> {
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
    return render(lines);
  }

  const config = await loadConfigSafely(configPath, lines);

  if (!config) {
    return render(lines);
  }

  inspectConfig(config, lines);

  const discovery = await discoverLocalTools();
  lines.push(info("Outils locaux:"));
  lines.push(formatCommand("Codex CLI", discovery.codex.available, discovery.codex.command, discovery.codex.path));
  lines.push(formatCommand("Claude CLI", discovery.claude.available, discovery.claude.command, discovery.claude.path));
  lines.push(formatCommand("Gemini CLI", discovery.gemini.available, discovery.gemini.command, discovery.gemini.path));
  lines.push(discovery.ollama.available
    ? ok(`Ollama API joignable: ${discovery.ollama.baseUrl} (${discovery.ollama.models.length} modele(s))`)
    : warn(discovery.ollama.commandAvailable
      ? `Ollama installe mais API non joignable: ${discovery.ollama.baseUrl}${formatErrorSuffix(discovery.ollama.error)}`
      : `Ollama non detecte et API non joignable: ${discovery.ollama.baseUrl}${formatErrorSuffix(discovery.ollama.error)}`));

  inspectAgents(config, discovery, lines);

  return render(lines);
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

function inspectConfig(config: PalabreConfig, lines: DiagnosticLine[]): void {
  const agentNames = Object.keys(config.agents ?? {});

  lines.push(agentNames.length > 0
    ? ok(`${agentNames.length} agent(s) configure(s): ${agentNames.join(", ")}`)
    : error("Aucun agent configure."));

  inspectDefaultAgent("defaults.agentA", config.defaults?.agentA, config, lines);
  inspectDefaultAgent("defaults.agentB", config.defaults?.agentB, config, lines);

  if (config.defaults?.summaryAgent) {
    inspectDefaultAgent("defaults.summaryAgent", config.defaults.summaryAgent, config, lines);
  } else {
    lines.push(warn("defaults.summaryAgent absent: la synthese utilisera agentB."));
  }

  if (config.outputDir) {
    lines.push(ok(`outputDir configure: ${path.resolve(config.outputDir)}`));
  } else {
    lines.push(info("outputDir absent: les exports seront ecrits dans le dossier courant."));
  }
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

function inspectAgents(
  config: PalabreConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
  lines: DiagnosticLine[]
): void {
  lines.push(info("Agents configures:"));

  for (const [name, agent] of Object.entries(config.agents)) {
    if (agent.type === "cli") {
      inspectCliAgent(name, agent, discovery, lines);
      continue;
    }

    inspectOllamaAgent(name, agent, discovery, lines);
  }
}

function inspectCliAgent(
  name: string,
  agent: Extract<AgentConfig, { type: "cli" }>,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
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
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
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


function formatCommand(label: string, available: boolean, command: string, resolvedPath?: string): DiagnosticLine {
  return available
    ? ok(`${label}: detecte (${resolvedPath ?? command})`)
    : warn(`${label}: non detecte dans PATH.`);
}
function knownCliDetection(
  command: string,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): { available: boolean; command: string; path?: string } | undefined {
  const normalized = path.basename(command).toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");

  if (normalized === "codex") return discovery.codex;
  if (normalized === "claude") return discovery.claude;
  if (normalized === "gemini") return discovery.gemini;
  return undefined;
}

function render(lines: DiagnosticLine[]): DoctorResult {
  const hasErrors = lines.some((line) => line.level === "error");

  return {
    ok: !hasErrors,
    output: lines.map(formatLine).join("\n")
  };
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
