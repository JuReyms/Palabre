/**
 * @file Prototype isolé (issue #96) : adapters de reprise de sessions externes Codex et Claude Code.
 *
 * Ce module n'est importé par aucun code produit (`src/`). Il sert uniquement à vérifier la
 * faisabilité de `palabre relay` : reprise d'une session identifiée, envoi d'un message,
 * capture de la réponse finale, fork, sondes d'attachement de la cible et preuve de délivrance.
 *
 * Contrat commun : un appel = un message, une réponse, puis fin du processus. Aucune relance.
 * Lecture seule par défaut. Les identifiants de session ne sortent jamais de la machine :
 * ils sont seulement écrits dans les traces locales `.tmp/relay-probe/` (ignorées par git).
 *
 * Les fonctions d'interprétation (`interpret*Output`, `probe*`, `find*Nonce`, `classifyDelivery`)
 * sont pures ou paramétrables pour être testées sans appeler de vrai agent (`adapters.test.ts`).
 */
import { spawn, spawnSync } from "node:child_process";
import { closeSync, constants, existsSync, openSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------------------------
// Contrats
// ---------------------------------------------------------------------------------------------

/** Session externe explicitement identifiée. `cwd` est le dossier de travail de la session. */
export interface ExternalSession {
  agent: "codex" | "claude";
  sessionId: string;
  cwd: string;
}

/** Options d'un échange. */
export interface ExchangeOptions {
  /** Timeout dur ; à l'expiration, l'arbre de processus est tué. */
  timeoutMs: number;
  /** Interroge une copie de la session au lieu de l'originale. */
  fork?: boolean;
  /** Prototype seulement : tue l'arbre de processus N ms après le premier signal de démarrage. */
  killAfterStartMs?: number;
}

/**
 * Identité de la session dans laquelle la CLI a répondu, comparée à la cible :
 * - `same-as-target` : reprise réussie, tous les identifiants rapportés égalent la cible ;
 * - `new-session` : fork ou création réussis, un identifiant unique et différent de la cible ;
 * - `mismatch` : échange réussi mais identifiants incohérents avec l'opération demandée ;
 * - `unavailable` : échec, ou aucun identifiant fiable (ex. `session_id` d'un résultat `is_error`).
 */
export type SessionIdentity = "same-as-target" | "new-session" | "mismatch" | "unavailable";

/** Interprétation de la sortie d'une CLI, indépendante du processus qui l'a produite. */
export interface ExchangeInterpretation {
  /** `true` si la CLI signale un échec (exit non nul, `is_error`, `turn.failed`, sortie absente). */
  isError: boolean;
  reply?: string;
  /** Identifiant fiable de la session ayant répondu ; jamais renseigné quand `isError`. */
  effectiveSessionId?: string;
  identity: SessionIdentity;
  /** Identifiants bruts rapportés par la CLI, pour diagnostic seulement. */
  reportedSessionIds: string[];
  /** Modèle annoncé par la CLI au démarrage (Claude : `system/init.model`). */
  declaredModel?: string;
  /** Modèles réellement observés dans les réponses (Claude : `assistant.message.model`, `modelUsage`). */
  observedModels: string[];
  /** Messages d'erreur rapportés par la CLI. */
  errors: string[];
}

/** Résultat brut d'un échange, tel qu'observé depuis le processus de la CLI. */
export interface ExchangeResult extends ExchangeInterpretation {
  agent: ExternalSession["agent"];
  exitCode: number | null;
  /** Code d'erreur brut émis par le processus enfant (`ENOENT`, `EACCES`…). */
  spawnErrorCode?: string;
  /** Cause d'un lancement impossible (dossier, exécutable, autre) ; la CLI n'a jamais démarré. */
  launchFailure?: LaunchFailure;
  timedOut: boolean;
  killedByProbe: boolean;
  /** Premier signal machine indiquant que la CLI a démarré le tour (ms depuis le lancement). */
  startSignalMs?: number;
  startSignal?: string;
  durationMs: number;
  argv: string[];
  stdout: string;
  stderr: string;
}

/** Vivacité d'un PID : `unverifiable` quand le système ne permet pas de conclure. */
export type Liveness = "alive" | "dead" | "unverifiable";

/** Processus rattaché à une session (registre Claude). */
export interface AttachedProcess {
  pid: number;
  liveness: Liveness;
  status?: string;
  entrypoint?: string;
  kind?: string;
  version?: string;
}

/**
 * Sonde de la cible. `attachment` et `activity` sont indépendants :
 * - `attachment` : `attached` si au moins un processus vivant est rattaché à la session (ou si le
 *   verrou d'écriture est tenu), `detached` si la sonde a pu conclure qu'aucun ne l'est,
 *   `unknown` si la vérification est impossible ;
 * - `activity` : état déclaré par le fournisseur (`busy`/`idle`), `unknown` s'il n'est pas exposé.
 * Le contrôle produit ne doit lire que ces champs ; `evidence` sert seulement au diagnostic humain.
 */
export interface TargetProbe {
  attachment: "attached" | "detached" | "unknown";
  activity: "busy" | "idle" | "unknown";
  processes: AttachedProcess[];
  lock?: { exists: boolean; held?: boolean; code?: string };
  evidence: string[];
}

/** Décision d'envoi dérivée d'une sonde : seule une cible `detached` est relayable. */
export type TargetDecision =
  | { allowed: true }
  | { allowed: false; error: "target-busy" | "target-state-unknown" };

/** `target-busy` signifie « cible attachée à un processus », pas seulement « génération en cours ». */
export function assessTarget(probe: TargetProbe): TargetDecision {
  if (probe.attachment === "detached") return { allowed: true };
  return { allowed: false, error: probe.attachment === "attached" ? "target-busy" : "target-state-unknown" };
}

/**
 * Preuve de délivrance lue dans l'historique de la cible :
 * - `persisted` : le nonce figure dans une entrée utilisateur (`true`), n'y figure pas
 *   (`false`, ce qui ne prouve pas la non-délivrance), ou l'historique est illisible (`unknown`) ;
 * - `inActiveBranch` : l'entrée trouvée est-elle sur la branche que la prochaine reprise suivra ?
 */
export interface DeliveryEvidence {
  persisted: boolean | "unknown";
  inActiveBranch: boolean | "unknown";
  detail: string;
}

/** Contrat d'adapter de session externe ; l'orchestration ne doit dépendre que de ceci. */
export interface ExternalSessionAdapter {
  readonly agent: ExternalSession["agent"];
  /** Prototype seulement : crée une session jetable dans `cwd` et retourne son identifiant. */
  createThrowaway(cwd: string, prompt: string, timeoutMs: number): Promise<ExchangeResult>;
  /** Envoie un message à une session existante et capture la réponse finale. */
  send(target: ExternalSession, message: string, options: ExchangeOptions): Promise<ExchangeResult>;
  /** Cherche des preuves d'attachement et d'activité de la session cible. */
  probeTarget(target: ExternalSession): TargetProbe;
  /** Cherche le nonce d'une enveloppe dans l'historique de la cible. */
  findNonce(target: ExternalSession, nonce: string): DeliveryEvidence;
  /** Refus certain de la CLI, observé avant toute écriture ; `undefined` sinon. */
  certainRefusal(result: ExchangeResult): CertainRefusal | undefined;
}

/** Refus de CLI observés sans aucune écriture dans l'historique de la cible. */
export type CertainRefusal = "target-busy" | "session-not-found";

/**
 * Issue d'un relay et code de sortie associé. Toute issue autre que `replied` sort en non nul :
 * 1 erreur interne, 2 échec CLI ou réponse invalide, 3 refus avant envoi (cible attachée, état
 * invérifiable, neutralisation impossible), 4 timeout, 5 identité incohérente, 6 session introuvable,
 * 7 exécutable de la CLI introuvable (distinct d'une erreur interne), 8 requête invalide (ici :
 * dossier de travail de la cible introuvable).
 */
export type RelayOutcomeKind =
  | "replied" | "target-busy" | "target-state-unknown" | "neutralization-failed" | "session-not-found"
  | "timeout" | "identity-mismatch" | "no-valid-reply" | "cli-failure" | "command-not-found" | "invalid-request";

export const RELAY_EXIT_CODES: Record<RelayOutcomeKind, number> = {
  "replied": 0,
  "cli-failure": 2,
  "no-valid-reply": 2,
  "target-busy": 3,
  "target-state-unknown": 3,
  "neutralization-failed": 3,
  "timeout": 4,
  "identity-mismatch": 5,
  "session-not-found": 6,
  "command-not-found": 7,
  "invalid-request": 8,
};

/**
 * Déduit l'issue d'un relay. Priorités : refus avant envoi (sonde, puis étape préalable),
 * échec de lancement diagnostiqué, timeout (y compris kill), refus certain de la CLI, puis
 * cohérence de l'identité et validité de la réponse.
 */
export function relayOutcome(input: {
  decision?: TargetDecision;
  preflightRefusal?: { kind: PreflightRefusalKind };
  result?: ExchangeResult;
  certainRefusal?: CertainRefusal;
}): { kind: RelayOutcomeKind; exitCode: number; reason?: "invalid-working-directory" } {
  const of = (kind: RelayOutcomeKind) => ({ kind, exitCode: RELAY_EXIT_CODES[kind] });
  const invalidWorkingDirectory = { ...of("invalid-request"), reason: "invalid-working-directory" as const };
  if (input.decision && !input.decision.allowed) return of(input.decision.error);
  if (input.preflightRefusal) {
    return input.preflightRefusal.kind === "invalid-working-directory" ? invalidWorkingDirectory : of(input.preflightRefusal.kind);
  }
  const result = input.result;
  if (!result) return of("cli-failure");
  if (result.launchFailure === "invalid-working-directory") return invalidWorkingDirectory;
  if (result.launchFailure === "command-not-found") return of("command-not-found");
  if (result.timedOut) return of("timeout");
  if (input.certainRefusal) return of(input.certainRefusal);
  if (!result.isError && result.reply !== undefined) {
    return result.identity === "same-as-target" || result.identity === "new-session" ? of("replied") : of("identity-mismatch");
  }
  if (result.identity === "mismatch") return of("identity-mismatch");
  return of(result.exitCode === 0 && !result.killedByProbe ? "no-valid-reply" : "cli-failure");
}

// ---------------------------------------------------------------------------------------------
// Processus
// ---------------------------------------------------------------------------------------------

/**
 * Variables héritées de l'hôte Claude Code (desktop ou CLI) à ne pas transmettre : elles
 * désignent la session de l'appelant (socket de messagerie, identifiant, session enfant).
 * Sans ce nettoyage, une CLI lancée par un agent pourrait se rattacher à la session appelante.
 */
const HOST_SESSION_ENV = /^(CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_PID|CLAUDE_AGENT_SDK_.*|CODEX_THREAD_ID|CODEX_SESSION_.*)$/;

export function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!HOST_SESSION_ENV.test(key)) env[key] = value;
  }
  return env;
}

