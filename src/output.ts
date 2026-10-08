/** @file Exports Markdown : `.debate.md`/`.ask.md` (transcript, métadonnées, synthèse finale) et `.relay.md` (relay vers une session externe). */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";
import type { DebateFailure, DebateMessage, DebateOptions, DebateSummary } from "./types.js";
import { getPackageVersion } from "./version.js";

interface ReportMetadata {
  palabreVersion: string;
}

/**
 * Écrit le débat au format Markdown dans `outputDir`.
 * Crée le répertoire si absent. Retourne le chemin absolu du fichier créé.
 */
export async function writeDebateMarkdown(
  outputDir: string,
  options: DebateOptions,
  debateMessages: DebateMessage[],
  summary?: DebateSummary,
  stopReason?: string,
  messages: Messages = createTranslator("fr"),
  failure?: DebateFailure
): Promise<string> {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = options.mode === "ask" ? "ask" : "debate";
  const fileName = `palabre-${slugifyTopic(options.topic, extension === "ask" ? "ask" : "debat")}-${safeDate}.${extension}.md`;
  const filePath = path.resolve(outputDir, fileName);

  await mkdir(path.dirname(filePath), { recursive: true });
  const metadata = { palabreVersion: await getPackageVersion() };
  await writeFile(filePath, renderDebateMarkdown(options, debateMessages, summary, stopReason, messages, failure, metadata), "utf8");

  return filePath;
}

function slugifyTopic(topic: string, fallback: string): string {
  const slug = topic
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  return slug || fallback;
}

/**
 * Produit la représentation Markdown complète du débat.
 * Fonction pure : aucun effet de bord sur le filesystem.
 */
export function renderDebateMarkdown(
  options: DebateOptions,
  debateMessages: DebateMessage[],
  summary?: DebateSummary,
  stopReason?: string,
  messages: Messages = createTranslator("fr"),
  failure?: DebateFailure,
  metadata: ReportMetadata = { palabreVersion: "unknown" }
): string {
  const lines = [
    options.mode === "ask" ? messages.output.askTitle : messages.output.title,
    "",
    ...renderSessionHeader(options, debateMessages, stopReason, messages, metadata),
    "",
    messages.output.contextTitle,
    "",
    ...renderFileList(options.files, messages),
    "",
    options.mode === "ask" ? messages.output.askResponsesTitle : messages.output.exchangesTitle,
    ""
  ];

  for (const message of debateMessages) {
    lines.push(
      `### ${message.agent} (${message.role})`,
      "",
      normalizeMarkdownForWindowsPreview(message.content.trim()),
      ""
    );
  }

  if (failure) {
    lines.push("---", "", messages.output.failureTitle, "", ...renderFailureBlock(failure, messages), "");
  }

  lines.push("---", "", messages.output.finalSummaryTitle, "", ...renderSummaryBlock(options, summary, messages));

  return `${lines.join("\n")}\n`;
}

function renderSummaryBlock(options: DebateOptions, summary: DebateSummary | undefined, messages: Messages): string[] {
  if (summary) {
    return [
      `| ${messages.output.tableField} | ${messages.output.tableValue} |`,
      "| --- | --- |",
      `| ${messages.output.fields.agent} | ${escapeTableCell(summary.agent)} |`,
      `| ${messages.output.fields.role} | ${escapeTableCell(summary.role)} |`,
      `| ${messages.output.fields.date} | ${escapeTableCell(summary.createdAt)} |`,
      "",
      normalizeMarkdownForWindowsPreview(summary.content.trim()),
      ""
    ];
  }

  return [
    options.summaryEnabled
      ? messages.output.summaryMissing
      : messages.output.summaryDisabled,
    ""
  ];
}

function renderFailureBlock(failure: DebateFailure, messages: Messages): string[] {
  const rows = [
    [messages.output.fields.failurePhase, failure.phase],
    [messages.output.fields.failureAgent, failure.agent ?? messages.output.no],
    [messages.output.fields.failureTurn, failure.turn === undefined ? messages.output.no : String(failure.turn)],
    [messages.output.fields.failureKind, failure.kind],
    [messages.output.fields.failureMessage, failure.message]
  ];

  return [
    `| ${messages.output.tableField} | ${messages.output.tableValue} |`,
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label)} | ${escapeTableCell(value)} |`)
  ];
}

function normalizeMarkdownForWindowsPreview(content: string): string {
  return content.replace(/:\*\*/g, "&#58;**");
}

function renderSessionHeader(
  options: DebateOptions,
  debateMessages: DebateMessage[],
  stopReason: string | undefined,
  messages: Messages,
  metadata: ReportMetadata
): string[] {
  const rows = [
    [messages.output.fields.palabreVersion, metadata.palabreVersion],
    [messages.output.fields.invocationSource, options.session.invocation?.client ?? "direct-cli"],
    ...(options.session.invocation?.clientVersion
      ? [[messages.output.fields.clientVersion, options.session.invocation.clientVersion]]
      : []),
    [messages.output.fields.subject, options.topic],
    [messages.output.fields.mode, options.mode],
    [messages.output.fields.agents, formatAgentsForHeader(options)],
    [messages.output.fields.autoPullOllama, options.pullModels ? messages.output.yes : messages.output.no],
    [messages.output.fields.summary, options.summaryEnabled ? options.summaryAgent : messages.output.disabled],
    [
      options.mode === "ask" ? messages.output.fields.requestedResponses : messages.output.fields.requestedTurns,
      String(options.mode === "ask" ? options.askAgents?.length ?? debateMessages.length : options.turns)
    ],
    [
      options.mode === "ask" ? messages.output.fields.receivedResponses : messages.output.fields.playedTurns,
      String(debateMessages.length)
    ],
    [messages.output.fields.earlyStop, options.mode === "debate" ? stopReason ?? messages.output.no : messages.output.no],
    [messages.output.fields.localDate, options.session.localDate],
    [messages.output.fields.timeZone, options.session.timeZone],
    [messages.output.fields.cwd, options.session.cwd],
    [messages.output.fields.sessionStartedAt, options.session.startedAt]
  ];

  return [
    `| ${messages.output.tableField} | ${messages.output.tableValue} |`,
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label)} | ${escapeTableCell(value)} |`)
  ];
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function renderFileList(files: DebateOptions["files"], messages: Messages): string[] {
  if (files.length === 0) {
    return [messages.output.noFileContext];
  }

  return files.map((file) => `- \`${file.path}\` (${file.sizeBytes} ${messages.output.fileSizeUnit})`);
}

