import { spawn } from "node:child_process";
import { formatAgentPrompt } from "../prompt.js";
import type { AgentAdapter, AgentPrompt, AgentResponse, CliAgentConfig } from "../types.js";

export class CliAdapter implements AgentAdapter {
  readonly role;

  constructor(
    readonly name: string,
    private readonly config: CliAgentConfig
  ) {
    this.role = config.role;
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
          reject(new Error(`${this.name} produced empty output.${detail}`));
          return;
        }

        resolve({
          content,
          raw: stdout
        });
      };

      hardTimer = setTimeout(() => {
        child.kill();
        finish(new Error(`${this.name} timed out after ${this.config.timeoutMs ?? 180_000}ms`));
      }, this.config.timeoutMs ?? 180_000);

      const bumpIdleTimer = () => {
        if (!this.config.idleTimeoutMs) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          child.kill();
          finish();
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

      child.on("error", finish);
      child.on("close", (code) => {
        if (code && code !== 0 && !stdout.trim()) {
          finish(new Error(`${this.name} exited with code ${code}: ${stderr.trim()}`));
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
