/**
 * @file Adapter CLI batch minimal : spawn, injection du prompt, capture stdout, classement des erreurs
 * connues. Échéance honnête (arrêt local demandé, confirmé seulement par `exit`), indication d'attente
 * facultative, sortie OpenCode structurée et référence de lecture sûre pour un profil qualifié.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { AdapterError, cancelledError } from "../errors.js";
import { createTranslator } from "../i18n.js";
import { resolveNativeWindowsExecutable, resolvePowerShellExecutable, resolvePowerShellShim } from "../exec.js";
import { directNpmShimLaunch, withShimNodePath } from "../npmShim.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterErrorMessages } from "../messages/adapter-errors.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, CliAgentConfig, CliRuntimeProfile, ConfigIdentity } from "../types.js";
import { isCliResponseFormatValid } from "../types.js";
import { encodeRecoveryReference, OpenCodeSessionObserver, parseOpenCodeRunOutput, sha256Hex } from "./opencodeJson.js";
import { resolveTimeoutMs, resolveWaitingIntervalMs } from "./cli-shared.js";
import { clipLine, DEFAULT_TIMEOUT_MS, extractRetryAfter, extractUsageLimitMessage, resolveMaxOutputBytes, stripLogPrefix, uniqueNonEmptyLines, utf8ChildProcessEnv, withModelArgs } from "./cli-shared.js";
import { cleanTerminalOutput, sanitizeTerminalText } from "./terminal.js";

/**
 * Adapter pour les CLIs batch (Codex, Claude, OpenCode, Vibe...).
 * Lance un sous-processus, injecte le prompt via stdin ou argument, capture stdout.
 * Garantit : rejet des sorties vides (sauf texte avec `allowEmptyOutput`), des timeouts et de tout exit non nul.
 * Le format JSON explicite ne revient jamais au texte/PTY en cas de format inconnu.
 * Un `runtime` qualifié (fourni par la factory, jamais par la config) lit la sortie OpenCode JSON
 * et, à l'échéance, garde la session observée et l'empreinte du prompt exact pour une lecture sans
 * renvoi. L'échéance n'est jamais un succès ni une preuve d'échec du modèle.
 */
export class CliAdapter implements AgentAdapter {
  readonly role;
  readonly contract: AdapterContract;

  constructor(
    readonly name: string,
    private readonly config: CliAgentConfig,
    private readonly runtime?: CliRuntimeProfile,
    private readonly configIdentity?: ConfigIdentity
  ) {
    this.role = config.role;
    this.contract = {
      name,
      kind: "cli",
      capabilities: {
        mode: "batch",
        supportsModelOverride: true,
        supportsFilesystemAccess: true,
        supportsStreaming: false,
        supportsProcessExitCode: true,
        supportsStderr: true
      },
      guarantees: {
        rejectsEmptyOutput: config.responseFormat === "antigravity-json" || runtime !== undefined || !config.allowEmptyOutput,
        rejectsNonZeroExit: true,
        rejectsTimeout: true,
        returnsRawOutput: true
      }
    };
  }

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    if (prompt.signal?.aborted) {
      throw cancelledError(this.name);
    }

    const renderedPrompt = formatAgentPrompt(prompt);
    // Référence de la demande : empreinte du texte exact transmis, jamais le texte lui-même.
    const requestSha256 = this.runtime ? sha256Hex(renderedPrompt) : undefined;
    const cwd = process.cwd();
    const timeoutMs = resolveTimeoutMs(this.config.timeoutMs);
    const errorMessages = createTranslator(prompt.language ?? "fr").adapterErrors;
    if (!isCliResponseFormatValid(this.config)) {
      throw new AdapterError("spawn-failed", this.name, errorMessages.invalidResponseFormat(this.name));
    }
    const promptMode = this.config.promptMode ?? "stdin";
    const spawnSafety = resolveWindowsSpawnSafety(
      this.config.command,
      this.config.shell ?? false,
      promptMode,
      this.config.model,
      this.name,
      errorMessages
    );
    const baseArgs = withModelArgs(this.config.args ?? [], this.config.model, this.config.modelArg ?? "--model");
    const adapterArgs = promptMode === "argument"
      ? [...baseArgs, renderedPrompt]
      : baseArgs;
    const args = [...spawnSafety.argsPrefix, ...adapterArgs];

