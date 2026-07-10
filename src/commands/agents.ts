/** @file Commande palabre agents et contrat JSON v1 pour les integrations. */
import { configExists, loadConfig, resolveDefaultConfigPath } from "../config.js";
import { discoverLocalToolsForConfig, type CommandDetection, type ToolDiscovery } from "../discovery.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { turnsOrDefault } from "../limits.js";
import { listAgentsWithAvailability } from "../presets.js";
import { detectionForCommand, isRetiredAgentName } from "../agentRegistry.js";
import { VALID_AGENT_ROLES, type AgentConfig, type PalabreConfig } from "../types.js";
import type { Messages } from "../messages/index.js";
import { optionalString, type CommandFlags } from "./shared.js";

/**
 * Liste les agents configurés avec leur disponibilité calculée par le CLI.
 * @param flags - Flags de langue, config, URL Ollama et format JSON.
 * @returns Une promesse résolue après écriture de la sortie.
 * @throws {Error} Si aucune configuration n'est disponible.
 */
export async function runAgentsCommand(flags: CommandFlags): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  if (!(await configExists(configPath))) {
    const messages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language) }));
    throw new Error(messages.agents.noConfig);
  }

  const config = await loadConfig(configPath);
  const messages = createTranslator(resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config.language
  }));
  const discovery = await discoverLocalToolsForConfig(config, optionalString(flags["ollama-url"]));

  if (flags.json) {
    const fallbackAskAgents = [config.defaults?.agentA, config.defaults?.agentB]
      .filter((name): name is string => typeof name === "string" && !isRetiredAgentName(name));
    process.stdout.write(JSON.stringify({
      v: 1,
      roles: VALID_AGENT_ROLES,
      agents: listAgentsWithAvailability(config, discovery, messages),
      defaults: {
        askAgents: config.defaults?.askAgents?.length
          ? config.defaults.askAgents.filter((name) => !isRetiredAgentName(name))
          : fallbackAskAgents
      }
    }) + "\n");
    return;
  }

  printAgents(configPath, config, discovery, messages);
}

function printAgents(configPath: string, config: PalabreConfig, discovery: ToolDiscovery, messages: Messages): void {
  const entries = Object.entries(config.agents)
    .filter(([name]) => !isRetiredAgentName(name))
    .sort(([left], [right]) => left.localeCompare(right));

  console.log(messages.agents.config(configPath));
  console.log("");
  console.log(messages.agents.title);
  for (const [name, agentConfig] of entries) {
    const status = formatAgentDetection(name, agentConfig, discovery, messages);
    const defaults = formatAgentDefaults(name, config, messages);
    const details = formatAgentDetails(agentConfig, messages);
    console.log(`- ${name.padEnd(13)} ${`${agentConfig.type}/${agentConfig.role}`.padEnd(18)} ${status}${defaults ? ` | ${defaults}` : ""}`);
    if (details) console.log(`  ${details}`);
  }

  console.log("");
  console.log(messages.agents.defaults(
    config.defaults?.agentA ?? messages.agents.none,
    config.defaults?.agentB ?? messages.agents.none,
    turnsOrDefault(config.defaults?.turns),
    config.defaults?.summaryAgent ?? messages.agents.summaryAgentB,
    config.defaults?.askSummaryAgent
  ));
}

function formatAgentDefaults(name: string, config: PalabreConfig, messages: Messages): string {
  const labels: string[] = [];
  if (config.defaults?.agentA === name) labels.push(messages.agents.defaultAgentA);
  if (config.defaults?.agentB === name) labels.push(messages.agents.defaultAgentB);
  if (config.defaults?.summaryAgent === name) labels.push(messages.agents.defaultSummary);
  if (config.defaults?.askSummaryAgent === name) labels.push(messages.agents.defaultAskSummary);
  return labels.join(", ");
}

function formatAgentDetails(agentConfig: AgentConfig, messages: Messages): string {
  return agentConfig.type === "ollama"
    ? messages.agents.model(agentConfig.model)
    : messages.agents.command(agentConfig.command, agentConfig.model);
}

function formatAgentDetection(name: string, agentConfig: AgentConfig, discovery: ToolDiscovery, messages: Messages): string {
  if (agentConfig.type === "ollama") {
    const ollama = discovery.ollama;
    if (!ollama.available) return ollama.commandAvailable ? messages.agents.ollamaUnreachable : messages.agents.ollamaNotDetected;
    return ollama.models.includes(agentConfig.model) ? messages.agents.detected() : messages.agents.missingModel(agentConfig.model);
  }

  const detection = cliDetectionForAgent(name, agentConfig, discovery);
  return detection.available ? messages.agents.detected(detection.command) : messages.agents.notDetected;
}

function cliDetectionForAgent(name: string, agentConfig: AgentConfig, discovery: ToolDiscovery): CommandDetection {
  const command = agentConfig.type === "cli" || agentConfig.type === "cli-pty" ? agentConfig.command : name;
  return detectionForCommand(command, discovery) ?? { available: true, command };
}
