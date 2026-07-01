/** @file Commande de diagnostic et application des mises a jour Palabre. */
import { configExists, loadConfig, resolveDefaultConfigPath } from "../config.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "../update.js";
import { getPackageVersion } from "../version.js";
import { optionalString, type CommandFlags } from "./shared.js";

/**
 * Affiche les instructions de mise à jour ou applique le workflow d'un checkout source.
 * @param flags - Flags de config, langue et application explicite.
 * @returns Une promesse résolue après affichage ou mise à jour.
 */
export async function runUpdateCommand(flags: CommandFlags): Promise<void> {
  const info = await getUpdateInfo(await getPackageVersion());
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const config = await configExists(configPath) ? await loadConfig(configPath) : undefined;
  const messages = createTranslator(resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config?.language
  }));

  if (flags.apply) {
    await applySourceUpdate(info, messages);
    console.log(messages.update.upToDate);
    return;
  }

  console.log(formatUpdateInstructions(info, messages));
}
