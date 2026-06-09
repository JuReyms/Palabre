import type { Language } from "../types.js";

export interface OrchestratorMessages {
  agreementStopReason: string;
  earlyStop(reason: string): string;
  /**
   * Phrases d'accord explicite qui déclenchent l'arrêt anticipé.
   * Déjà normalisées (minuscules, sans diacritiques) pour matcher la sortie de
   * `normalizeForAgreement`. Volontairement ciblées : pas de motif trop large.
   */
  agreementPatterns: string[];
  ollamaNoContext(agentNames: string): string;
  unknownSummaryAgent(agentName: string): string;
}

export const orchestratorMessages: Record<Language, OrchestratorMessages> = {
  fr: {
    agreementStopReason: "Accord clair detecte apres un tour complet.",
    earlyStop: (reason) => `Arret anticipe: ${reason}`,
    agreementPatterns: [
      "accord complet",
      "accord total",
      "aucun desaccord",
      "aucune incertitude",
      "rien a trancher",
      "rien a ajouter",
      "question factuelle resolue"
    ],
    ollamaNoContext: (agentNames) => `${agentNames} ne lit pas le filesystem. Ajoute --files ou --context pour fournir un contexte projet.`,
    unknownSummaryAgent: (agentName) => `Agent de synthese inconnu: ${agentName}`
  },
  en: {
    agreementStopReason: "Clear agreement detected after a complete round.",
    earlyStop: (reason) => `Early stop: ${reason}`,
    agreementPatterns: [
      "full agreement",
      "complete agreement",
      "total agreement",
      "no disagreement",
      "no remaining uncertainty",
      "nothing to settle",
      "nothing to add",
      "factual question resolved"
    ],
    ollamaNoContext: (agentNames) => `${agentNames} cannot read the filesystem. Add --files or --context to provide project context.`,
    unknownSummaryAgent: (agentName) => `Unknown summary agent: ${agentName}`
  }
};
