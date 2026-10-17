/**
 * @file Commande `palabre relay` : transmet un message à une conversation Codex ou Claude Code
 * fermée et rend une réponse, en un seul appel (voir AGENTS.md, section "Relay externe").
 *
 * Déroulé strictement ordonné ; une étape refusée arrête le relay sans rien lancer :
 * arguments, config approuvée (sans question interactive), agent et fournisseur, exécutable,
 * historique et dossier de la cible, attachement, puis échange (étape préalable et reprise),
 * issue, délivrance, export et sortie. Aucun retry : le statut de délivrance dit à l'appelant
 * s'il peut renvoyer sans risque de doublon.
 *
 * `--open` (B1, Codex seulement) inverse la condition d'attachement : la conversation doit être
 * ouverte (verrou tenu). Après la même résolution de config, d'agent et d'exécutable (D21), la
 * localisation est bornée et le dépôt passe par `codex queue` (`runOpenRelay`). La cible garde ses
 * outils et permissions ; les champs JSON propres à `--open` n'apparaissent qu'avec cette option.
 */
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { externalSessionProviderForCommand, isRetiredAgentName } from "../agentRegistry.js";
import { configExists, loadConfig, resolveDefaultConfigPath, resolveOutputDir } from "../config.js";
import { isConfigTrusted, trustConfig } from "../configTrust.js";
import { exchange, exchangeOutcome, type ExchangeResult, type ExternalExecutable, type ExternalSessionAdapter } from "../externalSessions/adapter.js";
import { ClaudeSessionAdapter } from "../externalSessions/claude.js";
import { CodexSessionAdapter } from "../externalSessions/codex.js";
import { buildEnvelope, buildOpenEnvelope, createNonce, MAX_RELAY_MESSAGE_BYTES, parseSessionRef, validateRelayMessage } from "../externalSessions/envelope.js";
import type { OpenTurnContext } from "../externalSessions/openReader.js";
import { defaultOpenRelayDeps, runOpenRelay, type OpenQueueReport, type OpenRelayResult } from "../externalSessions/openRelay.js";
import { locateOpenRollout } from "../externalSessions/openRollout.js";
import { assessTarget, classifyDelivery, RELAY_EXIT_CODES, refusalOutcome, type PreLaunchRefusal } from "../externalSessions/outcome.js";
import { resolveExternalExecutable } from "../externalSessions/resolve.js";
import { checkClaudeReviewCli, MIN_CLAUDE_REVIEW_VERSION, type ReviewCliIdentity } from "../externalSessions/reviewCli.js";
import { parsePullRequest, reviewAllowed, readPullRequest, reviewPrompt, publishReview, type ReviewReport, type ReviewInput } from "../externalSessions/review.js";
import type {
  DeliveryVerdict,
  ExternalProvider,
  ExternalTarget,
  InvalidRequestReason,
  RelayOutcome,
  RelayStatus,
  SessionIdentity,
  SessionRef
} from "../externalSessions/types.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import type { Messages } from "../messages/index.js";
import { writeRelayMarkdown } from "../output.js";
import { optionalString } from "./shared.js";
import { runRelayAllowRepo, reviewAuthorizationCommand } from "./relayAllowRepo.js";

/** Timeout par défaut et bornes de `--timeout`, en secondes. */
export const DEFAULT_RELAY_TIMEOUT_SECONDS = 600;
export const MIN_RELAY_TIMEOUT_SECONDS = 10;
export const MAX_RELAY_TIMEOUT_SECONDS = 3600;

/** Options de `palabre relay` qui attendent une valeur. */
const RELAY_VALUE_FLAGS = new Set(["from", "to", "message-file", "timeout", "config", "language", "task", "pr"]);
/** Options de `palabre relay` sans valeur. */
const RELAY_BOOLEAN_FLAGS = new Set(["json", "no-export", "trust-config", "help", "open"]);
/** Alias acceptés, comme pour les autres commandes. */
const RELAY_FLAG_ALIASES: Record<string, string> = { lang: "language" };

