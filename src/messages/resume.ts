import type { Language, OrchestrationMode } from "../types.js";

export interface ResumeMessages {
  idRequired: string;
  tooManyIds: string;
  completed(id: string): string;
  configMissing(configPath: string): string;
  configChanged(configPath: string): string;
  configUntrusted(configPath: string): string;
  contextChanged(contextPath: string): string;
  missingAgent(agent: string): string;
  missingSummaryAgent(agent: string): string;
  summaryBeforeMode: string;
  conflictingModeState: string;
  transcriptTooLong: string;
  noResponseRemaining: string;
  incompleteAskSummary: string;
  responseOrder(index: number): string;
  askRolesMismatch: string;
  checkpointReady(id: string): string;
  preview(id: string, mode: OrchestrationMode, topic: string, responses: number, phase: string): string;
  confirmPrompt: string;
  yesRequired: string;
  declined: string;
}

export const resumeMessages: Record<Language, ResumeMessages> = {
  fr: {
    idRequired: "Indique l'identifiant de session : palabre resume <session-id>.",
    tooManyIds: "La commande resume accepte un seul identifiant de session.",
    completed: (id) => `La session ${id} est déjà terminée ; aucune phase ne peut être reprise.`,
    configMissing: (configPath) => `La configuration de la session est introuvable : ${configPath}.`,
    configChanged: (configPath) => `La configuration a changé depuis le checkpoint : ${configPath}. Relance une nouvelle session ou restaure la configuration approuvée.`,
    configUntrusted: (configPath) => `La configuration de la session n'est plus approuvée : ${configPath}. Vérifie-la et approuve-la avant de reprendre.`,
    contextChanged: (contextPath) => `Le contexte a changé ou est introuvable : ${contextPath}. La reprise est refusée pour éviter de modifier silencieusement la décision.`,
    missingAgent: (agent) => `État de reprise incohérent : l'agent ${agent} est absent de la configuration.`,
    missingSummaryAgent: (agent) => `État de reprise incohérent : l'agent de synthèse ${agent} est absent.`,
    summaryBeforeMode: "État de reprise incohérent : la synthèse est indiquée sans phase principale terminée.",
    conflictingModeState: "État de reprise incohérent : la phase principale est à la fois terminée et à reprendre.",
    transcriptTooLong: "État de reprise incohérent : le transcript dépasse le nombre de réponses attendu.",
    noResponseRemaining: "État de reprise incohérent : aucune réponse principale ne reste à produire.",
    incompleteAskSummary: "État de reprise incohérent : toutes les réponses Ask doivent précéder la synthèse.",
    responseOrder: (index) => `État de reprise incohérent : la réponse ${index} ne respecte pas l'ordre des agents.`,
    askRolesMismatch: "État de reprise incohérent : les rôles Ask ne peuvent pas être reconstruits fidèlement.",
    checkpointReady: (id) => `Checkpoint activé : ${id} · reprise : palabre resume ${id}`,
    preview: (id, mode, topic, responses, phase) => `Reprise ${id} · ${mode} · ${responses} réponse(s) conservée(s) · prochaine phase : ${phase}\nSujet : ${topic}`,
    confirmPrompt: "Reprendre cette session et contacter les agents ? [o/N] ",
    yesRequired: "La reprise non interactive exige --yes avant tout appel d'agent.",
    declined: "Reprise annulée."
  },
  en: {
    idRequired: "Provide the session id: palabre resume <session-id>.",
    tooManyIds: "The resume command accepts exactly one session id.",
    completed: (id) => `Session ${id} is already complete; there is no phase to resume.`,
    configMissing: (configPath) => `The session configuration cannot be found: ${configPath}.`,
    configChanged: (configPath) => `The configuration changed since the checkpoint: ${configPath}. Start a new session or restore the trusted configuration.`,
    configUntrusted: (configPath) => `The session configuration is no longer trusted: ${configPath}. Review and trust it before resuming.`,
    contextChanged: (contextPath) => `Context changed or cannot be found: ${contextPath}. Resume is blocked to avoid silently changing the decision.`,
    missingAgent: (agent) => `Inconsistent resume state: agent ${agent} is missing from the configuration.`,
    missingSummaryAgent: (agent) => `Inconsistent resume state: summary agent ${agent} is missing.`,
    summaryBeforeMode: "Inconsistent resume state: summary is next but the main phase is not complete.",
    conflictingModeState: "Inconsistent resume state: the main phase is both complete and pending.",
    transcriptTooLong: "Inconsistent resume state: the transcript exceeds the expected response count.",
    noResponseRemaining: "Inconsistent resume state: no main response remains to be generated.",
    incompleteAskSummary: "Inconsistent resume state: every Ask response must precede summary.",
    responseOrder: (index) => `Inconsistent resume state: response ${index} does not match agent order.`,
    askRolesMismatch: "Inconsistent resume state: Ask roles cannot be reconstructed faithfully.",
    checkpointReady: (id) => `Checkpoint enabled: ${id} · resume with: palabre resume ${id}`,
    preview: (id, mode, topic, responses, phase) => `Resume ${id} · ${mode} · ${responses} saved response(s) · next phase: ${phase}\nSubject: ${topic}`,
    confirmPrompt: "Resume this session and contact the agents? [y/N] ",
    yesRequired: "Non-interactive resume requires --yes before any agent call.",
    declined: "Resume cancelled."
  }
};
