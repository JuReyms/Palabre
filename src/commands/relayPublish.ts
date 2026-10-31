/** @file Bilan Relay choisi : aperçu exact, confirmation clavier, trace exclusive et publication unique. */
import os from "node:os";
import path from "node:path";
import { stdin, stderr } from "node:process";
import { createInterface } from "node:readline/promises";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { parseAgentName } from "../externalSessions/envelope.js";
import { parseRelayGitHub, validRelayParticipant } from "../externalSessions/relayWork.js";
import { publicationBody, publicationHash, readPublicationSnapshot, runPublicationGitHub, validPublicationUrl,
  verifiedPublication, type PublicationGitHubRun, type PublicationTarget } from "../githubPublication.js";
import { resolveLanguage } from "../i18n.js";
import { relayPublishText } from "../messages/relayPublish.js";
import { readPublicationReceipt, readPublicationText, reservePublication, settlePublication, type PublicationReceipt } from "../publicationReceipt.js";
import type { Language } from "../types.js";

/** Limite du seul bilan choisi ; l'attribution garde une marge sous 64 Kio. */
export const MAX_PUBLICATION_BODY_BYTES = 60 * 1024;

/** Aperçu exact, indépendant des identifiants de conversation et des permissions Relay. */
export interface RelayPublicationPreview {
  to: string;
  publisher: string;
  public: boolean;
  agent: string;
  participant: string;
  body: string;
  bodyHash: string;
  commit?: string;
}

/** Résultat JSON v1 propre à la publication ; aucun succès de tâche ou de transport Relay n'en découle. */
export interface RelayPublicationResult {
  v: 1;
  type: "relay-publication-result";
  status: "preview" | "published" | "already-published" | "invalid-request" | "confirmation-required" | "declined" | "changed" | "unavailable" | "uncertain" | "cancelled" | "trace-failed";
  exitCode: number;
  publication: "not-attempted" | "published" | "unknown";
  /** Tentative de cet appel uniquement, indépendamment d'une réservation antérieure. */
  attempted: boolean;
  preview?: RelayPublicationPreview;
  commentUrl?: string;
  receipt?: { path: string; status: "saved" | "failed" };
  cancelled?: boolean;
  error: { reason: string; message: string } | null;
}

/** IO terminal injectables dans les seuls tests ; une option CLI ne peut jamais les remplacer. */
export interface PublicationTerminal {
  interactive: boolean;
  print(value: string): void;
  confirm(prompt: string, signal?: AbortSignal): Promise<boolean>;
}

/** Dépendances d'exécution ; les profils fictifs sont imposés par le lanceur de tests. */
export interface RelayPublicationDeps {
  run: PublicationGitHubRun;
  terminal: PublicationTerminal;
  home: string;
  signal?: AbortSignal;
}

const terminal: PublicationTerminal = {
  get interactive() { return Boolean(stdin.isTTY && stderr.isTTY); },
  print: value => stderr.write(`${sanitizeTerminalText(value)}\n`),
  confirm: confirmPublication
};

/**
 * Confirmation clavier : EOF/Ctrl+D refusent, Ctrl+C ou le signal annulent. Fermer readline
 * ne règle pas toujours question() : son propre signal garantit la fin et le nettoyage.
 * Les streams injectables servent aux tests inertes, jamais à confirmer pour l'humain.
 */
export async function confirmPublication(prompt: string, signal?: AbortSignal,
  input: NodeJS.ReadableStream = stdin, output: NodeJS.WritableStream = stderr): Promise<boolean> {
  const reader = createInterface({ input, output });
  const controller = new AbortController();
  let closed = false, interrupted = false;
  const abort = () => controller.abort();
  const close = () => { closed = true; abort(); };
  const interrupt = () => { interrupted = true; abort(); };
  reader.once("close", close);
  reader.once("SIGINT", interrupt);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    return ["o", "oui", "y", "yes"].includes((await reader.question(sanitizeTerminalText(prompt), { signal: controller.signal })).trim().toLowerCase());
  } catch (error) {
    if (closed && !interrupted && !signal?.aborted) return false;
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.removeListener("close", close);
    reader.removeListener("SIGINT", interrupt);
    reader.close();
  }
}

interface PublicationArgs {
  target: PublicationTarget;
  file: string;
  agent: string;
  participant: string;
  commit?: string;
  dryRun: boolean;
  language: Language;
}

