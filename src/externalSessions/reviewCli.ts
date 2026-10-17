/** Compatibility check for the resolved Claude review CLI; never invokes a model. */
import type { ExternalExecutable } from "./adapter.js";
import { runExternalProcess, type ExternalProcessResult } from "./process.js";

/** Oldest supported review CLI, verified with --safe-mode. Notifications keep their defaults. */
export const MIN_CLAUDE_REVIEW_VERSION = "2.1.292";

export interface ReviewCliIdentity {
  /** Native executable, or CLI script when launched through a recognized npm shim. */
  path: string;
  version: string | null;
}

export async function checkClaudeReviewCli(
  executable: ExternalExecutable,
  cwd: string,
  run: typeof runExternalProcess = runExternalProcess
): Promise<{ supported: boolean; cli: ReviewCliIdentity }> {
  const cli: ReviewCliIdentity = { path: executable.prefixArgs[0] ?? executable.command, version: null };
  const complete = (result: ExternalProcessResult) => result.started && result.exitCode === 0
    && result.signal === null && !result.launchFailure && !result.stopReason && !result.forcedReturn;
  const probe = (arg: string) => run({ command: executable.command, args: [...executable.prefixArgs, arg],
    cwd, stdin: "", timeoutMs: 15_000, maxOutputBytes: 256 * 1024 });
  const version = await probe("--version");
  if (!complete(version)) return { supported: false, cli };
  cli.version = /^(\d+\.\d+\.\d+) \(Claude Code\)\s*$/.exec(version.stdout.trim())?.[1] ?? null;
  if (!cli.version) return { supported: false, cli };
  const help = await probe("--help");
  const parts = cli.version.split(".").map(BigInt);
  const minimum = MIN_CLAUDE_REVIEW_VERSION.split(".").map(BigInt);
  const difference = parts.findIndex((part, index) => part !== minimum[index]);
  const supported = (difference < 0 || parts[difference]! > minimum[difference]!) && complete(help)
    && /^\s*--safe-mode(?:\s|,|$)/m.test(help.stdout);
  return { supported, cli };
}