/** Tue l'arbre de processus (les CLIs Windows lancent des enfants natifs). */
export function killTree(pid: number): void {
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* déjà terminé */ } }
  }
}

export interface RunSpec {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  killAfterStartMs?: number;
  /** Détecte, ligne par ligne sur stdout, le signal machine de démarrage du tour. */
  startSignal: (line: string) => string | undefined;
  /** Injection pour les tests ; `killTree` par défaut. */
  kill?: (pid: number) => void;
  /** Environnement ; `cleanEnv()` par défaut. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Échec de lancement diagnostiqué. `ENOENT` seul ne prouve pas l'absence de l'exécutable : Node
 * le renvoie aussi quand le dossier de travail n'existe pas.
 */
export type LaunchFailure = "invalid-working-directory" | "command-not-found" | "spawn-failed";

/** Vrai si `dir` désigne un dossier existant. */
export function isUsableDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Attribue une erreur de lancement à sa cause : dossier de travail d'abord, puis exécutable.
 * Un `ENOENT` avec un dossier et un exécutable présents (interpréteur manquant, par exemple)
 * reste un `spawn-failed`.
 */
export function diagnoseLaunchFailure(code: string | undefined, command: string, cwd: string): LaunchFailure {
  if (!isUsableDirectory(cwd)) return "invalid-working-directory";
  if (code !== "ENOENT") return "spawn-failed";
  const isPath = path.isAbsolute(command) || command.includes("/") || command.includes("\\");
  return isPath && existsSync(command) ? "spawn-failed" : "command-not-found";
}

export interface RunResult {
  exitCode: number | null;
  /** Code d'erreur brut émis par le processus enfant (`ENOENT`, `EACCES`…). */
  spawnErrorCode?: string;
  /** Cause d'un lancement impossible ; le processus n'a jamais démarré. */
  launchFailure?: LaunchFailure;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  killedByProbe: boolean;
  startSignalMs?: number;
  startSignal?: string;
  durationMs: number;
}

/**
 * Lance une CLI sans shell, message sur stdin, avec timeout dur et kill de l'arbre.
 *
 * Invariant : aucun kill n'est émis après la terminaison du processus. Les deux timers
 * (timeout dur et kill de prototype) sont annulés à `close`, et chacun vérifie `closed`
 * avant d'agir : un PID libéré puis réattribué ne doit jamais être tué.
 */
export function run(spec: RunSpec): Promise<RunResult> {
  const kill = spec.kill ?? killTree;
  return new Promise((resolve) => {
    const started = Date.now();
    // Aucun repli vers le dossier courant : un dossier absent est refusé avant tout lancement.
    if (!isUsableDirectory(spec.cwd)) {
      resolve({ exitCode: null, launchFailure: "invalid-working-directory", stdout: "", stderr: "", timedOut: false, killedByProbe: false, durationMs: 0 });
      return;
    }
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env ?? cleanEnv(),
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    let buffer = "";
    let timedOut = false;
    let killedByProbe = false;
    let closed = false;
    let startSignalMs: number | undefined;
    let startSignal: string | undefined;
    let spawnErrorCode: string | undefined;
    let probeKillTimer: NodeJS.Timeout | undefined;

    const hardTimer = setTimeout(() => {
      if (closed || child.pid === undefined) return;
      timedOut = true;
      kill(child.pid);
    }, spec.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (startSignalMs !== undefined) continue;
        const signal = spec.startSignal(line);
        if (!signal) continue;
        startSignalMs = Date.now() - started;
        startSignal = signal;
        if (spec.killAfterStartMs !== undefined) {
          probeKillTimer = setTimeout(() => {
            if (closed || child.pid === undefined) return;
            killedByProbe = true;
            kill(child.pid);
          }, spec.killAfterStartMs);
        }
      }
    });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnErrorCode ??= error.code ?? "unknown";
      stderr += `\n[spawn error] ${error.message}`;
    });
    child.on("close", (exitCode) => {
      closed = true;
      clearTimeout(hardTimer);
      if (probeKillTimer) clearTimeout(probeKillTimer);
      // Le dossier peut disparaître entre la vérification et le lancement : diagnostic a posteriori.
      const launchFailure = spawnErrorCode !== undefined && child.pid === undefined
        ? diagnoseLaunchFailure(spawnErrorCode, spec.command, spec.cwd)
        : undefined;
      resolve({ exitCode, spawnErrorCode, launchFailure, stdout, stderr, timedOut, killedByProbe, startSignalMs, startSignal, durationMs: Date.now() - started });
    });
    child.stdin.on("error", () => { /* processus terminé avant lecture de stdin */ });
    child.stdin.end(spec.stdin, "utf8");
  });
}

