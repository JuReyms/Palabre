/**
 * @file Commande `palabre relay` : transmet un message à une conversation Codex ou Claude Code
 * fermée et rend une réponse, en un seul appel (voir AGENTS.md, section "Relay externe").
 *
 * Déroulé strictement ordonné ; une étape refusée arrête le relay sans rien lancer :
 * arguments, config approuvée (sans question interactive), agent et fournisseur, exécutable,
 * historique et dossier de la cible, attachement, puis échange (étape préalable et reprise),
 * issue, délivrance, export et sortie. Aucun retry : le statut de délivrance dit à l'appelant
 * s'il peut renvoyer sans risque de doublon.
 */
import { readFile, stat } from "node:fs/promises";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { externalSessionProviderForCommand, isRetiredAgentName } from "../agentRegistry.js";
import { configExists, loadConfig, resolveDefaultConfigPath, resolveOutputDir } from "../config.js";
import { isConfigTrusted, trustConfig } from "../configTrust.js";
import { exchange, exchangeOutcome, type ExchangeResult, type ExternalSessionAdapter } from "../externalSessions/adapter.js";
import { ClaudeSessionAdapter } from "../externalSessions/claude.js";
import { CodexSessionAdapter } from "../externalSessions/codex.js";
import { buildEnvelope, createNonce, MAX_RELAY_MESSAGE_BYTES, parseSessionRef, validateRelayMessage } from "../externalSessions/envelope.js";
import { assessTarget, classifyDelivery, RELAY_EXIT_CODES, refusalOutcome, type PreLaunchRefusal } from "../externalSessions/outcome.js";
import { resolveExternalExecutable } from "../externalSessions/resolve.js";
import type {
  DeliveryVerdict,
  ExternalProvider,
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

/** Timeout par défaut et bornes de `--timeout`, en secondes. */
export const DEFAULT_RELAY_TIMEOUT_SECONDS = 600;
export const MIN_RELAY_TIMEOUT_SECONDS = 10;
export const MAX_RELAY_TIMEOUT_SECONDS = 3600;

/** Options de `palabre relay` qui attendent une valeur. */
const RELAY_VALUE_FLAGS = new Set(["from", "to", "message-file", "timeout", "config", "language"]);
/** Options de `palabre relay` sans valeur. */
const RELAY_BOOLEAN_FLAGS = new Set(["json", "no-export", "trust-config", "help"]);
/** Alias acceptés, comme pour les autres commandes. */
const RELAY_FLAG_ALIASES: Record<string, string> = { lang: "language" };

/**
 * Sortie `--json` v1 : un seul objet, quelle que soit l'issue. Politique de version du renderer
 * NDJSON : un ajout optionnel ne change pas `v`.
 */
export interface RelayResultV1 {
  v: 1;
  type: "relay-result";
  status: RelayStatus;
  exitCode: number;
  from: { agent: string; session: string } | null;
  to: { agent: string; session: string; provider: ExternalProvider | null } | null;
  /** Présent seulement pour `replied`. */
  reply?: string;
  delivery: DeliveryVerdict;
  identity: SessionIdentity | null;
  observedModels: string[];
  error: { kind: RelayStatus; message: string; reason?: InvalidRequestReason } | null;
  exportPath: string | null;
  durationMs: number;
}

/** État partagé avec le gestionnaire d'erreur interne, pour qualifier la délivrance. */
interface RelayContext {
  startedAt: number;
  messages: Messages;
  from: SessionRef | null;
  to: SessionRef | null;
  provider: ExternalProvider | null;
  /** Vrai dès que l'échange a commencé : une erreur interne rend alors la délivrance inconnue. */
  exchangeStarted: boolean;
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
  const context: RelayContext = {
    startedAt: Date.now(),
    messages: startupMessages(rawArgs),
    from: null,
    to: null,
    provider: null,
    exchangeStarted: false
  };
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(context.messages.help.renderCommand("relay"));
    return;
  }
  const json = rawArgs.includes("--json");
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
  writeResult(result, json, context.messages);
  process.exitCode = result.exitCode;
}

async function relay(rawArgs: string[], context: RelayContext): Promise<RelayResultV1> {
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

  const message = await readRelayMessage(flags, positionals, messages);
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
  try {
    config = await loadConfig(configPath);
  } catch {
    throw invalid("config-unavailable");
  }
  try {
    context.messages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language), configLanguage: config.language }));
  } catch {
    // Langue de config invalide : la langue de démarrage reste utilisée.
  }

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

  // Claude : cadre opérateur fixe (D22) dans la langue du relay, sans aucun contenu du message.
  const adapter: ExternalSessionAdapter = provider === "claude"
    ? new ClaudeSessionAdapter({ operatorFrame: context.messages.relay.operatorFrame })
    : new CodexSessionAdapter();
  const located = adapter.locate(to.value);
  if (located.status !== "found") {
    throw located.status === "session-not-found"
      ? new RelayRefusal({ status: "session-not-found" })
      : invalid("invalid-working-directory");
  }
  const decision = assessTarget(adapter.probe(located.target));
  if (!decision.allowed) throw new RelayRefusal({ status: decision.status });

  const nonce = createNonce();
  const envelope = buildEnvelope({ from: from.value, nonce, message }, context.messages.relay);
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.once("SIGINT", onInterrupt);
  context.exchangeStarted = true;
  let exchanged: ExchangeResult;
  try {
    exchanged = await exchange(adapter, resolution.executable, located.target, envelope, {
      timeoutMs: timeoutSeconds * 1000,
      signal: controller.signal
    });
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }

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
  if (flags["no-export"] !== true) {
    result.exportPath = await exportRelay(resolveOutputDir(config.outputDir), result, { nonce, message, startedAt: context.startedAt }, context.messages);
  }
  return result;
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
  }
): RelayResultV1 {
  const { outcome } = input;
  return {
    v: 1,
    type: "relay-result",
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
      : { kind: outcome.status, message: errorMessage(outcome, context.messages, input.detail), ...(outcome.reason ? { reason: outcome.reason } : {}) },
    exportPath: null,
    durationMs: Date.now() - context.startedAt
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
      error: result.error?.message
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
  const lines: string[] = [];
  if (result.status === "replied") {
    process.stdout.write(`${sanitizeTerminalText(result.reply ?? "")}\n`);
    lines.push(messages.relay.replied(result.to?.agent ?? ""));
  } else {
    lines.push(`${messages.relay.failed(result.status)} ${result.error?.message ?? ""}`.trim());
    lines.push(messages.relay.delivery(result.delivery.status));
  }
  if (result.exportPath) lines.push(messages.relay.exportWritten(result.exportPath));
  process.stderr.write(`${lines.map((line) => sanitizeTerminalText(line)).join("\n")}\n`);
}