/**
 * Sortie `--json` v1 : un seul objet, quelle que soit l'issue. Politique de version du renderer
 * NDJSON : un ajout optionnel ne change pas `v`.
 */
export interface RelayResultV1 {
  /** Human confirmation command; the agent may open it, but must never answer for the owner. */
  remedy?: string;
  /** CLI inspected before a Claude review, including on compatibility refusal. */
  cli?: ReviewCliIdentity;
  /** Tâche autorisée, distincte de la délivrance du message. Présente uniquement avec --task. */
  task?: ReviewReport;
  /** Vrai seulement pour une occupation refusée avant tout envoi. */
  retryable?: boolean;
  v: 1;
  type: "relay-result";
  status: RelayStatus;
  exitCode: number;
  from: { agent: string; session: string } | null;
  to: { agent: string; session: string; provider: ExternalProvider | null } | null;
  /** Réponse de l'agent ; conservée aussi si la publication d'une revue échoue ensuite. */
  reply?: string;
  delivery: DeliveryVerdict;
  identity: SessionIdentity | null;
  observedModels: string[];
  error: { kind: RelayStatus; message: string; reason?: InvalidRequestReason } | null;
  exportPath: string | null;
  durationMs: number;
  /**
   * Champs optionnels propres à `--open` (B1), présents seulement avec `--open` : la sortie sans
   * `--open` reste identique, champ pour champ. `status` peut alors valoir `target-not-open`.
   */
  mode?: "open";
  queue?: OpenQueueReport;
  correlation?: { status: string; reason: string };
  receiver?: "unverified";
  targetPermissions?: Omit<OpenTurnContext, "model"> | "unknown";
}

/** État partagé avec le gestionnaire d'erreur interne, pour qualifier la délivrance. */
interface RelayContext {
  /** Annulation du chef de mission ; ne confère aucun droit supplémentaire. */
  signal?: AbortSignal;
  remedy?: string;
  cli?: ReviewCliIdentity;
  task?: ReviewReport;
  startedAt: number;
  messages: Messages;
  from: SessionRef | null;
  to: SessionRef | null;
  provider: ExternalProvider | null;
  /** Vrai dès que l'échange a commencé : une erreur interne rend alors la délivrance inconnue. */
  exchangeStarted: boolean;
  /** `--open` (B1) : dépôt dans une conversation Codex ouverte. */
  open: boolean;
}

/** Erreur de validation : arrête le relay avec un refus avant lancement. */
class RelayRefusal extends Error {
  constructor(readonly refusal: PreLaunchRefusal, message?: string) {
    super(message ?? refusal.status);
  }
}

const invalid = (reason: InvalidRequestReason, detail?: string) => new RelayRefusal({ status: "invalid-request", reason }, detail);

const NOT_DELIVERED: DeliveryVerdict = { status: "not-delivered", persisted: false, inActiveBranch: false };

/** Langue de démarrage : `--language`, puis `PALABRE_LANGUAGE` ; une valeur invalide retombe sur le français. */
function startupMessages(rawArgs: readonly string[]): Messages {
  const index = rawArgs.findIndex((arg) => arg === "--language" || arg === "--lang");
  const explicit = index >= 0 ? rawArgs[index + 1] : undefined;
  try {
    return createTranslator(resolveLanguage({ explicitLanguage: explicit }));
  } catch {
    return createTranslator("fr");
  }
}

/** Point d'entrée de `palabre relay`. `rawArgs` commence par `relay`. */
export async function runRelayCommand(rawArgs: string[]): Promise<void> {
  const messages = startupMessages(rawArgs);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(messages.help.renderCommand("relay"));
    return;
  }
  if (rawArgs[1] === "allow-repo") {
    try { await runRelayAllowRepo(rawArgs.slice(2)); }
    catch (error) {
      console.error(sanitizeTerminalText(error instanceof Error ? error.message : messages.relay.invalidRequest("invalid-arguments")));
      process.exitCode = 8;
    }
    return;
  }
  const { result, messages: resolvedMessages } = await executeRelayWithMessages(rawArgs);
  writeResult(result, rawArgs.includes("--json"), resolvedMessages);
  process.exitCode = result.exitCode;
}

