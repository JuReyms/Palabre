/**
 * @file Lancement d'une CLI de session externe (voir AGENTS.md, section "Relay externe").
 *
 * Garanties de `runExternalProcess` :
 * - aucun shell : la commande et ses arguments sont transmis tels quels ;
 * - dossier de travail vérifié avant le lancement, sans repli vers le dossier courant ;
 * - environnement de l'hôte nettoyé des variables qui rattacheraient la CLI à la session appelante ;
 * - message sur stdin ;
 * - timeout dur, plafond cumulé stdout + stderr et annulation, chacun suivi du kill de l'arbre ;
 * - aucun kill après la terminaison du processus : tous les timers sont annulés à `exit` ;
 * - la promesse est toujours résolue, jamais rejetée ;
 * - un retour forcé ferme les flux et détache l'enfant de la boucle d'événements : l'appelant
 *   peut se terminer même si un processus récalcitrant survit.
 *
 * L'interprétation de la sortie appartient aux adapters fournisseurs.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { resolveMaxOutputBytes, utf8ChildProcessEnv } from "../adapters/cli-shared.js";
import { resolveExecutablePath } from "../exec.js";
import type { Liveness } from "./types.js";

/**
 * Variables héritées d'un hôte Claude Code ou Codex qui désignent la session appelante (socket
 * de messagerie, identifiant de session, session enfant). Transmises à la CLI cible, elles
 * pourraient la rattacher à la conversation de l'appelant.
 */
const HOST_SESSION_ENV = /^(CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_PID|CLAUDE_AGENT_SDK_.*|CODEX_THREAD_ID|CODEX_SESSION_.*)$/i;

/** Délai par défaut laissé au processus pour se terminer après un kill. */
export const DEFAULT_KILL_GRACE_MS = 5_000;

/**
 * Échec de lancement diagnostiqué. `ENOENT` seul ne prouve pas l'absence de l'exécutable : Node
 * le renvoie aussi quand le dossier de travail n'existe pas.
 */
export type LaunchFailure = "invalid-working-directory" | "command-not-found" | "spawn-failed";

/** Raison d'un arrêt provoqué par Palabre. */
export type StopReason = "timeout" | "output-too-large" | "cancelled";

/** Paramètres d'un lancement. `command` est un exécutable déjà résolu, lancé sans shell. */
export interface ExternalProcessSpec {
  command: string;
  args: readonly string[];
  /** Dossier de travail de la cible ; doit exister. */
  cwd: string;
  /** Message transmis sur stdin, encodé en UTF-8. */
  stdin: string;
  /** Timeout dur ; à l'expiration, l'arbre de processus est tué. */
  timeoutMs: number;
  /** Plafond cumulé stdout + stderr ; une valeur invalide retombe sur la limite par défaut. */
  maxOutputBytes?: number;
  /** Annulation (Ctrl+C) : tue l'arbre de processus, ou empêche le lancement si déjà déclenchée. */
  signal?: AbortSignal;
  /**
   * Environnement de base ; celui de Palabre par défaut. Il est **toujours** nettoyé par
   * `cleanExternalEnv`, y compris quand il est fourni explicitement.
   */
  env?: NodeJS.ProcessEnv;
  /** Délai après un kill, ou après `exit` sans fermeture des flux, avant de rendre la main. */
  killGraceMs?: number;
  /** Injection pour les tests ; `killProcessTree` par défaut. */
  killTree?: (pid: number) => void;
}

/** Résultat brut d'un lancement, sans interprétation de la sortie. */
export interface ExternalProcessResult {
  /** `true` si un processus a réellement été créé. Sinon, rien n'a pu être délivré. */
  started: boolean;
  pid?: number;
  /** Cause d'un lancement impossible ; absent si le processus a démarré. */
  launchFailure?: LaunchFailure;
  /** Code d'erreur brut du lancement (`ENOENT`, `EACCES`, `EINVAL`…), pour diagnostic. */
  launchErrorCode?: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  /** Arrêt provoqué par Palabre ; absent si le processus s'est terminé seul. */
  stopReason?: StopReason;
  /**
   * `true` si la main a été rendue sans attendre la fermeture des flux : processus resté vivant
   * après le kill, ou descendants gardant stdout/stderr ouverts après `exit`. Les flux sont alors
   * fermés et l'enfant détaché : la sortie rendue est figée, et le processus survivant n'est plus
   * attendu (`pid` permet de le signaler).
   */
  forcedReturn: boolean;
  stdout: string;
  stderr: string;
  /** Octets observés sur stdout et stderr, y compris ceux écartés après dépassement du plafond. */
  outputBytes: number;
  durationMs: number;
}

/** Copie de l'environnement sans les variables qui désignent la session de l'hôte appelant. */
export function cleanExternalEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (!HOST_SESSION_ENV.test(key)) env[key] = value;
  }
  return env;
}

/**
 * Vivacité d'un PID par le signal 0 : `ESRCH` signifie mort, `EPERM` signifie vivant (processus
 * d'un autre utilisateur), tout autre résultat est `unverifiable`. Limite : un PID réattribué à un
 * autre processus est vu vivant, ce qui reste un faux positif prudent.
 */
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

/** Vrai si `dir` désigne un dossier existant. */
export function isUsableDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Attribue une erreur de lancement à sa cause, dans cet ordre :
 * 1. dossier de travail absent : `invalid-working-directory`, quel que soit le code ;
 * 2. code autre que `ENOENT` : `spawn-failed` ;
 * 3. exécutable introuvable (chemin explicite absent, ou nom absent du PATH) : `command-not-found` ;
 * 4. sinon (`ENOENT` avec dossier et exécutable présents, par exemple un interpréteur manquant) :
 *    `spawn-failed`.
 */
