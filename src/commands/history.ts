/** @file Commande de consultation des exports Markdown recents. */
import { configExists, loadConfig, resolveDefaultConfigPath, resolveOutputDir } from "../config.js";
import { listHistoryEntries } from "../history.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { optionalString, type CommandFlags } from "./shared.js";

/**
 * Liste les exports du dossier de sortie configuré.
 * @param flags - Flags de config, langue et format JSON.
 * @returns Une promesse résolue après écriture de l'historique.
 */
export async function runHistoryCommand(flags: CommandFlags): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const config = await configExists(configPath) ? await loadConfig(configPath) : undefined;
  const messages = createTranslator(resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config?.language
  }));
  const entries = await listHistoryEntries(resolveOutputDir(config?.outputDir));

  if (flags.json) {
    process.stdout.write(JSON.stringify({ v: 1, history: entries }) + "\n");
    return;
  }

  console.log(messages.tui.historyTitle);
  console.log("");
  if (entries.length === 0) {
    console.log(messages.tui.historyEmpty);
    return;
  }
  for (const entry of entries) {
    console.log(`- ${entry.date || entry.fileName} | ${entry.mode} | ${entry.topic}`);
    console.log(`  ${entry.path}`);
  }
}
