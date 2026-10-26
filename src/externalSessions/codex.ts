/**
 * @file Adapter de session externe Codex (voir docs/dev/relay.md, section "Relay externe").
 *
 * Sources lues, toutes sous `~/.codex` (racine injectable pour les tests) :
 * - `sessions/**` et `archived_sessions/**` : rollout `rollout-*-<session>.jsonl`, dont la
 *   première entrée `session_meta` donne l'identifiant et le dossier de travail, et dont le dernier
 *   `turn_context` donne le modèle enregistré ;
 * - `thread-writer-locks/<session>.lock` : verrou tenu par l'écrivain de la conversation.
 *
 * Reprise vérifiée sur Codex CLI 0.151.0 :
 * `exec resume <neutralisation MCP> --json --skip-git-repo-check --disable memories
 * --disable hooks -c notify=[] [-m <modèle enregistré>] -c sandbox_mode="read-only"
 * -c approval_policy="never" <session> -`, avec le message sur stdin.
 *
 * L'étape préalable (`prepare`) liste les serveurs MCP déclarés en config, dans le dossier de la
 * cible, et refuse tout envoi si la liste n'est pas strictement conforme. Ces formats ne sont pas
 * documentés comme stables : toute ambiguïté est traitée prudemment (refus ou `unknown`).
 */
