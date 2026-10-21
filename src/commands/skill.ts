/** @file Installation et rafraîchissement explicites du skill du paquet courant, hors config et réseau. */
import { createInterface } from "node:readline/promises";
import { resolveLanguage } from "../i18n.js";
import { applySkillSync, planSkillInstall, planSkillSync, SkillSyncError } from "../skillSync.js";
import { formatSkillPlan, skillCommandMessages, skillSyncFailure } from "../messages/skillSync.js";
import { optionalString, type CommandFlags } from "./shared.js";

/** Une seule confirmation couvre les cibles affichées et leurs sauvegardes ; previews sans écriture. */
export async function runSkillCommand(flags: CommandFlags, positionals: string[]): Promise<void> {
  const language = resolveLanguage({ explicitLanguage: optionalString(flags.language) });
  const messages = skillCommandMessages[language];
  if (positionals.length || Object.keys(flags).some(flag => !["sync", "install", "check", "dry-run", "yes", "language", "terminal", "plain"].includes(flag)) ||
      (flags.sync && flags.install) || (flags.install !== undefined && flags.install !== "codex" && flags.install !== "claude")) {
    throw Error(messages.usage);
  }
  const plan = flags.install === "codex" || flags.install === "claude" ? planSkillInstall(flags.install) : planSkillSync();
  console.log(formatSkillPlan(plan, language));
  if (flags.check || flags["dry-run"] || (!flags.sync && !flags.install) || !plan.copies.some(copy => copy.state === "different")) return;
  if (flags.yes !== true) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error(messages.confirmationRequired);
    const io = createInterface({ input: process.stdin, output: process.stdout });
    try { if (!["oui", "o", "yes", "y"].includes((await io.question(messages.confirm)).trim().toLowerCase())) return; }
    finally { io.close(); }
  }
  try {
    applySkillSync(plan, plan.source, backup => console.log(messages.backup(backup)));
    console.log(messages.complete);
  } catch (error) {
    if (error instanceof SkillSyncError) throw Error(skillSyncFailure(error, language));
    throw error;
  }
}