/** Même échange que la commande, sans sortie console ni exitCode global ; utilisé par Mission. */
export async function executeRelay(rawArgs: string[], options: { signal?: AbortSignal } = {}): Promise<RelayResultV1> {
  return (await executeRelayWithMessages(rawArgs, options)).result;
}

/** Préserve la langue résolue dans la config pour le rendu de la commande historique. */
async function executeRelayWithMessages(rawArgs: string[], options: { signal?: AbortSignal } = {}): Promise<{ result: RelayResultV1; messages: Messages }> {
  const context: RelayContext = {
    signal: options.signal,
    startedAt: Date.now(),
    messages: startupMessages(rawArgs),
    from: null,
    to: null,
    provider: null,
    exchangeStarted: false,
    open: rawArgs.includes("--open")
  };
  let result: RelayResultV1;
  try {
    result = await relay(rawArgs, context);
  } catch (error) {
    result = error instanceof RelayRefusal
      ? refusalResult(context, error)
      : buildResult(context, {
        outcome: { status: "internal-error", exitCode: RELAY_EXIT_CODES["internal-error"] },
        delivery: context.exchangeStarted ? { status: "unknown", persisted: "unknown", inActiveBranch: "unknown" } : NOT_DELIVERED,
        detail: error instanceof Error ? error.message : String(error)
      });
  }
  return { result, messages: context.messages };
}

