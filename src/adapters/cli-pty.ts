import { spawn as spawnPty } from "node-pty";
import { existsSync } from "node:fs";
import path from "node:path";
import { AdapterError } from "../errors.js";
import { executableExtensions } from "../exec.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, CliPtyAgentConfig } from "../types.js";
import { DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS, withModelArgs } from "./cli-shared.js";
import { cleanTerminalOutput } from "./terminal.js";

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
    const renderedPrompt = formatAgentPrompt(prompt);
    const promptMode = this.config.promptMode ?? "stdin";
    const baseArgs = withModelArgs(this.config.args ?? [], this.config.model, this.config.modelArg ?? "--model");
    const args = promptMode === "argument"
      ? [...baseArgs, renderedPrompt]
      : baseArgs;

    return new Promise<AgentResponse>((resolve, reject) => {
      let output = "";
      let outputBytes = 0;
      let settled = false;
      let hardTimer: ReturnType<typeof setTimeout>;
      let term: ReturnType<typeof spawnPty>;
      let dataSubscription: { dispose(): void } | undefined;
      let exitSubscription: { dispose(): void } | undefined;
      const maxOutputBytes = this.config.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

      const finish = (error?: Error, exitCode?: number, kill = true) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        dataSubscription?.dispose();
        exitSubscription?.dispose();

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

        if (exitCode && exitCode !== 0 && !content) {
          reject(createPtyExitError(this.name, exitCode, output));
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
        term = spawnPty(resolveExecutable(this.config.command), args, {
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

function resolveExecutable(command: string): string {
  if (path.isAbsolute(command) || command.includes("\\") || command.includes("/")) {
    return command;
  }

  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const trimmed = directory.trim();
    if (!trimmed) continue;

    for (const extension of executableExtensions(command)) {
      const candidate = path.join(trimmed, `${command}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return command;
}

function cleanupPty(term: ReturnType<typeof spawnPty>): void {
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

function createPtyExitError(adapterName: string, exitCode: number, raw: string): AdapterError {
  return new AdapterError(
    "non-zero-exit",
    adapterName,
    `${adapterName} exited with code ${exitCode}: ${summarizePtyOutput(raw)}`,
    {
      exitCode,
      raw
    }
  );
}

function summarizePtyOutput(output: string): string {
  const cleaned = cleanTerminalOutput(output);
  return cleaned ? cleaned.slice(-1_200) : "aucune sortie PTY capturee.";
}
