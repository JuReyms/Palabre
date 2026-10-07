/**
 * @file Adapter de session externe Claude Code (voir AGENTS.md, section "Relay externe").
 *
 * Sources lues, toutes sous `~/.claude` (racine injectable pour les tests) :
 * - `projects/<dossier encodé>/<session>.jsonl` : transcript, dossier de travail, preuve du nonce ;
 * - `sessions/<pid>.json` : registre des processus attachés (`sessionId`, `kind`, `status`).
 *
 * Reprise en lecture seule renforcée, vérifiée sur Claude Code 2.1.85 et 2.1.292 :
 * `-p --output-format stream-json --verbose --permission-mode plan --tools Read,Glob,Grep
 * --strict-mcp-config --settings {"disableAllHooks":true} --append-system-prompt <cadre opérateur>
 * --resume <session>`, sans `--model` : le modèle reste celui que la CLI retient. Le cadre
 * opérateur (décision D22) est un texte fixe, sans aucun contenu du message relayé. Ces formats ne sont pas documentés comme stables par le
 * fournisseur : toute ambiguïté est traitée prudemment (refus ou `unknown`).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractUsageLimitMessage } from "../adapters/cli-shared.js";
import { relayMessages } from "../messages/relay.js";
import type { ExternalSessionAdapter, LocateResult, ProviderVerdict } from "./adapter.js";
import { isSessionId } from "./envelope.js";
import { isUsableDirectory, pidLiveness, type ExternalProcessResult } from "./process.js";
import type {
  AttachedProcess,
  DeliveryEvidence,
  ExchangeInterpretation,
  ExternalTarget,
  Liveness,
  SessionIdentity,
  SessionRef,
  TargetProbe
} from "./types.js";

/** Options injectables ; les valeurs par défaut lisent l'installation de l'utilisateur. */
export interface ClaudeAdapterOptions {
  /** Racine `~/.claude`. */
  home?: string;
  /** Vivacité d'un PID ; `pidLiveness` par défaut. */
  liveness?: (pid: number) => Liveness;
  /**
   * Cadre opérateur fixe de la reprise (D22), dans la langue du relay ; le texte français par
   * défaut. Il ne doit jamais contenir de donnée issue du message relayé.
   */
  operatorFrame?: string;
}

type JsonObject = Record<string, unknown>;

/** Lit un flux JSONL en ignorant les lignes vides ou invalides. */
function parseJsonLines(text: string): JsonObject[] {
  const entries: JsonObject[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const value: unknown = JSON.parse(trimmed);
      if (value && typeof value === "object" && !Array.isArray(value)) entries.push(value as JsonObject);
    } catch {
      // Ligne tronquée ou bruit : ignorée.
    }
  }
  return entries;
}

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const asObject = (value: unknown): JsonObject | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined;

/** Arguments de reprise en lecture seule renforcée, hors exécutable. */
export function claudeResumeArgs(sessionId: string, operatorFrame: string): string[] {
  return [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "plan",
    "--tools", "Read,Glob,Grep",
    "--strict-mcp-config",
    "--settings", JSON.stringify({ disableAllHooks: true }),
    "--append-system-prompt", operatorFrame,
    "--resume", sessionId
  ];
}

/**
 * Identité de la session qui a répondu. Un échange en erreur ne fournit jamais d'identifiant
 * fiable : sur « No conversation found », Claude rapporte un identifiant neuf, sans lien avec la cible.
 */
function resolveIdentity(reported: readonly string[], targetSessionId: string, isError: boolean): SessionIdentity {
  const unique = [...new Set(reported)];
  if (isError || unique.length === 0) return "unavailable";
  if (unique.length > 1) return "mismatch";
  return unique[0] === targetSessionId ? "same-as-target" : "mismatch";
}