/** Vivacité d'un PID via le signal 0 : `ESRCH` = mort, `EPERM` = existe, autre = inconclusif. */
export function pidLiveness(pid: number, probe: (pid: number, signal: 0) => unknown = process.kill): Liveness {
  if (!Number.isInteger(pid) || pid <= 0) return "unverifiable";
  try {
    probe(pid, 0);
    return "alive";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return "dead";
    if (code === "EPERM") return "alive";
    return "unverifiable";
  }
}

function parseJsonLines(text: string): Array<Record<string, any>> {
  return text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return [];
    try { return [JSON.parse(trimmed)]; } catch { return []; }
  });
}

/** Compare les identifiants rapportés à la cible selon l'opération demandée. */
export function resolveIdentity(
  reported: string[],
  operation: "resume" | "fork" | "create",
  targetSessionId: string | undefined,
  isError: boolean,
): { identity: SessionIdentity; effectiveSessionId?: string } {
  const unique = [...new Set(reported.filter(Boolean))];
  if (isError || unique.length === 0) return { identity: "unavailable" };
  if (unique.length > 1) return { identity: "mismatch" };
  const [id] = unique;
  if (operation === "resume") {
    return id === targetSessionId ? { identity: "same-as-target", effectiveSessionId: id } : { identity: "mismatch" };
  }
  return id !== targetSessionId ? { identity: "new-session", effectiveSessionId: id } : { identity: "mismatch" };
}

