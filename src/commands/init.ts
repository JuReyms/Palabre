/** @file Initialisation explicite de configuration globale ou locale. */
import { configExists, createConfigFromDiscovery, DEFAULT_CONFIG_PATH, GLOBAL_CONFIG_PATH, writeConfig } from "../config.js";
import { isImplicitProjectConfig, trustConfig } from "../configTrust.js";
import { discoverLocalTools, type CommandDetection, type ToolDiscovery } from "../discovery.js";
import { detectedAgentNames } from "../agentRegistry.js";
import { createTranslator, DEFAULT_LANGUAGE, resolveLanguage } from "../i18n.js";
import type { PalabreConfig } from "../types.js";
import type { Messages } from "../messages/index.js";
import { optionalString, type CommandFlags } from "./shared.js";

/**
 * Crée une configuration à partir des outils détectés localement.
 * @param flags - Flags de chemin, portée locale, langue et URL Ollama.
 * @returns Une promesse résolue après création et affichage du récapitulatif.
 */
export async function runInitCommand(flags: CommandFlags): Promise<void> {
  const configPath = optionalString(flags.config) ?? (flags.local ? DEFAULT_CONFIG_PATH : GLOBAL_CONFIG_PATH);
  const startupMessages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language) }));
  if (await configExists(configPath)) {
    console.log(startupMessages.init.configExists(configPath));
    return;
  }

  const discovery = await discoverLocalTools({ ollamaUrl: optionalString(flags["ollama-url"]) });
  const config = createConfigFromDiscovery(discovery);
  config.language = resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config.language
  });
  const messages = createTranslator(config.language);
  await writeConfig(configPath, config);
  if (isImplicitProjectConfig(configPath, process.cwd(), [DEFAULT_CONFIG_PATH])) {
    await trustConfig(configPath);
  }
  console.log(messages.init.configCreated(configPath));
  printInitDiscovery(discovery, config, messages);
}

function printInitDiscovery(discovery: ToolDiscovery, config: PalabreConfig, messages: Messages): void {
  console.log("");
  console.log(messages.init.localDetectionTitle);
  console.log(`- Codex CLI: ${formatCommandDetection(discovery.codex, messages)}`);
  console.log(`- Claude CLI: ${formatCommandDetection(discovery.claude, messages)}`);
  console.log(`- Antigravity CLI: ${formatCommandDetection(discovery.antigravity, messages)}`);
  console.log(`- OpenCode CLI: ${formatCommandDetection(discovery.opencode, messages)}`);
  console.log(`- Mistral Vibe CLI: ${formatCommandDetection(discovery.vibe, messages)}`);
  console.log(`- Ollama API: ${formatOllamaDetection(discovery.ollama, messages)}`);
  console.log("");
  console.log(config.defaults?.agentA && config.defaults.agentB
    ? messages.init.defaults(config.defaults.agentA, config.defaults.agentB)
    : messages.init.noDefaultPair(formatDetectedAgentSummary(discovery, config.language ?? DEFAULT_LANGUAGE)));
  console.log(messages.init.languageHint(config.language ?? DEFAULT_LANGUAGE));
}

function formatDetectedAgentSummary(discovery: ToolDiscovery, language: NonNullable<PalabreConfig["language"]>): string {
  const names = detectedAgentNames(discovery);
  if (names.length === 0) return language === "en" ? "no agent detected" : "aucun agent détecté";
  if (names.length === 1) {
    return language === "en" ? `only one agent detected (${names[0]})` : `un seul agent détecté (${names[0]})`;
  }
  return language === "en"
    ? `no usable pair detected among ${names.join(", ")}`
    : `aucune paire utilisable détectée parmi ${names.join(", ")}`;
}

function formatCommandDetection(detection: CommandDetection, messages: Messages): string {
  return detection.available ? messages.init.commandDetected(detection.command) : messages.init.commandMissing;
}

function formatOllamaDetection(detection: ToolDiscovery["ollama"], messages: Messages): string {
  if (!detection.available) {
    return detection.commandAvailable ? messages.init.ollamaServerUnreachable(detection.baseUrl) : messages.init.ollamaMissing;
  }
  return messages.init.ollamaDetected(detection.models.length);
}
