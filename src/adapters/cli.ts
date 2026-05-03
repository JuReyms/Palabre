import { spawn } from "node:child_process";
import { AdapterError } from "../errors.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, CliAgentConfig } from "../types.js";

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
      let hardTimer: ReturnType<typeof setTimeout>;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;

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
        stdout += chunk.toString("utf8");
        bumpIdleTimer();
      });

      child.stderr.on("data", (chunk: Buffer) => {
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
      child.on("close", (code) => {
        if (code && code !== 0 && !stdout.trim()) {
          finish(new AdapterError("non-zero-exit", this.name, `${this.name} exited with code ${code}: ${stderr.trim()}`, {
            exitCode: code,
            stderr: stderr.trim()
          }));
          return;
        }

        finish();
      });

      if (promptMode === "stdin") {
        child.stdin.write(renderedPrompt);
        child.stdin.end();
      }
    });
  }
}

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

function cleanCliOutput(output: string): string {
  return output
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .trim();
}
