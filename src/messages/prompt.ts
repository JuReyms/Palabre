import type { AgentRole, Language } from "../types.js";

export interface PromptMessages {
  subject(topic: string): string;
  debateIntro(selfName: string, turn: number): string;
  summaryIntro(selfName: string): string;
  peer(peerName: string): string;
  role(selfName: string, role: AgentRole): string;
  roleInstruction(role: AgentRole): string;
  sessionTitle: string;
  sessionSource: string;
  localDate(value: string): string;
  timeZone(value: string): string;
  cwd(value: string): string;
  sessionStartedAt(value: string): string;
  turnProgress(turn: number, totalTurns: number): string;
  objectiveTitle: string;
  debateObjectives: string[];
  summaryObjectives: string[];
  fileContextTitle: string;
  historyTitle: string;
  emptyHistory: string;
  answerTitle: string;
  transcriptTitle: string;
  noMessage: string;
  expectedFormatTitle: string;
  consensusHeading: string;
  disagreementsHeading: string;
  actionsHeading: string;
  conclusionHeading: string;
  finalProseInstruction: string;
  summaryAnswerTitle: string;
}

const frRoleInstructions: Record<AgentRole, string> = {
  implementer: "Consigne de role: propose une solution concrete, executable et sobrement justifiee.",
  reviewer: "Consigne de role: cherche les risques, regressions, angles morts et tests manquants.",
  architect: "Consigne de role: structure les options techniques, compromis et frontieres du systeme.",
  scout: "Consigne de role: explore rapidement le terrain, releve les pistes utiles et les inconnues.",
  critic: "Consigne de role: challenge les hypotheses, pointe les faiblesses et demande les preuves utiles.",
  summarizer: "Consigne de role: synthetise fidelement le transcript sans ajouter de nouvelles hypotheses non signalees."
};

const enRoleInstructions: Record<AgentRole, string> = {
  implementer: "Role instruction: propose a concrete, executable solution with concise justification.",
  reviewer: "Role instruction: look for risks, regressions, blind spots, and missing tests.",
  architect: "Role instruction: structure technical options, trade-offs, and system boundaries.",
  scout: "Role instruction: quickly explore the terrain, useful leads, and unknowns.",
  critic: "Role instruction: challenge assumptions, point out weaknesses, and ask for useful evidence.",
  summarizer: "Role instruction: faithfully summarize the transcript without adding new unstated assumptions."
};

export const promptMessages: Record<Language, PromptMessages> = {
  fr: {
    subject: (topic) => `Sujet: ${topic}`,
    debateIntro: (selfName, turn) => `Tu es ${selfName}. Tu reponds au tour ${turn}.`,
    summaryIntro: (selfName) => `Tu es ${selfName}. Tu produis la synthese finale du debat.`,
    peer: (peerName) => `Ton interlocuteur est ${peerName}.`,
    role: (selfName, role) => `Role de ${selfName}: ${role}.`,
    roleInstruction: (role) => frRoleInstructions[role],
    sessionTitle: "Contexte de session PALABRE:",
    sessionSource: "- Source: fourni par PALABRE et visible par tous les agents de ce debat.",
    localDate: (value) => `- Date locale: ${value}`,
    timeZone: (value) => `- Fuseau horaire: ${value}`,
    cwd: (value) => `- Dossier courant: ${value}`,
    sessionStartedAt: (value) => `- Session demarree a: ${value}`,
    turnProgress: (turn, totalTurns) => `- Tour courant: ${turn}/${totalTurns}`,
    objectiveTitle: "Objectif:",
    debateObjectives: [
      "- Apporte une reponse utile, concrete et courte.",
      "- Reagis aux arguments precedents au lieu de repartir de zero.",
      "- Signale les incertitudes ou les points a trancher.",
      "- Respecte ton role sans ignorer les faits du transcript."
    ],
    summaryObjectives: [
      "- Resume le consensus en points concrets.",
      "- Liste les desaccords ou incertitudes qui restent.",
      "- Propose les prochaines actions techniques.",
      "- Termine par une conclusion courte en prose, bien ecrite, qui explique rapidement ce qu'il faut retenir.",
      "- Reste concis et exploitable."
    ],
    fileContextTitle: "Contexte fichiers:",
    historyTitle: "Historique:",
    emptyHistory: "Historique: aucun message pour le moment.",
    answerTitle: "Ta reponse:",
    transcriptTitle: "Transcript du debat:",
    noMessage: "Aucun message.",
    expectedFormatTitle: "Format attendu:",
    consensusHeading: "### Consensus",
    disagreementsHeading: "### Desaccords / incertitudes",
    actionsHeading: "### Actions proposees",
    conclusionHeading: "### Conclusion",
    finalProseInstruction: "Un court paragraphe de synthese en prose, sans liste, qui resume le sens general du debat et la decision ou direction la plus raisonnable.",
    summaryAnswerTitle: "Synthese:"
  },
  en: {
    subject: (topic) => `Subject: ${topic}`,
    debateIntro: (selfName, turn) => `You are ${selfName}. You are answering turn ${turn}.`,
    summaryIntro: (selfName) => `You are ${selfName}. You are producing the final debate summary.`,
    peer: (peerName) => `Your counterpart is ${peerName}.`,
    role: (selfName, role) => `${selfName}'s role: ${role}.`,
    roleInstruction: (role) => enRoleInstructions[role],
    sessionTitle: "PALABRE session context:",
    sessionSource: "- Source: provided by PALABRE and visible to all agents in this debate.",
    localDate: (value) => `- Local date: ${value}`,
    timeZone: (value) => `- Time zone: ${value}`,
    cwd: (value) => `- Current directory: ${value}`,
    sessionStartedAt: (value) => `- Session started at: ${value}`,
    turnProgress: (turn, totalTurns) => `- Current turn: ${turn}/${totalTurns}`,
    objectiveTitle: "Objective:",
    debateObjectives: [
      "- Provide a useful, concrete, and concise answer.",
      "- Respond to previous arguments instead of starting over.",
      "- Call out uncertainties or points that still need a decision.",
      "- Respect your role without ignoring facts from the transcript."
    ],
    summaryObjectives: [
      "- Summarize the consensus into concrete points.",
      "- List remaining disagreements or uncertainties.",
      "- Propose the next technical actions.",
      "- End with a short, well-written prose conclusion that explains what to retain.",
      "- Stay concise and actionable."
    ],
    fileContextTitle: "File context:",
    historyTitle: "History:",
    emptyHistory: "History: no message yet.",
    answerTitle: "Your answer:",
    transcriptTitle: "Debate transcript:",
    noMessage: "No message.",
    expectedFormatTitle: "Expected format:",
    consensusHeading: "### Consensus",
    disagreementsHeading: "### Disagreements / uncertainties",
    actionsHeading: "### Proposed actions",
    conclusionHeading: "### Conclusion",
    finalProseInstruction: "A short prose summary paragraph, without a list, that captures the general meaning of the debate and the most reasonable decision or direction.",
    summaryAnswerTitle: "Summary:"
  }
};