async function relay(rawArgs: string[], context: RelayContext): Promise<RelayResultV1> {
  if (context.signal?.aborted) throw new RelayRefusal({ status: "cancelled" });
  const { messages } = context;
  const { flags, positionals } = parseRelayTokens(rawArgs.slice(1), messages);
  try {
    resolveLanguage({ explicitLanguage: optionalString(flags.language) });
  } catch (error) {
    throw invalid("invalid-arguments", error instanceof Error ? error.message : undefined);
  }

  const toValue = optionalString(flags.to);
  if (!toValue) throw invalid("invalid-arguments", messages.relay.arguments.toRequired);
  const fromValue = optionalString(flags.from);
  if (!fromValue) throw invalid("invalid-arguments", messages.relay.arguments.fromRequired);
  const to = parseSessionRef(toValue);
  if (!to.ok) throw invalid(to.reason);
  context.to = to.value;
  const from = parseSessionRef(fromValue);
  if (!from.ok) throw invalid(from.reason);
  context.from = from.value;

  if (flags.task !== undefined && flags.task !== "review") throw invalid("task-not-allowed");
  const pr = typeof flags.pr === "string" ? parsePullRequest(flags.pr) : undefined;
  if ((flags.task === "review" && (!pr || context.open || flags["trust-config"])) || (flags.pr && !flags.task)) throw invalid("invalid-pr");
  const defaultReviewMessage = flags.task === "review" && positionals.length === 0 && !flags["message-file"];
  let message = defaultReviewMessage ? "" : await readRelayMessage(flags, positionals, messages);
  const timeoutSeconds = parseTimeout(flags.timeout, messages);

  // Config : même résolution que les autres commandes, approbation exigée sans question interactive.
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  if (!(await configExists(configPath))) throw invalid("config-unavailable");
  try {
    if (flags["trust-config"] === true) {
      await trustConfig(configPath);
    } else if (!(await isConfigTrusted(configPath))) {
      throw invalid("config-untrusted");
    }
  } catch (error) {
    if (error instanceof RelayRefusal) throw error;
    throw invalid("config-unavailable");
  }
  let config: Awaited<ReturnType<typeof loadConfig>>;
  let configFingerprint: string | undefined;
  try {
    configFingerprint = flags.task ? createHash("sha256").update(await readFile(configPath)).digest("hex") : undefined;
    config = await loadConfig(configPath);
  } catch {
    throw invalid("config-unavailable");
  }
  try {
    context.messages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language), configLanguage: config.language }));
  } catch {
    // Langue de config invalide : la langue de démarrage reste utilisée.
  }
  if (pr) {
    if (!reviewAllowed(config.relay, pr) || !(await isConfigTrusted(configPath))
      || createHash("sha256").update(await readFile(configPath)).digest("hex") !== configFingerprint) {
      context.remedy = reviewAuthorizationCommand(pr.repository, configPath);
      throw invalid("task-not-allowed", context.messages.relay.authorizationRequired(pr.repository, context.remedy));
    }
    context.task = { name: "review", pr: pr.url, publication: "not-attempted" };
  }
  if (defaultReviewMessage) message = context.messages.relay.defaultReviewMessage;

  // Agent cible, fournisseur et exécutable, sans réutiliser les réglages de débat.
  const agent = config.agents[to.value.agent];
  if (!agent || isRetiredAgentName(to.value.agent)) throw invalid("unknown-agent");
  if (agent.type !== "cli") throw invalid("unsupported-agent");
  const provider = externalSessionProviderForCommand(agent.command);
  if (!provider) throw invalid("unsupported-agent");
  context.provider = provider;
  const resolution = resolveExternalExecutable(agent.command);
  if (resolution.status === "command-not-found") throw new RelayRefusal({ status: "command-not-found" });
  if (resolution.status === "unsupported-executable") throw invalid("unsupported-executable");

  if (context.open) {
    if (provider !== "codex") throw invalid("unsupported-agent", context.messages.relay.open.unsupportedProvider);
    return relayOpen(context, {
      to: to.value,
      from: from.value,
      message,
      timeoutMs: timeoutSeconds * 1000,
      executable: resolution.executable,
      outputDir: resolveOutputDir(config.outputDir),
      exportResult: flags["no-export"] !== true
    });
  }

  // Claude : cadre opérateur fixe (D22) dans la langue du relay, sans aucun contenu du message.
  const adapter: ExternalSessionAdapter = provider === "claude"
    ? new ClaudeSessionAdapter({ operatorFrame: context.messages.relay.operatorFrame, safeMode: flags.task === "review" })
    : new CodexSessionAdapter();
  const located = adapter.locate(to.value);
  if (located.status !== "found") {
    throw located.status === "session-not-found"
      ? new RelayRefusal({ status: "session-not-found" })
      : invalid("invalid-working-directory");
  }
  const decision = assessTarget(adapter.probe(located.target));
  if (!decision.allowed) throw new RelayRefusal({ status: decision.status });

  if (pr && provider === "claude") {
    const checked = await checkClaudeReviewCli(resolution.executable, located.target.cwd);
    context.cli = checked.cli;
    if (!checked.supported) throw invalid("review-cli-unsupported",
      `version=${checked.cli.version ?? "unknown"}; minimum=${MIN_CLAUDE_REVIEW_VERSION}; path=${checked.cli.path}`);
  }

  let review: ReviewInput | undefined;
  if (context.signal?.aborted) throw new RelayRefusal({ status: "cancelled" });
  if (pr) {
    try {
      review = await readPullRequest(pr);
      message = reviewPrompt(review, message);
      context.task!.headSha = review.headSha;
    } catch { throw invalid("review-unavailable"); }
  }

  const nonce = createNonce();
  const envelope = buildEnvelope({ from: from.value, nonce, message }, context.messages.relay);
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  context.signal?.addEventListener("abort", onInterrupt, { once: true });
  if (context.signal?.aborted) controller.abort();
  process.once("SIGINT", onInterrupt);
  context.exchangeStarted = true;
  try {
    const exchanged = await exchange(adapter, resolution.executable, located.target, envelope, {
      timeoutMs: timeoutSeconds * 1000,
      signal: controller.signal
    });
    const { outcome, launched } = exchangeOutcome(exchanged);
    const evidence = launched ? adapter.findNonce(located.target, nonce) : undefined;
    const delivery = classifyDelivery({ outcome, launched, evidence });
    const reply = outcome.status === "replied" ? exchanged.verdict?.interpretation.reply : undefined;
    const result = buildResult(context, {
      outcome,
      delivery,
      reply,
      identity: exchanged.verdict?.interpretation.identity ?? null,
      observedModels: exchanged.verdict?.interpretation.observedModels ?? []
    });
    if (review && reply !== undefined && outcome.status === "replied") {
      try {
        const reviewUrl = await publishReview(review, reply, to.value.agent, [from.value.sessionId, to.value.sessionId, nonce], undefined, async () => {
          if (!(await isConfigTrusted(configPath))
            || createHash("sha256").update(await readFile(configPath)).digest("hex") !== configFingerprint) throw new Error("review-authorization-changed");
          if (controller.signal.aborted) throw new Error("review-cancelled");
          context.task!.publication = "unknown";
        });
        context.task!.publication = "published";
        context.task!.reviewUrl = reviewUrl;
      } catch (error) {
        const known = ["pull-request-changed", "review-authorization-changed", "invalid-review-body", "review-cancelled"];
        const reason = error instanceof Error && known.includes(error.message) ? error.message
          : context.task!.publication === "unknown" ? "review-publication-unconfirmed" : "review-publication-refused";
        context.task!.error = reason;
        result.status = "review-failed"; result.exitCode = RELAY_EXIT_CODES["review-failed"];
        result.error = { kind: "review-failed", message: context.messages.relay.reviewFailure(reason) };
      }
    }
    applyReviewCancellation(result, controller.signal.aborted, context.messages);
    result.durationMs = Date.now() - context.startedAt;
    if (flags["no-export"] !== true) {
      result.exportPath = await exportRelay(resolveOutputDir(config.outputDir), result, { nonce, message, startedAt: context.startedAt }, context.messages);
    }
    return result;
  } finally {
    context.signal?.removeEventListener("abort", onInterrupt);
    process.removeListener("SIGINT", onInterrupt);
  }
}