/**
 * Vrai si l'événement final a la forme vérifiée d'un succès (Claude Code 2.1.85 et 2.1.292) :
 * `subtype: "success"`, `is_error` strictement égal à `false` (un champ absent ou la chaîne
 * `"true"` ne suffisent pas) et une réponse textuelle non blanche.
 */
function isVerifiedSuccess(final: JsonObject): boolean {
  const result = asString(final.result);
  return final.subtype === "success" && final.is_error === false && result !== undefined && result.trim() !== "";
}

/**
 * Interprète le flux `stream-json` d'une reprise. Succès : exit 0, **un seul** événement `result`
 * de forme vérifiée (`isVerifiedSuccess`), puis identité vérifiée sur `system/init`, `assistant`
 * et `result`. La réponse rendue est le texte original, sans retouche. Toute autre forme est un
 * échec, sans réponse rendue. Les modèles observés viennent des réponses (`<synthetic>` exclu)
 * et de `modelUsage`.
 */
export function interpretClaudeOutput(stdout: string, exitCode: number | null, targetSessionId: string): ExchangeInterpretation {
  const events = parseJsonLines(stdout);
  const results = events.filter((event) => event.type === "result");
  const final = results.length === 1 ? results[0] : undefined;
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const finalResult = asString(final?.result);
  const isError = exitCode !== 0 || !final || !isVerifiedSuccess(final);
  const reported = [init, final, ...events.filter((event) => event.type === "assistant")]
    .map((event) => asString(event?.session_id))
    .filter((id): id is string => id !== undefined);
  const observed = new Set<string>();
  for (const event of events) {
    const model = event.type === "assistant" ? asString(asObject(event.message)?.model) : undefined;
    if (model && model !== "<synthetic>") observed.add(model);
  }
  for (const model of Object.keys(asObject(final?.modelUsage) ?? {})) observed.add(model);
  return {
    isError,
    reply: isError ? undefined : finalResult,
    identity: resolveIdentity(reported, targetSessionId, isError),
    reportedSessionIds: reported,
    observedModels: [...observed],
    errors: Array.isArray(final?.errors) ? final.errors.map(String) : []
  };
}

/** Texte d'un message de transcript (chaîne, ou blocs `{ text }`). */
function messageText(message: unknown): string {
  const content = asObject(message)?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => asString(asObject(part)?.text) ?? "").join("\n");
  return "";
}

/**
 * Cherche le nonce dans une entrée utilisateur, puis évalue la branche active (diagnostic).
 * Heuristique conforme aux observations, non documentée par le fournisseur : la branche active
 * part de la dernière entrée `user` ou `assistant` hors `isSidechain`, et remonte par
 * `parentUuid`, ou `logicalParentUuid` après une compaction. Une chaîne incomplète donne `unknown`.
 */
export function findNonceInClaudeTranscript(content: string, nonce: string): DeliveryEvidence {
  const entries = parseJsonLines(content).filter((entry) => typeof entry.uuid === "string");
  const byUuid = new Map(entries.map((entry) => [entry.uuid as string, entry]));
  const hit = entries.find((entry) => entry.type === "user" && messageText(entry.message).includes(nonce));
  if (!hit) return { persisted: false, inActiveBranch: "unknown", detail: "nonce absent du transcript" };

  const leaf = [...entries].reverse().find((entry) => (entry.type === "user" || entry.type === "assistant") && entry.isSidechain !== true);
  let cursor: JsonObject | undefined = leaf;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.uuid as string)) {
    if (cursor.uuid === hit.uuid) return { persisted: true, inActiveBranch: true, detail: "nonce sur la branche active" };
    seen.add(cursor.uuid as string);
    const parent = asString(cursor.parentUuid) ?? asString(cursor.logicalParentUuid);
    if (!parent) return { persisted: true, inActiveBranch: false, detail: "nonce hors de la branche active" };
    cursor = byUuid.get(parent);
    if (!cursor) return { persisted: true, inActiveBranch: "unknown", detail: "chaîne parentUuid incomplète" };
  }
  return { persisted: true, inActiveBranch: "unknown", detail: "branche active indéterminée" };
}

