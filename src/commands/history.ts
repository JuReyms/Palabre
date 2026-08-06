/** @file Commande de consultation des exports Markdown recents. */
import { configExists, loadConfig, resolveDefaultConfigPath, resolveOutputDir } from "../config.js";
import { listHistoryEntries } from "../history.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import type { Messages } from "../messages/index.js";
import { optionalString, type CommandFlags } from "./shared.js";
import { sanitizeTerminalText } from "../adapters/terminal.js";

/** Nombre d'exports retournés par défaut par la commande historique. */
export const DEFAULT_HISTORY_LIMIT = 10;
/** Garde-fou empêchant une intégration de charger un historique non borné. */
export const MAX_HISTORY_LIMIT = 100;

/**
 * Valide la quantité d'exports demandée par une intégration.
 * @param value - Valeur brute du flag `--limit`.
 * @param messages - Dictionnaire localisé actif.
 * @returns Une limite entière comprise entre 1 et {@link MAX_HISTORY_LIMIT}.
 */
export function resolveHistoryLimit(
  value: CommandFlags[string] | undefined,
  messages: Messages
): number {
  if (value === undefined) {
    return DEFAULT_HISTORY_LIMIT;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(messages.limits.mustBeInteger("--limit", MAX_HISTORY_LIMIT));
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    throw new Error(messages.limits.mustBeInteger("--limit", MAX_HISTORY_LIMIT));
  }
  return limit;
}

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
  const limit = resolveHistoryLimit(flags.limit, messages);
  const entries = await listHistoryEntries(resolveOutputDir(config?.outputDir), limit);

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
    console.log(`- ${sanitizeTerminalText(entry.date || entry.fileName)} | ${entry.mode} | ${sanitizeTerminalText(entry.topic)}`);
    console.log(`  ${sanitizeTerminalText(entry.path)}`);
  }
}
