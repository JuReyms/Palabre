/**
 * @file `palabre result --reference <référence>` : lecture sans envoi de la réponse d'UNE demande
 * OpenCode dont l'attente a expiré. La référence opaque (`opencodeJson.ts`) lie la configuration
 * approuvée exacte (chemin canonique et SHA-256), l'agent et sa commande, le dossier, la session et le
 * dernier message observés, l'empreinte du prompt et le modèle demandé ; jamais le prompt.
 *
 * Avant tout lancement : identité de configuration relevée avant et après le chargement, égale à la
 * référence, configuration toujours approuvée, agent au profil qualifié avec la même commande, dossier
 * existant, signal non annulé. Aucune approbation accordée ni rafraîchie. Une seule lecture
 * `session export <id>` par la commande configurée, dans le dossier d'origine, avec délai, plafond,
 * UTF-8 strict et annulation ; seul le client lancé est arrêté. Aucun modèle, aucune nouvelle
 * conversation, aucun renvoi ni attente en boucle. La réponse reste une donnée non fiable.
 */
import { stat } from "node:fs/promises";
import { loadConfig } from "../config.js";
import { getConfigIdentity, isConfigTrusted } from "../configTrust.js";
import { cliRuntimeProfile, isRetiredAgentName } from "../agentRegistry.js";
import { killChildProcess, releaseChildProcessHandles, spawnConfiguredCommand } from "../adapters/cli.js";
import { resolveMaxOutputBytes } from "../adapters/cli-shared.js";
import { decodeRecoveryReference, evaluateOpenCodeExport } from "../adapters/opencodeJson.js";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { resolveLanguage } from "../i18n.js";
import { agentResultText } from "../messages/agentResult.js";
import type { CliAgentConfig, ConfigIdentity, Language, PalabreConfig } from "../types.js";

/** Issues publiques ; seule `replied` porte une réponse. */
export type AgentResultStatus = "replied" | "pending" | "not-succeeded" | "mismatch" | "unreadable" | "invalid-request" | "command-not-found" | "cancelled";

const EXIT_CODES: Record<AgentResultStatus, number> = {
  replied: 0, pending: 2, "not-succeeded": 2, unreadable: 2, mismatch: 3, "command-not-found": 7, "invalid-request": 8, cancelled: 130
};

/** Sortie `--json` v1 distincte (`agent-result`) : un seul objet, `sent` toujours faux. */
export interface AgentResultV1 {
  v: 1;
  type: "agent-result";
  status: AgentResultStatus;
  exitCode: number;
  agent: string | null;
  session: string | null;
  sent: false;
  reply?: string;
  outcome?: string;
  error: { kind: AgentResultStatus; message: string; reason?: string } | null;
}

/** Lecture d'export brute, sans interprétation du contenu. */
export type ExportRun =
  | { status: "completed"; exitCode: number; stdout: string }
  | { status: "timeout" | "output-too-large" | "cancelled" | "spawn-failed" | "command-not-found" | "invalid-output" };

/** Lanceur injectable pour les tests ; par défaut la commande configurée, sans modèle ni prompt. */
export type ExportRunner = (input: { agent: string; config: CliAgentConfig; session: string; cwd: string; timeoutMs: number; signal?: AbortSignal }) => Promise<ExportRun>;

/** Dépendances facultatives (tests, annulation). */
export interface AgentResultDeps {
  runExport?: ExportRunner;
  signal?: AbortSignal;
}

const VALUE_FLAGS = new Set(["reference", "timeout", "language"]);
const BOOLEAN_FLAGS = new Set(["json", "help"]);
const DEFAULT_TIMEOUT_SECONDS = 60;

/** Parseur strict : options longues connues, sans `=`, sans répétition ni positionnel. */
function parseTokens(tokens: string[]): Record<string, string | true> | undefined {
  const flags: Record<string, string | true> = {};
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const name = token === "-h" ? "help" : token.startsWith("--") && !token.includes("=") ? token.slice(2) : undefined;
    if (!name || Object.prototype.hasOwnProperty.call(flags, name)) return undefined;
    if (BOOLEAN_FLAGS.has(name)) { flags[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) return undefined;
    const value = tokens[++index];
    if (value === undefined || value.startsWith("--")) return undefined;
    flags[name] = value;
  }
  return flags;
}

