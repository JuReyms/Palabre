import type { Language } from "../types.js";

export interface OrchestratorMessages {
  agreementStopReason: string;
  earlyStop(reason: string): string;
  ollamaNoContext(agentNames: string): string;
  unknownSummaryAgent(agentName: string): string;
}

export const orchestratorMessages: Record<Language, OrchestratorMessages> = {
  fr: {
    agreementStopReason: "Accord clair detecte apres un tour complet.",
    earlyStop: (reason) => `Arret anticipe: ${reason}`,
    ollamaNoContext: (agentNames) => `${agentNames} ne lit pas le filesystem. Ajoute --files ou --context pour fournir un contexte projet.`,
    unknownSummaryAgent: (agentName) => `Agent de synthese inconnu: ${agentName}`
  },
  en: {
    agreementStopReason: "Clear agreement detected after a complete round.",
    earlyStop: (reason) => `Early stop: ${reason}`,
    ollamaNoContext: (agentNames) => `${agentNames} cannot read the filesystem. Add --files or --context to provide project context.`,
    unknownSummaryAgent: (agentName) => `Unknown summary agent: ${agentName}`
  }
};