/**
 * `--open` (B1) : dépôt dans une conversation Codex ouverte, puis réponse corrélée. Localisation
 * bornée (première ligne du rollout seulement) ; Ctrl+C est géré avant la référence, le dépôt et
 * l'attente, qui partagent une seule échéance (`runOpenRelay`). Aucun renvoi automatique.
 */
async function relayOpen(
  context: RelayContext,
  input: { to: SessionRef; from: SessionRef; message: string; timeoutMs: number; executable: ExternalExecutable; outputDir: string; exportResult: boolean }
): Promise<RelayResultV1> {
  const home = path.join(os.homedir(), ".codex");
  const located = await locateOpenRollout(home, input.to.sessionId);
  if (located.status !== "found") {
    throw located.status === "session-not-found" ? new RelayRefusal({ status: "session-not-found" }) : invalid("invalid-working-directory");
  }
  const adapter = new CodexSessionAdapter({ home });
  const target: ExternalTarget = { agent: input.to.agent, provider: "codex", sessionId: input.to.sessionId, cwd: located.cwd };
  const nonce = createNonce();
  const envelope = buildOpenEnvelope({ from: input.from, nonce, message: input.message }, context.messages.relay);
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.once("SIGINT", onInterrupt);
  let open: OpenRelayResult;
  try {
    open = await runOpenRelay({
      executable: input.executable,
      sessionId: input.to.sessionId,
      cwd: located.cwd,
      historyPath: located.historyPath,
      envelope,
      nonce,
      timeoutMs: input.timeoutMs,
      signal: controller.signal,
      onAttempt: () => { context.exchangeStarted = true; }
    }, defaultOpenRelayDeps(() => adapter.probe(target)));
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }
  const result = buildResult(context, {
    outcome: open.outcome,
    delivery: open.delivery,
    reply: open.reply,
    identity: open.identity,
    observedModels: open.observedModels,
    message: openErrorMessage(open, context.messages),
    open
  });
  // Un refus avant tentative n'a rien exécuté : pas d'export, comme pour Relay A.
  if (input.exportResult && open.queue.attempted) {
    result.exportPath = await exportRelay(input.outputDir, result, { nonce, message: input.message, startedAt: context.startedAt }, context.messages);
  }
  return result;
}

