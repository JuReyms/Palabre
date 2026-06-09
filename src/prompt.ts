import { createTranslator } from "./i18n.js";
import type { PromptMessages } from "./messages/prompt.js";
import type { AgentPrompt, DebateMessage, ProjectFileContext } from "./types.js";

/**
 * Formate le prompt complet transmis à l'adapter.
 * Dispatche vers le format de synthèse si `input.mode === "summary"`, sinon construit le prompt de débat standard.
 */
export function formatAgentPrompt(input: AgentPrompt): string {
  const messages = createTranslator(input.language ?? "fr").prompt;

  if (input.mode === "summary") {
    return formatSummaryPrompt(input, messages);
  }

  const transcript = formatTranscript(input.transcript);

  return [
    messages.subject(input.topic),
    "",
    messages.debateIntro(input.selfName, input.turn),
    messages.peer(input.peerName),
    messages.role(input.selfName, input.selfRole),
    messages.roleInstruction(input.selfRole),
    "",
    messages.sessionTitle,
    messages.sessionSource,
    messages.localDate(input.session.localDate),
    messages.timeZone(input.session.timeZone),
    messages.cwd(input.session.cwd),
    messages.sessionStartedAt(input.session.startedAt),
    messages.turnProgress(input.turn, input.totalTurns),
    "",
    messages.responseLanguageInstruction,
    "",
    messages.objectiveTitle,
    ...messages.debateObjectives,
    "",
    input.files.length > 0 ? messages.fileContextTitle : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    transcript.length > 0 ? messages.historyTitle : messages.emptyHistory,
    transcript,
    "",
    messages.answerTitle
  ]
    .filter(Boolean)
    .join("\n");
}

/** Formate le prompt de synthèse finale. Impose un format structuré : Consensus / Désaccords / Actions / Conclusion. */
function formatSummaryPrompt(input: AgentPrompt, messages: PromptMessages): string {
  const transcript = formatTranscript(input.transcript);

  return [
    messages.subject(input.topic),
    "",
    messages.summaryIntro(input.selfName),
    messages.role(input.selfName, input.selfRole),
    messages.roleInstruction("summarizer"),
    "",
    messages.sessionTitle,
    messages.sessionSource,
    messages.localDate(input.session.localDate),
    messages.timeZone(input.session.timeZone),
    messages.cwd(input.session.cwd),
    messages.sessionStartedAt(input.session.startedAt),
    "",
    messages.responseLanguageInstruction,
    "",
    messages.objectiveTitle,
    ...messages.summaryObjectives,
    "",
    input.files.length > 0 ? messages.fileContextTitle : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    messages.transcriptTitle,
    transcript || messages.noMessage,
    "",
    messages.expectedFormatTitle,
    messages.consensusHeading,
    "",
    messages.disagreementsHeading,
    "",
    messages.actionsHeading,
    "",
    messages.conclusionHeading,
    "",
    messages.finalProseInstruction,
    "",
    messages.summaryAnswerTitle
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
