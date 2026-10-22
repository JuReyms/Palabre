/**
 * @file Notice observée le 22 octobre 2026 avec OpenCode Windows 2.0.32.
 * Identifiant et horodatage remplacés par des témoins, aucun transcript ou code de contexte.
 * Texte/description/métadonnées : forme produite par instructions/builtins.ts et
 * session/message-updater.ts au tag v2.0.32 (843a6c514e606b436a7fe713422ace0a93ad3d61).
 */

/** Chaque appel rend une fixture indépendante, sans sélection d'une session réelle. */
export function dateNotice(): Record<string, unknown> {
  return { id: "msg_date", type: "system", time: { created: Date.UTC(2026, 9, 22, 12) },
    description: "Instructions updated: core/date", metadata: { notice: "instructions", instructionSources: ["core/date"] },
    text: "Today's date is now: Thu Oct 22 2026" };
}
