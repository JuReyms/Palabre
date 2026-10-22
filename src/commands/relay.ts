/**
 * @file Commande `palabre relay` : transmet un message à une conversation Codex ou Claude Code
 * neuve, fermée ou ouverte selon relay.view et le verrou (#190), en un seul appel.
 *
 * Déroulé strictement ordonné ; une étape refusée arrête le relay sans rien lancer :
 * arguments, config approuvée (sans question interactive), agent et fournisseur, exécutable,
 * historique et dossier de la cible, attachement, puis échange (étape préalable et reprise),
 * issue, délivrance, export et sortie. Aucun retry : le statut de délivrance dit à l'appelant
 * s'il peut renvoyer sans risque de doublon. `--new` omet localisation et sonde d'une ancienne
 * cible ; l'identifiant reçu pendant le flux est conservé même après un tour en échec.
 *
 * `--open` (B1, Codex seulement) inverse la condition d'attachement : la conversation doit être
 * ouverte (verrou tenu). Après la même résolution de config, d'agent et d'exécutable (D21), la
 * localisation est bornée et le dépôt passe par `codex queue` (`runOpenRelay`). La cible garde ses
 * outils et permissions ; les champs JSON propres au mode ouvert apparaissent aussi avec auto.
 *
 * `--open --follow` (#195) ne dépose rien : sans message ni processus Codex (seule la sonde de
 * verrou, `python3` sous macOS/Linux, est lancée comme pour `--open`), il attend le premier
 * tour terminé après l'appel dans la conversation ouverte et rend sa réponse en `followed`, avec un
 * auteur non vérifié. Il sert à reprendre la suite d'un tour lancé depuis l'app (confirmation, etc.).
 *
 * `--check` (#203) fait les mêmes contrôles qu'un envoi jusqu'à l'état de la conversation, puis
 * s'arrête : ni enveloppe, ni processus de la CLI cible, ni export. Issue `checked` ou refus identique.
 */
import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { externalSessionProviderForCommand, isRetiredAgentName } from "../agentRegistry.js";
import { configExists, loadConfig, resolveDefaultConfigPath, resolveOutputDir } from "../config.js";
import { isConfigTrusted, trustConfig } from "../configTrust.js";
import { exchange, exchangeOutcome, type ExchangeResult, type ExternalExecutable, type ExternalSessionAdapter } from "../externalSessions/adapter.js";
import { ClaudeSessionAdapter } from "../externalSessions/claude.js";
import { CodexSessionAdapter, codexDesktopThreadLink } from "../externalSessions/codex.js";
import { buildEnvelope, buildOpenEnvelope, createNonce, MAX_RELAY_MESSAGE_BYTES, parseAgentName, parseSenderRef, parseSessionRef, validMissionHeader, validateRelayMessage, validateRelaySubject, type MissionEnvelopeHeader } from "../externalSessions/envelope.js";
import type { OpenTurnContext } from "../externalSessions/openReader.js";
import { defaultOpenRelayDeps, runFollowRelay, runOpenRelay, type FollowRelayResult, type OpenQueueReport, type OpenRelayResult } from "../externalSessions/openRelay.js";
import { locateOpenRollout, readLastTurnContext } from "../externalSessions/openRollout.js";
import { assessTarget, classifyDelivery, RELAY_EXIT_CODES, refusalOutcome, type PreLaunchRefusal } from "../externalSessions/outcome.js";
import { resolveExternalExecutable } from "../externalSessions/resolve.js";
import { isUsableDirectory } from "../externalSessions/process.js";
import { checkClaudeReviewCli, MIN_CLAUDE_REVIEW_VERSION, type ReviewCliIdentity } from "../externalSessions/reviewCli.js";
import { parsePullRequest, reviewAllowed, readPullRequest, reviewPrompt, publishReview, type ReviewReport, type ReviewInput } from "../externalSessions/review.js";
import type {
  DeliveryVerdict,
  ExternalProvider,
  ExternalTarget,
  InvalidRequestReason,
  ReadAccessDiagnostic,
  RelayOutcome,
  RelayStatus,
  SessionIdentity,
  SenderRef,
  SessionRef
} from "../externalSessions/types.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import type { Messages } from "../messages/index.js";
import { writeRelayMarkdown } from "../output.js";
import { optionalString } from "./shared.js";
import { runRelayAllowRepo, reviewAuthorizationCommand } from "./relayAllowRepo.js";
import { createInterface } from "node:readline/promises";
import { prepareWrite, readWriteRequest, approveWrite, consumeWrite, createWriteWorktree, WriteCodexAdapter, writeReport, writeHash, WriteError, type WriteRequest, type WriteReport } from "../externalSessions/write.js";
import { relayWriteText } from "../messages/relayWrite.js";
import { resolveRelayView, type RelayModeSource } from "../externalSessions/relayView.js";
import { relayViewText } from "../messages/relayView.js";
import { relayViewCommand } from "./relayView.js";

/** Timeout par défaut et bornes de `--timeout`, en secondes. */
export const DEFAULT_RELAY_TIMEOUT_SECONDS = 600;
export const MIN_RELAY_TIMEOUT_SECONDS = 10;
export const MAX_RELAY_TIMEOUT_SECONDS = 3600;

/** Options de `palabre relay` qui attendent une valeur. */
const RELAY_VALUE_FLAGS = new Set(["from", "to", "message-file", "timeout", "config", "language", "task", "pr", "subject", "dir"]);
/** Options de `palabre relay` sans valeur. */
const RELAY_BOOLEAN_FLAGS = new Set(["json", "no-export", "trust-config", "help", "open", "background", "new", "write", "follow", "check"]);
/** Alias acceptés, comme pour les autres commandes. */
const RELAY_FLAG_ALIASES: Record<string, string> = { lang: "language" };

/** Mode d'un échange Relay, tel qu'annoncé à l'utilisateur (#190). */
export type RelayMode = "background" | "open" | "follow";

/**
 * Rapport de `--check` (#203), présent sur tout résultat de vérification, réussi ou refusé.
 * `target` n'est connu qu'une fois la conversation retrouvée et sondée. En mode ouvert,
 * `lastPermissions` vient du dernier `turn_context` lisible à la fin de l'historique : c'est
 * une indication, pas une garantie pour le tour suivant.
 */
export interface RelayCheckReport {
  target?: "open" | "closed";
  lastPermissions?: Omit<OpenTurnContext, "model"> | "unknown";
  /** Horodatage ISO du relevé, quand l'historique le fournit. */
  lastPermissionsAt?: string;
}

