/** @file Consignes FR/EN de récupération locale du skill, sans installation ni nouvelle autorité. */
import type { Language } from "../types.js";

/** Le diagnostic guide la relecture avant une tâche ; il ne commande aucun renvoi Relay. */
export const skillRuntimeMessages: Record<Language, { reload: string; unavailable: string; optionScope: string }> = {
  fr: {
    optionScope: "--read est réservé à skill ; --skill-revision est réservé à skill --read, agents --json ou relay --check. Aucun envoi effectué.",
    reload: "Avant de préparer la tâche Palabre, lisez les consignes du paquet exécuté avec palabre skill --read --json, puis ses références utiles. Retenez la révision seulement après lecture et poursuivez dans le cadre déjà autorisé. Ne demandez ni synchronisation ni redémarrage à l'utilisateur pour cette lecture. Aucun droit ajouté, aucun renvoi d'un message déjà tenté.",
    unavailable: "Les consignes du paquet exécuté sont indisponibles ou invalides. Ne supposez pas le skill à jour ; expliquez cette limite si elle empêche de préparer la tâche. Aucun remplacement de fichier, installation ou renvoi automatique."
  },
  en: {
    optionScope: "--read is reserved for skill; --skill-revision is reserved for skill --read, agents --json or relay --check. Nothing sent.",
    reload: "Before preparing the Palabre task, read the running package's instructions with palabre skill --read --json, then its relevant references. Remember the revision only after reading and continue within existing authorization. Do not ask the user to synchronize or restart for this read. No additional authority and no resend of a message already attempted.",
    unavailable: "The running package's instructions are unavailable or invalid. Do not assume the skill is current; explain this limitation if it prevents preparing the task. No automatic file replacement, installation or resend."
  }
};