/** Grammaire fermée, avant toute IO ; pas de config/politique héritée ou d'approbation transmissible. */
function parsePublicationArgs(tokens: readonly string[]): PublicationArgs | undefined {
  const flags = new Map<string, string | boolean>();
  const values = new Set(["--to", "--from", "--participant", "--message-file", "--commit", "--language"]);
  for (let i = 0; i < tokens.length; i++) {
    const flag = tokens[i] === "--lang" ? "--language" : tokens[i]!;
    if (flags.has(flag)) return undefined;
    if (flag === "--dry-run" || flag === "--json") flags.set(flag, true);
    else if (values.has(flag)) {
      const value = tokens[++i];
      if (!value || value.startsWith("-")) return undefined;
      flags.set(flag, value);
    } else return undefined;
  }
  const target = parseRelayGitHub(String(flags.get("--to") ?? ""));
  const agent = String(flags.get("--from") ?? "");
  const participant = String(flags.get("--participant") ?? agent);
  const file = String(flags.get("--message-file") ?? "");
  const commitValue = flags.get("--commit");
  if (!target || target.kind === "repository" || target.number === undefined || !parseAgentName(agent).ok || !validRelayParticipant(participant)
    || !file.trim() || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(file)
    || (commitValue !== undefined && (target.kind !== "pull-request" || typeof commitValue !== "string" || !/^[0-9a-fA-F]{40}$/.test(commitValue)))) return undefined;
  const language = resolveLanguage({ explicitLanguage: flags.get("--language") as string | undefined });
  return { target: target as PublicationTarget, agent, participant, file: path.resolve(file), language,
    dryRun: flags.has("--dry-run"), ...(typeof commitValue === "string" ? { commit: commitValue.toLowerCase() } : {}) };
}

/** Un bilan choisi, pas un export entier. CRLF devient LF avant l'aperçu ; aucun contrôle n'est masqué. */
async function readReport(file: string): Promise<string> {
  if (/\.(relay|handoff|ask|debate|chat)\.md$/i.test(file)) throw new Error("report-required");
  const body = (await readPublicationText(file, MAX_PUBLICATION_BODY_BYTES)).replace(/\r\n/g, "\n");
  if (!body.trim() || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(body.replace(/[\n\t]/g, ""))) throw new Error("invalid-report");
  return body;
}