/** Message d'erreur de `--open` : issue, diagnostic court, et réception non observée après tentative. */
function openErrorMessage(open: OpenRelayResult, messages: Messages): string | undefined {
  if (open.outcome.status === "replied") return undefined;
  const relayMessages = messages.relay;
  const tooLarge = open.outcome.status === "invalid-request" && open.outcome.reason === "message-too-large";
  const parts = [tooLarge ? relayMessages.open.messageTooLarge(open.diagnostic ?? "") : errorMessage(open.outcome, messages)];
  if (open.diagnostic && !tooLarge) parts.push(relayMessages.open.diagnostic(open.diagnostic));
  if (open.queue.attempted && !open.receptionObserved) parts.push(relayMessages.open.receptionNotObserved);
  return parts.join(" ");
}

/** Résumé borné des permissions relevées dans le tour corrélé. */
function permissionsSummary(permissions: Omit<OpenTurnContext, "model">): string {
  return [
    permissions.approvalPolicy ? `approval=${permissions.approvalPolicy}` : undefined,
    permissions.sandbox ? `sandbox=${permissions.sandbox}` : undefined,
    permissions.network ? `network=${permissions.network}` : undefined
  ].filter((part) => part !== undefined).join(", ");
}

/**
 * Analyse stricte des arguments de `relay`, indépendante du parseur général : tout jeton qui
 * commence par `-` doit être une option longue de relay. Sont refusées et nommées : options
 * courtes (`-q`, `-a`, `-s`…), options inconnues ou propres à d'autres commandes, forme
 * `--option=valeur`, option répétée et option sans valeur. Rien n'est ignoré silencieusement.
 * `-h` et `--help` sont traités avant, par `runRelayCommand`.
 */
export function parseRelayTokens(
  tokens: readonly string[],
  messages: Messages
): { flags: Record<string, string | boolean>; positionals: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    const raw = token.startsWith("--") ? token.slice(2) : "";
    const name = RELAY_FLAG_ALIASES[raw] ?? raw;
    const isValueFlag = RELAY_VALUE_FLAGS.has(name);
    if (!isValueFlag && !RELAY_BOOLEAN_FLAGS.has(name)) {
      throw invalid("invalid-arguments", messages.relay.arguments.unknownFlag(token));
    }
    if (name in flags) throw invalid("invalid-arguments", messages.relay.arguments.repeatedFlag(token));
    if (!isValueFlag) {
      flags[name] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("-")) throw invalid("invalid-arguments", messages.relay.arguments.valueRequired(token));
    flags[name] = value;
    index += 1;
  }
  return { flags, positionals };
}