/** Enveloppe minimale porteuse du nonce de délivrance. */
export function buildEnvelope(message: string, nonce: string, from?: string): string {
  return [`[Message relayé — palabre relay · réf. ${nonce}]`, ...(from ? [`De : ${from}`] : []), "", message].join("\n");
}

/**
 * Statut de délivrance d'un échange :
 * - `replied` : réponse capturée, identité cohérente ;
 * - `not-delivered` : refus certain avant tout envoi (contrôle Palabre ou refus CLI documenté) ;
 * - `persisted-no-reply` : le nonce est dans l'historique de la cible, sans réponse capturée ;
 * - `unknown` : échec sans preuve dans un sens ou dans l'autre (écriture différée, autre
 *   branche, historique illisible). L'absence du nonce ne prouve pas la non-délivrance.
 */
export type DeliveryStatus = "replied" | "not-delivered" | "persisted-no-reply" | "unknown";

export interface DeliveryVerdict {
  status: DeliveryStatus;
  persisted: boolean | "unknown";
  inActiveBranch: boolean | "unknown";
}

export function classifyDelivery(input: {
  refusedBeforeSend: boolean;
  certainCliRefusal?: boolean;
  result?: ExchangeInterpretation;
  evidence?: DeliveryEvidence;
}): DeliveryVerdict {
  // Sans preuve : rien n'a pu être écrit si la CLI n'a pas été lancée.
  const fallback = input.refusedBeforeSend ? false : "unknown";
  const persisted = input.evidence?.persisted ?? fallback;
  const inActiveBranch = input.evidence?.inActiveBranch ?? fallback;
  const ok = input.result && !input.result.isError && input.result.reply !== undefined && input.result.identity !== "mismatch" && input.result.identity !== "unavailable";
  // Une preuve de persistance l'emporte toujours sur un refus annoncé : jamais de « renvoi sans risque ».
  if (persisted === true) return { status: ok ? "replied" : "persisted-no-reply", persisted, inActiveBranch };
  if (input.refusedBeforeSend || input.certainCliRefusal) return { status: "not-delivered", persisted, inActiveBranch };
  if (ok) return { status: "replied", persisted, inActiveBranch };
  return { status: "unknown", persisted, inActiveBranch };
}

/**
 * Test non destructif : un fichier ouvert ailleurs sans partage refuse l'ouverture exclusive.
 * `held` reste indéfini quand la vérification est impossible (plateforme, code inattendu).
 */
export function exclusiveOpenProbe(file: string): { exists: boolean; held?: boolean; code?: string } {
  if (!existsSync(file)) return { exists: false };
  if (process.platform !== "win32") return { exists: true, code: "unsupported-platform" };
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

// ---------------------------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------------------------

/** Options d'isolation des sessions de test Codex. */
export interface CodexAdapterOptions {
  /**
   * Prototype : `--ignore-user-config` pour que les sessions jetables ne touchent ni mémoires ni
   * MCP de l'utilisateur. Un relay réel vers une session de travail devrait garder la config.
   */
  ignoreUserConfig: boolean;
  /**
   * Modèle explicite. Reprendre avec un modèle différent de celui enregistré ajoute un message
   * `<model_switch>` dans l'historique de la cible : un relay réel devrait réutiliser le modèle
   * enregistré par la session plutôt que celui de la config courante.
   */
  model?: string;
  /** `--disable hooks` : coupe tous les hooks (`[features] hooks`). */
  disableHooks?: boolean;
  /** `-c notify=[]` : neutralise la commande `notify` exécutée en fin de tour. */
  disableNotify?: boolean;
  /** Arguments supplémentaires (tests de hooks témoins). */
  extraArgs?: string[];
  /** Racine `~/.codex` ; injectable pour les tests. */
  home?: string;
  /** Lanceur explicite (tests : `node fake-cli.cjs`) ; résolu depuis le PATH par défaut. */
  launcher?: { command: string; prefix: string[] };
  /**
   * Neutralise les serveurs MCP avant la reprise : `--disable plugins --disable apps`, puis
   * `-c mcp_servers.<nom>.enabled=false` pour chaque serveur restant dans `codex mcp list --json`,
   * calculé dans le `cwd` de la cible (la couche projet en dépend) avec les mêmes `-c`.
   * `-c mcp_servers={}` ne suffit pas : la table vide est fusionnée, pas substituée.
   * Exige la config utilisateur : `codex mcp list` n'accepte pas `--ignore-user-config`, et
   * désactiver un serveur absent de la config crée une entrée partielle refusée au chargement.
   */
  neutralizeMcp?: boolean;
}

/**
 * Refus avant envoi : une étape préalable n'a pas pu être garantie. La CLI de reprise n'est
 * jamais lancée ; la délivrance est `not-delivered`.
 * - `neutralization-failed` : liste MCP invalide, illisible ou en échec ;
 * - `command-not-found` : l'exécutable de la CLI est introuvable dès l'inspection préalable ;
 * - `invalid-working-directory` : le dossier de travail de la cible n'existe pas.
 */
export type PreflightRefusalKind = "neutralization-failed" | "command-not-found" | "invalid-working-directory";

export class PreflightRefusal extends Error {
  readonly kind: PreflightRefusalKind;

  constructor(message: string, kind: PreflightRefusalKind = "neutralization-failed") {
    super(message);
    this.kind = kind;
  }
}

/** Clé TOML nue : seule forme acceptée pour composer `mcp_servers.<nom>.enabled=false`. */
const BARE_TOML_KEY = /^[A-Za-z0-9_-]+$/;

/**
 * Valide strictement la sortie de `codex mcp list --json` : un tableau d'objets, chacun avec un
 * `name` de type chaîne, non vide et exprimable en clé TOML nue. Toute autre forme lève
 * `PreflightRefusal` (ex. `[{}]`, `[{"name":42}]`, `[{"name":null}]`, `{}`, `[null]`) : sans
 * liste fiable, on ne peut pas garantir qu'aucun serveur ne démarrera.
 */
export function parseMcpServerNames(stdout: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new PreflightRefusal("liste MCP non JSON");
  }
  if (!Array.isArray(parsed)) throw new PreflightRefusal("liste MCP : un tableau est attendu");
  const names: string[] = [];
  parsed.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new PreflightRefusal(`liste MCP : l'entrée ${index} n'est pas un objet`);
    }
    const name = (entry as Record<string, unknown>).name;
    if (typeof name !== "string" || name.length === 0) {
      throw new PreflightRefusal(`liste MCP : l'entrée ${index} n'a pas de nom de type chaîne non vide`);
    }
    if (!BARE_TOML_KEY.test(name)) throw new PreflightRefusal(`liste MCP : nom non neutralisable « ${name} »`);
    names.push(name);
  });
  return [...new Set(names)];
}