/**
 * Sonde du registre `sessions/<pid>.json` :
 * - une entrée vivante pour la session donne `attached`, quel que soit son `status` ;
 * - un PID mort est ignoré ;
 * - un PID invérifiable, une entrée illisible, une entrée sans `sessionId` valide (`{}`,
 *   `{ pid }`, `sessionId: null`…) ou un registre absent donnent `unknown` ;
 * - `activity` reflète le `status` déclaré (`busy`, `idle`), pour diagnostic.
 */
export function probeClaudeRegistry(sessionId: string, dir: string, liveness: (pid: number) => Liveness): TargetProbe {
  const evidence: string[] = [];
  const processes: Array<AttachedProcess & { status?: string }> = [];
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => /^\d+\.json$/.test(name));
  } catch {
    return { attachment: "unknown", activity: "unknown", processes: [], evidence: ["registre Claude absent ou illisible"] };
  }
  let unreadable = 0;
  for (const name of names) {
    let entry: JsonObject | undefined;
    try {
      entry = asObject(JSON.parse(readFileSync(path.join(dir, name), "utf8")));
    } catch {
      entry = undefined;
    }
    // Une entrée n'est écartée comme « autre session » que si sa session est un identifiant valide
    // et différent. Sans session déterminable, elle peut appartenir à la cible : invérifiable.
    const entrySession = asString(entry?.sessionId);
    if (!entry || entrySession === undefined || !isSessionId(entrySession)) {
      unreadable++;
      continue;
    }
    if (entrySession.toLowerCase() !== sessionId.toLowerCase()) continue;
    const pid = Number(entry.pid ?? name.slice(0, -".json".length));
    const item = { pid, liveness: liveness(pid), kind: asString(entry.kind), status: asString(entry.status) };
    processes.push(item);
    evidence.push(`pid ${pid} ${item.liveness}, kind=${item.kind ?? "?"}, status=${item.status ?? "absent"}`);
  }
  // Une entrée illisible ou incomplète peut appartenir à la cible : l'attachement devient invérifiable.
  if (unreadable > 0) evidence.push(`${unreadable} entrée(s) de registre illisible(s) ou sans session déterminable`);
  const alive = processes.filter((item) => item.liveness === "alive");
  const attachment = alive.length > 0
    ? "attached"
    : processes.some((item) => item.liveness === "unverifiable") || unreadable > 0 ? "unknown" : "detached";
  const activity = alive.some((item) => item.status === "busy")
    ? "busy"
    : alive.length > 0 && alive.every((item) => item.status === "idle") ? "idle" : "unknown";
  return {
    attachment,
    activity,
    processes: processes.map(({ pid, liveness: state, kind }) => ({ pid, liveness: state, kind })),
    evidence
  };
}

/** Adapter Claude Code. */
export class ClaudeSessionAdapter implements ExternalSessionAdapter {
  readonly provider = "claude" as const;
  private readonly home: string;
  private readonly liveness: (pid: number) => Liveness;
  private readonly operatorFrame: string;

  constructor(options: ClaudeAdapterOptions = {}) {
    this.home = options.home ?? path.join(os.homedir(), ".claude");
    this.liveness = options.liveness ?? ((pid) => pidLiveness(pid));
    this.operatorFrame = options.operatorFrame ?? relayMessages.fr.operatorFrame;
  }

  /** Transcripts portant l'identifiant, dans tous les dossiers de projet. */
  private transcripts(sessionId: string): string[] {
    if (!isSessionId(sessionId)) return [];
    const root = path.join(this.home, "projects");
    let projects: string[];
    try {
      projects = readdirSync(root);
    } catch {
      return [];
    }
    return projects
      .map((project) => path.join(root, project, `${sessionId}.jsonl`))
      .filter((candidate) => existsSync(candidate));
  }