/** Message en argument positionnel ou par `--message-file`, jamais les deux. */
async function readRelayMessage(flags: Record<string, string | string[] | boolean>, positionals: string[], messages: Messages): Promise<string> {
  const file = optionalString(flags["message-file"]);
  if (positionals.length > 1) throw invalid("invalid-arguments", messages.relay.arguments.tooManyMessages);
  if (file && positionals.length === 1) throw invalid("invalid-arguments", messages.relay.arguments.messageConflict);
  let message: string;
  if (file) {
    try {
      // Lecture bornée : un fichier plus grand que la limite est refusé sans être chargé.
      if ((await stat(file)).size > MAX_RELAY_MESSAGE_BYTES) throw invalid("message-too-large");
      message = await readFile(file, "utf8");
    } catch (error) {
      if (error instanceof RelayRefusal) throw error;
      throw invalid("invalid-arguments", messages.relay.arguments.messageFileUnreadable(file));
    }
  } else if (positionals.length === 1) {
    message = positionals[0]!;
  } else {
    throw invalid("invalid-arguments", messages.relay.arguments.messageRequired);
  }
  const validated = validateRelayMessage(message);
  if (!validated.ok) {
    throw invalid(validated.reason, validated.reason === "invalid-arguments" ? messages.relay.arguments.messageRequired : undefined);
  }
  return validated.value;
}

function parseTimeout(value: string | string[] | boolean | undefined, messages: Messages): number {
  if (value === undefined) return DEFAULT_RELAY_TIMEOUT_SECONDS;
  const seconds = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(seconds) || seconds < MIN_RELAY_TIMEOUT_SECONDS || seconds > MAX_RELAY_TIMEOUT_SECONDS) {
    throw invalid("invalid-arguments", messages.relay.arguments.timeoutInvalid(MIN_RELAY_TIMEOUT_SECONDS, MAX_RELAY_TIMEOUT_SECONDS));
  }
  return seconds;
}

function errorMessage(outcome: RelayOutcome, messages: Messages, detail?: string): string {
  if (outcome.status === "invalid-request") return messages.relay.invalidRequest(outcome.reason ?? "invalid-arguments", detail);
  if (outcome.status === "replied") return "";
  const base = messages.relay.status(outcome.status);
  return outcome.status === "internal-error" && detail ? `${base} ${detail}` : base;
}

function buildResult(
  context: RelayContext,
  input: {
    outcome: RelayOutcome;
    delivery: DeliveryVerdict;
    reply?: string;
    identity?: SessionIdentity | null;
    observedModels?: string[];
    detail?: string;
    /** Message d'erreur déjà composé (mode `--open`), prioritaire sur le message de l'issue. */
    message?: string;
    open?: OpenRelayResult;
  }
): RelayResultV1 {
  const { outcome } = input;
  const openFields: Partial<RelayResultV1> = context.open
    ? {
      mode: "open",
      queue: input.open?.queue ?? { attempted: false },
      ...(input.open?.correlation ? { correlation: input.open.correlation } : {}),
      receiver: "unverified",
      targetPermissions: input.open?.targetPermissions ?? "unknown"
    }
    : {};
  return {
    v: 1,
    type: "relay-result",
    ...(context.task ? { task: context.task } : {}),
    ...(context.cli ? { cli: context.cli } : {}),
    ...(context.remedy ? { remedy: context.remedy } : {}),
    ...(outcome.status === "target-busy" ? { retryable: true } : {}),
    status: outcome.status,
    exitCode: outcome.exitCode,
    from: context.from ? { agent: context.from.agent, session: context.from.sessionId } : null,
    to: context.to ? { agent: context.to.agent, session: context.to.sessionId, provider: context.provider } : null,
    ...(outcome.status === "replied" && input.reply !== undefined ? { reply: input.reply } : {}),
    delivery: input.delivery,
    identity: input.identity ?? null,
    observedModels: input.observedModels ?? [],
    error: outcome.status === "replied"
      ? null
      : { kind: outcome.status, message: input.message ?? errorMessage(outcome, context.messages, input.detail), ...(outcome.reason ? { reason: outcome.reason } : {}) },
    exportPath: null,
    durationMs: Date.now() - context.startedAt,
    ...openFields
  };
}

function refusalResult(context: RelayContext, refusal: RelayRefusal): RelayResultV1 {
  const detail = refusal.message !== refusal.refusal.status ? refusal.message : undefined;
  return buildResult(context, { outcome: refusalOutcome(refusal.refusal), delivery: NOT_DELIVERED, detail });
}

