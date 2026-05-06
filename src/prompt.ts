import type { AgentPrompt, AgentRole, DebateMessage, ProjectFileContext } from "./types.js";

/**
 * Formate le prompt complet transmis à l'adapter.
 * Dispatche vers le format de synthèse si `input.mode === "summary"`, sinon construit le prompt de débat standard.
 */
export function formatAgentPrompt(input: AgentPrompt): string {
  if (input.mode === "summary") {
    return formatSummaryPrompt(input);
  }

  const transcript = formatTranscript(input.transcript);

  return [
    `Sujet: ${input.topic}`,
    "",
    `Tu es ${input.selfName}. Tu reponds au tour ${input.turn}.`,
    `Ton interlocuteur est ${input.peerName}.`,
    `Role de ${input.selfName}: ${input.selfRole}.`,
    roleInstruction(input.selfRole),
    "",
    "Contexte de session PALABRE:",
    "- Source: fourni par PALABRE et visible par tous les agents de ce debat.",
    `- Date locale: ${input.session.localDate}`,
    `- Fuseau horaire: ${input.session.timeZone}`,
    `- Dossier courant: ${input.session.cwd}`,
    `- Session demarree a: ${input.session.startedAt}`,
    "",
    "Objectif:",
    "- Apporte une reponse utile, concrete et courte.",
    "- Reagis aux arguments precedents au lieu de repartir de zero.",
    "- Signale les incertitudes ou les points a trancher.",
    "- Respecte ton role sans ignorer les faits du transcript.",
    "",
    input.files.length > 0 ? "Contexte fichiers:" : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    transcript.length > 0 ? "Historique:" : "Historique: aucun message pour le moment.",
    transcript,
    "",
    "Ta reponse:"
  ]
    .filter(Boolean)
    .join("\n");
}

/** Formate le prompt de synthèse finale. Impose un format structuré : Consensus / Désaccords / Actions / Conclusion. */
function formatSummaryPrompt(input: AgentPrompt): string {
  const transcript = formatTranscript(input.transcript);

  return [
    `Sujet: ${input.topic}`,
    "",
    `Tu es ${input.selfName}. Tu produis la synthese finale du debat.`,
    `Role de ${input.selfName}: ${input.selfRole}.`,
    roleInstruction("summarizer"),
    "",
    "Contexte de session PALABRE:",
    "- Source: fourni par PALABRE et visible par tous les agents de ce debat.",
    `- Date locale: ${input.session.localDate}`,
    `- Fuseau horaire: ${input.session.timeZone}`,
    `- Dossier courant: ${input.session.cwd}`,
    `- Session demarree a: ${input.session.startedAt}`,
    "",
    "Objectif:",
    "- Resume le consensus en points concrets.",
    "- Liste les desaccords ou incertitudes qui restent.",
    "- Propose les prochaines actions techniques.",
    "- Termine par une conclusion courte en prose, bien ecrite, qui explique rapidement ce qu'il faut retenir.",
    "- Reste concis et exploitable.",
    "",
    input.files.length > 0 ? "Contexte fichiers:" : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    "Transcript du debat:",
    transcript || "Aucun message.",
    "",
    "Format attendu:",
    "### Consensus",
    "",
    "### Desaccords / incertitudes",
    "",
    "### Actions proposees",
    "",
    "### Conclusion",
    "",
    "Un court paragraphe de synthese en prose, sans liste, qui resume le sens general du debat et la decision ou direction la plus raisonnable.",
    "",
    "Synthese:"
  ]
    .filter(Boolean)
    .join("\n");
}

function roleInstruction(role: AgentRole): string {
  const instructions: Record<AgentRole, string> = {
    implementer: "Consigne de role: propose une solution concrete, executable et sobrement justifiee.",
    reviewer: "Consigne de role: cherche les risques, regressions, angles morts et tests manquants.",
    architect: "Consigne de role: structure les options techniques, compromis et frontieres du systeme.",
    scout: "Consigne de role: explore rapidement le terrain, releve les pistes utiles et les inconnues.",
    critic: "Consigne de role: challenge les hypotheses, pointe les faiblesses et demande les preuves utiles.",
    summarizer: "Consigne de role: synthetise fidelement le transcript sans ajouter de nouvelles hypotheses non signalees."
  };

  return instructions[role];
}

/** Formate les fichiers projet en blocs de code annotés pour l'injection dans le prompt. */
function formatFileContext(files: ProjectFileContext[]): string {
  return files
    .map((file) => {
      return [
        `--- ${file.path} (${file.sizeBytes} bytes)`,
        "```",
        file.content.trimEnd(),
        "```"
      ].join("\n");
    })
    .join("\n\n");
}

/** Formate le transcript en sections lisibles. Retourne une chaîne vide si aucun message. */
export function formatTranscript(messages: DebateMessage[]): string {
  return messages
    .map((message) => {
      return [
        `--- ${message.agent} (${message.role})`,
        message.content.trim()
      ].join("\n");
    })
    .join("\n\n");
}
