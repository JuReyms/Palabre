/** @file Exports Markdown : `.debate.md`/`.ask.md` (transcript, métadonnées, synthèse finale) et `.relay.md` (relay vers une session externe). */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";
import type { ReadAccessDiagnostic } from "./externalSessions/types.js";
import type { DebateFailure, DebateMessage, DebateOptions, DebateSummary } from "./types.js";
import { getPackageVersion } from "./version.js";
import { relayWriteText } from "./messages/relayWrite.js";
import type { ThenFollowReport } from "./externalSessions/openRelay.js";

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

/** Données d'un export `.relay.md` (voir docs/dev/relay.md, section "Relay externe"). */
export interface RelayExport {
  /** Source et copie distinctes, même après erreur ou absence de réponse. */
  copy?: import("./externalSessions/copyRelay.js").CopyReport;
  /** Suite séparée de --then-follow ; aucune nouvelle délivrance ni autorisation. */
  nextTurn?: ThenFollowReport;
  /** Rapport Git et commandes observées, uniquement après un accord d'écriture ponctuel. */
  write?: import("./externalSessions/write.js").WriteReport;
  /** Indication de reprise CLI, sans date/fuseau implicites ni relance automatique. */
  retryAfter?: number | string;
  readAccess?: ReadAccessDiagnostic;
  subject?: string;
  cli?: { path: string; version: string | null };
  task?: { name: "review"; pr: string; headSha?: string; publication: string; reviewUrl?: string; error?: string };
  from: { agent: string; session?: string } | null;
  to: { agent: string; session: string | null; provider: string };
  /** Création Relay : l'identifiant peut manquer si la CLI n'a rien annoncé. */
  created?: boolean;
  cwd?: string;
  /** Lien `codex://threads/…` d'une conversation Codex créée ; absent sinon (#179). */
  desktopLink?: string;
  status: string;
  delivery: { status: string; persisted: boolean | "unknown"; inActiveBranch: boolean | "unknown" };
  identity: string | null;
  observedModels: string[];
  nonce: string;
  startedAt: string;
  /** Message transmis, avant enveloppe. */
  message: string;
  /** Texte exact soumis au transport ; absent avant tentative, pour un suivi et les parcours gelés. */
  envelope?: string;
  reply?: string;
  error?: string;
  /** Diagnostic de `--open` (B1) ; absent sans `--open`, ce qui laisse l'export Relay A inchangé. */
  open?: {
    queue: string;
    correlation: string | null;
    receiver: string;
    targetPermissions: string | null;
  };
  /**
   * Mode de l'échange (#190). Déduit de `copy`/`open`/`follow` quand il est absent ;
   * sans preuve de ces parcours, un export antérieur reste en arrière-plan.
   */
  mode?: "background" | "open" | "follow" | "copy";
  /** Origine du mode choisi par la CLI, sans autorité supplémentaire. */
  modeSource?: import("./externalSessions/relayView.js").RelayModeSource;
  /** Suivi `--open --follow` (#195) : aucun dépôt, donc ni référence ni message transmis. */
  follow?: {
    correlation: string | null;
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
  const mode = report.mode ?? (report.copy ? "copy" : report.follow ? "follow" : report.open ? "open" : "background");
  const rows = [
    [labels.palabreVersion, metadata.palabreVersion],
    [labels.mode, `${mode} — ${labels.modeNames[mode]}`],
    ...(report.modeSource ? [["modeSource", report.modeSource]] : []),
    [labels.from, report.from ? `${report.from.agent}${report.from.session ? `:${report.from.session}` : ""}` : messages.relay.terminalSender],
    [labels.to, `${report.to.agent}${report.to.session ? `:${report.to.session}` : ""}`],
    ...(report.created !== undefined ? [[labels.created, formatBoolean(report.created)], [labels.cwd, report.cwd ?? labels.unknown]] : []),
    ...(report.desktopLink ? [[labels.desktopLink, report.desktopLink]] : []),
    [labels.provider, report.to.provider],
    ...(report.copy ? [
      [messages.relay.copy.source, report.copy.source],
      [messages.relay.copy.copy, report.copy.session ?? (report.copy.retention === "none" ? messages.relay.copy.none : messages.relay.copy.unknown)],
      [messages.relay.copy.verified, formatBoolean(report.copy.verified)], [messages.relay.copy.retention, report.copy.retention],
      ...(report.copy.diagnostic ? [[messages.relay.copy.diagnostic, report.copy.diagnostic]] : []),
      [labels.cwd, report.cwd ?? labels.unknown], [messages.relay.copy.check, report.copy.sourceCheck],
      [messages.relay.copy.stop, report.copy.serverStop]
    ] : []),
    [labels.status, report.status],
    [labels.delivery, report.delivery.status],
    [labels.persisted, formatBoolean(report.delivery.persisted)],
    [labels.inActiveBranch, formatBoolean(report.delivery.inActiveBranch)],
    [labels.identity, report.identity ?? labels.none],
    [labels.observedModels, report.observedModels.length > 0 ? report.observedModels.join(", ") : labels.none],
    [labels.nonce, report.nonce || labels.none],
    [labels.startedAt, report.startedAt],
    ...(report.readAccess ? [[labels.readAccess, `${report.readAccess.status}; ${report.readAccess.reason}; failedCommands=${report.readAccess.failedCommands}${report.readAccess.succeededCommands === undefined ? "" : `; succeededCommands=${report.readAccess.succeededCommands}`}`]] : []),
    ...(report.retryAfter !== undefined ? [[labels.retryAfter, String(report.retryAfter)]] : []),
    ...(report.subject !== undefined ? [[labels.subject, report.subject]] : []),
    ...(report.cli ? [[labels.cliPath, report.cli.path], [labels.cliVersion, report.cli.version ?? labels.unknown]] : []),
    ...(report.task ? [
      [labels.task, report.task.name], [labels.pullRequest, report.task.pr], [labels.commit, report.task.headSha ?? labels.unknown],
      [labels.publication, report.task.publication], [labels.reviewUrl, report.task.reviewUrl ?? labels.none]
    ] : []),
    ...(report.open
      ? [
        [labels.queue, report.open.queue],
        [labels.correlation, report.open.correlation ?? labels.none],
        [labels.receiver, report.open.receiver],
        [labels.targetPermissions, report.open.targetPermissions ?? labels.unknown]
      ]
      : []),
    ...(report.follow
      ? [
        [labels.correlation, report.follow.correlation ?? labels.none],
        [labels.receiver, "unverified"],
        [labels.targetPermissions, report.follow.targetPermissions ?? labels.unknown]
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
    `> ${report.copy ? messages.relay.copy.notice : report.write ? relayWriteText(report.write.language).exportNotice : report.follow ? messages.relay.open.followNotice : report.open ? labels.openNotice : labels.readOnlyNotice}`,
    "",
    // Un relay réussi n'a pas de section Erreur : l'avertissement doit donc exister par lui-même.
    // Une seule copie : quand l'erreur porte déjà l'avertissement (`blocked`, échec enrichi), la
    // section Erreur suffit.
    ...(report.readAccess && !report.error?.includes(messages.relay.readAccess(report.readAccess))
      ? [`> ${messages.relay.readAccess(report.readAccess)}`, ""] : []),
    `## ${labels.message}`,
    "",
    report.message,
    "",
    ...(report.reply !== undefined ? [`## ${labels.reply}`, "", report.reply, ""] : []),
    ...(report.error !== undefined ? [`## ${labels.error}`, "", report.error, ""] : [])
  ];
  if (report.write) content.push(`## ${relayWriteText(report.write.language).exportHeading}`, "", "````json", JSON.stringify(report.write, null, 2), "````", "");
  if (report.nextTurn) {
    const next = report.nextTurn;
    content.push(`## nextTurn — ${messages.relayThenFollow.label}`, "", messages.relayThenFollow.statusLine(labels.status, next.status, next.reason), "",
      ...(next.reply !== undefined ? [next.reply, ""] : []), "````json", JSON.stringify(next, null, 2), "````", "");
  }
  const rendered = normalizeMarkdownForWindowsPreview(content.join("\n"));
  if (report.envelope === undefined) return rendered;
  // Ne jamais normaliser ce bloc : il conserve aussi CRLF, accents et `:**`.
  // Un délimiteur plus long que tous les backticks du message empêche sa fermeture anticipée.
  const fence = "`".repeat((report.envelope.match(/`+/g) ?? []).reduce((length, run) => Math.max(length, run.length + 1), 3));
  // Avant tout corps/réponse non fiable : un fence laissé ouvert ne peut pas avaler la trace.
  const messageIndex = content.indexOf(`## ${labels.message}`);
  return `${normalizeMarkdownForWindowsPreview(content.slice(0, messageIndex).join("\n"))}\n## ${messages.relay.messageCopy.heading}\n\n${messages.relay.messageCopy.notice}\n\n${fence}text\n${report.envelope}\n${fence}\n\n${normalizeMarkdownForWindowsPreview(content.slice(messageIndex).join("\n"))}`;
}
