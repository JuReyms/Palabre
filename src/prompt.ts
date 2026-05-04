import type { AgentPrompt, DebateMessage, ProjectFileContext } from "./types.js";

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

/** Formate le prompt de synthèse finale. Impose un format structuré : Consensus / Désaccords / Actions. */
function formatSummaryPrompt(input: AgentPrompt): string {
  const transcript = formatTranscript(input.transcript);

  return [
    `Sujet: ${input.topic}`,
    "",
    `Tu es ${input.selfName}. Tu produis la synthese finale du debat.`,
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
    "Synthese:"
  ]
    .filter(Boolean)
    .join("\n");
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

