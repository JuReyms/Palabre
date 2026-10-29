/** @file Lecture du skill du paquet courant, ou synchronisation disque confirmée, hors config et réseau. */
import { createInterface } from "node:readline/promises";
import { resolveLanguage } from "../i18n.js";
import { applySkillSync, planSkillInstall, planSkillSync, SkillSyncError } from "../skillSync.js";
import { formatSkillPlan, skillCommandMessages, skillSyncFailure } from "../messages/skillSync.js";
import { optionalString, type CommandFlags } from "./shared.js";
import { inspectSkillRuntime } from "../skillRuntime.js";

/** Lecture --read autonome sans mutation ; sinon une confirmation couvre les copies et sauvegardes du plan. */
export async function runSkillCommand(flags: CommandFlags, positionals: string[]): Promise<void> {
  const language = resolveLanguage({ explicitLanguage: optionalString(flags.language) });
  const messages = skillCommandMessages[language];
  // Lecture universelle avant une tâche : hors config/confiance, incompatible avec toute mutation.
  if (flags.read) {
    if (positionals.length || flags.json !== true || Object.keys(flags).some(flag => !["read", "json", "language", "skill-revision"].includes(flag))) throw Error(messages.usage);
    const skill = inspectSkillRuntime(flags["skill-revision"], language, { includeInstructions: true });
    console.log(JSON.stringify({ v: 1, kind: "skill-runtime", ...skill }));
    if (skill.status === "unavailable") process.exitCode = 1;
    return;
  }
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
