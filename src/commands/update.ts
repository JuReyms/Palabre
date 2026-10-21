/** @file Commande de diagnostic, confirmation et application des mises a jour Palabre. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { configExists, loadConfig, resolveDefaultConfigPath } from "../config.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { applyUpdate, canApplyUpdate, formatUpdateInstructions, getUpdateInfo, type UpdateInfo } from "../update.js";
import { getPackageVersion } from "../version.js";
import { optionalString, type CommandFlags } from "./shared.js";
import type { Messages } from "../messages/index.js";

/** Hôte injectable pour vérifier l'accord unique sans TTY ni installation réels. */
export interface UpdateCommandHost {
  getInfo?: typeof getUpdateInfo;
  apply?: (info: UpdateInfo, messages: Messages) => Promise<void>;
  confirm?: (prompt: string) => Promise<boolean>;
  interactive?: boolean;
  write?: (report: string) => void;
}

/**
 * Affiche le diagnostic, prévisualise le plan ou applique une mise à jour après confirmation.
 * @param flags - Flags de config, langue, vérification et application explicite.
 * @returns Une promesse résolue après affichage ou mise à jour.
 */
export async function runUpdateCommand(flags: CommandFlags, host: UpdateCommandHost = {}): Promise<void> {
  const info = await (host.getInfo ?? getUpdateInfo)(await getPackageVersion());
  const write = host.write ?? console.log;
  const apply = host.apply ?? applyUpdate;
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const config = await configExists(configPath) ? await loadConfig(configPath) : undefined;
  const messages = createTranslator(resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config?.language
  }));

  const report = formatUpdateInstructions(info, messages);
  const explicitlyApplying = flags.apply === true || flags.yes === true;
  if (flags.check === true || flags["dry-run"] === true) {
    write(report);
    return;
  }

  if (!canApplyUpdate(info)) {
    write(report);
    return;
  }

  if (explicitlyApplying) {
    write(report);
    await apply(info, messages);
    write(messages.update.updateComplete);
    return;
  }

  write(report);
  if (!(host.interactive ?? stdin.isTTY)) {
    throw new Error(messages.update.confirmationRequired);
  }

  if (await (host.confirm ?? confirmUpdate)(messages.update.confirmApply)) {
    await apply(info, messages);
    write(messages.update.updateComplete);
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
