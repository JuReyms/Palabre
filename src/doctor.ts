/** @file Diagnostic `palabre doctor` : vérifie config, agents détectés et connectivité Ollama. */
import path from "node:path";
import { stat } from "node:fs/promises";
import { configExists, loadConfig, resolveDefaultConfigPath, resolveOutputDir } from "./config.js";
import { detectedAgentNames, detectionForCommand } from "./agentRegistry.js";
import { discoverLocalTools, type ToolDiscovery } from "./discovery.js";
import { createTranslator, resolveLanguage } from "./i18n.js";
import { DEFAULT_TURNS, MAX_TURNS } from "./limits.js";
import { configuredOllamaTargets, normalizeOllamaBaseUrl } from "./ollamaUrl.js";
import { compareSemver, getLatestPackageVersion, getPackageVersion } from "./version.js";
import type { AgentConfig, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

/** Résultat du diagnostic. `ok` est faux dès qu'au moins une ligne est de niveau `error`. */
export interface DoctorResult {
  ok: boolean;
  output: string;
}

interface DiagnosticLine {
  level: "ok" | "warn" | "error" | "info";
  text: string;
  marker?: "title" | "cwd" | "tools" | "agents";
}

/**
 * Exécute le diagnostic complet : config, outils locaux et agents.
 * Retourne toujours un résultat (pas de throw) ; les erreurs de config sont reportées comme lignes `error`.
 */
export async function runDoctor(explicitConfigPath?: string, plain = false, explicitLanguage?: string): Promise<DoctorResult> {
  const lines: DiagnosticLine[] = [];
  const configPath = explicitConfigPath ?? await resolveDefaultConfigPath();
  const hasConfig = await configExists(configPath);

  const config = hasConfig ? await loadConfigSafely(configPath) : undefined;
  const language = resolveLanguage({
    explicitLanguage,
    configLanguage: config?.language
  });
  const t = createTranslator(language);

  lines.push(info(t.doctor.title, "title"));
  await inspectCliVersion(lines, t);
  lines.push(info(t.doctor.currentDirectory(process.cwd()), "cwd"));
  lines.push(hasConfig
    ? ok(t.doctor.configFound(configPath))
    : error(t.doctor.configMissing(configPath)));

  if (!hasConfig) {
    lines.push(info(t.doctor.noConfigAction));
    return render(lines, plain, t);
  }

  if (!config) {
    const loadError = await getConfigLoadError(configPath);
    lines.push(error(t.doctor.configUnreadable(loadError)));
    lines.push(info(t.doctor.configUnreadableAction));
    return render(lines, plain, t);
  }

  lines.push(ok(t.doctor.configReadable));
  lines.push(ok(t.doctor.interfaceLanguage(language)));

  await inspectConfig(config, lines, t);

  const ollamaTargets = Object.fromEntries(
    Object.entries(configuredOllamaTargets(config))
      .map(([name, value]) => [name, value && isValidOllamaBaseUrl(value) ? value : undefined])
  );
  const discovery = await discoverLocalTools({
    ollamaTargets
  });
  lines.push(info(t.doctor.localTools, "tools"));
  lines.push(formatCommand("Codex CLI", discovery.codex.available, discovery.codex.command, discovery.codex.path, t));
  lines.push(formatCommand("Claude CLI", discovery.claude.available, discovery.claude.command, discovery.claude.path, t));
  lines.push(formatCommand("Antigravity CLI", discovery.antigravity.available, discovery.antigravity.command, discovery.antigravity.path, t));
  lines.push(formatCommand("OpenCode CLI", discovery.opencode.available, discovery.opencode.command, discovery.opencode.path, t));
  lines.push(formatCommand("Mistral Vibe CLI", discovery.vibe.available, discovery.vibe.command, discovery.vibe.path, t));
  lines.push(discovery.ollama.available
    ? ok(t.doctor.ollamaReachable(discovery.ollama.baseUrl, discovery.ollama.models.length))
    : warn(discovery.ollama.commandAvailable
      ? t.doctor.ollamaInstalledNoApi(discovery.ollama.baseUrl, formatErrorSuffix(discovery.ollama.error))
      : t.doctor.ollamaMissingNoApi(discovery.ollama.baseUrl, formatErrorSuffix(discovery.ollama.error))));

  inspectDetectedMissingAgents(config, discovery, lines, t);
  inspectAgents(config, discovery, lines, t);

  return render(lines, plain, t);
}

async function inspectCliVersion(lines: DiagnosticLine[], t: Messages): Promise<void> {
  const currentVersion = await getPackageVersion();
  lines.push(info(t.doctor.cliVersion(currentVersion)));

  const latestVersion = await getLatestPackageVersion();
  if (!latestVersion) {
    lines.push(info(t.doctor.updateUnknown));
    return;
  }

  lines.push(compareSemver(currentVersion, latestVersion) < 0
    ? warn(t.doctor.updateAvailable(currentVersion, latestVersion))
    : ok(t.doctor.updateCurrent(latestVersion)));
}

async function loadConfigSafely(configPath: string): Promise<PalabreConfig | undefined> {
  try {
    return await loadConfig(configPath);
  } catch {
    return undefined;
  }
}

async function getConfigLoadError(configPath: string): Promise<string> {
  try {
    await loadConfig(configPath);
    return "";
  } catch (loadError) {
    return loadError instanceof Error ? loadError.message : String(loadError);
  }
}

async function inspectConfig(config: PalabreConfig, lines: DiagnosticLine[], t: Messages): Promise<void> {
  const agentNames = Object.keys(config.agents ?? {});

  if (agentNames.length === 0) {
    lines.push(error(t.doctor.noAgents));
  } else if (agentNames.length === 1) {
    lines.push(warn(t.doctor.oneAgent(agentNames[0])));
  } else {
    lines.push(ok(t.doctor.agentCount(agentNames.length, agentNames.join(", "))));
  }

  inspectDefaultAgent("defaults.agentA", config.defaults?.agentA, config, lines, t);
  inspectDefaultAgent("defaults.agentB", config.defaults?.agentB, config, lines, t);
  inspectDefaultPair(config, lines, t);
  inspectDefaultTurns(config.defaults?.turns, lines, t);

  if (config.defaults?.summaryAgent) {
    inspectDefaultAgent("defaults.summaryAgent", config.defaults.summaryAgent, config, lines, t);
  } else {
    lines.push(warn(t.doctor.summaryAgentMissing));
  }

  if (config.defaults?.askSummaryAgent) {
    inspectDefaultAgent("defaults.askSummaryAgent", config.defaults.askSummaryAgent, config, lines, t);
  }

  await inspectOutputDir(config.outputDir, lines, t);
}

function inspectDefaultAgent(
  label: string,
  agentName: string | undefined,
  config: PalabreConfig,
  lines: DiagnosticLine[],
  t: Messages
): void {
  if (!agentName) {
    lines.push(warn(t.doctor.defaultAgentMissing(label)));
    return;
  }

  if (!config.agents[agentName]) {
    lines.push(error(t.doctor.defaultAgentUnknown(label, agentName)));
    return;
  }

  lines.push(ok(t.doctor.defaultAgentOk(label, agentName)));
}

function inspectDefaultPair(config: PalabreConfig, lines: DiagnosticLine[], t: Messages): void {
  const { agentA, agentB } = config.defaults ?? {};

  if (!agentA || !agentB) {
    lines.push(warn(t.doctor.defaultPairIncomplete));
    return;
  }

  if (agentA === agentB) {
    lines.push(warn(t.doctor.sameDefaultAgent(agentA)));
  }
}

function inspectDefaultTurns(turns: number | undefined, lines: DiagnosticLine[], t: Messages): void {
  const value = turns ?? DEFAULT_TURNS;

  if (turns === undefined) {
    lines.push(info(t.doctor.defaultTurnsMissing(DEFAULT_TURNS)));
    return;
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_TURNS) {
    lines.push(error(t.doctor.defaultTurnsInvalid(String(turns), MAX_TURNS)));
    return;
  }

  lines.push(ok(t.doctor.defaultTurnsOk(value)));
}

async function inspectOutputDir(outputDir: string | undefined, lines: DiagnosticLine[], t: Messages): Promise<void> {
  const effectiveOutputDir = resolveOutputDir(outputDir);
  const resolved = path.resolve(effectiveOutputDir);

  if (!outputDir) {
    lines.push(info(t.doctor.outputDirMissing(resolved)));
  } else if (outputDir.trim() === ".") {
    lines.push(info(t.doctor.outputDirLegacy(resolved)));
  }

  try {
    const stats = await stat(resolved);

    if (!stats.isDirectory()) {
      lines.push(error(t.doctor.outputDirIsFile(resolved)));
      return;
    }

    lines.push(ok(t.doctor.outputDirConfigured(resolved)));
  } catch {
    lines.push(warn(t.doctor.outputDirWillCreate(resolved)));
  }
}

function inspectDetectedMissingAgents(config: PalabreConfig, discovery: ToolDiscovery, lines: DiagnosticLine[], t: Messages): void {
  const missing = detectedAgentNames(discovery).filter((name) => !config.agents[name]);

  if (missing.length === 0) {
    return;
  }

  lines.push(warn(t.doctor.detectedMissing(missing.join(", "))));
}

function inspectAgents(
  config: PalabreConfig,
  discovery: ToolDiscovery,
  lines: DiagnosticLine[],
  t: Messages
): void {
  lines.push(info(t.doctor.configuredAgents, "agents"));

  for (const [name, agent] of Object.entries(config.agents)) {
    inspectAgentShape(name, agent, lines, t);

    if (agent.type === "cli" || agent.type === "cli-pty") {
      inspectCliAgent(name, agent, discovery, lines, t);
      continue;
    }

    inspectOllamaAgent(name, agent, discovery, lines, t);
  }
}

function inspectAgentShape(name: string, agent: AgentConfig, lines: DiagnosticLine[], t: Messages): void {
  if (!agent.role) {
    lines.push(error(t.doctor.roleMissing(name)));
  }

  if (agent.type === "cli" || agent.type === "cli-pty") {
    if (!agent.command || !agent.command.trim()) {
      lines.push(error(t.doctor.cliCommandMissing(name)));
    }

    if (agent.promptMode && !["stdin", "argument"].includes(agent.promptMode)) {
      lines.push(error(t.doctor.promptModeInvalid(name, agent.promptMode)));
    }

    if (agent.timeoutMs !== undefined && (!Number.isFinite(agent.timeoutMs) || agent.timeoutMs <= 0)) {
      lines.push(error(t.doctor.positiveTimeout(name, "timeoutMs")));
    }

    if (agent.idleTimeoutMs !== undefined && (!Number.isFinite(agent.idleTimeoutMs) || agent.idleTimeoutMs <= 0)) {
      lines.push(error(t.doctor.positiveTimeout(name, "idleTimeoutMs")));
    }

    return;
  }

  if (!agent.model || !agent.model.trim()) {
    lines.push(error(t.doctor.ollamaModelMissing(name)));
  }

  if (agent.baseUrl && !isValidOllamaBaseUrl(agent.baseUrl)) {
    lines.push(error(t.doctor.ollamaBaseUrlInvalid(name, agent.baseUrl)));
  }

  if (agent.timeoutMs !== undefined && (!Number.isFinite(agent.timeoutMs) || agent.timeoutMs <= 0)) {
    lines.push(error(t.doctor.positiveTimeout(name, "timeoutMs")));
  }
}

function isValidOllamaBaseUrl(value: string): boolean {
  try {
    normalizeOllamaBaseUrl(value);
    return true;
  } catch {
    return false;
  }
}

function inspectCliAgent(
  name: string,
  agent: Extract<AgentConfig, { type: "cli" | "cli-pty" }>,
  discovery: ToolDiscovery,
  lines: DiagnosticLine[],
  t: Messages
): void {
  const known = detectionForCommand(agent.command, discovery);
  const prefix = `${name} [cli:${agent.role}] command=${agent.command}`;

  if (!known) {
    lines.push(info(t.doctor.customCommand(prefix)));
    return;
  }

  lines.push(known.available
    ? ok(t.doctor.cliDetected(prefix, known.path ?? known.command))
    : warn(t.doctor.cliMissing(prefix)));
}

function inspectOllamaAgent(
  name: string,
  agent: Extract<AgentConfig, { type: "ollama" }>,
  discovery: ToolDiscovery,
  lines: DiagnosticLine[],
  t: Messages
): void {
  const prefix = `${name} [ollama:${agent.role}] model=${agent.model}`;
  const ollama = discovery.ollamaAgents?.[name] ?? discovery.ollama;

  if (!ollama.available) {
    lines.push(warn(t.doctor.ollamaNotVerifiable(prefix)));
    return;
  }

  if (agent.validateModel === false) {
    lines.push(info(t.doctor.ollamaValidateFalse(prefix)));
    return;
  }

  const installed = ollama.models.includes(agent.model);
  lines.push(installed
    ? ok(t.doctor.ollamaInstalled(prefix))
    : warn(t.doctor.ollamaMissing(prefix, agent.model)));
}

function formatCommand(label: string, available: boolean, command: string, resolvedPath: string | undefined, t: Messages): DiagnosticLine {
  return available
    ? ok(t.doctor.commandDetected(label, resolvedPath ?? command))
    : warn(t.doctor.commandMissing(label));
}

function render(lines: DiagnosticLine[], plain: boolean, t: Messages): DoctorResult {
  const hasErrors = lines.some((line) => line.level === "error");

  return {
    ok: !hasErrors,
    output: plain ? renderPlain(lines, t) : renderPretty(lines, t)
  };
}

function renderPlain(lines: DiagnosticLine[], t: Messages): string {
  return lines.map((line) => formatLine(line, t)).join("\n");
}

function renderPretty(lines: DiagnosticLine[], t: Messages): string {
  const configLines: DiagnosticLine[] = [];
  const toolLines: DiagnosticLine[] = [];
  const agentLines: DiagnosticLine[] = [];
  const actionLines: DiagnosticLine[] = [];
  let current: "config" | "tools" | "agents" = "config";
  let cwd = process.cwd();

  for (const line of lines) {
    if (line.marker === "title") continue;

    if (line.marker === "cwd") {
      cwd = line.text.replace(/^.*?: /, "");
      continue;
    }

    if (line.marker === "tools") {
      current = "tools";
      continue;
    }

    if (line.marker === "agents") {
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
  const status = t.doctor.status(errorCount, warnCount);

  return [
    ...renderDoctorHeader(status, t),
    "",
    ...renderSection(t.doctor.sections.configuration, [info(t.doctor.currentDirectory(cwd)), ...configLines], t),
    "",
    ...renderSection(t.doctor.sections.tools, toolLines, t),
    "",
    ...renderSection(t.doctor.sections.agents, agentLines, t),
    ...(actionLines.length > 0 ? ["", ...renderSection(t.doctor.sections.check, actionLines, t)] : []),
    ""
  ].join("\n");
}

function renderDoctorHeader(status: string, t: Messages): string[] {
  const title = t.doctor.title;

  return [
    `┌─ ${title} ${"─".repeat(Math.max(1, 58 - title.length))}`,
    `│ ${t.doctor.statusLabel}: ${status}`,
    `└${"─".repeat(73)}`
  ];
}

function renderSection(title: string, lines: DiagnosticLine[], t: Messages): string[] {
  if (lines.length === 0) {
    return [title, `  ${t.doctor.prettyLevelLabels.info} ${t.doctor.nothingToDisplay}`];
  }

  return [
    title,
    "─".repeat(Math.max(16, title.length + 8)),
    ...lines.map((line) => `  ${formatPrettyLine(line, t)}`)
  ];
}

function formatPrettyLine(line: DiagnosticLine, t: Messages): string {
  return `${t.doctor.prettyLevelLabels[line.level]} ${line.text}`;
}

function formatLine(line: DiagnosticLine, t: Messages): string {
  return `[${t.doctor.levelLabels[line.level]}] ${line.text}`;
}

function ok(text: string, marker?: DiagnosticLine["marker"]): DiagnosticLine {
  return { level: "ok", text, marker };
}

function warn(text: string, marker?: DiagnosticLine["marker"]): DiagnosticLine {
  return { level: "warn", text, marker };
}

function error(text: string, marker?: DiagnosticLine["marker"]): DiagnosticLine {
  return { level: "error", text, marker };
}

function info(text: string, marker?: DiagnosticLine["marker"]): DiagnosticLine {
  return { level: "info", text, marker };
}

function formatErrorSuffix(errorMessage: string | undefined): string {
  return errorMessage ? ` (${errorMessage})` : "";
}