const identityOf = (file: string) => getConfigIdentity(file).catch(() => undefined);
const sameIdentity = (actual: ConfigIdentity | undefined, expected: ConfigIdentity) =>
  actual !== undefined && actual.path === expected.path && actual.sha256 === expected.sha256;

/**
 * Lance `session export <id>` avec la commande configurée dans le dossier d'origine. Signal déjà
 * annulé : aucun lancement. Délai, plafond cumulé stdout+stderr, UTF-8 strict ; l'arrêt ne vise que
 * le client lancé, jamais son arbre ni un service.
 */
export const runOpenCodeExport: ExportRunner = ({ agent, config, session, cwd, timeoutMs, signal }) => new Promise((resolve) => {
  if (signal?.aborted) { resolve({ status: "cancelled" }); return; }
  let child: ReturnType<typeof spawnConfiguredCommand>;
  try { child = spawnConfiguredCommand(agent, config, ["session", "export", session], { cwd }); }
  catch { resolve({ status: "spawn-failed" }); return; }
  const chunks: Buffer[] = [];
  const maxBytes = resolveMaxOutputBytes(config.maxOutputBytes);
  let bytes = 0;
  let settled = false;
  const end = (run: ExportRun) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    resolve(run);
  };
  const stop = (run: ExportRun) => {
    killChildProcess(child, false);
    releaseChildProcessHandles(child);
    end(run);
  };
  const onAbort = () => stop({ status: "cancelled" });
  const timer = setTimeout(() => stop({ status: "timeout" }), timeoutMs);
  signal?.addEventListener("abort", onAbort, { once: true });
  const count = (chunk: Buffer, keep: boolean) => {
    if (settled) return;
    bytes += chunk.length;
    if (bytes > maxBytes) { stop({ status: "output-too-large" }); return; }
    if (keep) chunks.push(chunk);
  };
  child.stdout.on("data", (chunk: Buffer) => count(chunk, true));
  child.stderr.on("data", (chunk: Buffer) => count(chunk, false));
  child.stdin.on("error", () => { /* Fermeture anticipée : l'issue vient de close. */ });
  child.on("error", (error: NodeJS.ErrnoException) => end({ status: error.code === "ENOENT" ? "command-not-found" : "spawn-failed" }));
  child.on("close", (code: number | null) => {
    let stdout: string;
    try { stdout = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { end({ status: "invalid-output" }); return; }
    end({ status: "completed", exitCode: code ?? -1, stdout });
  });
  child.stdin.end();
});