    return new Promise<AgentResponse>((resolve, reject) => {
      const spawnCommand = shellCommandForSpawn(spawnSafety.command, args, spawnSafety.shell);
      const child = spawn(spawnCommand.command, spawnCommand.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: spawnSafety.nodePath === undefined ? utf8ChildProcessEnv() : withShimNodePath(utf8ChildProcessEnv(), spawnSafety.nodePath),
        shell: spawnSafety.shell
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;
      let outputBytes = 0;
      let hardTimer: ReturnType<typeof setTimeout>;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;
      let waitTimer: ReturnType<typeof setInterval> | undefined;
      let stopRequested = false;
      const startedAt = Date.now();
      const observer = this.runtime ? new OpenCodeSessionObserver() : undefined;
      let abortListener: (() => void) | undefined;
      const maxOutputBytes = resolveMaxOutputBytes(this.config.maxOutputBytes);
      // Profil qualifié : seul le client lancé est arrêté, jamais son arbre, pour ne pas toucher un
      // service habituel qu'il aurait démarré. Autres CLIs : politique d'arbre inchangée.
      const stopChild = () => killChildProcess(child, this.runtime === undefined);

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        if (idleTimer) clearTimeout(idleTimer);
        if (graceTimer) clearTimeout(graceTimer);
        if (waitTimer) clearInterval(waitTimer);
        if (abortListener) {
          prompt.signal?.removeEventListener("abort", abortListener);
        }

        if (error) {
          releaseChildProcessHandles(child);
          reject(error);
          return;
        }

        const stdout = decodeCliBytes(stdoutChunks);
        const stderr = decodeCliBytes(stderrChunks);
        let content: string;
        try {
          // Parser le JSON original, jamais une sortie préalablement nettoyée ou extraite des logs.
          content = this.config.responseFormat === "antigravity-json"
            ? parseAntigravityResponse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(stdoutChunks)), this.name, errorMessages)
            : this.runtime?.output === "opencode-json"
              ? cleanTerminalOutput(parseOpenCodeRunOutput(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(stdoutChunks))).content)
              : cleanCliOutput(stdout);
        } catch (error) {
          reject(createKnownCliError(this.name, undefined, stderr, errorMessages)
            ?? (error instanceof AdapterError ? error : new AdapterError("unknown", this.name, this.runtime
              ? errorMessages.invalidOpenCodeJson(this.name)
              : errorMessages.invalidAntigravityJson(this.name))));
          return;
        }

        if (!content && (this.runtime !== undefined || !this.config.allowEmptyOutput)) {
          const knownError = createKnownCliError(this.name, undefined, stderr, errorMessages);

          if (knownError) {
            reject(knownError);
            return;
          }

          const detail = stderr.trim() ? ` Stderr: ${stderr.trim()}` : "";
          reject(new AdapterError("empty-output", this.name, `${this.name} produced empty output.${detail}`, {
            stderr: stderr.trim()
          }));
          return;
        }

