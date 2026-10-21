/** @file Installation et rafraîchissement explicites du skill du paquet courant, hors config et réseau. */
import { createInterface } from "node:readline/promises";
import { resolveLanguage } from "../i18n.js";
import { applySkillSync, planSkillInstall, planSkillSync, SkillSyncError } from "../skillSync.js";
import { formatSkillPlan, skillSyncFailure } from "../messages/skillSync.js";
import { optionalString, type CommandFlags } from "./shared.js";

/** Une seule confirmation couvre les cibles affichées et leurs sauvegardes ; previews sans écriture. */
export async function runSkillCommand(flags: CommandFlags, positionals: string[]): Promise<void> {
  const language = resolveLanguage({ explicitLanguage: optionalString(flags.language) });
  const fr = language === "fr";
  if (positionals.length || Object.keys(flags).some(flag => !["sync", "install", "check", "dry-run", "yes", "language", "terminal", "plain"].includes(flag)) ||
      (flags.sync && flags.install) || (flags.install !== undefined && flags.install !== "codex" && flags.install !== "claude")) {
    throw Error(fr ? "Usage : palabre skill [--sync | --install codex|claude] [--check | --dry-run] [--yes]." : "Usage: palabre skill [--sync | --install codex|claude] [--check | --dry-run] [--yes].");
  }
  const plan = flags.install === "codex" || flags.install === "claude" ? planSkillInstall(flags.install) : planSkillSync();
  console.log(formatSkillPlan(plan, language));
  if (flags.check || flags["dry-run"] || (!flags.sync && !flags.install) || !plan.copies.length) return;
  if (flags.yes !== true) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error(fr ? "Aucune écriture : relancez dans un terminal pour confirmer, ou utilisez explicitement --yes après lecture du plan." : "Nothing written: run in a terminal to confirm, or explicitly use --yes after reading the plan.");
    const io = createInterface({ input: process.stdin, output: process.stdout });
    try { if (!["oui", "o", "yes", "y"].includes((await io.question(fr ? "Installer ces instructions pour les agents ? [o/N] " : "Install these agent instructions? [y/N] ")).trim().toLowerCase())) return; }
    finally { io.close(); }
  }
  try {
    applySkillSync(plan, plan.source, backup => console.log(`${fr ? "Sauvegarde" : "Backup"}: ${backup}`));
    console.log(fr ? "Skill aligné sur la CLI exécutée. Rechargez le skill ou reprenez la conversation de l'agent." : "Skill matches the running CLI. Reload the skill or resume the agent conversation.");
  } catch (error) {
    if (error instanceof SkillSyncError) throw Error(skillSyncFailure(error, language));
    throw error;
  }
}
