import { configExists, loadConfig, resolveDefaultConfigPath } from "../config.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "../update.js";
import { getPackageVersion } from "../version.js";
import { optionalString, type CommandFlags } from "./shared.js";

/** Exécute `palabre update`, avec application explicite pour un checkout source. */
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
