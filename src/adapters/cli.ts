import { spawn } from "node:child_process";
import { AdapterError } from "../errors.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, CliAgentConfig } from "../types.js";
import { cleanTerminalOutput } from "./terminal.js";

const DEFAULT_MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

/**
 * Adapter pour les CLIs batch (Codex, Claude, Gemini…).
 * Lance un sous-processus, injecte le prompt via stdin ou argument, capture stdout.
 * Garantit : rejection des sorties vides (sauf `allowEmptyOutput`), des timeouts et des exit codes non nuls sans stdout.
 */
export class CliAdapter implements AgentAdapter {
  readonly role;
  readonly contract: AdapterContract;

  constructor(
    readonly name: string,
    private readonly config: CliAgentConfig
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
      const child = spawn(this.config.command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: this.config.shell ?? false
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      let outputBytes = 0;
      let hardTimer: ReturnType<typeof setTimeout>;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const maxOutputBytes = this.config.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        if (idleTimer) clearTimeout(idleTimer);

        if (error) {
          reject(error);
          return;
        }

        const content = cleanCliOutput(stdout);

        if (!content && !this.config.allowEmptyOutput) {
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

      hardTimer = setTimeout(() => {
        child.kill();
        finish(new AdapterError("timeout", this.name, `${this.name} timed out after ${this.config.timeoutMs ?? 180_000}ms`, {
          timeoutMs: this.config.timeoutMs ?? 180_000
        }));
      }, this.config.timeoutMs ?? 180_000);

      const bumpIdleTimer = () => {
        if (!this.config.idleTimeoutMs) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          child.kill();
          finish(new AdapterError(
            "idle-timeout",
            this.name,
            `${this.name} stopped producing output for ${this.config.idleTimeoutMs}ms`,
            { idleTimeoutMs: this.config.idleTimeoutMs }
          ));
        }, this.config.idleTimeoutMs);
      };

      bumpIdleTimer();

      child.stdout.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > maxOutputBytes) {
          child.kill();
          finish(new AdapterError("output-too-large", this.name, `${this.name} produced more than ${maxOutputBytes} bytes of output`, {
            maxOutputBytes,
            outputBytes
          }));
          return;
        }
        stdout += chunk.toString("utf8");
        bumpIdleTimer();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > maxOutputBytes) {
          child.kill();
          finish(new AdapterError("output-too-large", this.name, `${this.name} produced more than ${maxOutputBytes} bytes of output`, {
            maxOutputBytes,
            outputBytes
          }));
          return;
        }
        stderr += chunk.toString("utf8");
        bumpIdleTimer();
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        const kind = error.code === "ENOENT" ? "command-not-found" : "spawn-failed";
        finish(new AdapterError(kind, this.name, `${this.name} failed to start command "${this.config.command}": ${error.message}`, {
          code: error.code,
          command: this.config.command
        }));
      });
      const finishFromExitCode = (code: number | null) => {
        if (code && code !== 0 && !stdout.trim()) {
          finish(createCliExitError(this.name, code, stderr));
          return;
        }

        finish();
      };

      child.on("close", finishFromExitCode);

      if (promptMode === "stdin") {
        child.stdin.write(renderedPrompt);
      }
      child.stdin.end();
    });
  }
}

/**
 * Insère `modelArg model` dans la liste d'arguments.
 * Si le dernier argument est `-` (stdin marker), insère avant lui pour préserver l'ordre attendu par les CLIs.
 */
function withModelArgs(args: string[], model: string | undefined, modelArg: string): string[] {
  if (!model) {
    return [...args];
  }

  const promptStdinIndex = args.lastIndexOf("-");

  if (promptStdinIndex === args.length - 1) {
    return [
      ...args.slice(0, promptStdinIndex),
      modelArg,
      model,
      ...args.slice(promptStdinIndex)
    ];
  }

  return [...args, modelArg, model];
}

/** Retire les séquences ANSI et les espaces en tête/fin. */
function cleanCliOutput(output: string): string {
  return cleanTerminalOutput(output);
}

/**
 * Construit une `AdapterError` typée depuis un exit code non nul.
 * Élève en `usage-limit` si le stderr contient un signal de quota/rate-limit connu.
 */
function createCliExitError(adapterName: string, exitCode: number, stderr: string): AdapterError {
  const cleanedStderr = cleanCliOutput(stderr);
  const usageLimitMessage = extractUsageLimitMessage(cleanedStderr);
  const unsupportedModelMessage = extractUnsupportedModelMessage(cleanedStderr);

  if (usageLimitMessage) {
    return new AdapterError(
      "usage-limit",
      adapterName,
      `${adapterName} a atteint une limite d'utilisation: ${usageLimitMessage}`,
      {
        exitCode,
        stderr: cleanedStderr
      }
    );
  }

  if (unsupportedModelMessage) {
    return new AdapterError(
      "unsupported-model",
      adapterName,
      `${adapterName} ne peut pas utiliser ce modèle: ${unsupportedModelMessage}`,
      {
        exitCode,
        stderr: cleanedStderr
      }
    );
  }

  return new AdapterError(
    "non-zero-exit",
    adapterName,
    `${adapterName} exited with code ${exitCode}: ${summarizeCliError(cleanedStderr)}`,
    {
      exitCode,
      stderr: cleanedStderr
    }
  );
}

function extractUnsupportedModelMessage(stderr: string): string | undefined {
  const lines = uniqueNonEmptyLines(stderr);
  const match = lines.find((line) => isUnsupportedModelLine(line));

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
    "model does not exist",
    "unknown model"
  ].some((pattern) => normalized.includes(pattern));
}

function extractJsonErrorMessage(line: string): string | undefined {
  const match = line.match(/"message"\s*:\s*"([^"]+)"/);
  return match?.[1];
}
function extractUsageLimitMessage(stderr: string): string | undefined {
  const lines = uniqueNonEmptyLines(stderr);
  const match = lines.find((line) => isUsageLimitLine(line));

  if (!match) {
    return undefined;
  }

  return clipLine(stripLogPrefix(match), 500);
}

function isUsageLimitLine(line: string): boolean {
  const normalized = line.toLowerCase();

  return [
    "usage limit",
    "rate limit",
    "quota exceeded",
    "resource_exhausted",
    "too many requests",
    "insufficient_quota",
    "exceeded your current quota",
    "credit balance is too low",
    "billing hard limit"
  ].some((pattern) => normalized.includes(pattern));
}

function summarizeCliError(stderr: string): string {
  const lines = uniqueNonEmptyLines(stderr).map(stripLogPrefix);

  if (lines.length === 0) {
    return "aucun stderr capture.";
  }

  return clipLine(lines.slice(-8).join("\n"), 1_200);
}

function uniqueNonEmptyLines(value: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const line of value.split(/\r?\n/)) {
    const cleaned = line.trim();

    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    lines.push(cleaned);
  }

  return lines;
}

function stripLogPrefix(line: string): string {
  return line
    .replace(/^\d{4}-\d{2}-\d{2}T\S+\s+(ERROR|WARN|INFO|DEBUG)\s+[^:]+:\s*/i, "")
    .replace(/^ERROR:\s*/i, "")
    .trim();
}

function clipLine(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}
