/** @file Commande de diagnostic, confirmation et application des mises a jour Palabre. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { configExists, loadConfig, resolveDefaultConfigPath } from "../config.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { applyUpdate, canApplyUpdate, formatUpdateInstructions, getUpdateInfo } from "../update.js";
import { getPackageVersion } from "../version.js";
import { optionalString, type CommandFlags } from "./shared.js";

/**
 * Affiche le diagnostic, prévisualise le plan ou applique une mise à jour après confirmation.
 * @param flags - Flags de config, langue, vérification et application explicite.
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

  const report = formatUpdateInstructions(info, messages);
  const explicitlyApplying = flags.apply === true || flags.yes === true;
  if (flags.check === true || flags["dry-run"] === true) {
    console.log(report);
    return;
  }

  if (!canApplyUpdate(info)) {
    console.log(report);
    return;
  }

  if (explicitlyApplying) {
    await applyUpdate(info, messages);
    console.log(messages.update.updateComplete);
    return;
  }

  console.log(report);
  if (!stdin.isTTY) {
    throw new Error(messages.update.confirmationRequired);
  }

  if (await confirmUpdate(messages.update.confirmApply)) {
    await applyUpdate(info, messages);
    console.log(messages.update.updateComplete);
  }
}

/** Demande une confirmation unique dans un terminal interactif, sans accepter une réponse implicite. */
async function confirmUpdate(prompt: string): Promise<boolean> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await readline.question(prompt)).trim().toLocaleLowerCase();
    return ["y", "yes", "o", "oui"].includes(answer);
  } finally {
    readline.close();
  }
}