function formatAgentsForHeader(options: DebateOptions): string {
  if (options.mode === "ask") {
    return (options.askAgents && options.askAgents.length > 0 ? options.askAgents : [options.agentA, options.agentB]).join(", ");
  }

  return `${options.agentA} <-> ${options.agentB}`;
}

/** Données d'un export `.relay.md` (voir AGENTS.md, section "Relay externe"). */
export interface RelayExport {
  from: { agent: string; session: string };
  to: { agent: string; session: string; provider: string };
  status: string;
  delivery: { status: string; persisted: boolean | "unknown"; inActiveBranch: boolean | "unknown" };
  identity: string | null;
  observedModels: string[];
  nonce: string;
  startedAt: string;
  /** Message transmis, avant enveloppe. */
  message: string;
  reply?: string;
  error?: string;
  /** Diagnostic de `--open` (B1) ; absent sans `--open`, ce qui laisse l'export Relay A inchangé. */
  open?: {
    queue: string;
    correlation: string | null;
    receiver: string;
    targetPermissions: string | null;
  };
}

/**
 * Écrit l'export `.relay.md` dans `outputDir`, créé au besoin. Le fichier contient les
 * identifiants de session de l'expéditeur et de la cible. Retourne le chemin absolu.
 */
export async function writeRelayMarkdown(outputDir: string, report: RelayExport, messages: Messages): Promise<string> {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `palabre-relay-${slugifyTopic(report.to.agent, "relay")}-${safeDate}.relay.md`;
  const filePath = path.resolve(outputDir, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, renderRelayMarkdown(report, messages, { palabreVersion: await getPackageVersion() }), "utf8");
  return filePath;
}

/** Représentation Markdown d'un relay. Fonction pure. */
export function renderRelayMarkdown(report: RelayExport, messages: Messages, metadata: ReportMetadata): string {
  const labels = messages.relay.export;
  const formatBoolean = (value: boolean | "unknown") => (value === "unknown" ? "unknown" : value ? messages.output.yes : messages.output.no);
  const rows = [
    [labels.palabreVersion, metadata.palabreVersion],
    [labels.from, `${report.from.agent}:${report.from.session}`],
    [labels.to, `${report.to.agent}:${report.to.session}`],
    [labels.provider, report.to.provider],
    [labels.status, report.status],
    [labels.delivery, report.delivery.status],
    [labels.persisted, formatBoolean(report.delivery.persisted)],
    [labels.inActiveBranch, formatBoolean(report.delivery.inActiveBranch)],
    [labels.identity, report.identity ?? labels.none],
    [labels.observedModels, report.observedModels.length > 0 ? report.observedModels.join(", ") : labels.none],
    [labels.nonce, report.nonce],
    [labels.startedAt, report.startedAt],
    ...(report.open
      ? [
        [labels.mode, "open"],
        [labels.queue, report.open.queue],
        [labels.correlation, report.open.correlation ?? labels.none],
        [labels.receiver, report.open.receiver],
        [labels.targetPermissions, report.open.targetPermissions ?? labels.unknown]
      ]
      : [])
  ];
  const content = [
    `# ${labels.title}`,
    "",
    `| ${labels.field} | ${labels.value} |`,
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label!)} | ${escapeTableCell(value!)} |`),
    "",
    `> ${report.open ? labels.openNotice : labels.readOnlyNotice}`,
    "",
    `## ${labels.message}`,
    "",
    report.message,
    "",
    ...(report.reply !== undefined ? [`## ${labels.reply}`, "", report.reply, ""] : []),
    ...(report.error !== undefined ? [`## ${labels.error}`, "", report.error, ""] : [])
  ];
  return normalizeMarkdownForWindowsPreview(content.join("\n"));
}
