/** @file Messages FR/EN du skill lié au paquet CLI, sans contenu des instructions utilisateur. */
import type { Language } from "../types.js";
import type { SkillSyncError, SkillSyncPlan } from "../skillSync.js";
import { sanitizeTerminalText } from "../adapters/terminal.js";

/** Textes de la commande dédiée, séparés du déroulé et de la confirmation. */
export const skillCommandMessages = {
  fr: {
    usage: "Usage : palabre skill [--sync | --install codex|claude] [--check | --dry-run] [--yes].",
    confirmationRequired: "Aucune écriture : relancez dans un terminal pour confirmer, ou utilisez explicitement --yes après lecture du plan.",
    confirm: "Installer ces instructions pour les agents ? [o/N] ",
    backup: (directory: string) => `Sauvegarde : ${sanitizeTerminalText(directory)}`,
    complete: "Copies vérifiables du skill alignées sur la CLI exécutée. Rechargez le skill dans chaque conversation concernée, ou démarrez une nouvelle conversation. Les copies non vérifiées restent intactes."
  },
  en: {
    usage: "Usage: palabre skill [--sync | --install codex|claude] [--check | --dry-run] [--yes].",
    confirmationRequired: "Nothing written: run in a terminal to confirm, or explicitly use --yes after reading the plan.",
    confirm: "Install these agent instructions? [y/N] ",
    backup: (directory: string) => `Backup: ${sanitizeTerminalText(directory)}`,
    complete: "Verifiable skill copies match the running CLI. Reload the skill in each affected conversation, or start a new conversation. Unverified copies remain untouched."
  }
} satisfies Record<Language, unknown>;

/**
 * Affiche toutes les cibles avant confirmation, y compris les copies personnalisées à sauvegarder.
 * Le remplacement et le dossier de sauvegarde ne sont annoncés que si une copie peut être remplacée :
 * une copie différente, ou, après une mise à jour de la CLI (`afterUpdate`), toute copie vérifiable,
 * puisque `applyUpdate` la compare alors au skill du nouveau paquet. Une copie illisible ne l'est jamais.
 */
export function formatSkillPlan(plan: SkillSyncPlan, language: Language, afterUpdate = false): string {
  const fr = language === "fr";
  const clean = sanitizeTerminalText;
  const replacing = plan.copies.some(copy => afterUpdate ? copy.state !== "unreadable" : copy.state === "different");
  return [
    fr ? `Skill livré par la CLI ${afterUpdate ? "après sa mise à jour" : "exécutée"} (aucun téléchargement GitHub).` : `Skill bundled with the ${afterUpdate ? "updated" : "running"} CLI (no GitHub download).`,
    ...plan.copies.map(copy => `  ${clean(copy.directory)} — ${fr ? ({ current: "identique à la CLI actuelle", different: "différent ou absent", unreadable: "AVERTISSEMENT : comparaison impossible ; copie ignorée et laissée intacte" })[copy.state] : ({ current: "matches the current CLI", different: "different or absent", unreadable: "WARNING: cannot compare; copy skipped and left untouched" })[copy.state]}`),
    ...(!plan.copies.length
      ? [fr ? "Aucune copie détectée. Installer pour Codex : palabre skill --install codex ; pour Claude : palabre skill --install claude." : "No copy detected. Install for Codex: palabre skill --install codex; for Claude: palabre skill --install claude."]
      : replacing ? [
        fr ? "Les fichiers livrés seront remplacés après sauvegarde des copies existantes ; les ajouts privés et les jonctions seront conservés." : "Bundled files will be replaced after backing up existing copies; private additions and junctions will be preserved.",
        `${fr ? "Sauvegardes hors des dossiers de skills" : "Backups outside skill directories"}: ${clean(plan.backupRoot)}`
      ] : [fr ? "Rien à remplacer : aucune copie vérifiable ne diffère de la CLI." : "Nothing to replace: no verifiable copy differs from the CLI."])
  ].join("\n");
}

/** Erreur explicite : aucune modification des politiques de confiance ou permissions n'est proposée. */
export function skillSyncFailure(error: SkillSyncError, language: Language): string {
  const fr = language === "fr";
  const causes = fr ? {
    source: "Skill livré par cette CLI absent, incomplet ou illisible. Réinstallez cette version de Palabre.",
    unsafe: "Copie illisible ou contenant un lien interne : rafraîchissement refusé. Le propriétaire vérifie ce dossier.",
    changed: "Copie modifiée depuis le plan : rafraîchissement refusé. Relancez palabre skill --sync pour examiner un nouveau plan.",
    backup: "Sauvegarde impossible ou placée dans un dossier de skills : aucun remplacement de cette copie. Vérifiez le dossier de sauvegarde.",
    write: "Rafraîchissement incomplet. Conservez la sauvegarde affichée/prévue et vérifiez les droits du dossier avant de relancer palabre skill --sync."
  } : {
    source: "Bundled skill missing, incomplete or unreadable. Reinstall this version of Palabre.",
    unsafe: "Unreadable copy or internal link: refresh refused. The owner must check this directory.",
    changed: "Copy changed since the plan: refresh refused. Run palabre skill --sync again to inspect a new plan.",
    backup: "Backup failed or points inside a skill directory: this copy was not replaced. Check the backup directory.",
    write: "Refresh incomplete. Keep the displayed/planned backup and check directory permissions before running palabre skill --sync again."
  };
  return `${causes[error.kind]} (${sanitizeTerminalText(error.directory)})`;
}

/**
 * Rappel après une mise à jour directe de la CLI (`src/skillNotice.ts`). Il donne seulement les
 * étapes, sans chemin ni contenu utilisateur. Une différence n'est pas présentée comme forcément
 * ancienne, une copie non comparable jamais comme à jour, et une reprise n'est pas présentée comme
 * un rechargement garanti.
 */
export const skillReminderMessages = {
  fr: {
    notice: (different: boolean, unreadable: boolean): string[] => [
      `Skill Palabre : ${different && unreadable
        ? "des copies installées diffèrent de cette CLI (autre version ou personnalisation) ou n'ont pas pu être comparées"
        : different
          ? "au moins une copie installée diffère de cette CLI (autre version ou personnalisation)"
          : "au moins une copie installée n'a pas pu être comparée à cette CLI ; elle n'est pas considérée comme à jour"}.`,
      "Mettre à jour la CLI seule ne synchronise pas les copies du skill.",
      "1) Vérifier : palabre skill --check.",
      "2) Si nécessaire : palabre skill --sync (plan à relire et confirmer ; copies remplacées sauvegardées).",
      "3) Recharger le skill dans chaque conversation concernée, ou démarrer une nouvelle conversation.",
      "Cette comparaison ne prouve pas ce que l'agent a chargé."
    ]
  },
  en: {
    notice: (different: boolean, unreadable: boolean): string[] => [
      `Palabre skill: ${different && unreadable
        ? "installed copies differ from this CLI (another version or a customization) or could not be compared"
        : different
          ? "at least one installed copy differs from this CLI (another version or a customization)"
          : "at least one installed copy could not be compared with this CLI; it is not treated as up to date"}.`,
      "Updating the CLI alone does not synchronize skill copies.",
      "1) Check: palabre skill --check.",
      "2) If needed: palabre skill --sync (review and confirm the plan; replaced copies are backed up).",
      "3) Reload the skill in each affected conversation, or start a new conversation.",
      "This comparison does not prove what the agent has loaded."
    ]
  }
} satisfies Record<Language, { notice: (different: boolean, unreadable: boolean) => string[] }>;