        resolve({
          content,
          raw: stdout
        });
      };

      abortListener = () => {
        stopChild();
        finish(cancelledError(this.name));
      };
      prompt.signal?.addEventListener("abort", abortListener, { once: true });

      // Échéance : arrêt du processus local demandé, confirmé seulement par son événement `exit` dans
      // un court délai. Le code de `taskkill` n'est jamais une preuve ; l'état du service reste inconnu.
      const timeoutError = (localExit: "confirmed" | "unconfirmed") => this.timeoutError(errorMessages, {
        timeoutMs, waitedMs: Date.now() - startedAt, localExit, observer, requestSha256, cwd
      });
      hardTimer = setTimeout(() => {
        stopRequested = true;
        if (idleTimer) clearTimeout(idleTimer);
        if (waitTimer) clearInterval(waitTimer);
        stopChild();
        graceTimer = setTimeout(() => finish(timeoutError("unconfirmed")), STOP_CONFIRMATION_MS);
      }, timeoutMs);
      child.once("exit", () => {
        if (stopRequested) finish(timeoutError("confirmed"));
      });

      // Attente côté Palabre seulement : jamais présentée comme un avancement du modèle.
      const notify = prompt.onWaiting;
      if (notify) {
        waitTimer = setInterval(() => {
          try { notify({ agent: this.name, elapsedMs: Date.now() - startedAt, timeoutMs }); }
          catch { /* Indication facultative : n'affecte jamais l'appel. */ }
        }, resolveWaitingIntervalMs(prompt.waitingIntervalMs));
      }

      const bumpIdleTimer = () => {
        if (!this.config.idleTimeoutMs || stopRequested) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          stopChild();
          finish(new AdapterError(
            "idle-timeout",
            this.name,
            `${this.name} stopped producing output for ${this.config.idleTimeoutMs}ms`,
            { idleTimeoutMs: this.config.idleTimeoutMs }
          ));
        }, this.config.idleTimeoutMs);
      };

      bumpIdleTimer();

      // stdout et stderr partagent le même budget `maxOutputBytes`. Après une demande d'arrêt, la
      // sortie tardive est ignorée : elle ne peut jamais devenir une réponse.
      const createDataHandler = (chunks: Buffer[], observe = false) => (chunk: Buffer) => {
        if (stopRequested || settled) return;
        outputBytes += chunk.length;
        if (outputBytes > maxOutputBytes) {
          stopChild();
          finish(new AdapterError("output-too-large", this.name, `${this.name} produced more than ${maxOutputBytes} bytes of output`, {
            maxOutputBytes,
            outputBytes
          }));
          return;
        }
        chunks.push(chunk);
        if (observe) observer?.feed(chunk);
        bumpIdleTimer();
      };

      child.stdout.on("data", createDataHandler(stdoutChunks, true));

      child.stderr.on("data", createDataHandler(stderrChunks));

      child.on("error", (error: NodeJS.ErrnoException) => {
        // Après la demande d'arrêt, l'échéance reste l'issue : un échec tardif ne la remplace pas.
        if (stopRequested) return;
        const kind = error.code === "ENOENT" ? "command-not-found" : "spawn-failed";
        finish(new AdapterError(kind, this.name, `${this.name} failed to start command "${this.config.command}": ${error.message}`, {
          code: error.code,
          command: this.config.command
        }));
      });
      const finishFromExitCode = (code: number | null, signal: NodeJS.Signals | null) => {
        // Fin après la demande d'arrêt : l'échéance reste l'issue, jamais une réponse partielle.
        if (stopRequested) {
          finish(timeoutError("confirmed"));
          return;
        }
        if (code === null) {
          finish(new AdapterError(
            "non-zero-exit",
            this.name,
            `${this.name} was terminated by signal ${signal ?? "unknown"}.`,
            { exitCode: null, signal, stderr: cleanCliOutput(decodeCliBytes(stderrChunks)) }
          ));
          return;
        }

        if (code !== 0) {
          finish(createCliExitError(
            this.name,
            code,
            decodeCliBytes(stdoutChunks),
            decodeCliBytes(stderrChunks),
            errorMessages
          ));
          return;
        }

        finish();
      };

      child.on("close", finishFromExitCode);

      child.stdin.on("error", () => { /* Fermeture anticipée (EPIPE) : l'issue vient de exit/close. */ });
      if (promptMode === "stdin") {
        child.stdin.write(renderedPrompt);
      }
      child.stdin.end();
    });
  }

  /**
   * Erreur `timeout` (kind v1 inchangé). Détails facultatifs : attente, arrêt local demandé et
   * confirmé ou non, travail distant inconnu, aucun renvoi ; pour un profil qualifié, la référence
   * de lecture opaque (configuration approuvée exacte, commande, dossier, session et dernier message
   * observés, SHA-256 du prompt exact, modèle demandé ; jamais le prompt) ou son absence nommée.
   * Jamais une réponse ni un succès.
   */
  private timeoutError(messages: AdapterErrorMessages, input: {
    timeoutMs: number; waitedMs: number; localExit: "confirmed" | "unconfirmed"; observer?: OpenCodeSessionObserver; requestSha256?: string; cwd: string;
  }): AdapterError {
    const observed = input.observer?.reference();
    const reference = this.runtime && observed && input.requestSha256 && this.configIdentity
      ? encodeRecoveryReference({
        v: 1, agent: this.name, command: this.config.command, config: this.configIdentity, cwd: input.cwd,
        session: observed.session, lastMessage: observed.lastMessage, requestSha256: input.requestSha256, model: this.config.model ?? null
      })
      : undefined;
    const recovery = !this.runtime ? undefined : reference && observed
      ? { available: true, reference, agent: this.name, session: observed.session }
      : { available: false, reason: !this.configIdentity ? "config-unknown" : !observed ? "session-unknown" : "reference-unsafe" };
    const command = reference ? `palabre result --reference ${reference}` : undefined;
    return new AdapterError("timeout", this.name, messages.waitTimeout(this.name, input.timeoutMs, input.localExit, this.runtime !== undefined, command), {
      timeoutMs: input.timeoutMs,
      waitedMs: input.waitedMs,
      stopRequested: true,
      localExit: input.localExit,
      remoteWork: "unknown",
      resent: false,
      ...(recovery ? { recovery } : {})
    });
  }
}