/** Lit la réponse liée à une référence ; toute validation précède l'unique lecture d'export. */
export async function executeAgentResult(rawArgs: string[], deps: AgentResultDeps = {}): Promise<{ language: Language; result?: AgentResultV1; help?: string }> {
  const flags = parseTokens(rawArgs);
  const explicitLanguage = typeof flags?.language === "string" ? flags.language : undefined;
  let language: Language = "fr";
  let languageValid = true;
  try { language = resolveLanguage({ explicitLanguage }); } catch { languageValid = false; }
  let text = agentResultText(language);
  let agent: string | null = null;
  let session: string | null = null;
  const done = (status: AgentResultStatus, message: string, extra: { reason?: string; reply?: string; outcome?: string } = {}) => ({
    language,
    result: {
      v: 1 as const,
      type: "agent-result" as const,
      status,
      exitCode: EXIT_CODES[status],
      agent,
      session,
      sent: false as const,
      ...(extra.reply !== undefined ? { reply: extra.reply } : {}),
      ...(extra.outcome !== undefined ? { outcome: extra.outcome } : {}),
      error: status === "replied" ? null : { kind: status, message, ...(extra.reason ? { reason: extra.reason } : {}) }
    }
  });
  const invalid = (reason: string) => done("invalid-request", text.invalid(reason), { reason });
  if (!flags || !languageValid) return invalid("invalid-arguments");
  if (flags.help) return { language, help: text.help };
  if (typeof flags.reference !== "string") return invalid("invalid-arguments");
  const reference = decodeRecoveryReference(flags.reference);
  if (!reference) return invalid("invalid-reference");
  agent = reference.agent;
  session = reference.session;
  const timeoutText = typeof flags.timeout === "string" ? flags.timeout : undefined;
  const timeoutSeconds = timeoutText === undefined ? DEFAULT_TIMEOUT_SECONDS : /^\d{1,4}$/.test(timeoutText) ? Number(timeoutText) : NaN;
  if (!(timeoutSeconds >= 5 && timeoutSeconds <= 600)) return invalid("invalid-arguments");

  // Même configuration approuvée qu'à l'envoi : identité avant et après le chargement, sans accord ajouté.
  const before = await identityOf(reference.config.path);
  if (!before) return invalid("config-unavailable");
  if (!sameIdentity(before, reference.config)) return invalid("config-changed");
  let trusted = false;
  try { trusted = await isConfigTrusted(reference.config.path); } catch { return invalid("config-unavailable"); }
  if (!trusted) return invalid("config-untrusted");
  let config: PalabreConfig;
  try { config = await loadConfig(reference.config.path); } catch { return invalid("config-unavailable"); }
  if (!sameIdentity(await identityOf(reference.config.path), reference.config)) return invalid("config-changed");
  try {
    language = resolveLanguage({ explicitLanguage, configLanguage: config.language });
    text = agentResultText(language);
  } catch { /* Langue de config invalide : la langue de démarrage reste utilisée. */ }
  const agents = config.agents ?? {};
  if (!Object.prototype.hasOwnProperty.call(agents, reference.agent) || isRetiredAgentName(reference.agent)) return invalid("unknown-agent");
  const profile = cliRuntimeProfile(agents[reference.agent]!);
  if (!profile?.runtime) return invalid("unsupported-agent");
  if (profile.config.command !== reference.command) return invalid("agent-changed");
  try { if (!(await stat(reference.cwd)).isDirectory()) return invalid("cwd-unavailable"); }
  catch { return invalid("cwd-unavailable"); }
  if (deps.signal?.aborted) return done("cancelled", text.cancelled);

  const run = await (deps.runExport ?? runOpenCodeExport)({
    agent: reference.agent, config: profile.config, session: reference.session, cwd: reference.cwd, timeoutMs: timeoutSeconds * 1000, signal: deps.signal
  });
  if (run.status === "cancelled") return done("cancelled", text.cancelled);
  if (run.status === "command-not-found") return done("command-not-found", text.commandNotFound(reference.agent));
  if (run.status === "invalid-output") return done("unreadable", text.unreadable("unknown-format"), { reason: "unknown-format" });
  if (run.status !== "completed") return done("unreadable", text.unreadable(run.status), { reason: run.status });
  if (run.exitCode !== 0) return done("unreadable", text.unreadable("export-failed"), { reason: "export-failed" });
  let exported: unknown;
  try { exported = JSON.parse(run.stdout); } catch { return done("unreadable", text.unreadable("unknown-format"), { reason: "unknown-format" }); }
  const verdict = evaluateOpenCodeExport(exported, reference);
  switch (verdict.status) {
    case "replied": return done("replied", "", { reply: verdict.reply });
    case "pending": return done("pending", text.pending(reference.agent));
    case "not-succeeded": return done("not-succeeded", text.notSucceeded(verdict.reason, verdict.outcome), { reason: verdict.reason, ...(verdict.outcome ? { outcome: verdict.outcome } : {}) });
    case "mismatch": return done("mismatch", text.mismatch(verdict.reason), { reason: verdict.reason });
    case "unreadable": return done("unreadable", text.unreadable(verdict.reason), { reason: verdict.reason });
  }
}

/** Point d'entrée : JSON unique sur stdout avec `--json`, sinon réponse sur stdout et état sur stderr. */
export async function runAgentResultCommand(rawArgs: string[]): Promise<void> {
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.once("SIGINT", onInterrupt);
  try {
    const { result, language, help } = await executeAgentResult(rawArgs, { signal: controller.signal });
    if (help !== undefined || !result) {
      console.log(help ?? "");
      return;
    }
    if (rawArgs.includes("--json")) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      if (result.reply !== undefined) process.stdout.write(`${sanitizeTerminalText(result.reply)}\n`);
      const status = result.status === "replied" ? agentResultText(language).replied(result.agent ?? "") : result.error?.message ?? "";
      process.stderr.write(`${sanitizeTerminalText(status)}\n`);
    }
    process.exitCode = result.exitCode;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }
}
