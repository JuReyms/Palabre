import type { Language } from "../types.js";

export interface SessionsMessages {
  title: string;
  empty: string;
  invalid: string;
  nextPhase(phase: string): string;
  complete: string;
  resumeCommand(id: string): string;
  unknownAction(action: string): string;
  deleteIdRequired: string;
  deleteTooManyIds: string;
  deleteTarget(filePath: string): string;
  deletePrompt: string;
  deleteYesRequired: string;
  deleteDeclined: string;
  deleteMissing(id: string): string;
  deleted(id: string): string;
}

export const sessionsMessages: Record<Language, SessionsMessages> = {
  fr: {
    title: "SESSIONS PALABRE",
    empty: "Aucun checkpoint dans ce dossier.",
    invalid: "invalide",
    nextPhase: (phase) => `prochaine phase : ${phase}`,
    complete: "terminée",
    resumeCommand: (id) => `palabre resume ${id}`,
    unknownAction: (action) => `Action sessions inconnue : ${action}. Utilise palabre sessions ou palabre sessions delete <session-id>.`,
    deleteIdRequired: "Indique l'identifiant à supprimer : palabre sessions delete <session-id>.",
    deleteTooManyIds: "La suppression accepte un seul identifiant de session.",
    deleteTarget: (filePath) => `Checkpoint ciblé : ${filePath}`,
    deletePrompt: "Supprimer définitivement ce checkpoint ? [o/N] ",
    deleteYesRequired: "La suppression non interactive exige --yes.",
    deleteDeclined: "Suppression annulée.",
    deleteMissing: (id) => `Checkpoint introuvable : ${id}.`,
    deleted: (id) => `Checkpoint supprimé : ${id}.`
  },
  en: {
    title: "PALABRE SESSIONS",
    empty: "No checkpoint in this folder.",
    invalid: "invalid",
    nextPhase: (phase) => `next phase: ${phase}`,
    complete: "complete",
    resumeCommand: (id) => `palabre resume ${id}`,
    unknownAction: (action) => `Unknown sessions action: ${action}. Use palabre sessions or palabre sessions delete <session-id>.`,
    deleteIdRequired: "Provide the id to delete: palabre sessions delete <session-id>.",
    deleteTooManyIds: "Delete accepts exactly one session id.",
    deleteTarget: (filePath) => `Target checkpoint: ${filePath}`,
    deletePrompt: "Permanently delete this checkpoint? [y/N] ",
    deleteYesRequired: "Non-interactive deletion requires --yes.",
    deleteDeclined: "Deletion cancelled.",
    deleteMissing: (id) => `Checkpoint not found: ${id}.`,
    deleted: (id) => `Checkpoint deleted: ${id}.`
  }
};
