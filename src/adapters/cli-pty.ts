/** @file Adapter pseudo-terminal (`node-pty`) pour les CLIs qui exigent une vraie console (ex. Antigravity `agy`). */
import { AdapterError, cancelledError } from "../errors.js";
import { createTranslator } from "../i18n.js";
import { resolveExecutablePath, resolveNativeWindowsExecutable, resolvePowerShellShim } from "../exec.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterErrorMessages } from "../messages/adapter-errors.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, CliPtyAgentConfig } from "../types.js";
import { DEFAULT_TIMEOUT_MS, extractPtyUsageLimitMessage, resolveMaxOutputBytes, withModelArgs } from "./cli-shared.js";
import { cleanTerminalOutput } from "./terminal.js";

type PtyProcess = ReturnType<typeof import("node-pty").spawn>;

/**
 * Adapter pour les CLIs qui exigent un vrai terminal.
 * Contrairement à `CliAdapter`, stdout/stderr sont fusionnés dans le flux PTY.
 */
export class CliPtyAdapter implements AgentAdapter {
  readonly role;
  readonly contract: AdapterContract;

  constructor(
    readonly name: string,
    private readonly config: CliPtyAgentConfig
  ) {
    this.role = config.role;
    this.contract = {
      name,
      kind: "cli-pty",
      capabilities: {
        mode: "pty",
        supportsModelOverride: true,
        supportsFilesystemAccess: true,
        supportsStreaming: false,
        supportsProcessExitCode: true,
        supportsStderr: false
      },
      guarantees: {
        rejectsEmptyOutput: !config.allowEmptyOutput,
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
    const errorMessages = createTranslator(prompt.language ?? "fr").adapterErrors;
    const promptMode = this.config.promptMode ?? "stdin";
    const baseArgs = withModelArgs(this.config.args ?? [], this.config.model, this.config.modelArg ?? "--model");
    const adapterArgs = promptMode === "argument"
      ? [...baseArgs, renderedPrompt]
      : baseArgs;
    const launch = resolvePtyLaunch(this.config.command, promptMode, this.config.model, this.name, errorMessages);
    const args = [...launch.argsPrefix, ...adapterArgs];
    const { spawn: spawnPty } = await import("node-pty");

    return new Promise<AgentResponse>((resolve, reject) => {
      let output = "";
      let outputBytes = 0;
      let settled = false;
      let hardTimer: ReturnType<typeof setTimeout>;
      let term: PtyProcess;
      let dataSubscription: { dispose(): void } | undefined;
      let exitSubscription: { dispose(): void } | undefined;
      let abortListener: (() => void) | undefined;
      const maxOutputBytes = resolveMaxOutputBytes(this.config.maxOutputBytes);

      const finish = (error?: Error, exitCode?: number, kill = true) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        dataSubscription?.dispose();
        exitSubscription?.dispose();
        if (abortListener) {
          prompt.signal?.removeEventListener("abort", abortListener);
        }

        if (kill) {
          try {
            term.kill();
          } catch {
            // The PTY may already be closed.
          }
        }

        cleanupPty(term);

        if (error) {
          reject(error);
          return;
        }

        const content = cleanTerminalOutput(output);

        // Le PTY fusionne stdout/stderr : seuls les diagnostics autonomes ou machine
        // sont acceptés pour éviter de rejeter une réponse normale parlant de rate-limit.
        const usageLimitMessage = extractPtyUsageLimitMessage(content);
        if (usageLimitMessage) {
          reject(new AdapterError("usage-limit", this.name, errorMessages.usageLimit(this.name, usageLimitMessage), {
            ...(exitCode === undefined || exitCode === 0 ? {} : { exitCode }),
            raw: output
          }));
          return;
        }

        if (exitCode && exitCode !== 0) {
          reject(createPtyExitError(this.name, exitCode, output, errorMessages));
          return;
        }

        if (!content && !this.config.allowEmptyOutput) {
          reject(new AdapterError("empty-output", this.name, `${this.name} produced empty PTY output.`, {
            raw: output
          }));
          return;
        }

        resolve({
          content,
          raw: output
        });
      };

      try {
        term = spawnPty(launch.command, args, {
          name: "xterm-256color",
          cols: this.config.cols ?? 120,
          rows: this.config.rows ?? 40,
          cwd: process.cwd(),
          env: process.env,
          ...(process.platform !== "win32" ? { encoding: "utf8" } : {}),
          ...(process.platform === "win32" ? { useConpty: true } : {})
        });
      } catch (error) {
        reject(new AdapterError("spawn-failed", this.name, `${this.name} failed to start PTY command "${this.config.command}": ${error instanceof Error ? error.message : String(error)}`, {
          command: this.config.command
        }));
        return;
      }

      abortListener = () => {
        finish(cancelledError(this.name));
      };
      prompt.signal?.addEventListener("abort", abortListener, { once: true });

      hardTimer = setTimeout(() => {
        finish(new AdapterError("timeout", this.name, `${this.name} timed out after ${this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`, {
          timeoutMs: this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS
        }));
      }, this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      dataSubscription = term.onData((chunk) => {
        outputBytes += Buffer.byteLength(chunk, "utf8");
        if (outputBytes > maxOutputBytes) {
          finish(new AdapterError("output-too-large", this.name, `${this.name} produced more than ${maxOutputBytes} bytes of PTY output`, {
            maxOutputBytes,
            outputBytes
          }));
          return;
        }
        output += chunk;
      });

      exitSubscription = term.onExit(({ exitCode }) => {
        finish(undefined, exitCode, false);
      });

      if (promptMode === "stdin") {
        term.write(`${renderedPrompt}\r`);
      }
    });
  }
}

/**
 * Résout un lancement PTY sûr. Sous Windows, préfère un binaire natif ou le shim PowerShell
 * npm/pnpm ; refuse les arguments non fiables si seul un wrapper interprété reste disponible.
 */
function resolvePtyLaunch(
  command: string,
  promptMode: "stdin" | "argument",
  model: string | undefined,
  adapterName: string,
  messages: AdapterErrorMessages
): { command: string; argsPrefix: string[] } {
  if (process.platform !== "win32") {
    return { command: resolveExecutablePath(command) ?? command, argsPrefix: [] };
  }

  const native = resolveNativeWindowsExecutable(command);
  if (native) {
    return { command: native, argsPrefix: [] };
  }

  const shim = resolvePowerShellShim(command);
  if (shim) {
    return {
      command: "powershell.exe",
      argsPrefix: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", shim]
    };
  }

  if (promptMode === "argument") {
    throw new AdapterError("spawn-failed", adapterName, messages.unsafeWindowsShellPrompt(adapterName), {
      command,
      promptMode
    });
  }

  if (model && /[&|<>()^%!"\r\n]/.test(model)) {
    throw new AdapterError("spawn-failed", adapterName, messages.unsafeWindowsShellModel(adapterName), {
      command,
      model
    });
  }

  return { command: resolveExecutablePath(command) ?? command, argsPrefix: [] };
}

/**
 * Force la libération des ressources internes ConPTY sur Windows après `term.kill()`, qui ne les
 * relâche pas toujours. Accède à des champs privés non documentés de `node-pty` : purement
 * best-effort, toute erreur est avalée sans remonter à l'appelant.
 */
function cleanupPty(term: PtyProcess): void {
  const maybeTerm = term as unknown as {
    _agent?: {
      _cleanUpProcess?: () => void;
      _conoutSocketWorker?: {
        _worker?: {
          terminate?: () => void;
        };
      };
    };
  };

  try {
    maybeTerm._agent?._cleanUpProcess?.();
    maybeTerm._agent?._conoutSocketWorker?._worker?.terminate?.();
  } catch {
    // Best-effort cleanup for Windows ConPTY internals.
  }
}

/** Construit une `AdapterError` `non-zero-exit` à partir de la sortie brute fusionnée du PTY. */
function createPtyExitError(adapterName: string, exitCode: number, raw: string, messages: AdapterErrorMessages): AdapterError {
  return new AdapterError(
    "non-zero-exit",
    adapterName,
    `${adapterName} exited with code ${exitCode}: ${summarizePtyOutput(raw, messages)}`,
    {
      exitCode,
      raw
    }
  );
}

function summarizePtyOutput(output: string, messages: AdapterErrorMessages): string {
  const cleaned = cleanTerminalOutput(output);
  return cleaned ? cleaned.slice(-1_200) : messages.noPtyOutputCaptured;
}