/**
 * Sortie `--json` v1 : un seul objet, quelle que soit l'issue. Politique de version du renderer
 * NDJSON : un ajout optionnel ne change pas `v`.
 */
export interface RelayResultV1 {
  /** Demande à confirmer, sans aucun appel modèle ; puis rapport d'actions observées. */
  writeRequest?: string;
  write?: WriteReport;
  /** Reprise CLI facultative : secondes, ISO ou HH:mm sans date/fuseau. Aucun renvoi programmé. */
  retryAfter?: number | string;
  /** Échec d'accès observé, sans déduction depuis la prose du modèle. */
  readAccess?: ReadAccessDiagnostic;
  /** Objet explicite inchangé ; absent si --subject n'est pas fourni. */
  subject?: string;
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
  from: { agent: string; session?: string } | null;
  /** `session` reste null tant qu'aucun identifiant de création n'a été reçu. */
  to: { agent: string; session: string | null; provider: ExternalProvider | null } | null;
  /** Présents seulement avec --new ; le dossier est résolu avant toute création. */
  created?: boolean;
  cwd?: string;
  /** Réponse de l'agent ; conservée aussi si la publication d'une revue échoue ensuite. */
  reply?: string;
  delivery: DeliveryVerdict;
  identity: SessionIdentity | null;
  observedModels: string[];
  error: { kind: RelayStatus; message: string; reason?: InvalidRequestReason } | null;
  exportPath: string | null;
  durationMs: number;
  /**
   * Mode de l'échange, émis à chaque résultat (#190). Ajout facultatif du contrat v1 : les
   * consommateurs tolèrent son absence (versions antérieures) ; ce type producteur le garantit. `background` (conversation fermée ou
   * créée, sans fenêtre visible), `open` (conversation ouverte dans l'app) ou `follow` (#195).
   */
  mode: RelayMode;
  /** Origine du choix ; absent si la validation s'arrête avant toute résolution. */
  modeSource?: RelayModeSource;
  /** Présent seulement avec `--check` (#203) : rien n'a été envoyé ni lancé. */
  check?: RelayCheckReport;
  /**
   * Champs propres au mode ouvert (B1), explicite ou automatique : `status` peut
   * alors valoir `target-not-open`. Avec `--open --follow` (#195) : sans `queue`, et `status` peut
   * valoir `followed`.
   */
  queue?: OpenQueueReport;
  correlation?: { status: string; reason: string };
  receiver?: "unverified";
  targetPermissions?: Omit<OpenTurnContext, "model"> | "unknown";
}