import { closeSync, constants, existsSync, openSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { extractUsageLimitMessage } from "../adapters/cli-shared.js";
import { PREPARATION_LIMITS, type ExternalSessionAdapter, type LocateResult, type PreparationResult, type PreparationRunner, type ProviderVerdict } from "./adapter.js";
import { isSessionId } from "./envelope.js";
import { codexWindowsEnvironment } from "./codexWindowsEnvironment.js";
import type { PreLaunchRefusal } from "./outcome.js";
import { isUsableDirectory, type ExternalProcessResult } from "./process.js";
import type { DeliveryEvidence, ExchangeInterpretation, ExternalTarget, SessionIdentity, SessionRef, TargetProbe } from "./types.js";

/** Options injectables ; les valeurs par défaut lisent l'installation de l'utilisateur. */
export interface CodexAdapterOptions {
  /** Racine `~/.codex`. */
  home?: string;
  /** Sonde du verrou ; `exclusiveOpenProbe` par défaut. */
  lockProbe?: (file: string) => LockProbe;
}

/** État d'un fichier de verrou ; `held` est absent quand la vérification est impossible. */
export interface LockProbe {
  exists: boolean;
  held?: boolean;
  code?: string;
}

/** Résultat minimal injectable de la sonde Python POSIX. */
export interface PosixFlockRun {
  status: number | null;
  errorCode?: string;
  signal?: NodeJS.Signals | null;
}

export type PosixFlockRunner = (file: string) => PosixFlockRun;

type JsonObject = Record<string, unknown>;

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

/** Options de neutralisation présentes dans toute liste MCP comme dans toute reprise. */
const NEUTRALIZATION_BASE = ["--disable", "plugins", "--disable", "apps"] as const;

/** Clé TOML nue : seule forme acceptée pour composer `mcp_servers.<nom>.enabled=false`. */
const BARE_TOML_KEY = /^[A-Za-z0-9_-]+$/;

/** Modèle repris tel quel : texte court, sans caractère de contrôle. */
const RECORDED_MODEL = /^[^\u0000-\u001f\u007f]{1,200}$/;

/**
 * Valide strictement la sortie de `codex mcp list --json` : un tableau d'objets, chacun avec un
 * `name` de type chaîne, non vide et exprimable en clé TOML nue. Les noms sont dédoublonnés.
 * @returns Les noms, ou `undefined` si la sortie n'est pas conforme (`[{}]`, `[{"name":42}]`…).
 */
export function parseMcpServerNames(stdout: string): string[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const names: string[] = [];
  for (const entry of parsed) {
    const name = asObject(entry)?.name;
    if (typeof name !== "string" || !BARE_TOML_KEY.test(name)) return undefined;
    names.push(name);
  }
  return [...new Set(names)];
}

/** Arguments de neutralisation à insérer dans la reprise, pour les serveurs listés. */
export function mcpNeutralizationArgs(names: readonly string[]): string[] {
  return [...NEUTRALIZATION_BASE, ...names.flatMap((name) => ["-c", `mcp_servers.${name}.enabled=false`])];
}

/**
 * Arguments complets de la reprise. `neutralization` doit commencer par `--disable plugins
 * --disable apps` : une reprise sans neutralisation est une erreur de programmation.
 */
export function codexResumeArgs(sessionId: string, neutralization: readonly string[], model?: string): string[] {
  if (!NEUTRALIZATION_BASE.every((arg, index) => neutralization[index] === arg)) {
    throw new Error("Reprise Codex refusée : neutralisation MCP absente.");
  }
  return [
    "exec", "resume",
    ...neutralization,
    "--json",
    "--skip-git-repo-check",
    "--disable", "memories",
    "--disable", "hooks",
    "-c", "notify=[]",
    ...(model ? ["-m", model] : []),
    // `exec resume` n'expose pas `-s/--sandbox` : la politique passe par `-c`.
    "-c", "sandbox_mode=\"read-only\"",
    "-c", "approval_policy=\"never\"",
    sessionId,
    "-"
  ];
}

/** Même politique que la reprise, sans `resume` ni identifiant ni sélection `--last`. */
export function codexCreateArgs(neutralization: readonly string[]): string[] {
  const args = codexResumeArgs("", neutralization);
  return ["exec", ...args.slice(2, -2), "-"];
}

function resolveIdentity(reported: readonly string[], targetSessionId: string, isError: boolean): SessionIdentity {
  const unique = [...new Set(reported.map((id) => id.toLowerCase()))];
  if (isError || unique.length === 0) return "unavailable";
  if (unique.length > 1) return "mismatch";
  return unique[0] === targetSessionId.toLowerCase() ? "same-as-target" : "mismatch";
}

/**
 * Lancement de commande refusé par Windows avant toute exécution du shell, dans la forme observée
 * avec Codex 0.163.0. Ne jamais chercher ce signal dans la prose du modèle, dans la sortie d'une
 * commande réussie ou dans les outils MCP.
 */
function isRefusedLaunch(item: JsonObject): boolean {
  return item.status === "failed" && item.exit_code === -1 && typeof item.aggregated_output === "string"
    && /^(?:Failed to create unified exec process: |windows sandbox failed: )CreateProcessAsUserW failed: 5(?:\s|\()/u.test(item.aggregated_output);
}

/**
 * Classe les lancements refusés d'après **la suite du même tour**, jamais d'après la réponse du
 * modèle (#173 ; essai réel #171). Seules les commandes postérieures au premier refus comptent :
 * l'essai a montré un agent qui se replie seul sur un autre shell après deux refus, puis lit ce
 * qui lui était demandé. Compter les refus sans regarder ce qui suit dégradait donc des relays
 * réussis, parfois à cause de refus étrangers à la demande.
 *
 * Une réussite doit aussi **précéder la réponse finale** (le dernier `agent_message`) : une
 * commande lancée après coup ne peut pas avoir nourri la réponse, qui serait alors plausible sans
 * aucune lecture (relecture indépendante de #174). Les refus, eux, sont comptés sur tout le tour.
 *
 * Une commande n'est réussie que si elle est `completed` avec `exit_code: 0`. Un code entier non
 * nul est un échec ordinaire. Un statut inconnu, ou `completed` sans code entier, n'est pas
 * interprétable : sans autre réussite explicite, le repli est `unverified`. Une réussite explicite
 * donne toujours priorité à `partial`, même si un autre événement est ambigu.
 */
function diagnoseReadAccess(events: JsonObject[]): ExchangeInterpretation["readAccess"] {
  const items = events.map((event) => (event.type === "item.completed" ? asObject(event.item) : undefined));
  let replyIndex = -1;
  items.forEach((item, index) => { if (item?.type === "agent_message") replyIndex = index; });
  let failedCommands = 0;
  let succeededCommands = 0;
  let uninterpretable = 0;
  items.forEach((item, index) => {
    if (item?.type !== "command_execution") return;
    if (isRefusedLaunch(item)) { failedCommands += 1; return; }
    // Avant le premier refus, une réussite ne prouve rien sur ce qui a suivi ; après la réponse,
    // elle ne l'a pas nourrie. Sans réponse, tout le tour reste examiné.
    if (failedCommands === 0 || (replyIndex >= 0 && index > replyIndex)) return;
    if (item.status === "completed") {
      if (item.exit_code === 0) succeededCommands += 1;
      else if (!Number.isInteger(item.exit_code)) uninterpretable += 1;
    } else if (item.status !== "failed") uninterpretable += 1;
  });
  if (failedCommands === 0) return undefined;
  const reason = "windows-process-access-denied" as const;
  if (succeededCommands > 0) return { status: "partial", reason, failedCommands, succeededCommands };
  if (uninterpretable > 0) return { status: "unverified", reason, failedCommands };
  return { status: "blocked", reason, failedCommands };
}

/**
 * Interprète le flux `codex exec --json`. Succès : exit 0, exactement un `turn.completed`, aucun
 * `turn.failed` ni `error`, et un dernier `agent_message` textuel non blanc, rendu tel quel.
 * L'identité est vérifiée sur `thread.started`. Toute autre forme est un échec, sans réponse.
 *
 * Les lancements de commandes refusés par Windows sont comptés à part, dans `readAccess` : ils
 * ne changent ni `isError`, ni la réponse, ni l'identité.
 */
export function interpretCodexOutput(stdout: string, exitCode: number | null, targetSessionId: string): ExchangeInterpretation {
  const events = parseJsonLines(stdout);
  const reported = events
    .filter((event) => event.type === "thread.started")
    .map((event) => asString(event.thread_id))
    .filter((id): id is string => id !== undefined);
  const messages = events
    .map((event) => (event.type === "item.completed" ? asObject(event.item) : undefined))
    .filter((item): item is JsonObject => item?.type === "agent_message");
  const lastText = messages.length > 0 ? asString(messages[messages.length - 1]!.text) : undefined;
  const failed = events.some((event) => event.type === "turn.failed" || event.type === "error");
  const completed = events.filter((event) => event.type === "turn.completed").length;
  const isError = exitCode !== 0 || failed || completed !== 1 || lastText === undefined || lastText.trim() === "";
  const errors = events
    .filter((event) => event.type === "error" || event.type === "turn.failed")
    .map((event) => asString(event.message) ?? asString(asObject(event.error)?.message) ?? "");
  const readAccess = diagnoseReadAccess(events);
  return {
    ...(readAccess ? { readAccess } : {}),
    isError,
    reply: isError ? undefined : lastText,
    identity: resolveIdentity(reported, targetSessionId, isError),
    reportedSessionIds: reported,
    observedModels: [],
    errors
  };
}

/**
 * Lien d'ouverture d'une conversation locale dans Codex Desktop (lien profond documenté par
 * OpenAI). Une conversation créée par `codex exec` (`source: exec`) est absente de la liste de
 * Desktop, mais ce lien l'ouvre avec son historique : essai Windows de l'issue #179, Desktop
 * 26.1013.40934. Une fois ouverte, Desktop tient le verrou : Relay ne la joint plus qu'avec
 * `--open`, avec les permissions de Desktop. `undefined` si l'identifiant n'est pas un UUID.
 */
export function codexDesktopThreadLink(sessionId: string): string | undefined {
  return isSessionId(sessionId) ? `codex://threads/${sessionId.toLowerCase()}` : undefined;
}

/**
 * Le rollout Codex a un seul écrivain et reste linéaire dans les cas observés : un nonce trouvé
 * dans un message utilisateur est considéré sur la branche active.
 */
export function findNonceInCodexRollout(content: string, nonce: string): DeliveryEvidence {
  for (const entry of parseJsonLines(content)) {
    const payload = asObject(entry.payload);
    if (entry.type !== "response_item" || payload?.type !== "message" || payload.role !== "user") continue;
    const parts = Array.isArray(payload.content) ? payload.content : [];
    const text = parts.map((part) => asString(asObject(part)?.text) ?? "").join("\n");
    if (text.includes(nonce)) return { persisted: true, inActiveBranch: true, detail: "nonce dans un message utilisateur du rollout" };
  }
  return { persisted: false, inActiveBranch: "unknown", detail: "nonce absent du rollout" };
}

const POSIX_FLOCK_SCRIPT = [
  "import errno, fcntl, os, sys",
  "try:",
  "    fd = os.open(sys.argv[1], os.O_RDWR)",
  "except FileNotFoundError:",
  "    raise SystemExit(3)",
  "except OSError:",
  "    raise SystemExit(4)",
  "try:",
  "    try:",
  "        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)",
  "    except BlockingIOError as error:",
  "        if error.errno in (errno.EACCES, errno.EAGAIN, errno.EWOULDBLOCK):",
  "            raise SystemExit(2)",
  "        raise SystemExit(4)",
  "    except OSError:",
  "        raise SystemExit(4)",
  "    else:",
  "        fcntl.flock(fd, fcntl.LOCK_UN)",
  "finally:",
  "    os.close(fd)"
].join("\n");

/** Lance le probe POSIX borné, sans shell et sans lire le contenu du verrou. */
function runPosixFlock(file: string): PosixFlockRun {
  const result = spawnSync("python3", ["-c", POSIX_FLOCK_SCRIPT, file], {
    stdio: "ignore",
    shell: false,
    timeout: 2_000,
    killSignal: "SIGKILL",
    windowsHide: true
  });
  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  return {
    status: result.status,
    ...(errorCode ? { errorCode } : {}),
    signal: result.signal
  };
}

/**
 * Test POSIX réel avec `flock(LOCK_EX | LOCK_NB)` via Python 3. Les codes du script sont privés et
 * stables : 0 libre, 2 tenu, 3 disparu, 4 erreur. Tout outil absent, timeout, signal ou résultat
 * ambigu reste `unknown` ; l'appelant refuse alors par prudence.
 */
export function posixFlockProbe(file: string, run: PosixFlockRunner = runPosixFlock): LockProbe {
  if (!existsSync(file)) return { exists: false };
  const result = run(file);
  if (result.errorCode === "ENOENT") return { exists: true, code: "python3-unavailable" };
  if (result.errorCode === "ETIMEDOUT") return { exists: true, code: "posix-flock-timeout" };
  if (result.errorCode || result.signal) return { exists: true, code: "posix-flock-failed" };
  if (result.status === 0) return { exists: true, held: false };
  if (result.status === 2) return { exists: true, held: true };
  if (result.status === 3) return { exists: false };
  return { exists: true, code: "posix-flock-failed" };
}

/**
 * Test non destructif du verrou : sous Windows, un fichier ouvert par l'écrivain sans partage
 * refuse l'ouverture exclusive (`EBUSY`). Sur POSIX, le verrou consultatif est éprouvé par une
 * tentative `flock` non bloquante. Toute ambiguïté reste inconnue.
 */
export function exclusiveOpenProbe(file: string): LockProbe {
  if (!existsSync(file)) return { exists: false };
  if (process.platform !== "win32") return posixFlockProbe(file);
  // Node 22 n'expose pas `UV_FS_O_EXLOCK` dans `fs.constants` ; valeur libuv documentée.
  const exlock = (constants as Record<string, number>).UV_FS_O_EXLOCK ?? 0x10000000;
  try {
    closeSync(openSync(file, constants.O_RDONLY | exlock));
    return { exists: true, held: false };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { exists: false };
    return { exists: true, held: code === "EBUSY" ? true : undefined, code };
  }
}

/**
 * Attachement déduit du verrou d'écriture :
 * - absent, ou présent mais libre (verrou laissé après un kill) : `detached` ;
 * - tenu : `attached` ;
 * - invérifiable (plateforme, code inattendu) : `unknown`.
 * Le verrou ne dit rien de l'activité : `activity` reste `unknown`.
 */
export function probeCodexLock(lock: LockProbe): TargetProbe {
  const evidence = [`verrou d'écriture ${lock.exists ? "présent" : "absent"}, tenu=${lock.held ?? "inconnu"}${lock.code ? ` (${lock.code})` : ""}`];
  const attachment = !lock.exists || lock.held === false ? "detached" : lock.held === true ? "attached" : "unknown";
  return { attachment, activity: "unknown", processes: [], evidence };
}

/**
 * Rollouts `rollout-*-<session>.jsonl` sous `<home>/sessions/**` et `<home>/archived_sessions/**`.
 * Un identifiant invalide ne désigne aucun fichier. Partagé par Relay A et par la localisation
 * bornée de B1 ; plusieurs résultats signifient une cible ambiguë, refusée par les appelants.
 */
export function findCodexRollouts(home: string, sessionId: string): string[] {
  if (!isSessionId(sessionId)) return [];
  const suffix = `-${sessionId.toLowerCase()}.jsonl`;
  const found: string[] = [];
  for (const root of [path.join(home, "sessions"), path.join(home, "archived_sessions")]) {
    let entries: string[];
    try {
      entries = readdirSync(root, { recursive: true }) as string[];
    } catch {
      continue;
    }
    for (const entry of entries) {
      const name = path.basename(entry).toLowerCase();
      if (name.startsWith("rollout-") && name.endsWith(suffix)) found.push(path.join(root, entry));
    }
  }
  return found;
}

/** Refus de l'étape préalable selon l'échec de lancement de `codex mcp list`. */
function preparationLaunchRefusal(run: ExternalProcessResult): PreLaunchRefusal {
  if (run.stopReason === "cancelled") return { status: "cancelled" };
  if (run.launchFailure === "invalid-working-directory") return { status: "invalid-request", reason: "invalid-working-directory" };
  if (run.launchFailure === "command-not-found") return { status: "command-not-found" };
  return { status: "neutralization-failed" };
}

/** Adapter Codex. */
export class CodexSessionAdapter implements ExternalSessionAdapter {
  readonly provider = "codex" as const;
  /** Évite seulement l'alias PowerShell Store confirmé ; les permissions restent inchangées. */
  environment(source: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return codexWindowsEnvironment(source);
  }
  private readonly home: string;
  private readonly lockProbe: (file: string) => LockProbe;

  constructor(options: CodexAdapterOptions = {}) {
    this.home = options.home ?? path.join(os.homedir(), ".codex");
    this.lockProbe = options.lockProbe ?? exclusiveOpenProbe;
  }

  /** Rollouts portant l'identifiant, dans les sessions actives et archivées. */
  private rollouts(sessionId: string): string[] {
    return findCodexRollouts(this.home, sessionId);
  }

  /**
   * Localise le rollout. La première entrée doit être un `session_meta` dont l'identifiant égale
   * la session : sinon le rollout est incohérent et refusé. Le dossier de travail est
   * `session_meta.cwd` ; le modèle est celui du dernier `turn_context`, repris pour éviter un
   * changement de modèle dans l'historique de la cible. Sans modèle enregistré, `-m` est omis.
   */
  locate(ref: SessionRef): LocateResult {
    const found = this.rollouts(ref.sessionId);
    if (found.length === 0) return { status: "session-not-found", detail: "aucun rollout Codex pour cette session" };
    if (found.length > 1) return { status: "session-not-found", detail: `${found.length} rollouts pour cette session : cible ambiguë` };
    const historyPath = found[0]!;
    let entries: JsonObject[];
    try {
      entries = parseJsonLines(readFileSync(historyPath, "utf8"));
    } catch {
      return { status: "session-not-found", detail: "rollout Codex illisible" };
    }
    const meta = entries[0]?.type === "session_meta" ? asObject(entries[0].payload) : undefined;
    if (asString(meta?.id)?.toLowerCase() !== ref.sessionId.toLowerCase()) {
      return { status: "session-not-found", detail: "rollout incohérent : session_meta absent ou d'une autre session" };
    }
    const cwd = asString(meta?.cwd);
    if (!cwd) return { status: "invalid-working-directory", detail: "aucun dossier de travail dans session_meta" };
    if (!isUsableDirectory(cwd)) return { status: "invalid-working-directory", detail: "dossier de travail de la session introuvable" };
    const contexts = entries.filter((entry) => entry.type === "turn_context");
    const recorded = asString(asObject(contexts[contexts.length - 1]?.payload)?.model);
    const model = recorded !== undefined && RECORDED_MODEL.test(recorded) ? recorded : undefined;
    const evidence = model ? [] : ["modèle non enregistré ou non conforme : Codex utilisera son modèle par défaut"];
    return {
      status: "found",
      target: { agent: ref.agent, provider: "codex", sessionId: ref.sessionId, cwd, ...(model ? { model } : {}) },
      historyPath,
      evidence
    };
  }

  probe(target: ExternalTarget): TargetProbe {
    return probeCodexLock(this.lockProbe(path.join(this.home, "thread-writer-locks", `${target.sessionId}.lock`)));
  }

  /**
   * Liste les serveurs MCP déclarés en config avec `codex mcp list --json --disable plugins
   * --disable apps`, dans le dossier de la cible (la couche projet en dépend). Tout échec, ou une
   * liste non conforme, refuse l'envoi : sans liste fiable, rien ne garantit qu'aucun serveur ne
   * démarrera. Garantie conditionnelle : la config ne doit pas changer d'ici la reprise.
   */
  async prepare(_target: ExternalTarget, run: PreparationRunner): Promise<PreparationResult> {
    const listed = await run(["mcp", "list", "--json", ...NEUTRALIZATION_BASE], PREPARATION_LIMITS);
    if (!listed.started) return { status: "refused", refusal: preparationLaunchRefusal(listed), detail: "liste MCP impossible à lancer" };
    if (listed.stopReason) {
      const refusal: PreLaunchRefusal = listed.stopReason === "cancelled" ? { status: "cancelled" } : { status: "neutralization-failed" };
      return { status: "refused", refusal, detail: `liste MCP interrompue (${listed.stopReason})` };
    }
    if (listed.exitCode !== 0) {
      return { status: "refused", refusal: { status: "neutralization-failed" }, detail: `liste MCP en échec (exit ${listed.exitCode})` };
    }
    const names = parseMcpServerNames(listed.stdout);
    if (!names) return { status: "refused", refusal: { status: "neutralization-failed" }, detail: "liste MCP non conforme" };
    return { status: "ready", args: mcpNeutralizationArgs(names), evidence: [`${names.length} serveur(s) MCP neutralisé(s)`] };
  }

  resumeArgs(target: ExternalTarget, preparation: readonly string[]): string[] {
    return codexResumeArgs(target.sessionId, preparation, target.model);
  }

  createArgs(_target: ExternalTarget, preparation: readonly string[]): string[] {
    return codexCreateArgs(preparation);
  }

  creationSessionId(line: string): string | undefined {
    const event = parseJsonLines(line)[0];
    const id = event?.type === "thread.started" ? asString(event.thread_id) : undefined;
    return id && isSessionId(id) ? id.toLowerCase() : undefined;
  }

  /**
   * Refus certains, observés sans écriture et seulement si aucun tour n'a commencé :
   * « already has an active writer » (course perdue contre un écrivain) et « no rollout found ».
   * Limite d'usage : motifs partagés avec les adapters CLI, sur stderr et les erreurs.
   */
  interpret(run: ExternalProcessResult, target: ExternalTarget): ProviderVerdict {
    const interpretation = interpretCodexOutput(run.stdout, run.exitCode, target.sessionId);
    const turnStarted = parseJsonLines(run.stdout).some((event) => event.type === "turn.started");
    let certainRefusal: ProviderVerdict["certainRefusal"];
    if (run.exitCode !== 0 && !turnStarted) {
      if (/already has an active writer/.test(run.stderr)) certainRefusal = "target-busy";
      else if (/no rollout found for thread id/.test(run.stderr)) certainRefusal = "session-not-found";
    }
    const failureText = interpretation.isError ? [run.stderr, ...interpretation.errors].join("\n") : "";
    return { interpretation, certainRefusal, usageLimit: extractUsageLimitMessage(failureText) !== undefined };
  }

  findNonce(target: ExternalTarget, nonce: string): DeliveryEvidence {
    const found = this.rollouts(target.sessionId);
    if (found.length !== 1) return { persisted: "unknown", inActiveBranch: "unknown", detail: "rollout introuvable ou ambigu" };
    try {
      return findNonceInCodexRollout(readFileSync(found[0]!, "utf8"), nonce);
    } catch {
      return { persisted: "unknown", inActiveBranch: "unknown", detail: "rollout illisible" };
    }
  }
}
