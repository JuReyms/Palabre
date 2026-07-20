/** @file Rendu des prompts agent (débat, ask, synthèse) avec contexte de session, fichiers et transcript. */
import { createTranslator } from "./i18n.js";
import type { PromptMessages } from "./messages/prompt.js";
import type { AgentPrompt, DebateMessage, ProjectFileContext } from "./types.js";

/**
 * Formate le prompt complet transmis à l'adapter.
 * Dispatche vers le format ask ou synthèse si demandé, sinon construit le prompt de débat standard.
 */
export function formatAgentPrompt(input: AgentPrompt): string {
  const messages = createTranslator(input.language ?? "fr").prompt;

  if (input.mode === "summary") {
    return formatSummaryPrompt(input, messages);
  }

  if (input.mode === "ask") {
    return formatAskPrompt(input, messages);
  }

  if (input.mode === "chat") {
    return formatChatPrompt(input, messages);
  }

  if (input.mode === "consultation") {
    return formatConsultationPrompt(input, messages);
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
    input.files.length > 0 ? messages.untrustedFileContextInstruction : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    transcript.length > 0 ? messages.historyTitle : messages.emptyHistory,
    transcript.length > 0 ? messages.untrustedTranscriptInstruction : "",
    transcript,
    "",
    messages.answerTitle
  ]
    .filter(Boolean)
    .join("\n");
}

/** Formate le prompt d'un tour de conversation stateless avec l'utilisateur. */
function formatChatPrompt(input: AgentPrompt, messages: PromptMessages): string {
  const transcript = formatTranscript(input.transcript);

  return [
    messages.subject(input.topic),
    "",
    messages.chatIntro(input.selfName),
    messages.role(input.selfName, input.selfRole),
    messages.roleInstruction(input.selfRole),
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
    ...messages.chatObjectives,
    "",
    formatAvailableAgents(input, messages),
    "",
    input.files.length > 0 ? messages.fileContextTitle : "",
    input.files.length > 0 ? messages.untrustedFileContextInstruction : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    transcript.length > 0 ? messages.chatHistoryTitle : messages.emptyChatHistory,
    transcript.length > 0 ? messages.untrustedChatTranscriptInstruction : "",
    transcript,
    "",
    messages.answerTitle
  ]
    .filter(Boolean)
    .join("\n");
}
/** Formate le prompt d'un second avis explicitement demandé par l'utilisateur. */
function formatConsultationPrompt(input: AgentPrompt, messages: PromptMessages): string {
  const transcript = formatTranscript(input.transcript);

  return [
    messages.subject(input.topic),
    "",
    messages.consultationIntro(input.selfName, input.consultationRequester ?? "Palabre"),
    messages.role(input.selfName, input.selfRole),
    messages.roleInstruction(input.selfRole),
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
    ...messages.consultationObjectives,
    "",
    formatAvailableAgents(input, messages),
    "",
    input.files.length > 0 ? messages.fileContextTitle : "",
    input.files.length > 0 ? messages.untrustedFileContextInstruction : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    messages.chatHistoryTitle,
    messages.untrustedChatTranscriptInstruction,
    transcript || messages.emptyChatHistory,
    "",
    messages.answerTitle
  ]
    .filter(Boolean)
    .join("\n");
}

/** Expose les agents configurés afin qu'un agent puisse proposer une consultation sans l'exécuter. */
function formatAvailableAgents(input: AgentPrompt, messages: PromptMessages): string {
  if (!input.availableAgents || input.availableAgents.length === 0) return "";
  return [
    messages.availableAgentsTitle,
    ...input.availableAgents.map((agent) => `- ${agent.name} (${agent.role})`)
  ].join("\n");
}
/** Formate le prompt d'une réponse indépendante en mode ask. */
function formatAskPrompt(input: AgentPrompt, messages: PromptMessages): string {
  return [
    messages.subject(input.topic),
    "",
    messages.askIntro(input.selfName),
    messages.role(input.selfName, input.selfRole),
    messages.roleInstruction(input.selfRole),
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
    ...messages.askObjectives,
    "",
    input.files.length > 0 ? messages.fileContextTitle : "",
    input.files.length > 0 ? messages.untrustedFileContextInstruction : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    messages.answerTitle
  ]
    .filter(Boolean)
    .join("\n");
}

/** Formate le prompt de synthèse finale. Impose un format structuré : Consensus / Désaccords / Actions / Conclusion. */
function formatSummaryPrompt(input: AgentPrompt, messages: PromptMessages): string {
  const transcript = formatTranscript(input.transcript);
  const isAskSummary = input.peerName === "ask-responses";

  return [
    messages.subject(input.topic),
    "",
    isAskSummary ? messages.askSummaryIntro(input.selfName) : messages.summaryIntro(input.selfName),
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
    ...(isAskSummary ? messages.askSummaryObjectives : messages.summaryObjectives),
    "",
    input.files.length > 0 ? messages.fileContextTitle : "",
    input.files.length > 0 ? messages.untrustedFileContextInstruction : "",
    formatFileContext(input.files),
    input.files.length > 0 ? "" : "",
    isAskSummary ? messages.askResponsesTitle : messages.transcriptTitle,
    transcript ? messages.untrustedTranscriptInstruction : "",
    transcript || messages.noMessage,
    "",
    messages.expectedFormatTitle,
    ...(isAskSummary ? askSummaryHeadings(messages) : debateSummaryHeadings(messages)),
    "",
    isAskSummary ? messages.askFinalProseInstruction : messages.finalProseInstruction,
    "",
    messages.summaryAnswerTitle
  ]
    .filter(Boolean)
    .join("\n");
}

function debateSummaryHeadings(messages: PromptMessages): string[] {
  return [
    messages.consensusHeading,
    "",
    messages.disagreementsHeading,
    "",
    messages.actionsHeading,
    "",
    messages.conclusionHeading
  ];
}

function askSummaryHeadings(messages: PromptMessages): string[] {
  return [
    messages.askAgentSummariesHeading,
    "",
    messages.askComparisonHeading,
    "",
    messages.askWatchpointsHeading,
    "",
    messages.actionsHeading,
    "",
    messages.conclusionHeading
  ];
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