  /**
   * Le dossier de travail est le `cwd` de la première entrée qui en porte un : celui de la session
   * d'origine, qui détermine le dossier de projet du transcript. Une reprise lancée ailleurs
   * (Claude Code 2.1.292) ajoute des entrées avec un autre `cwd` : elles sont signalées, pas suivies.
   * Plusieurs transcripts pour un même identifiant sont refusés comme ambigus.
   */
  locate(ref: SessionRef): LocateResult {
    const found = this.transcripts(ref.sessionId);
    if (found.length === 0) return { status: "session-not-found", detail: "aucun transcript Claude pour cette session" };
    if (found.length > 1) return { status: "session-not-found", detail: `${found.length} transcripts pour cette session : cible ambiguë` };
    const historyPath = found[0]!;
    let entries: JsonObject[];
    try {
      entries = parseJsonLines(readFileSync(historyPath, "utf8"));
    } catch {
      return { status: "session-not-found", detail: "transcript Claude illisible" };
    }
    const cwds = [...new Set(entries.map((entry) => asString(entry.cwd)).filter((cwd): cwd is string => !!cwd))];
    const cwd = cwds[0];
    if (!cwd) return { status: "invalid-working-directory", detail: "aucun dossier de travail dans le transcript" };
    if (!isUsableDirectory(cwd)) return { status: "invalid-working-directory", detail: "dossier de travail de la session introuvable" };
    const evidence = cwds.length > 1 ? [`${cwds.length} dossiers de travail dans le transcript ; dossier d'origine retenu`] : [];
    return { status: "found", target: { agent: ref.agent, provider: "claude", sessionId: ref.sessionId, cwd }, historyPath, evidence };
  }

  probe(target: ExternalTarget): TargetProbe {
    return probeClaudeRegistry(target.sessionId, path.join(this.home, "sessions"), this.liveness);
  }

  resumeArgs(target: ExternalTarget): string[] {
    return claudeResumeArgs(target.sessionId, this.operatorFrame);
  }

  /**
   * Refus certain : « No conversation found », observé sans écriture. Limite d'usage : motifs
   * partagés avec les adapters CLI, cherchés sur stderr, les erreurs et le résultat d'un échec.
   */
  interpret(run: ExternalProcessResult, target: ExternalTarget): ProviderVerdict {
    const interpretation = interpretClaudeOutput(run.stdout, run.exitCode, target.sessionId);
    const certainRefusal = interpretation.isError && interpretation.errors.some((error) => error.startsWith("No conversation found"))
      ? "session-not-found" as const
      : undefined;
    const failureText = interpretation.isError
      ? [run.stderr, ...interpretation.errors, ...resultTextOnError(run.stdout)].join("\n")
      : "";
    return { interpretation, certainRefusal, usageLimit: extractUsageLimitMessage(failureText) !== undefined };
  }

  findNonce(target: ExternalTarget, nonce: string): DeliveryEvidence {
    const found = this.transcripts(target.sessionId);
    if (found.length !== 1) return { persisted: "unknown", inActiveBranch: "unknown", detail: "transcript introuvable ou ambigu" };
    try {
      return findNonceInClaudeTranscript(readFileSync(found[0]!, "utf8"), nonce);
    } catch {
      return { persisted: "unknown", inActiveBranch: "unknown", detail: "transcript illisible" };
    }
  }
}

/**
 * Textes `result` d'un échange déjà jugé en échec (Claude y place parfois le diagnostic de
 * quota). Appelé seulement quand l'interprétation est en erreur : quel que soit `is_error`, ces
 * textes ne sont jamais rendus comme réponse.
 */
function resultTextOnError(stdout: string): string[] {
  return parseJsonLines(stdout)
    .filter((event) => event.type === "result")
    .map((event) => asString(event.result))
    .filter((text): text is string => text !== undefined);
}