/** Délai d'observation de l'événement `exit` après la demande d'arrêt, avant « non confirmé ». */
const STOP_CONFIRMATION_MS = 5_000;

/**
 * Accepte un seul objet JSON Antigravity réussi. Les métadonnées ne deviennent jamais une réponse.
 * Préserve espaces et paragraphes du champ response ; assainit seulement les contrôles terminal.
 * Une forme inconnue ou un statut d'erreur est refusé, même avec allowEmptyOutput.
 */
function parseAntigravityResponse(stdout: string, name: string, messages: AdapterErrorMessages): string {
  let value: unknown;
  try { value = JSON.parse(stdout); } catch {
    throw new AdapterError("unknown", name, messages.invalidAntigravityJson(name));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (value as { status?: unknown }).status !== "SUCCESS"
    || typeof (value as { response?: unknown }).response !== "string") {
    throw new AdapterError("unknown", name, messages.invalidAntigravityJson(name));
  }
  const content = sanitizeTerminalText((value as { response: string }).response);
  if (!content.trim()) throw new AdapterError("empty-output", name, messages.invalidAntigravityJson(name));
  return content;
}

function decodeCliBytes(chunks: readonly Buffer[]): string {
  const bytes = Buffer.concat(chunks);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/**
 * Évite que des valeurs runtime non fiables (prompt, transcript, modèle) soient reparsées par
 * `cmd.exe`. Ordre sous Windows : exécutable natif ; shim npm ou pnpm reconnu, lancé via Node et le
 * script du paquet (avec le `NODE_PATH` du shim pnpm) ; autre shim PowerShell (modifié, forme
 * inconnue), lancé par PowerShell ; sinon wrapper shell, sûr seulement avec le prompt sur stdin et
 * un identifiant de modèle sans métacaractère.
 */
function resolveWindowsSpawnSafety(
  command: string,
  shell: boolean,
  promptMode: "stdin" | "argument",
  model: string | undefined,
  adapterName: string,
  messages: AdapterErrorMessages
): { command: string; shell: boolean; argsPrefix: string[]; nodePath?: string } {
  if (process.platform !== "win32" || !shell) {
    return { command, shell, argsPrefix: [] };
  }

  const nativeCommand = resolveNativeWindowsExecutable(command);
  if (nativeCommand && !isWindowsAppsExecutionAlias(nativeCommand)) {
    return { command: nativeCommand, shell: false, argsPrefix: [] };
  }

  // Shim npm ou pnpm reconnu : Node et le script du paquet, sans PowerShell, qui altérerait stdin
  // UTF-8, les guillemets des arguments et l'argument `-` (#98, #109).
  const npmShim = directNpmShimLaunch(command);
  if (npmShim) {
    return { command: npmShim.command, shell: false, argsPrefix: npmShim.prefixArgs, ...(npmShim.nodePath !== undefined && { nodePath: npmShim.nodePath }) };
  }

  // Repli pour un shim d'une autre forme (shim modifié, forme inconnue) : PowerShell, avec ses limites.
  const powerShellShim = resolvePowerShellShim(command);
  const powerShellExecutable = powerShellShim ? resolvePowerShellExecutable() : undefined;
  if (powerShellShim && powerShellExecutable) {
    return {
      command: powerShellExecutable,
      shell: false,
      argsPrefix: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", powerShellShim]
    };
  }

  if (promptMode === "argument") {
    throw new AdapterError(
      "spawn-failed",
      adapterName,
      messages.unsafeWindowsShellPrompt(adapterName),
      { command, promptMode }
    );
  }

  if (model && /[&|<>()^%!"\r\n]/.test(model)) {
    throw new AdapterError(
      "spawn-failed",
      adapterName,
      messages.unsafeWindowsShellModel(adapterName),
      { command, model }
    );
  }

  return { command, shell: true, argsPrefix: [] };
}

/** Les alias WindowsApps ne sont pas des exécutables fiables pour child_process. */
function isWindowsAppsExecutionAlias(command: string): boolean {
  return command.toLowerCase().includes("\\windowsapps\\");
}

/** Retire les séquences ANSI et les espaces en tête/fin. */
function cleanCliOutput(output: string): string {
  return stripWindowsTaskkillNoise(cleanTerminalOutput(output));
}

/**
 * Retire les lignes de statut `taskkill` (FR/EN) que Windows peut mélanger à la sortie
 * d'une CLI tuée après timeout ou annulation. Sans ce filtre, ce bruit contaminerait
 * la réponse agent capturée sur stdout.
 */
function stripWindowsTaskkillNoise(output: string): string {
  const lines = output.split("\n");
  const kept: string[] = [];
  let skipNextFrenchContinuation = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const normalized = normalizeForWindowsStatus(trimmed);

    if (skipNextFrenchContinuation && /^arr.*t.*\.$/i.test(normalized)) {
      skipNextFrenchContinuation = false;
      continue;
    }
    skipNextFrenchContinuation = false;

    if (isWindowsTaskkillStatusLine(trimmed)) {
      skipNextFrenchContinuation = true;
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n").trim();
}

function isWindowsTaskkillStatusLine(line: string): boolean {
  const normalized = normalizeForWindowsStatus(line);
  const lower = line.toLowerCase();

  return (
    /^SUCCESS:\s+The process with PID \d+ .* has been terminated\.$/i.test(line) ||
    /^operation reussie.*processus de pid \d+ .* a ete$/.test(normalized) ||
    (
      lower.startsWith("op") &&
      lower.includes("processus de pid ") &&
      lower.includes("processus enfant de pid") &&
      lower.includes(" a ")
    )
  );
}

function normalizeForWindowsStatus(line: string): string {
  return line
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Construit une `AdapterError` typée depuis un exit code non nul.
 * Élève en `usage-limit` si le stderr contient un signal de quota/rate-limit connu.
 */
function createCliExitError(
  adapterName: string,
  exitCode: number,
  stdout: string,
  stderr: string,
  messages: AdapterErrorMessages
): AdapterError {
  const cleanedStderr = cleanCliOutput(stderr);
  const cleanedStdout = cleanCliOutput(stdout);
  const diagnostic = cleanedStderr
    ? summarizeCliDiagnostic(cleanedStderr, messages)
    : cleanedStdout
      ? messages.stdoutDiagnostic(summarizeCliDiagnostic(cleanedStdout, messages))
      : messages.noStderrCaptured;

  return createKnownCliError(adapterName, exitCode, cleanedStderr, messages)
    ?? new AdapterError(
      "non-zero-exit",
      adapterName,
      `${adapterName} exited with code ${exitCode}: ${diagnostic}`,
      {
        exitCode,
        stderr: cleanedStderr
      }
    );
}

function createKnownCliError(adapterName: string, exitCode: number | undefined, stderr: string, messages: AdapterErrorMessages): AdapterError | undefined {
  const cleanedStderr = cleanCliOutput(stderr);
  const usageLimitMessage = extractUsageLimitMessage(cleanedStderr);
  const retryAfter = usageLimitMessage ? extractRetryAfter(usageLimitMessage) : undefined;
  const unsupportedModelMessage = extractUnsupportedModelMessage(cleanedStderr);

  if (usageLimitMessage) {
    return new AdapterError(
      "usage-limit",
      adapterName,
      messages.usageLimit(adapterName, usageLimitMessage),
      {
        ...(exitCode === undefined ? {} : { exitCode }),
        stderr: cleanedStderr,
        ...(retryAfter === undefined ? {} : { retryAfter })
      }
    );
  }

  if (unsupportedModelMessage) {
    return new AdapterError(
      "unsupported-model",
      adapterName,
      messages.unsupportedModel(adapterName, unsupportedModelMessage),
      {
        ...(exitCode === undefined ? {} : { exitCode }),
        stderr: cleanedStderr
      }
    );
  }

  // OpenCode 2 refuse l'ancien `--pure` : reste un `non-zero-exit`, avec la marche à suivre.
  if (OPENCODE_PURE_REJECTED.test(cleanedStderr)) {
    return new AdapterError(
      "non-zero-exit",
      adapterName,
      messages.openCodePureRemoved(adapterName),
      {
        ...(exitCode === undefined ? {} : { exitCode }),
        stderr: cleanedStderr
      }
    );
  }

  return undefined;
}

/**
 * Refus observé avec OpenCode 2.0.32, ligne exacte : « Unrecognized flag: --pure in command opencode run ».
 * Un autre drapeau (`--pure-extra`) ou une autre commande ne déclenchent jamais ce diagnostic.
 */
const OPENCODE_PURE_REJECTED = /^\s*Unrecognized flag: --pure in command opencode run\s*$/m;

/** Cherche dans stderr une ligne signalant un modèle non supporté, pour classer l'erreur en `unsupported-model`. */
function extractUnsupportedModelMessage(stderr: string): string | undefined {
  const lines = uniqueNonEmptyLines(stderr);
  const match = lines.find((line) => isUnsupportedModelLine(extractJsonErrorMessage(line) ?? line));

  if (!match) {
    return undefined;
  }

  return clipLine(stripLogPrefix(extractJsonErrorMessage(match) ?? match), 500);
}

function isUnsupportedModelLine(line: string): boolean {
  const normalized = line.toLowerCase();

  return [
    "model is not supported",
    "model is unsupported",
    "unsupported model",
    "model_not_found",
    "not supported when using",
    "model requires a newer version",
    "model does not exist",
    "unknown model"
  ].some((pattern) => normalized.includes(pattern));
}

function extractJsonErrorMessage(line: string): string | undefined {
  const jsonStart = line.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed: unknown = JSON.parse(line.slice(jsonStart));
      const error = typeof parsed === "object" && parsed !== null
        ? (parsed as { error?: unknown }).error
        : undefined;
      const message = typeof error === "object" && error !== null
        ? (error as { message?: unknown }).message
        : undefined;
      if (typeof message === "string") return message;
    } catch {
      // Some CLIs prefix or truncate their JSON error; the bounded regex fallback still helps.
    }
  }

  const match = line.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return undefined;

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function summarizeCliDiagnostic(output: string, messages: AdapterErrorMessages): string {
  const lines = uniqueNonEmptyLines(output).map(stripLogPrefix);

  if (lines.length === 0) {
    return messages.noStderrCaptured;
  }

  const structuredMessage = lines.map(extractJsonErrorMessage).find((message): message is string => Boolean(message));
  if (structuredMessage) {
    return clipLine(structuredMessage, 1_200);
  }

  const diagnostic = lines.find(isCliDiagnosticLine);
  if (diagnostic) {
    return clipLine(diagnostic, 1_200);
  }

  return clipLine(lines.slice(-8).join("\n"), 1_200);
}

/** Repère les diagnostics textuels actionnables quand aucune erreur JSON terminale n'est disponible. */
function isCliDiagnosticLine(line: string): boolean {
  const normalized = line.toLowerCase();
  return [
    "authentication",
    "authrequired",
    "unauthorized",
    "forbidden",
    "quota",
    "rate limit",
    "timeout",
    "timed out",
    "transport",
    "connection refused"
  ].some((pattern) => normalized.includes(pattern));
}

/**
 * Recompose `command`/`args` en une seule ligne de commande quotée quand `shell: true` est requis
 * (ex. wrappers npm shimmés sur Windows où `spawn` direct renvoie `EPERM`/`EINVAL`).
 */
function shellCommandForSpawn(command: string, args: string[], shell: boolean): { command: string; args: string[] } {
  if (!shell) {
    return { command, args };
  }

  if (process.platform !== "win32") {
    return {
      command: [command, ...args].map(quotePosixShellArg).join(" "),
      args: []
    };
  }

  return {
    command: [command, ...args].map(quoteWindowsShellArg).join(" "),
    args: []
  };
}

function quoteWindowsShellArg(value: string): string {
  if (value.length === 0) {
    return "\"\"";
  }

  return `"${value
    .replace(/(\\*)"/g, "$1$1\\\"")
    .replace(/(\\+)$/g, "$1$1")}"`;
}

function quotePosixShellArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Termine le process et ses enfants (`/T`) sur Windows via `taskkill.exe`, car `child.kill()` seul
 * ne tue pas les sous-processus d'un wrapper npm/shim. `taskkill` est lancé en fire-and-forget :
 * seul son échec de spawn déclenche un `child.kill()` de repli, sans attendre sa fin.
 * Avec `tree: false`, seul le processus lancé reçoit le signal (client OpenCode qualifié), jamais
 * un service qu'il aurait démarré.
 */
export function killChildProcess(child: ReturnType<typeof spawn>, tree = true): void {
  if (tree && process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
    killer.on("error", () => {
      child.kill();
    });
    return;
  }

  child.kill();
}

/**
 * Libère les canaux locaux après un échec, même sans arrêt confirmé. Ne tue aucun processus et
 * n'atteste ni l'arrêt d'un descendant ni celui d'un service ; évite que leurs pipes retiennent Node.
 */
export function releaseChildProcessHandles(child: ReturnType<typeof spawn>): void {
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

/**
 * Lance la commande configurée d'un agent CLI avec d'autres arguments, sans prompt ni modèle, avec la
 * même résolution Windows que `generate` (natif, shim reconnu, sans shell quand c'est possible) et le
 * même environnement. Sert aux lectures sans envoi (`palabre result`). La commande choisie n'est
 * jamais remplacée par une autre installation ; l'appelant borne délai, sortie et annulation.
 */
export function spawnConfiguredCommand(name: string, config: CliAgentConfig, args: string[], options: { cwd?: string } = {}): ChildProcessWithoutNullStreams {
  const safety = resolveWindowsSpawnSafety(config.command, config.shell ?? false, "stdin", undefined, name, createTranslator("fr").adapterErrors);
  const spawnCommand = shellCommandForSpawn(safety.command, [...safety.argsPrefix, ...args], safety.shell);
  return spawn(spawnCommand.command, spawnCommand.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: safety.nodePath === undefined ? utf8ChildProcessEnv() : withShimNodePath(utf8ChildProcessEnv(), safety.nodePath),
    shell: safety.shell,
    ...(options.cwd ? { cwd: options.cwd } : {})
  });
}