export function diagnoseLaunchFailure(code: string | undefined, command: string, cwd: string): LaunchFailure {
  if (!isUsableDirectory(cwd)) return "invalid-working-directory";
  if (code !== "ENOENT") return "spawn-failed";
  const explicitPath = path.isAbsolute(command) || command.includes("/") || command.includes("\\");
  const present = explicitPath ? existsSync(command) : resolveExecutablePath(command) !== undefined;
  return present ? "spawn-failed" : "command-not-found";
}

/**
 * Tue un processus et ses descendants. Sous Windows, `taskkill /T /F`, car les CLIs lancent des
 * processus natifs enfants ; ailleurs, le groupe de processus créé par `detached`.
 */
export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => {
      try {
        process.kill(pid);
      } catch {
        // Déjà terminé.
      }
    });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Déjà terminé.
    }
  }
}

/** Lance la CLI et résout toujours, avec la cause précise de tout échec ou arrêt. */
export function runExternalProcess(spec: ExternalProcessSpec): Promise<ExternalProcessResult> {
  const startedAt = Date.now();
  const maxOutputBytes = resolveMaxOutputBytes(spec.maxOutputBytes);
  const killGraceMs = spec.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  const killTree = spec.killTree ?? killProcessTree;
  const notStarted = (fields: Partial<ExternalProcessResult>): ExternalProcessResult => ({
    started: false,
    exitCode: null,
    signal: null,
    forcedReturn: false,
    stdout: "",
    stderr: "",
    outputBytes: 0,
    durationMs: Date.now() - startedAt,
    ...fields
  });

  if (spec.signal?.aborted) {
    return Promise.resolve(notStarted({ stopReason: "cancelled" }));
  }
  if (!isUsableDirectory(spec.cwd)) {
    return Promise.resolve(notStarted({ launchFailure: "invalid-working-directory" }));
  }

  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(spec.command, [...spec.args], {
        cwd: spec.cwd,
        env: cleanExternalEnv(spec.env ?? utf8ChildProcessEnv()),
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"]
      });
    } catch (error) {
      // Erreur synchrone (ex. `EINVAL` pour un `.cmd` sans shell sous Windows).
      const code = (error as NodeJS.ErrnoException).code;
      resolve(notStarted({ launchErrorCode: code, launchFailure: diagnoseLaunchFailure(code, spec.command, spec.cwd) }));
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    let exited = false;
    let stopReason: StopReason | undefined;
    let launchErrorCode: string | undefined;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null, forcedReturn: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (graceTimer) clearTimeout(graceTimer);
      spec.signal?.removeEventListener("abort", onAbort);
      if (forcedReturn) release();
      const started = child.pid !== undefined;
      resolve({
        started,
        pid: child.pid,
        launchFailure: !started && launchErrorCode !== undefined
          ? diagnoseLaunchFailure(launchErrorCode, spec.command, spec.cwd)
          : undefined,
        launchErrorCode,
        exitCode,
        signal,
        stopReason,
        forcedReturn,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        outputBytes,
        durationMs: Date.now() - startedAt
      });
    };

    /**
     * Retour forcé : le processus (ou un descendant qui garde les flux) peut survivre. On ferme
     * les flux et on retire l'enfant de la boucle d'événements, sinon l'appelant resterait bloqué
     * jusqu'à la fin naturelle de l'enfant. Les écouteurs restent en place, neutralisés par
     * `settled`, pour absorber un éventuel événement tardif.
     */
    const release = () => {
      child.stdin?.destroy();
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
    };

    // Un seul arrêt par lancement ; jamais après `exit`, pour ne pas viser un PID réattribué.
    const stop = (reason: StopReason) => {
      if (settled || exited || stopReason) return;
      stopReason = reason;
      if (child.pid !== undefined) killTree(child.pid);
      graceTimer = setTimeout(() => finish(null, null, true), killGraceMs);
    };
    const onAbort = () => stop("cancelled");
    const hardTimer = setTimeout(() => stop("timeout"), spec.timeoutMs);
    spec.signal?.addEventListener("abort", onAbort, { once: true });

    const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
      // Après le résultat, plus aucune collecte : la sortie rendue est figée.
      if (settled) return;
      outputBytes += chunk.length;
      if (stopReason === "output-too-large") return;
      if (outputBytes > maxOutputBytes) {
        stop("output-too-large");
        return;
      }
      chunks.push(chunk);
    };
    child.stdout?.on("data", collect(stdoutChunks));
    child.stderr?.on("data", collect(stderrChunks));

    child.on("error", (error: NodeJS.ErrnoException) => {
      launchErrorCode ??= error.code ?? "unknown";
      // Sans PID, aucun processus n'a été créé : rien à attendre.
      if (child.pid === undefined) finish(null, null, false);
    });
    child.on("exit", (exitCode, signal) => {
      exited = true;
      if (settled) return;
      clearTimeout(hardTimer);
      if (graceTimer) clearTimeout(graceTimer);
      // Des descendants peuvent garder les flux ouverts : on n'attend `close` que pendant le délai de grâce.
      graceTimer = setTimeout(() => finish(exitCode, signal, true), killGraceMs);
    });
    child.on("close", (exitCode, signal) => finish(exitCode, signal, false));

    child.stdin?.on("error", () => {
      // Processus terminé avant d'avoir lu stdin ; l'issue est donnée par `exit`.
    });
    child.stdin?.end(spec.stdin, "utf8");
  });
}
