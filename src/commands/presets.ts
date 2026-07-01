import { configExists, createConfigFromDiscovery, loadConfig, resolveDefaultConfigPath } from "../config.js";
import { discoverLocalTools, discoverLocalToolsForConfig } from "../discovery.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { listPresetsWithAvailability } from "../presets.js";
import { optionalString, type CommandFlags } from "./shared.js";

/** Exécute `palabre presets` en sortie humaine ou JSON versionné. */
export async function runPresetsCommand(flags: CommandFlags): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const ollamaUrl = optionalString(flags["ollama-url"]);
  const config = await configExists(configPath) ? await loadConfig(configPath) : undefined;
  const discovery = config
    ? await discoverLocalToolsForConfig(config, ollamaUrl)
    : await discoverLocalTools({ ollamaUrl });
  const resolvedConfig = config ?? createConfigFromDiscovery(discovery);
  const messages = createTranslator(resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: resolvedConfig.language
  }));
  const presets = listPresetsWithAvailability(resolvedConfig, discovery, messages);

  if (flags.json) {
    process.stdout.write(JSON.stringify({ v: 1, presets }) + "\n");
    return;
  }

  console.log(messages.presets.title);
  console.log("");
  for (const preset of presets) {
    const status = preset.available
      ? messages.presets.available
      : messages.presets.unavailable(preset.unavailableReasons.join("; "));
    console.log(`  ${preset.name.padEnd(20)} ${preset.agentA} <-> ${preset.agentB}  ${status}`);
  }
  console.log("");
  console.log(messages.presets.total(presets.length));
}