/** Affiche un corps entier encadré, sans le tronquer ni interpréter son Markdown comme une autorité. */
export function renderPublicationPreview(preview: RelayPublicationPreview, language: Language): string {
  const text = relayPublishText(language);
  const fence = "`".repeat(Math.max(3, ...(preview.body.match(/`+/g) ?? []).map(run => run.length + 1)));
  return [`${text.account} : ${preview.publisher}`, `${text.destination} : ${preview.to}`, preview.public ? text.public : text.private,
    `${text.preview} (SHA-256 ${preview.bodyHash})`, `${fence}markdown`, preview.body, fence, text.endPreview].join("\n");
}

/**
 * Prépare ou publie un seul commentaire. Toute erreur après l'appel POST laisse l'issue inconnue,
 * sauf accusé complet vérifié. Les réservations survivent aux erreurs/crashes et bloquent le rejeu.
 * La confirmation TTY est un contrôle opérateur, pas une authentification contre un processus ayant ses droits.
 */
export async function executeRelayPublish(tokens: readonly string[], overrides: Partial<RelayPublicationDeps> = {}): Promise<{ result: RelayPublicationResult; language: Language }> {
  const deps: RelayPublicationDeps = { run: runPublicationGitHub, terminal, home: os.homedir(), ...overrides };
  let language: Language = "fr";
  const result: RelayPublicationResult = { v: 1, type: "relay-publication-result", status: "invalid-request", exitCode: 8,
    publication: "not-attempted", attempted: false, error: null };
  const finish = (status: RelayPublicationResult["status"], exitCode: number, reason?: keyof ReturnType<typeof relayPublishText>) => {
    result.status = status; result.exitCode = exitCode;
    result.error = reason ? { reason, message: relayPublishText(language)[reason] } : null;
    return { result, language };
  };
  const stop = () => deps.signal?.aborted ? finish("cancelled", 130, "cancelled") : undefined;
  let args: PublicationArgs | undefined;
  try {
    const index = tokens.findIndex(token => token === "--language" || token === "--lang");
    language = resolveLanguage({ explicitLanguage: index < 0 ? undefined : tokens[index + 1] });
    args = parsePublicationArgs(tokens);
  } catch { return finish("invalid-request", 8, "invalid"); }
  if (!args) return finish("invalid-request", 8, "invalid");
  language = args.language;
  if (stop()) return stop()!;
  if (!args.dryRun && !deps.terminal.interactive) return finish("confirmation-required", 8, "confirmation");
  let source: string;
  try { source = await readReport(args.file); }
  catch { return stop() ?? finish("invalid-request", 8, "body"); }
  const body = publicationBody({ body: source, agent: args.agent, participant: args.participant, commit: args.commit, language });
  if (Buffer.byteLength(body, "utf8") > 64 * 1024) return finish("invalid-request", 8, "body");
  try {
    const before = await readPublicationSnapshot(args.target, deps.run, deps.signal);
    if (stop()) return stop()!;
    if (args.commit && args.commit !== before.headSha) return finish("changed", 2, "changed");
    const bodyHash = publicationHash(body);
    const key = publicationHash(JSON.stringify([args.target.url, before.repositoryId, before.targetId, before.publisherId, before.publisher, bodyHash]));
    result.preview = { to: args.target.url, publisher: before.publisher, public: before.public, agent: args.agent,
      participant: args.participant, body, bodyHash, ...(args.commit ? { commit: args.commit } : {}) };
    if (args.dryRun) return finish("preview", 0);
    const file = path.join(deps.home, ".palabre", "relay-publications", `${key}.json`);
    let prior: PublicationReceipt | undefined;
    try { prior = await readPublicationReceipt(file); }
    catch { result.publication = "unknown"; result.receipt = { path: file, status: "failed" }; return finish("uncertain", 2, "uncertain"); }
    if (prior) {
      result.receipt = { path: file, status: "saved" };
      if (prior.key === key && prior.bodyHash === bodyHash && prior.target === args.target.url && prior.publisher === before.publisher
        && prior.repositoryId === before.repositoryId && prior.targetId === before.targetId && prior.publisherId === before.publisherId
        && prior.status === "published" && validPublicationUrl(prior.commentUrl, args.target)) {
        result.publication = "published"; result.commentUrl = prior.commentUrl;
        return finish("already-published", 0);
      }
      result.publication = "unknown"; return finish("uncertain", 2, "uncertain");
    }
    deps.terminal.print(renderPublicationPreview(result.preview, language));
    let confirmed: boolean;
    try { confirmed = await deps.terminal.confirm(relayPublishText(language).confirm, deps.signal); }
    catch (error) {
      if (deps.signal?.aborted || (error instanceof Error && error.name === "AbortError")) return finish("cancelled", 130, "cancelled");
      throw error;
    }
    if (!confirmed) return stop() ?? finish("declined", 8, "declined");
    if (stop()) return stop()!;
    const after = await readPublicationSnapshot(args.target, deps.run, deps.signal);
    if (stop()) return stop()!;
    let currentSource: string;
    try { currentSource = await readReport(args.file); } catch { return finish("changed", 2, "changed"); }
    if (JSON.stringify(before) !== JSON.stringify(after) || currentSource !== source) return finish("changed", 2, "changed");
    if (stop()) return stop()!;
    const receipt: PublicationReceipt = { v: 1, key, target: args.target.url, publisher: before.publisher,
      repositoryId: before.repositoryId, targetId: before.targetId, publisherId: before.publisherId, bodyHash, body,
      createdAt: new Date().toISOString(), status: "reserved" };
    try { await reservePublication(file, receipt); result.receipt = { path: file, status: "saved" }; }
    catch (error) {
      result.receipt = { path: file, status: "failed" };
      if ((error as NodeJS.ErrnoException).code === "EEXIST") { result.publication = "unknown"; return finish("uncertain", 2, "uncertain"); }
      return finish("trace-failed", 2, "receipt");
    }
    if (stop()) return stop()!;
    result.attempted = true;
    result.publication = "unknown";
    const settled: PublicationReceipt = { ...receipt, status: "unknown" };
    try {
      const raw = await deps.run([`repos/${args.target.repository}/issues/${args.target.number}/comments`, "--method", "POST", "--input", "-"], JSON.stringify({ body }), deps.signal);
      const url = verifiedPublication(raw, args.target, body, before.publisher, before.publisherId);
      if (url) { result.publication = "published"; result.commentUrl = url; settled.status = "published"; settled.commentUrl = url; }
    } catch { /* Une erreur après tentative conserve l'incertitude, sans renvoi. */ }
    if (deps.signal?.aborted) result.cancelled = true;
    try { await settlePublication(file, settled, receipt); }
    catch { result.receipt = { path: file, status: "failed" }; }
    return result.publication === "published" ? finish("published", 0)
      : finish("uncertain", 2, "uncertain");
  } catch { return stop() ?? finish("unavailable", 2, "unavailable"); }
}

/** Dispatch CLI : aperçu/confirmation sur stderr, un objet JSON unique sur stdout, aucun retry. */
export async function runRelayPublishCommand(tokens: string[]): Promise<void> {
  const help = tokens.filter(token => token === "--help" || token === "-h");
  const other = tokens.filter(token => token !== "--help" && token !== "-h");
  if (help.length === 1 && (other.length === 0 || (other.length === 2 && ["--language", "--lang"].includes(other[0]!)))) {
    try { process.stdout.write(`${relayPublishText(resolveLanguage({ explicitLanguage: other[1] })).help}\n`); return; }
    catch { /* La requête invalide passe par le résultat JSON/texte habituel. */ }
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    const { result, language } = await executeRelayPublish(tokens, { signal: controller.signal });
    const text = relayPublishText(language);
    if (tokens.includes("--json")) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (result.status === "preview" && result.preview) process.stdout.write(`${sanitizeTerminalText(renderPublicationPreview(result.preview, language))}\n`);
    else if (result.commentUrl) process.stdout.write(`${result.status === "already-published" ? text.already : text.published}\n${result.commentUrl}\n`);
    if (result.error) stderr.write(`${sanitizeTerminalText(result.error.message)}\n`);
    if (result.receipt) stderr.write(`${text.journal} : ${sanitizeTerminalText(result.receipt.path)}\n`);
    if (result.publication === "published" && result.receipt?.status === "failed") stderr.write(`${text.traceFailed}\n`);
    process.exitCode = result.exitCode;
  } finally { process.removeListener("SIGINT", cancel); }
}
