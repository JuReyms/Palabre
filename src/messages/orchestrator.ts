/** @file Messages FR/EN de l'orchestration et de l'attente locale, sans estimation du travail distant. */
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
  cancelled: string;
  ollamaNoContext(agentNames: string): string;
  unknownSummaryAgent(agentName: string): string;
  /** Indication d'attente sur stderr ; ne décrit jamais l'avancement du modèle. */
  agentWaiting(agentName: string, elapsedMs: number, timeoutMs: number): string;
}

/** Durée lisible : secondes sous deux minutes, minutes au-delà. */
const duration = (ms: number) => ms < 120_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;

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
    cancelled: "Débat annulé par l'utilisateur.",
    ollamaNoContext: (agentNames) => `${agentNames} ne lit pas le filesystem. Ajoute --files ou --context pour fournir un contexte projet.`,
    unknownSummaryAgent: (agentName) => `Agent de synthese inconnu: ${agentName}`,
    agentWaiting: (agentName, elapsedMs, timeoutMs) => `Palabre attend toujours ${agentName} : ${duration(elapsedMs)} sur ${duration(timeoutMs)} prévues. Cette attente ne renseigne pas sur l'avancement du modèle.`
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
    cancelled: "Debate cancelled by the user.",
    ollamaNoContext: (agentNames) => `${agentNames} cannot read the filesystem. Add --files or --context to provide project context.`,
    unknownSummaryAgent: (agentName) => `Unknown summary agent: ${agentName}`,
    agentWaiting: (agentName, elapsedMs, timeoutMs) => `Palabre is still waiting for ${agentName}: ${duration(elapsedMs)} of ${duration(timeoutMs)} planned. This wait says nothing about the model's progress.`
  }
};