/** Garde seulement les paires `-c clé=valeur`, seules options partagées avec `codex mcp list`. */
function configPairs(args: string[]): string[] {
  const pairs: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if ((args[index] === "-c" || args[index] === "--config") && args[index + 1] !== undefined) pairs.push("-c", args[++index]);
  }
  return pairs;
}

/** Résout `codex.js` derrière le shim npm Windows, pour lancer `node codex.js` sans shell. */
export function resolveCodexLauncher(): { command: string; prefix: string[] } {
  if (process.platform === "win32") {
    for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
      const candidate = path.join(dir.trim(), "node_modules", "@openai", "codex", "bin", "codex.js");
      if (dir.trim() && existsSync(candidate)) return { command: process.execPath, prefix: [candidate] };
    }
  }
  return { command: "codex", prefix: [] };
}

/** Interprète le flux `codex exec --json`. Succès = exit 0, `turn.completed`, pas de `turn.failed`. */
export function interpretCodexOutput(
  stdout: string,
  exitCode: number | null,
  operation: "resume" | "fork" | "create",
  targetSessionId?: string,
): ExchangeInterpretation {
  const events = parseJsonLines(stdout);
  const reported = events.filter((event) => event.type === "thread.started").map((event) => String(event.thread_id));
  const messages = events.filter((event) => event.type === "item.completed" && event.item?.type === "agent_message");
  const failed = events.some((event) => event.type === "turn.failed" || event.type === "error");
  const completed = events.some((event) => event.type === "turn.completed");
  const isError = exitCode !== 0 || failed || !completed || messages.length === 0;
  const errors = events
    .filter((event) => event.type === "error" || event.type === "turn.failed")
    .map((event) => String(event.message ?? event.error?.message ?? ""));
  return {
    isError,
    reply: isError ? undefined : messages.at(-1)?.item?.text,
    reportedSessionIds: reported,
    observedModels: [],
    errors,
    ...resolveIdentity(reported, operation, targetSessionId, isError),
  };
}

export class CodexAdapter implements ExternalSessionAdapter {
  readonly agent = "codex" as const;
  private readonly launcher: { command: string; prefix: string[] };
  private readonly options: CodexAdapterOptions;

  constructor(options: CodexAdapterOptions) {
    this.options = options;
    this.launcher = options.launcher ?? resolveCodexLauncher();
  }

  private get home(): string {
    return this.options.home ?? path.join(os.homedir(), ".codex");
  }

  /** Options communes : lecture seule et aucune approbation interactive possible. */
  private commonArgs(): string[] {
    return [
      "--json",
      "--skip-git-repo-check",
      ...(this.options.ignoreUserConfig ? ["--ignore-user-config"] : []),
      // Prototype : la fonctionnalité `memories` est active par défaut, même sans config utilisateur ;
      // on la coupe pour que les sessions jetables n'alimentent pas les mémoires Codex.
      "--disable", "memories",
      ...(this.options.disableHooks ? ["--disable", "hooks"] : []),
      ...(this.options.disableNotify ? ["-c", "notify=[]"] : []),
      ...(this.options.model ? ["-m", this.options.model] : []),
      // `codex exec resume` n'expose pas `-s/--sandbox` : la politique passe par `-c`.
      "-c", 'sandbox_mode="read-only"',
      "-c", 'approval_policy="never"',
      ...(this.options.extraArgs ?? []),
    ];
  }