/** État partagé avec le gestionnaire d'erreur interne, pour qualifier la délivrance. */
interface RelayContext {
  language?: "fr" | "en";
  approvedWrite?: WriteRequest;
  writeRequest?: string;
  write?: WriteReport;
  subject?: string;
  header?: MissionEnvelopeHeader;
  /** Annulation du chef de mission ; ne confère aucun droit supplémentaire. */
  signal?: AbortSignal;
  remedy?: string;
  cli?: ReviewCliIdentity;
  task?: ReviewReport;
  startedAt: number;
  messages: Messages;
  from: SenderRef | null;
  to: SessionRef | null;
  provider: ExternalProvider | null;
  /** Vrai dès que l'échange a commencé : une erreur interne rend alors la délivrance inconnue. */
  exchangeStarted: boolean;
  /** `--open` (B1) : dépôt dans une conversation Codex ouverte. */
  open: boolean;
  modeSource?: RelayModeSource;
  /** `--open --follow` (#195) : suivi du tour suivant, sans dépôt. */
  follow?: boolean;
  /** `--check` (#203) : contrôles d'avant envoi seulement, et leur rapport. */
  check?: boolean;
  checkReport?: RelayCheckReport;
  newSession?: boolean;
  cwd?: string;
  /**
   * Vrai dès que l'historique de la conversation reprise a été trouvé : seule preuve qu'elle existe,
   * donc que son lien Desktop a un sens (#190). Jamais déduit du statut final.
   */
  targetLocated?: boolean;
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
  if (rawArgs[1] === "approve-write" || rawArgs[1] === "run-write") {
    await manageWrite(rawArgs);
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
  const { result, messages: resolvedMessages, targetLocated } = await executeRelayWithMessages(rawArgs);
  writeResult(result, rawArgs.includes("--json"), resolvedMessages, targetLocated);
  process.exitCode = result.exitCode;
}

/** Même échange que la commande, sans sortie console ni exitCode global ; utilisé par Mission. */
export async function executeRelay(rawArgs: string[], options: { signal?: AbortSignal; header?: MissionEnvelopeHeader } = {}): Promise<RelayResultV1> {
  return (await executeRelayWithMessages(rawArgs, options)).result;
}

/** Préserve la langue résolue dans la config pour le rendu de la commande historique. */
async function executeRelayWithMessages(rawArgs: string[], options: { signal?: AbortSignal; header?: MissionEnvelopeHeader; approvedWrite?: WriteRequest } = {}): Promise<{ result: RelayResultV1; messages: Messages; targetLocated: boolean }> {
  const context: RelayContext = {
    signal: options.signal,
    startedAt: Date.now(),
    messages: startupMessages(rawArgs),
    from: null,
    to: null,
    provider: null,
    exchangeStarted: false,
    open: rawArgs.includes("--open"),
    // Connu dès les arguments bruts : tout résultat de --check porte son rapport, refus précoce compris.
    check: rawArgs.includes("--check")
  };
  context.approvedWrite = options.approvedWrite;
  let result: RelayResultV1;
  try {
    if (options.header !== undefined) {
      if (!validMissionHeader(options.header)) throw invalid("invalid-arguments");
      context.header = { ...options.header };
    }
    result = await relay(rawArgs, context);
  } catch (error) {
    const refusal = error instanceof WriteError ? invalid("write-approval-invalid", relayWriteText(context.language ?? "fr").failure(error.message)) : error;
    result = refusal instanceof RelayRefusal
      ? refusalResult(context, refusal)
      : buildResult(context, {
        outcome: { status: "internal-error", exitCode: RELAY_EXIT_CODES["internal-error"] },
        delivery: context.exchangeStarted ? { status: "unknown", persisted: "unknown", inActiveBranch: "unknown" } : NOT_DELIVERED,
        detail: error instanceof Error ? error.message : String(error)
      });
  }
  return { result, messages: context.messages, targetLocated: context.targetLocated === true };
}

async function relay(rawArgs: string[], context: RelayContext): Promise<RelayResultV1> {
  if (context.signal?.aborted) throw new RelayRefusal({ status: "cancelled" });
  const { messages } = context;
  const { flags, positionals } = parseRelayTokens(rawArgs.slice(1), messages);
  context.modeSource = flags.open || flags.background ? "explicit" : undefined;
  if (flags.open && flags.background) throw invalid("invalid-arguments", messages.relayView.conflict);
  if (context.header && context.open) throw invalid("invalid-arguments", messages.relayView.missionBackground);
  context.check = flags.check === true;
  // La vérification n'envoie rien et n'écrit rien : une option d'envoi, de suivi ou d'approbation
  // (`--trust-config` réécrirait le registre de confiance) la rendrait trompeuse.
  if (context.check && (positionals.length > 0 || flags["message-file"] !== undefined || flags.subject !== undefined || flags.from !== undefined
    || flags.new || flags.dir !== undefined || flags.task !== undefined || flags.pr !== undefined || flags.write || flags.follow
    || flags.timeout !== undefined || flags["no-export"] || flags["trust-config"] || context.header)) {
    throw invalid("invalid-arguments", messages.relay.check.conflict);
  }
  context.follow = flags.follow === true;
  // Le suivi ne transporte rien : toute option d'envoi le rendrait trompeur.
  if (context.follow && (!context.open || positionals.length > 0 || flags["message-file"] !== undefined || flags.subject !== undefined
    || flags.from !== undefined || flags.new || flags.dir !== undefined || flags.task !== undefined || flags.pr !== undefined || flags.write || context.header)) {
    throw invalid("invalid-arguments", messages.relay.open.followConflict);
  }
  if (flags.write && (!flags.new || context.open || flags.task || flags.pr || flags["trust-config"] || context.header)) {
    throw invalid("invalid-arguments", relayWriteText(resolveLanguage({ explicitLanguage: optionalString(flags.language) })).conflict);
  }
  if (flags.subject !== undefined) {
    const subject = validateRelaySubject(String(flags.subject));
    if (!subject.ok) throw invalid(subject.reason, messages.relay.arguments.subjectInvalid);
    context.subject = subject.value;
  }
  try {
    resolveLanguage({ explicitLanguage: optionalString(flags.language) });
  } catch (error) {
    throw invalid("invalid-arguments", error instanceof Error ? error.message : undefined);
  }

  const toValue = optionalString(flags.to);
  if (!toValue) throw invalid("invalid-arguments", messages.relay.arguments.toRequired);
  const fromValue = optionalString(flags.from);
  if (flags.from !== undefined && !fromValue) throw invalid("invalid-arguments", messages.relay.arguments.emptySender);
  if (flags.dir !== undefined && !optionalString(flags.dir)) throw invalid("invalid-arguments", messages.relay.arguments.emptyDirectory);
  context.newSession = flags.new === true;
  if ((context.newSession && context.open) || (flags.dir !== undefined && !context.newSession)) {
    throw invalid("invalid-arguments", messages.relay.arguments.newConflict);
  }
  // Une création n'a pas encore d'UUID ; ce nom seul ne sert jamais à chercher un historique.
  const to = context.newSession ? parseNewTarget(toValue, messages) : parseSessionRef(toValue);
  if (!to.ok) throw invalid(to.reason);
  context.to = to.value;
  if (fromValue !== undefined) {
    const from = parseSenderRef(fromValue);
    if (!from.ok) throw invalid(from.reason);
    context.from = from.value;
  }
  if (context.newSession) {
    const cwd = path.resolve(optionalString(flags.dir) ?? process.cwd());
    if (!isUsableDirectory(cwd)) throw invalid("invalid-working-directory");
    context.cwd = cwd;
  }

  if (flags.task !== undefined && flags.task !== "review") throw invalid("task-not-allowed");
  const pr = typeof flags.pr === "string" ? parsePullRequest(flags.pr) : undefined;
  if ((flags.task === "review" && (!pr || context.open || flags["trust-config"])) || (flags.pr && !flags.task)) throw invalid("invalid-pr");
  const defaultReviewMessage = flags.task === "review" && positionals.length === 0 && !flags["message-file"];
  let message = defaultReviewMessage || context.follow || context.check ? "" : await readRelayMessage(flags, positionals, messages);
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
    context.language = resolveLanguage({ explicitLanguage: optionalString(flags.language), configLanguage: config.language });
    context.messages = createTranslator(context.language);
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
  const nonce = createNonce();
  const envelopeInput = { from: context.from, to: to.value, nonce, message, subject: context.subject, header: context.header };
  const frame = flags.write ? {
    ...context.messages.relay, envelopePermissions: relayWriteText(context.language ?? "fr").envelopePermissions
  } : context.messages.relay;

  // Agent cible, fournisseur et exécutable, sans réutiliser les réglages de débat.
  const agent = config.agents[to.value.agent];
  if (!agent || isRetiredAgentName(to.value.agent)) throw invalid("unknown-agent");
  if (agent.type !== "cli") throw invalid("unsupported-agent");
  const provider = externalSessionProviderForCommand(agent.command);
  if (!provider) throw invalid("unsupported-agent");
  context.provider = provider;
  // Le suivi ne lance aucun processus Codex : l'exécutable de la cible n'est pas résolu. Seule la
  // sonde de verrou partagée avec `--open` peut lancer `python3` sous macOS/Linux.
  if (context.follow) {
    if (provider !== "codex") throw invalid("unsupported-agent", context.messages.relay.open.unsupportedProvider);
    return relayFollow(context, {
      to: to.value,
      timeoutMs: timeoutSeconds * 1000,
      outputDir: resolveOutputDir(config.outputDir),
      exportResult: flags["no-export"] !== true
    });
  }
  if (flags.write && (provider !== "codex" || process.platform !== "win32")) throw invalid("write-unavailable", relayWriteText(context.language ?? "fr").unavailable);
  const resolution = resolveExternalExecutable(agent.command);
  if (resolution.status === "command-not-found") throw new RelayRefusal({ status: "command-not-found" });
  if (resolution.status === "unsupported-executable") throw invalid("unsupported-executable");

  // Choisir avant l'enveloppe. Les parcours exclus ne sondent pas pour ouvrir une cible ;
  // les transports conservent ensuite leurs propres contrôles, sans repli après refus.
  const excluded = Boolean(context.newSession || context.header || flags.task || flags.write);
  let probe: () => import("../externalSessions/types.js").TargetProbe = () => { throw new Error("unexpected-mode-probe"); };
  if (!context.open && !flags.background && !excluded && provider === "codex" && config.relay?.view !== "background") {
    const located = await locateOpenRollout(path.join(os.homedir(), ".codex"), to.value.sessionId);
    if (located.status !== "found") throw located.status === "session-not-found"
      ? new RelayRefusal({ status: "session-not-found" }) : invalid("invalid-working-directory");
    context.targetLocated = true;
    const adapter = new CodexSessionAdapter();
    probe = () => adapter.probe({ ...to.value, provider: "codex", cwd: located.cwd });
  }
  const mode = resolveRelayView({ open: context.open, background: flags.background === true, excluded, provider, view: config.relay?.view }, probe);
  context.modeSource = mode.modeSource;
  context.open = mode.mode === "open";
  if (mode.refusal) throw new RelayRefusal({ status: mode.refusal });
  if (context.check) return relayCheck(context, { to: to.value, provider, configPath, explicitBackground: flags.background === true });
  const coordination = context.open ? buildOpenEnvelope(envelopeInput, frame) : buildEnvelope(envelopeInput, frame);
  const envelopeCheck = validateRelayMessage(coordination);
  if (!envelopeCheck.ok) throw invalid(envelopeCheck.reason);

  if (flags.write) {
    const text = relayWriteText(context.language ?? "fr");
    const configFile = await realpath(configPath);
    context.cwd = await realpath(context.cwd!);
    const configHash = writeHash(await readFile(configFile));
    if (!context.approvedWrite) {
      const args = ["relay", "--new", "--write", "--to", to.value.agent, "--dir", context.cwd!, "--config", configFile, "--timeout", String(timeoutSeconds), "--language", context.language ?? "fr",
        ...(fromValue ? ["--from", fromValue] : []), ...(context.subject ? ["--subject", context.subject] : []), ...(flags["no-export"] ? ["--no-export"] : []), message];
      const r = await prepareWrite({ args, agent: to.value.agent, message, config: configFile, configHash, cwd: context.cwd!, language: context.language ?? "fr" });
      context.writeRequest = r.id; context.remedy = `palabre relay approve-write ${r.id}`;
      throw invalid("write-approval-required", text.required(r.id));
    }
    const r = context.approvedWrite;
    if (r.agent !== to.value.agent || r.message !== message || r.repository !== context.cwd || r.config !== configFile || r.configHash !== configHash || JSON.stringify(r.args) !== JSON.stringify(rawArgs)) throw new WriteError("request-changed");
    await consumeWrite(r);
    context.write = { language: r.language, request: r.id, repository: r.repository, commit: r.commit, branch: r.branch, worktree: r.worktree, files: [], diff: "", commands: [], verification: "observed-commands-only", diagnostic: "execution-not-completed" };
    await createWriteWorktree(r);
    context.cwd = r.worktree;
  }

  if (context.open) {
    if (provider !== "codex") throw invalid("unsupported-agent", context.messages.relay.open.unsupportedProvider);
    return relayOpen(context, {
      to: to.value,
      message,
      envelope: coordination,
      nonce,
      timeoutMs: timeoutSeconds * 1000,
      executable: resolution.executable,
      outputDir: resolveOutputDir(config.outputDir),
      exportResult: flags["no-export"] !== true
    });
  }

  // Claude : cadre opérateur fixe (D22) dans la langue du relay, sans aucun contenu du message.
  const adapter: ExternalSessionAdapter = provider === "claude"
    ? new ClaudeSessionAdapter({ operatorFrame: context.messages.relay.operatorFrame, safeMode: flags.task === "review" })
    : context.approvedWrite ? new WriteCodexAdapter(context.approvedWrite) : new CodexSessionAdapter();
  const target: ExternalTarget = context.newSession
    ? { ...to.value, provider, cwd: context.cwd! }
    : assessClosedTarget(context, adapter, to.value, configPath, flags.background === true && !excluded);

  if (pr && provider === "claude") {
    const checked = await checkClaudeReviewCli(resolution.executable, target.cwd);
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

  // Le contexte PR (256 Kio) garde sa borne distincte des 64 Kio de coordination vérifiés plus haut.
  const envelope = review ? buildEnvelope({ ...envelopeInput, message }, context.messages.relay) : coordination;
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  context.signal?.addEventListener("abort", onInterrupt, { once: true });
  if (context.signal?.aborted) controller.abort();
  process.once("SIGINT", onInterrupt);
  context.exchangeStarted = true;
  try {
    const exchanged = await exchange(adapter, resolution.executable, target, envelope, {
      timeoutMs: timeoutSeconds * 1000,
      signal: controller.signal,
      ...(context.newSession ? { onCreatedSession: (id: string) => { context.to = { agent: to.value.agent, sessionId: id }; } } : {})
    });
    const { outcome, launched } = exchangeOutcome(exchanged);
    const evidence = launched && target.sessionId ? adapter.findNonce(target, nonce) : undefined;
    const delivery = classifyDelivery({ outcome, launched, evidence });
    const reply = outcome.status === "replied" ? exchanged.verdict?.interpretation.reply : undefined;
    const result = buildResult(context, {
      outcome,
      delivery,
      reply,
      identity: exchanged.verdict?.interpretation.identity ?? null,
      observedModels: exchanged.verdict?.interpretation.observedModels ?? []
    });
    if (context.approvedWrite) {
      result.write = await writeReport(context.approvedWrite, exchanged.process?.stdout ?? "");
      context.write = result.write;
      if (exchanged.process?.forcedReturn) result.write.diagnostic = "process-termination-unconfirmed";
      if (exchanged.refusal?.status === "invalid-request" && exchanged.refusal.reason === "write-unavailable") {
        result.write.diagnostic = "sandbox-unavailable";
        if (result.error) result.error.message = relayWriteText(context.language ?? "fr").unavailable;
      }
    }
    applyReadAccessDiagnostic(result, exchanged.verdict?.interpretation.readAccess, context.messages);
    if (review && reply !== undefined && outcome.status === "replied") {
      try {
        const reviewUrl = await publishReview(review, reply, to.value.agent, [context.from?.sessionId, target.sessionId, nonce].filter((id): id is string => !!id), undefined, async () => {
          if (!(await isConfigTrusted(configPath))
            || createHash("sha256").update(await readFile(configPath)).digest("hex") !== configFingerprint) throw new Error("review-authorization-changed");
          if (controller.signal.aborted) throw new Error("review-cancelled");
          context.task!.publication = "unknown";
        }, result.readAccess);
        context.task!.publication = "published";
        context.task!.reviewUrl = reviewUrl;
      } catch (error) {
        const known = ["read-unavailable", "pull-request-changed", "review-authorization-changed", "invalid-review-body", "review-cancelled"];
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
      result.exportPath = await exportRelay(resolveOutputDir(config.outputDir), result, { nonce, message, startedAt: context.startedAt }, context.messages, context.targetLocated === true);
    }
    return result;
  } finally {
    context.signal?.removeEventListener("abort", onInterrupt);
    process.removeListener("SIGINT", onInterrupt);
  }
}

/**
 * Arrière-plan : localise la conversation reprise, puis refuse une cible attachée ou invérifiable.
 * Sur une Codex attachée, le conseil dépend de la cause : préférence `background` (commande de
 * réglage) ou `--background` explicite (fermer la conversation) ; sinon, message d'origine.
 * Partagé par l'envoi et par `--check` (#203), qui doivent rendre les mêmes refus.
 */
function assessClosedTarget(context: RelayContext, adapter: ExternalSessionAdapter, to: SessionRef, configPath: string, explicitBackground: boolean): ExternalTarget {
  const located = adapter.locate(to);
  if (located.status !== "found") {
    throw located.status === "session-not-found"
      ? new RelayRefusal({ status: "session-not-found" })
      : invalid("invalid-working-directory");
  }
  context.targetLocated = true;
  const decision = assessTarget(adapter.probe(located.target));
  if (!decision.allowed) {
    if (context.provider === "codex" && decision.status === "target-busy" && context.modeSource === "setting") {
      context.remedy = relayViewCommand(configPath);
      throw new RelayRefusal({ status: decision.status }, relayViewText(context.language ?? "fr").busy(context.remedy));
    }
    if (context.provider === "codex" && decision.status === "target-busy" && explicitBackground) {
      throw new RelayRefusal({ status: decision.status }, context.messages.relayView.busyExplicit);
    }
    throw new RelayRefusal({ status: decision.status });
  }
  return located.target;
}

/**
 * `--check` (#203) : mêmes contrôles qu'un envoi jusqu'à l'état de la conversation, puis arrêt.
 * `check.target` est renseigné dès que l'état est connu, y compris avant `target-busy` (ouverte)
 * ou `target-not-open` (fermée) ; il reste absent pour un état invérifiable.
 * Ni enveloppe, ni processus de la CLI cible, ni export ; sous macOS/Linux, la sonde de verrou
 * Codex lance `python3`, comme pour un envoi. Un refus garde le statut qu'aurait l'envoi. En mode
 * ouvert, les permissions du dernier tour connu sont relevées, à titre indicatif. La liste MCP de
 * Codex (arrière-plan) n'est pas lancée : un échec `neutralization-failed` reste possible à l'envoi.
 */
async function relayCheck(
  context: RelayContext,
  input: { to: SessionRef; provider: ExternalProvider; configPath: string; explicitBackground: boolean }
): Promise<RelayResultV1> {
  if (context.open) {
    if (input.provider !== "codex") throw invalid("unsupported-agent", context.messages.relay.open.unsupportedProvider);
    const home = path.join(os.homedir(), ".codex");
    const located = await locateOpenRollout(home, input.to.sessionId);
    if (located.status !== "found") {
      throw located.status === "session-not-found" ? new RelayRefusal({ status: "session-not-found" }) : invalid("invalid-working-directory");
    }
    context.targetLocated = true;
    const attachment = new CodexSessionAdapter({ home }).probe({ ...input.to, provider: "codex", cwd: located.cwd }).attachment;
    if (attachment === "unknown") throw new RelayRefusal({ status: "target-state-unknown" });
    if (attachment !== "attached") {
      context.checkReport = { target: "closed" };
      throw new RelayRefusal({ status: "target-not-open" });
    }
    const last = await readLastTurnContext(located.historyPath);
    const { model: _model, ...permissions } = last?.context ?? {};
    const known = Object.keys(permissions).length > 0;
    context.checkReport = {
      target: "open",
      lastPermissions: known ? permissions : "unknown",
      ...(known && last?.observedAt ? { lastPermissionsAt: last.observedAt } : {})
    };
  } else {
    const adapter: ExternalSessionAdapter = input.provider === "claude"
      ? new ClaudeSessionAdapter({ operatorFrame: context.messages.relay.operatorFrame, safeMode: false })
      : new CodexSessionAdapter();
    try {
      assessClosedTarget(context, adapter, input.to, input.configPath, input.explicitBackground);
    } catch (error) {
      // Une cible attachée est ouverte : l'état est connu, même si l'envoi serait refusé.
      if (error instanceof RelayRefusal && error.refusal.status === "target-busy") context.checkReport = { target: "open" };
      throw error;
    }
    context.checkReport = { target: "closed" };
  }
  return buildResult(context, { outcome: { status: "checked", exitCode: RELAY_EXIT_CODES.checked }, delivery: NOT_DELIVERED });
}

/**
 * `--open` (B1) : dépôt dans une conversation Codex ouverte, puis réponse corrélée. Localisation
 * bornée (première ligne du rollout seulement) ; Ctrl+C est géré avant la référence, le dépôt et
 * l'attente, qui partagent une seule échéance (`runOpenRelay`). Aucun renvoi automatique.
 */
async function relayOpen(
  context: RelayContext,
  input: { to: SessionRef; message: string; envelope: string; nonce: string; timeoutMs: number; executable: ExternalExecutable; outputDir: string; exportResult: boolean }
): Promise<RelayResultV1> {
  const home = path.join(os.homedir(), ".codex");
  const located = await locateOpenRollout(home, input.to.sessionId);
  if (located.status !== "found") {
    throw located.status === "session-not-found" ? new RelayRefusal({ status: "session-not-found" }) : invalid("invalid-working-directory");
  }
  const adapter = new CodexSessionAdapter({ home });
  const target: ExternalTarget = { agent: input.to.agent, provider: "codex", sessionId: input.to.sessionId, cwd: located.cwd };
  const { nonce, envelope } = input;
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
    result.exportPath = await exportRelay(input.outputDir, result, { nonce, message: input.message, startedAt: context.startedAt }, context.messages, false);
  }
  return result;
}

/**
 * `--open --follow` (#195) : suivi du premier tour terminé après l'appel, sans dépôt ni processus
 * Codex ; sous macOS/Linux, la sonde de verrou lance `python3`, comme pour `--open`.
 * Même localisation bornée et même verrou que `--open`. La délivrance reste `not-delivered` : aucun
 * message n'a été envoyé. Export seulement quand une lecture a eu lieu.
 */
async function relayFollow(
  context: RelayContext,
  input: { to: SessionRef; timeoutMs: number; outputDir: string; exportResult: boolean }
): Promise<RelayResultV1> {
  const home = path.join(os.homedir(), ".codex");
  const located = await locateOpenRollout(home, input.to.sessionId);
  if (located.status !== "found") {
    throw located.status === "session-not-found" ? new RelayRefusal({ status: "session-not-found" }) : invalid("invalid-working-directory");
  }
  const adapter = new CodexSessionAdapter({ home });
  const target: ExternalTarget = { agent: input.to.agent, provider: "codex", sessionId: input.to.sessionId, cwd: located.cwd };
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.once("SIGINT", onInterrupt);
  let followed: FollowRelayResult;
  try {
    followed = await runFollowRelay({
      sessionId: input.to.sessionId,
      historyPath: located.historyPath,
      timeoutMs: input.timeoutMs,
      signal: controller.signal
    }, defaultOpenRelayDeps(() => adapter.probe(target)));
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }
  const result = buildResult(context, {
    outcome: followed.outcome,
    delivery: NOT_DELIVERED,
    reply: followed.reply,
    identity: followed.identity,
    observedModels: followed.observedModels,
    message: followErrorMessage(followed, context.messages),
    follow: followed
  });
  if (input.exportResult && followed.correlation) {
    result.exportPath = await exportRelay(input.outputDir, result, { nonce: "", message: context.messages.relay.open.followNoMessage, startedAt: context.startedAt }, context.messages, false);
  }
  return result;
}

/** Message d'erreur du suivi : issue et diagnostic court ; rien n'a été déposé, donc rien à renvoyer. */
function followErrorMessage(followed: FollowRelayResult, messages: Messages): string | undefined {
  if (followed.outcome.status === "followed") return undefined;
  const parts = [followed.outcome.status === "usage-limit"
    ? messages.relay.usageLimit(followed.retryAfter)
    : followed.outcome.status === "target-state-unknown" ? messages.relay.open.targetStateUnknown : errorMessage(followed.outcome, messages)];
  if (followed.diagnostic) parts.push(messages.relay.open.diagnostic(followed.diagnostic));
  return parts.join(" ");
}

/** Message d'erreur de `--open` : issue, diagnostic court, et réception non observée après tentative. */
function openErrorMessage(open: OpenRelayResult, messages: Messages): string | undefined {
  if (open.outcome.status === "replied") return undefined;
  const relayMessages = messages.relay;
  const tooLarge = open.outcome.status === "invalid-request" && open.outcome.reason === "message-too-large";
  const parts = [open.outcome.status === "usage-limit"
    ? relayMessages.usageLimit(open.retryAfter)
    : open.outcome.status === "target-state-unknown" ? relayMessages.open.targetStateUnknown
    : tooLarge ? relayMessages.open.messageTooLarge(open.diagnostic ?? "") : errorMessage(open.outcome, messages)];
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

/** La cible neuve doit être un nom de config seul, jamais un UUID ni « la dernière ». */
function parseNewTarget(value: string, messages: Messages): { ok: true; value: SessionRef } {
  const agent = parseAgentName(value);
  if (!agent.ok) throw invalid(agent.reason, messages.relay.arguments.newTarget);
  return { ok: true, value: { agent: agent.value, sessionId: "" } };
}

function errorMessage(outcome: RelayOutcome, messages: Messages, detail?: string): string {
  if (outcome.status === "invalid-request") return messages.relay.invalidRequest(outcome.reason ?? "invalid-arguments", detail);
  if (outcome.status === "replied" || outcome.status === "followed" || outcome.status === "checked") return "";
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
    follow?: FollowRelayResult;
  }
): RelayResultV1 {
  const { outcome } = input;
  const success = outcome.status === "replied" || outcome.status === "followed" || outcome.status === "checked";
  // Une vérification n'a rien déposé ni lu de tour : pas de champs de dépôt ou de corrélation.
  const openFields: Partial<RelayResultV1> = context.check ? {} : context.follow
    ? {
      ...(input.follow?.retryAfter !== undefined ? { retryAfter: input.follow.retryAfter } : {}),
      ...(input.follow?.correlation ? { correlation: input.follow.correlation } : {}),
      receiver: "unverified",
      targetPermissions: input.follow?.targetPermissions ?? "unknown"
    }
    : context.open
    ? {
      ...(input.open?.retryAfter !== undefined ? { retryAfter: input.open.retryAfter } : {}),
      queue: input.open?.queue ?? { attempted: false },
      ...(input.open?.correlation ? { correlation: input.open.correlation } : {}),
      receiver: "unverified",
      targetPermissions: input.open?.targetPermissions ?? "unknown"
    }
    : {};
  return {
    v: 1,
    type: "relay-result",
    ...(context.writeRequest ? { writeRequest: context.writeRequest } : {}),
    ...(context.write ? { write: context.write } : {}),
    ...(context.subject !== undefined ? { subject: context.subject } : {}),
    ...(context.task ? { task: context.task } : {}),
    ...(context.cli ? { cli: context.cli } : {}),
    ...(context.remedy ? { remedy: context.remedy } : {}),
    ...(outcome.status === "target-busy" ? { retryable: true } : {}),
    status: outcome.status,
    exitCode: outcome.exitCode,
    from: context.from ? { agent: context.from.agent, ...(context.from.sessionId ? { session: context.from.sessionId } : {}) } : null,
    to: context.to ? { agent: context.to.agent, session: context.to.sessionId || null, provider: context.provider } : null,
    ...(context.newSession ? { created: !!context.to?.sessionId, ...(context.cwd ? { cwd: context.cwd } : {}) } : {}),
    ...(success && input.reply !== undefined ? { reply: input.reply } : {}),
    delivery: input.delivery,
    identity: input.identity ?? null,
    observedModels: input.observedModels ?? [],
    error: success
      ? null
      : { kind: outcome.status, message: input.message ?? errorMessage(outcome, context.messages, input.detail), ...(outcome.reason ? { reason: outcome.reason } : {}) },
    exportPath: null,
    durationMs: Date.now() - context.startedAt,
    mode: context.follow ? "follow" : context.open ? "open" : "background",
    ...(context.modeSource ? { modeSource: context.modeSource } : {}),
    ...(context.check ? { check: context.checkReport ?? {} } : {}),
    ...openFields
  };
}

function refusalResult(context: RelayContext, refusal: RelayRefusal): RelayResultV1 {
  const detail = refusal.message !== refusal.refusal.status ? refusal.message : undefined;
  return buildResult(context, { outcome: refusalOutcome(refusal.refusal), delivery: NOT_DELIVERED, detail,
    ...(refusal.refusal.status === "target-busy" && detail ? { message: `${context.messages.relay.status("target-busy")} ${detail}` } : {}) });
}

/** Écrit l'export ; un échec d'écriture ne change pas l'issue du relay. */
async function exportRelay(
  outputDir: string,
  result: RelayResultV1,
  input: { nonce: string; message: string; startedAt: number },
  messages: Messages,
  targetLocated: boolean
): Promise<string | null> {
  if (!result.to || !result.to.provider) return null;
  try {
    return await writeRelayMarkdown(outputDir, {
      mode: result.mode,
      ...(result.modeSource ? { modeSource: result.modeSource } : {}),
      from: result.from,
      ...(result.write ? { write: result.write } : {}),
      ...(result.created !== undefined ? { created: result.created, cwd: result.cwd } : {}),
      ...(relayDesktopLink(result, targetLocated) ? { desktopLink: relayDesktopLink(result, targetLocated) } : {}),
      to: { agent: result.to.agent, session: result.to.session, provider: result.to.provider },
      status: result.status,
      delivery: result.delivery,
      identity: result.identity,
      observedModels: result.observedModels,
      nonce: input.nonce,
      startedAt: new Date(input.startedAt).toISOString(),
      ...(result.subject !== undefined ? { subject: result.subject } : {}),
      message: input.message,
      reply: result.reply,
      error: result.error?.message,
      ...(result.retryAfter !== undefined ? { retryAfter: result.retryAfter } : {}),
      ...(result.readAccess ? { readAccess: result.readAccess } : {}),
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
        : {}),
      ...(result.mode === "follow"
        ? {
          follow: {
            correlation: result.correlation ? `${result.correlation.status} (${result.correlation.reason})` : null,
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
function writeResult(result: RelayResultV1, json: boolean, messages: Messages, targetLocated = false): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const text = renderRelayText(result, messages, { targetLocated });
  const link = relayDesktopLink(result, targetLocated);
  process.stdout.write(text.stdout);
  process.stderr.write(link && terminalHyperlinksEnabled(process.stderr.isTTY, process.env) ? withTerminalHyperlink(text.stderr, link) : text.stderr);
}

/** Liens OSC 8 réservés à un terminal interactif, sans `NO_COLOR` ni `TERM=dumb` (voir AGENTS.md). */
export function terminalHyperlinksEnabled(isTTY: boolean | undefined, env: NodeJS.ProcessEnv): boolean {
  return Boolean(isTTY) && !env.NO_COLOR && env.TERM !== "dumb";
}

/**
 * Rend cliquable la **première** occurrence du lien dans un texte déjà assaini. Le lien est
 * construit par PALABRE depuis un UUID validé, jamais repris d'un texte libre ; les occurrences
 * suivantes (dans la commande d'ouverture) restent en texte brut pour un copier-coller fiable.
 */
export function withTerminalHyperlink(text: string, link: string): string {
  const index = text.indexOf(link);
  if (index < 0) return text;
  return `${text.slice(0, index)}\u001b]8;;${link}\u001b\\${link}\u001b]8;;\u001b\\${text.slice(index + link.length)}`;
}

/**
 * Commande que **l'humain** peut lancer pour ouvrir un lien `codex://` : l'app Claude, par
 * exemple, ne le rend pas cliquable (#190). Un agent ne la lance jamais à sa place.
 */
export function desktopOpenCommand(link: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") return `explorer.exe "${link}"`;
  if (platform === "darwin") return `open "${link}"`;
  return `xdg-open "${link}"`;
}

/**
 * Qualifie le travail sans effacer la réponse ni la délivrance. Le diagnostic ne décide plus seul
 * de l'issue : il la dégrade uniquement quand **rien n'a abouti après le premier refus**
 * (`blocked`), cas où la réponse peut être plausible sans aucune lecture. Dès qu'une commande a
 * abouti ensuite (`partial`), ou que les événements ne sont pas interprétables (`unverified`),
 * l'issue de l'échange est conservée et l'avertissement passe par le rendu texte et l'export
 * (#173 ; essai réel #171, suivi Windows #128).
 *
 * Appelée avant toute publication GitHub. La tâche `review` reste volontairement plus stricte :
 * tout diagnostic, quel que soit son statut, laisse la publication en `not-attempted`, parce que
 * publier une revue est une action publique que PALABRE ne peut pas défaire.
 */
export function applyReadAccessDiagnostic(
  result: RelayResultV1,
  diagnostic: ReadAccessDiagnostic | undefined,
  messages: Messages
): void {
  if (!diagnostic) return;
  result.readAccess = diagnostic;
  if (!result.task) {
    // En échec, le message existant est seulement enrichi du diagnostic.
    if (result.status !== "replied") {
      if (result.error) result.error.message += ` ${messages.relay.readAccess(diagnostic)}`;
      return;
    }
    // `blocked` seulement : aucune commande n'a abouti après le refus, donc rien n'étaye la
    // réponse. Les autres statuts gardent `replied` / 0.
    if (diagnostic.status === "blocked") {
      result.status = "read-unavailable";
      result.exitCode = RELAY_EXIT_CODES["read-unavailable"];
      result.error = { kind: "read-unavailable", message: messages.relay.readAccess(diagnostic) };
    }
    return;
  }
  result.task.error = "read-unavailable";
  const message = messages.relay.reviewFailure("read-unavailable");
  if (result.status !== "replied") {
    if (result.error) result.error.message += ` ${message}`;
    return;
  }
  result.status = "review-failed";
  result.exitCode = RELAY_EXIT_CODES["review-failed"];
  result.error = { kind: "review-failed", message };
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

/**
 * Lien `codex://threads/…` d'une conversation Codex suivie **en arrière-plan** : créée par ce relay
 * dès que son identifiant est connu, même si le premier tour a échoué (#179), ou reprise fermée
 * (#190) dont l'historique a été trouvé (`targetLocated`), quelle que soit l'issue ensuite. Jamais
 * pour Claude, ni en mode `open`/`follow` (la conversation est déjà dans l'app), ni pour une reprise
 * arrêtée avant la localisation (argument, CLI absente, cible introuvable, annulation précoce) : un
 * statut ne prouve pas à lui seul l'existence de la conversation. Aucun champ JSON n'est ajouté : une
 * intégration construit le même lien depuis `to.session`.
 */
export function relayDesktopLink(result: RelayResultV1, targetLocated: boolean): string | undefined {
  if (result.mode !== "background" || !result.to?.session || result.to.provider !== "codex") return undefined;
  if (!result.created && !targetLocated) return undefined;
  return codexDesktopThreadLink(result.to.session);
}

/** Même réponse en texte qu'en JSON, y compris après une publication refusée ou interrompue. */
export function renderRelayText(result: RelayResultV1, messages: Messages, options: { targetLocated?: boolean } = {}): { stdout: string; stderr: string } {
  const lines: string[] = [];
  const stdout = result.reply !== undefined ? `${sanitizeTerminalText(result.reply)}\n` : "";
  if (result.status === "replied") {
    lines.push(messages.relay.replied(result.to?.agent ?? ""));
  } else if (result.status === "followed") {
    lines.push(messages.relay.open.followed(result.to?.agent ?? ""));
    if (result.correlation?.reason === "turn-started-before-follow") lines.push(messages.relay.open.followStartedBefore);
  } else if (result.status === "checked") {
    lines.push(messages.relay.check.done(result.to?.agent ?? "", result.check?.target ?? "closed"));
  } else {
    lines.push(`${messages.relay.failed(result.status)} ${result.error?.message ?? ""}`.trim());
    // Le suivi et la vérification n'envoient rien : une consigne de renvoi n'aurait pas de sens.
    if (result.check) lines.push(messages.relay.check.nothingSent);
    else if (result.mode !== "follow") lines.push(messages.relay.delivery(result.delivery.status));
  }
  // Mode annoncé à chaque échange (#190), sauf refus d'arguments ou de configuration : rien n'a eu lieu.
  if (result.status !== "invalid-request") lines.push(messages.relay.modeLine(result.mode, result.to?.agent ?? "", Boolean(result.write)));
  if (result.status !== "invalid-request" && result.modeSource) lines.push(messages.relayView.source(result.modeSource));
  // Visible même quand l'issue reste `replied` : sans cette ligne, un échange réussi ne dirait
  // plus rien des lancements refusés, puisque `error` est alors nul. Pas de seconde copie quand
  // `applyReadAccessDiagnostic` l'a déjà placé dans le message d'erreur (`blocked`, échec enrichi).
  if (result.readAccess) {
    const warning = messages.relay.readAccess(result.readAccess);
    if (!result.error?.message.includes(warning)) lines.push(warning);
  }
  if (result.task) {
    lines.push(`${messages.relay.export.publication}: ${result.task.publication}`);
    if (result.task.reviewUrl) lines.push(`${messages.relay.export.reviewUrl}: ${result.task.reviewUrl}`);
  }
  if (result.created && result.to?.session) {
    lines.push(messages.relay.newConversation(`${result.to.agent}:${result.to.session}`, result.cwd ?? ""));
    if (result.write) lines.push(relayWriteText(result.write.language).continueReadOnly);
    lines.push(messages.relay.continueConversation(`palabre relay --to ${result.to.agent}:${result.to.session} "…"`));
    if (result.status !== "replied") lines.push(messages.relay.newFailed);
  }
  const link = relayDesktopLink(result, options.targetLocated === true);
  if (link) {
    lines.push(result.created ? messages.relay.desktopLink(link) : messages.relay.desktopLinkExisting(link));
    lines.push(messages.relay.openLinkCommand(desktopOpenCommand(link)));
  }
  if (result.check?.lastPermissions) {
    lines.push(result.check.lastPermissions === "unknown"
      ? messages.relay.check.permissionsUnknown
      : messages.relay.check.lastPermissions(permissionsSummary(result.check.lastPermissions), result.check.lastPermissionsAt));
  }
  if (result.mode === "open" && !result.check) {
    lines.push(messages.relay.open.unverifiedReceiver);
    if (result.targetPermissions && result.targetPermissions !== "unknown") lines.push(messages.relay.open.permissions(permissionsSummary(result.targetPermissions)));
  }
  if (result.mode === "follow" && result.targetPermissions && result.targetPermissions !== "unknown") {
    lines.push(messages.relay.open.followPermissions(permissionsSummary(result.targetPermissions)));
  }
  if (result.exportPath) lines.push(messages.relay.exportWritten(result.exportPath));
  if (result.write) {
    const text = relayWriteText(result.write.language);
    lines.push(text.report, `${messages.relay.export.cwd}: ${result.write.worktree}`,
      text.branch(result.write.branch), text.files(result.write.files, Boolean(result.write.diagnostic)));
    for (const command of result.write.commands) lines.push(text.command(command), command.output);
    if (!result.write.commands.length) lines.push(text.noTestEvidence);
    if (result.write.diagnostic) lines.push(text.failure(result.write.diagnostic));
  }
  return { stdout, stderr: `${lines.map((line) => sanitizeTerminalText(line)).join("\n")}\n` };
}

/** Gestion d'un accord humain ponctuel ; aucun --yes, aucune option modifiant la tâche approuvée. */
async function manageWrite(rawArgs: string[]): Promise<void> {
  let language: "fr" | "en" = resolveLanguage({});
  try {
    const id = rawArgs[2];
    const action = rawArgs[1];
    if (!id || rawArgs.length > (action === "run-write" && rawArgs[3] === "--json" ? 4 : 3)) throw new WriteError("invalid-request");
    const { request } = await readWriteRequest(id);
    language = request.language;
    const text = relayWriteText(language);
    if (action === "approve-write") {
      await approveWrite(id, {
        interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
        display: r => console.log(sanitizeTerminalText(text.plan(r))),
        confirm: async () => {
          const io = createInterface({ input: process.stdin, output: process.stdout });
          try {
            return ["o", "oui", "y", "yes"].includes((await io.question(text.prompt)).trim().toLowerCase());
          } finally {
            io.close();
          }
        }
      });
      console.log(text.approved(id));
      return;
    }
    const { result, messages, targetLocated } = await executeRelayWithMessages(request.args, { approvedWrite: request });
    writeResult(result, rawArgs.includes("--json"), messages, targetLocated); process.exitCode = result.exitCode;
  } catch (error) {
    const text = relayWriteText(language);
    const detail = error instanceof Error && error.message === "human-terminal-required" ? text.terminal + ` palabre relay approve-write ${rawArgs[2]}` : text.failure(error instanceof Error ? error.message : "invalid-request");
    const context: RelayContext = { startedAt: Date.now(), messages: createTranslator(language), from: null, to: null, provider: null, exchangeStarted: false, open: false };
    const result = refusalResult(context, invalid("write-approval-invalid", detail));
    writeResult(result, rawArgs.includes("--json"), context.messages); process.exitCode = result.exitCode;
  }
}
