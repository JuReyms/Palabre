/** @file Human-confirmed maintenance of obsolete approvals; never loads or approves a configuration. */
import { createInterface } from "node:readline/promises";
import { CONFIG_TRUST_PATH, planTrustPrune, pruneTrust } from "../configTrust.js";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { resolveLanguage } from "../i18n.js";

/** Terminal dependencies for tests on fictional profiles, without a bypass CLI flag. */
export interface PruneTrustIo {
  interactive: boolean;
  print(text: string): void;
  confirm(question: string): Promise<boolean>;
}

const terminal: PruneTrustIo = {
  get interactive() { return Boolean(process.stdin.isTTY && process.stdout.isTTY); },
  print: text => console.log(sanitizeTerminalText(text)),
  async confirm(question) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try { return ["o", "oui", "y", "yes"].includes((await prompt.question(question)).trim().toLowerCase()); }
    finally { prompt.close(); }
  }
};

/** Preview without writing via --dry-run, otherwise require a fresh keyboard confirmation. */
export async function runPruneTrustCommand(
  flags: Record<string, string | string[] | boolean>,
  positionals: string[] = [],
  io: PruneTrustIo = terminal,
  trustPath = CONFIG_TRUST_PATH
): Promise<void> {
  const en = resolveLanguage({ explicitLanguage: typeof flags.language === "string" ? flags.language : undefined }) === "en";
  const command = "palabre config --prune-trust";
  if (positionals.length || Object.keys(flags).some(key => !["prune-trust", "dry-run", "language"].includes(key))) {
    throw new Error(en ? `Use ${command} [--dry-run] [--language fr|en], without other options. No approval is changed.` : `Utilisez ${command} [--dry-run] [--language fr|en], sans autre option. Aucune approbation n'est modifiée.`);
  }
  let plan;
  try { plan = await planTrustPrune(trustPath); }
  catch { throw new Error(en ? `Cannot read the approval registry. Nothing changed. Keep the file and its backups; ask the maintainer for help before running ${command} again.` : `Le registre des approbations est illisible. Rien n'est modifié. Conservez le fichier et ses sauvegardes ; demandez de l'aide au mainteneur avant de relancer ${command}.`); }
  io.print(en ? `Obsolete approvals: ${plan.missing.length}. Kept: ${plan.kept} (inaccessible: ${plan.inaccessible}).` : `Approbations obsolètes : ${plan.missing.length}. Conservées : ${plan.kept} (inaccessibles : ${plan.inaccessible}).`);
  for (const file of plan.missing) io.print(sanitizeTerminalText(`- ${file}`));
  if (flags["dry-run"] || !plan.missing.length) return;
  if (!io.interactive) throw new Error(en ? `Nothing changed: keyboard confirmation is required. Run ${command} yourself in your terminal. No --yes option is accepted.` : `Rien n'est modifié : une confirmation au clavier est requise. Lancez vous-même ${command} dans votre terminal. L'option --yes n'est pas acceptée.`);
  if (!(await io.confirm(en ? "Back up the registry and remove these obsolete approvals? [y/N] " : "Sauvegarder le registre et retirer ces approbations obsolètes ? [o/N] "))) {
    io.print(en ? "Cancelled. Nothing changed." : "Annulé. Rien n'est modifié.");
    return;
  }
  let result;
  try { result = await pruneTrust(plan, trustPath); }
  catch { throw new Error(en ? `Cleanup stopped: the registry changed or could not be saved. Check the registry and its backups, then run ${command} yourself to review a fresh list.` : `Nettoyage arrêté : le registre a changé ou n'a pas pu être sauvegardé. Vérifiez le registre et ses sauvegardes, puis relancez vous-même ${command} pour relire une nouvelle liste.`); }
  io.print(en ? `Removed: ${result.removed}.` : `Approbations retirées : ${result.removed}.`);
  if (result.backup) io.print(sanitizeTerminalText(en ? `Backup: ${result.backup}` : `Sauvegarde : ${result.backup}`));
}
