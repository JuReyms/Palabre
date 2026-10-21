/** @file Messages FR/EN du skill lié au paquet CLI, sans contenu des instructions utilisateur. */
import type { Language } from "../types.js";
import type { SkillSyncError, SkillSyncPlan } from "../skillSync.js";
import { sanitizeTerminalText } from "../adapters/terminal.js";

/** Affiche toutes les cibles avant confirmation, y compris les copies personnalisées à sauvegarder. */
export function formatSkillPlan(plan: SkillSyncPlan, language: Language, afterUpdate = false): string {
  const fr = language === "fr";
  const clean = sanitizeTerminalText;
  return [
    fr ? `Skill livré par la CLI ${afterUpdate ? "après sa mise à jour" : "exécutée"} (aucun téléchargement GitHub).` : `Skill bundled with the ${afterUpdate ? "updated" : "running"} CLI (no GitHub download).`,
    ...plan.copies.map(copy => `  ${clean(copy.directory)} — ${fr ? ({ current: "identique à la CLI actuelle", different: "différent ou absent", unreadable: "comparaison impossible : rafraîchissement refusé" })[copy.state] : ({ current: "matches the current CLI", different: "different or absent", unreadable: "cannot compare: refresh refused" })[copy.state]}`),
    ...(plan.copies.length ? [
      fr ? "Les fichiers livrés seront remplacés après sauvegarde des copies existantes ; les ajouts privés et les jonctions seront conservés." : "Bundled files will be replaced after backing up existing copies; private additions and junctions will be preserved.",
      `${fr ? "Sauvegardes hors des dossiers de skills" : "Backups outside skill directories"}: ${clean(plan.backupRoot)}`
    ] : [fr ? "Aucune copie détectée. Installer pour Codex : palabre skill --install codex ; pour Claude : palabre skill --install claude." : "No copy detected. Install for Codex: palabre skill --install codex; for Claude: palabre skill --install claude."])
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