  /**
   * Arguments de neutralisation MCP pour le dossier `cwd`. Lève une erreur si la liste est
   * illisible ou si un nom ne peut pas être exprimé comme clé TOML nue : le relay doit alors
   * être refusé plutôt que lancé avec des serveurs actifs.
   */
  mcpNeutralizationArgs(cwd: string): string[] {
    if (this.options.ignoreUserConfig) {
      throw new PreflightRefusal("neutralizeMcp exige la config utilisateur (codex mcp list ne peut pas l'ignorer)");
    }
    // La couche de config projet dépend du `cwd` : sans dossier, la liste ne serait pas celle de la cible.
    if (!isUsableDirectory(cwd)) throw new PreflightRefusal("dossier de travail de la cible introuvable", "invalid-working-directory");
    const base = ["--disable", "plugins", "--disable", "apps"];
    const listed = spawnSync(this.launcher.command, [...this.launcher.prefix, "mcp", "list", "--json", ...base, ...configPairs(this.options.extraArgs ?? [])], {
      cwd, env: cleanEnv(), encoding: "utf8", timeout: 60_000, windowsHide: true,
    });
    if (listed.error) {
      const failure = diagnoseLaunchFailure((listed.error as NodeJS.ErrnoException).code, this.launcher.command, cwd);
      const kind = failure === "spawn-failed" ? "neutralization-failed" : failure;
      throw new PreflightRefusal(`liste MCP impossible : ${listed.error.message}`, kind);
    }
    if (listed.status !== 0) {
      throw new PreflightRefusal(`liste MCP illisible (exit ${listed.status}) : ${(listed.stderr ?? "").trim().split(/\r?\n/).at(-1) ?? ""}`);
    }
    const names = parseMcpServerNames(listed.stdout);
    return [...base, ...names.flatMap((name) => ["-c", `mcp_servers.${name}.enabled=false`])];
  }

  private async exchange(
    args: string[], cwd: string, message: string, options: ExchangeOptions,
    operation: "resume" | "fork" | "create", targetSessionId?: string,
  ): Promise<ExchangeResult> {
    if (this.options.neutralizeMcp) {
      const at = args.indexOf("--json");
      args = [...args.slice(0, at), ...this.mcpNeutralizationArgs(cwd), ...args.slice(at)];
    }
    const result = await run({
      command: this.launcher.command,
      args: [...this.launcher.prefix, ...args],
      cwd,
      stdin: message,
      timeoutMs: options.timeoutMs,
      killAfterStartMs: options.killAfterStartMs,
      startSignal: (line) => (/"type":"turn\.started"/.test(line) ? "turn.started" : undefined),
    });
    return {
      agent: this.agent,
      argv: ["codex", ...args],
      ...result,
      ...interpretCodexOutput(result.stdout, result.exitCode, operation, targetSessionId),
    };
  }

  createThrowaway(cwd: string, prompt: string, timeoutMs: number): Promise<ExchangeResult> {
    return this.exchange(["exec", ...this.commonArgs(), "-"], cwd, prompt, { timeoutMs }, "create");
  }

  send(target: ExternalSession, message: string, options: ExchangeOptions): Promise<ExchangeResult> {
    const sub = options.fork ? "fork" : "resume";
    return this.exchange(
      ["exec", sub, ...this.commonArgs(), target.sessionId, "-"], target.cwd, message, options,
      options.fork ? "fork" : "resume", target.sessionId,
    );
  }

  /**
   * Attachement = verrou `thread-writer-locks/<id>.lock` tenu par un écrivain (EBUSY).
   * Fichier absent ou présent mais libre (orphelin après kill) = `detached`.
   * Toute autre situation (plateforme, code inattendu) = `unknown`.
   * Le verrou ne dit rien de l'activité : `activity` reste `unknown`.
   */
  probeTarget(target: ExternalSession): TargetProbe {
    return probeCodexLock(path.join(this.home, "thread-writer-locks", `${target.sessionId}.lock`));
  }

  findNonce(target: ExternalSession, nonce: string): DeliveryEvidence {
    const rollout = findCodexRollout(target.sessionId, this.home);
    if (!rollout) return { persisted: "unknown", inActiveBranch: "unknown", detail: "rollout introuvable" };
    return findNonceInCodexRollout(readFileSync(rollout, "utf8"), nonce);
  }

  /** Refus observés sans écriture : écrivain actif (course perdue), ou thread inconnu. */
  certainRefusal(result: ExchangeResult): CertainRefusal | undefined {
    if (result.exitCode === 0) return undefined;
    if (/already has an active writer/.test(result.stderr)) return "target-busy";
    if (/no rollout found for thread id/.test(result.stderr)) return "session-not-found";
    return undefined;
  }
}

export function probeCodexLock(lock: string): TargetProbe {
  const { exists, held, code } = exclusiveOpenProbe(lock);
  const evidence = [`thread-writer-lock: ${exists ? "présent" : "absent"}, tenu=${held ?? "inconnu"}${code ? ` (${code})` : ""}`];
  const base = { activity: "unknown" as const, processes: [], lock: { exists, held, code }, evidence };
  if (!exists) return { ...base, attachment: "detached" };
  if (held === true) return { ...base, attachment: "attached" };
  if (held === false) return { ...base, attachment: "detached" };
  return { ...base, attachment: "unknown" };
}