/** Écrit l'export ; un échec d'écriture ne change pas l'issue du relay. */
async function exportRelay(
  outputDir: string,
  result: RelayResultV1,
  input: { nonce: string; message: string; startedAt: number },
  messages: Messages
): Promise<string | null> {
  if (!result.from || !result.to || !result.to.provider) return null;
  try {
    return await writeRelayMarkdown(outputDir, {
      from: result.from,
      to: { agent: result.to.agent, session: result.to.session, provider: result.to.provider },
      status: result.status,
      delivery: result.delivery,
      identity: result.identity,
      observedModels: result.observedModels,
      nonce: input.nonce,
      startedAt: new Date(input.startedAt).toISOString(),
      message: input.message,
      reply: result.reply,
      error: result.error?.message,
      ...(result.task ? { task: result.task } : {}),
      ...(result.cli ? { cli: result.cli } : {}),
      ...(result.mode === "open" && result.queue
        ? {
          open: {
            queue: [
              `attempted=${result.queue.attempted}`,
              ...(result.queue.accepted !== undefined ? [`accepted=${result.queue.accepted}`] : []),
              ...(result.queue.diagnostic ? [`diagnostic=${result.queue.diagnostic}`] : [])
            ].join(", "),
            correlation: result.correlation ? `${result.correlation.status} (${result.correlation.reason})` : null,
            receiver: result.receiver ?? "unverified",
            targetPermissions: result.targetPermissions && result.targetPermissions !== "unknown" ? permissionsSummary(result.targetPermissions) : null
          }
        }
        : {})
    }, messages);
  } catch {
    return null;
  }
}

/**
 * Sortie : `--json` écrit un seul objet sur stdout. En texte, la réponse va seule sur stdout ;
 * l'issue, la délivrance et l'export vont sur stderr. Tout texte affiché est assaini.
 */
function writeResult(result: RelayResultV1, json: boolean, messages: Messages): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const text = renderRelayText(result, messages);
  process.stdout.write(text.stdout);
  process.stderr.write(text.stderr);
}

/** Une interruption tardive n'efface jamais l'issue d'un POST déjà parti. */
export function applyReviewCancellation(result: RelayResultV1, interrupted: boolean, messages: Messages): void {
  if (!result.task || !interrupted) return;
  result.task.cancelled = true;
  if (result.task.publication !== "not-attempted") return;
  result.status = "cancelled";
  result.exitCode = RELAY_EXIT_CODES.cancelled;
  result.error = { kind: "cancelled", message: messages.relay.status("cancelled") };
}

/** Même réponse en texte qu'en JSON, y compris après une publication refusée ou interrompue. */
export function renderRelayText(result: RelayResultV1, messages: Messages): { stdout: string; stderr: string } {
  const lines: string[] = [];
  const stdout = result.reply !== undefined ? `${sanitizeTerminalText(result.reply)}\n` : "";
  if (result.status === "replied") {
    lines.push(messages.relay.replied(result.to?.agent ?? ""));
  } else {
    lines.push(`${messages.relay.failed(result.status)} ${result.error?.message ?? ""}`.trim());
    lines.push(messages.relay.delivery(result.delivery.status));
  }
  if (result.task) {
    lines.push(`${messages.relay.export.publication}: ${result.task.publication}`);
    if (result.task.reviewUrl) lines.push(`${messages.relay.export.reviewUrl}: ${result.task.reviewUrl}`);
  }
  if (result.mode === "open") {
    lines.push(messages.relay.open.unverifiedReceiver);
    if (result.targetPermissions && result.targetPermissions !== "unknown") lines.push(messages.relay.open.permissions(permissionsSummary(result.targetPermissions)));
  }
  if (result.exportPath) lines.push(messages.relay.exportWritten(result.exportPath));
  return { stdout, stderr: `${lines.map((line) => sanitizeTerminalText(line)).join("\n")}\n` };
}