/** Rollout JSONL d'un thread Codex (sessions actives puis archivées). */
export function findCodexRollout(sessionId: string, home = path.join(os.homedir(), ".codex")): string | undefined {
  for (const root of [path.join(home, "sessions"), path.join(home, "archived_sessions")]) {
    if (!existsSync(root)) continue;
    const match = (readdirSync(root, { recursive: true }) as string[])
      .find((entry) => entry.endsWith(`${sessionId}.jsonl`) && path.basename(entry).startsWith("rollout-"));
    if (match) return path.join(root, match);
  }
  return undefined;
}

/**
 * Le rollout Codex est écrit par un seul écrivain à la fois et reste linéaire dans les cas
 * observés : une entrée trouvée est considérée sur la branche active.
 */
export function findNonceInCodexRollout(content: string, nonce: string): DeliveryEvidence {
  for (const entry of parseJsonLines(content)) {
    const payload = entry.payload;
    if (entry.type !== "response_item" || payload?.type !== "message" || payload.role !== "user") continue;
    const text = (payload.content ?? []).map((part: any) => part?.text ?? "").join("\n");
    if (text.includes(nonce)) return { persisted: true, inActiveBranch: true, detail: `entrée utilisateur ${entry.timestamp}` };
  }
  return { persisted: false, inActiveBranch: "unknown", detail: "nonce absent du rollout" };
}

// ---------------------------------------------------------------------------------------------
// Claude Code
// ---------------------------------------------------------------------------------------------

/** Options d'isolation et de coût des sessions de test Claude. */
export interface ClaudeAdapterOptions {
  command: string;
  /** Arguments placés avant ceux de Claude (tests : script de CLI simulée lancé par `node`). */
  prefixArgs?: string[];
  model?: string;
  /**
   * Retire les outils d'écriture et les serveurs MCP utilisateur (`--tools Read,Glob,Grep
   * --strict-mcp-config`). Sans cela, le mode plan seul laisse Bash, Write, Edit et les outils
   * MCP dans la session : le refus d'écrire repose alors sur le modèle, pas sur l'outillage.
   */
  restrictTools: boolean;
  /** `--settings {"disableAllHooks":true}` : coupe les hooks des réglages et des plugins. */
  disableHooks?: boolean;
  /** Arguments supplémentaires (tests de hooks témoins, `--safe-mode`…). */
  extraArgs?: string[];
  /** Racine `~/.claude` ; injectable pour les tests. */
  home?: string;
}

/**
 * Interprète le flux `claude -p --output-format stream-json`.
 * Le `session_id` d'un résultat `is_error` n'est jamais retenu : sur « No conversation found »,
 * Claude rapporte un identifiant neuf et aléatoire, sans lien avec la cible.
 */
export function interpretClaudeOutput(
  stdout: string,
  exitCode: number | null,
  operation: "resume" | "fork" | "create",
  targetSessionId?: string,
): ExchangeInterpretation {
  const events = parseJsonLines(stdout);
  const final = events.find((event) => event.type === "result");
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const isError = exitCode !== 0 || !final || final.is_error === true || typeof final.result !== "string";
  const reported = [init?.session_id, final?.session_id, ...events.filter((event) => event.type === "assistant").map((event) => event.session_id)]
    .filter((id): id is string => typeof id === "string");
  const observed = new Set<string>();
  for (const event of events) {
    const model = event.type === "assistant" ? event.message?.model : undefined;
    if (typeof model === "string" && model !== "<synthetic>") observed.add(model);
  }
  for (const model of Object.keys(final?.modelUsage ?? {})) observed.add(model);
  return {
    isError,
    reply: isError ? undefined : final.result,
    reportedSessionIds: reported,
    declaredModel: init?.model,
    observedModels: [...observed],
    errors: Array.isArray(final?.errors) ? final.errors.map(String) : [],
    ...resolveIdentity(reported, operation, targetSessionId, isError),
  };
}

export class ClaudeAdapter implements ExternalSessionAdapter {
  readonly agent = "claude" as const;
  private readonly options: ClaudeAdapterOptions;

  constructor(options: ClaudeAdapterOptions) {
    this.options = options;
  }

  private get home(): string {
    return this.options.home ?? path.join(os.homedir(), ".claude");
  }

  /** Lecture seule : mode plan (proposé par l'issue), plus restriction d'outillage si demandée. */
  private commonArgs(): string[] {
    return [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "plan",
      ...(this.options.restrictTools ? ["--tools", "Read,Glob,Grep", "--strict-mcp-config"] : []),
      ...(this.options.disableHooks ? ["--settings", JSON.stringify({ disableAllHooks: true })] : []),
      ...(this.options.model ? ["--model", this.options.model] : []),
      ...(this.options.extraArgs ?? []),
    ];
  }

  private async exchange(
    args: string[], cwd: string, message: string, options: ExchangeOptions,
    operation: "resume" | "fork" | "create", targetSessionId?: string,
  ): Promise<ExchangeResult> {
    const result = await run({
      command: this.options.command,
      args: [...(this.options.prefixArgs ?? []), ...args],
      cwd,
      stdin: message,
      timeoutMs: options.timeoutMs,
      killAfterStartMs: options.killAfterStartMs,
      startSignal: (line) => (/"type":"system".*"subtype":"init"/.test(line) ? "system.init" : undefined),
    });
    return {
      agent: this.agent,
      argv: ["claude", ...args],
      ...result,
      ...interpretClaudeOutput(result.stdout, result.exitCode, operation, targetSessionId),
    };
  }

  createThrowaway(cwd: string, prompt: string, timeoutMs: number): Promise<ExchangeResult> {
    return this.exchange(this.commonArgs(), cwd, prompt, { timeoutMs }, "create");
  }

  send(target: ExternalSession, message: string, options: ExchangeOptions): Promise<ExchangeResult> {
    const fork = options.fork ? ["--fork-session"] : [];
    return this.exchange(
      [...this.commonArgs(), "--resume", target.sessionId, ...fork], target.cwd, message, options,
      options.fork ? "fork" : "resume", target.sessionId,
    );
  }

  probeTarget(target: ExternalSession): TargetProbe {
    return probeClaudeRegistry(target.sessionId, path.join(this.home, "sessions"));
  }

  findNonce(target: ExternalSession, nonce: string): DeliveryEvidence {
    const transcript = findClaudeTranscript(target.sessionId, this.home);
    if (!transcript) return { persisted: "unknown", inActiveBranch: "unknown", detail: "transcript introuvable" };
    return findNonceInClaudeTranscript(readFileSync(transcript, "utf8"), nonce);
  }

  /** Refus observé sans écriture : conversation introuvable (aucun tour joué). */
  certainRefusal(result: ExchangeResult): CertainRefusal | undefined {
    return result.isError && result.errors.some((error) => error.startsWith("No conversation found")) ? "session-not-found" : undefined;
  }
}

/**
 * Sonde du registre `~/.claude/sessions/<pid>.json`.
 * - Toute entrée vivante pour la session => `attached`, quel que soit `status` (idle, busy ou absent).
 * - PID mort => entrée ignorée ; PID invérifiable ou fichier illisible => `unknown` faute de mieux.
 * - Limite : un PID réattribué à un autre processus est vu vivant (faux positif prudent).
 */
export function probeClaudeRegistry(
  sessionId: string,
  dir: string,
  liveness: (pid: number) => Liveness = (pid) => pidLiveness(pid),
): TargetProbe {
  const evidence: string[] = [];
  const processes: AttachedProcess[] = [];
  let unreadable = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((entry) => /^\d+\.json$/.test(entry));
  } catch {
    return { attachment: "unknown", activity: "unknown", processes, evidence: [`registre illisible : ${dir}`] };
  }
  for (const name of entries) {
    let entry: Record<string, any>;
    try { entry = JSON.parse(readFileSync(path.join(dir, name), "utf8")); } catch { unreadable++; continue; }
    if (entry.sessionId !== sessionId) continue;
    const pid = Number(entry.pid ?? name.split(".")[0]);
    const process_: AttachedProcess = {
      pid, liveness: liveness(pid), status: entry.status, entrypoint: entry.entrypoint, kind: entry.kind, version: entry.version,
    };
    processes.push(process_);
    evidence.push(`pid=${pid} ${process_.liveness} kind=${entry.kind} entrypoint=${entry.entrypoint} status=${entry.status ?? "absent"}`);
  }
  if (unreadable) evidence.push(`${unreadable} entrée(s) de registre illisible(s)`);
  const alive = processes.filter((item) => item.liveness === "alive");
  const attachment = alive.length > 0
    ? "attached"
    : processes.some((item) => item.liveness === "unverifiable") || unreadable > 0 ? "unknown" : "detached";
  const activity = alive.some((item) => item.status === "busy")
    ? "busy"
    : alive.length > 0 && alive.every((item) => item.status === "idle") ? "idle" : "unknown";
  return { attachment, activity, processes, evidence };
}

/** Retrouve le transcript JSONL d'une session Claude dans `~/.claude/projects/*`. */
export function findClaudeTranscript(sessionId: string, home = path.join(os.homedir(), ".claude")): string | undefined {
  const root = path.join(home, "projects");
  if (!existsSync(root)) return undefined;
  for (const project of readdirSync(root)) {
    const candidate = path.join(root, project, `${sessionId}.jsonl`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function claudeText(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("\n");
  return "";
}

/**
 * Cherche le nonce dans une entrée utilisateur, puis vérifie si elle appartient à la branche
 * active. Heuristique conforme aux observations (non documentée par le fournisseur) : la branche
 * active part de la dernière entrée de conversation écrite (hors `isSidechain`) et remonte par
 * `parentUuid`, ou `logicalParentUuid` après une frontière de compaction. Chaîne cassée = `unknown`.
 */
export function findNonceInClaudeTranscript(content: string, nonce: string): DeliveryEvidence {
  const entries = parseJsonLines(content).filter((entry) => typeof entry.uuid === "string");
  const byUuid = new Map(entries.map((entry) => [entry.uuid as string, entry]));
  const hit = entries.find((entry) => entry.type === "user" && claudeText(entry.message).includes(nonce));
  if (!hit) return { persisted: false, inActiveBranch: "unknown", detail: "nonce absent du transcript" };

  const leaf = [...entries].reverse().find((entry) => (entry.type === "user" || entry.type === "assistant") && !entry.isSidechain);
  let cursor: Record<string, any> | undefined = leaf;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.uuid)) {
    if (cursor.uuid === hit.uuid) return { persisted: true, inActiveBranch: true, detail: `entrée ${hit.timestamp}, sur la branche active` };
    seen.add(cursor.uuid);
    const parent: string | null | undefined = cursor.parentUuid ?? cursor.logicalParentUuid;
    if (!parent) return { persisted: true, inActiveBranch: false, detail: `entrée ${hit.timestamp}, hors de la branche active` };
    cursor = byUuid.get(parent);
    if (!cursor) return { persisted: true, inActiveBranch: "unknown", detail: "chaîne parentUuid incomplète" };
  }
  return { persisted: true, inActiveBranch: "unknown", detail: "branche active indéterminée" };
}
