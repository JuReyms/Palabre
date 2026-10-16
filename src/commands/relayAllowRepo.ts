/** Human-facing authorization command; reuses the config trust store and atomic writer. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { resolveDefaultConfigPath } from "../config.js";
import { trustConfig } from "../configTrust.js";
import { normalizeReviewRepository, validateRelayPolicy } from "../externalSessions/review.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { writeTextFileAtomically } from "../atomicFile.js";

/** Injectable terminal and trust operation for ordinary unit tests; never exposed as CLI flags. */
export interface AllowRepoIo {
  interactive: boolean;
  print(text: string): void;
  confirm(prompt: string): Promise<boolean>;
  trust(file: string): Promise<void>;
}

const terminal: AllowRepoIo = {
  get interactive() { return Boolean(stdin.isTTY && stdout.isTTY); },
  print: text => console.log(sanitizeTerminalText(text)),
  confirm: async text => {
    const prompt = createInterface({ input: stdin, output: stdout });
    try { return ["o", "oui", "y", "yes"].includes((await prompt.question(sanitizeTerminalText(text))).trim().toLowerCase()); }
    finally { prompt.close(); }
  },
  trust: trustConfig
};

/** Copyable command targeting the same configuration, including when the human changes directory. */
export function reviewAuthorizationCommand(repository: string, configPath: string): string {
  const file = path.resolve(configPath);
  const quoted = process.platform === "win32" ? `'${file.replaceAll("'", "''")}'` : `'${file.replaceAll("'", "'\\''")}'`;
  return `palabre relay allow-repo ${repository} --config ${quoted}`;
}

export async function runRelayAllowRepo(tokens: readonly string[], io: AllowRepoIo = terminal): Promise<void> {
  const flags: Record<string, string> = {};
  const values: string[] = [];
  let invalid = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.startsWith("-")) { values.push(token); continue; }
    const name = token === "--lang" ? "--language" : token;
    if (!["--config", "--language"].includes(name) || flags[name] !== undefined || !tokens[i + 1] || tokens[i + 1]!.startsWith("-")) { invalid = true; break; }
    flags[name] = tokens[++i]!;
  }
  let messages = createTranslator(resolveLanguage({ explicitLanguage: flags["--language"] }));
  if (invalid || values.length !== 1 || !normalizeReviewRepository(values[0]!)) throw new Error(messages.relay.allowRepo.usage);
  if (!io.interactive) throw new Error(messages.relay.allowRepo.terminalRequired);
  const repository = normalizeReviewRepository(values[0]!)!;
  const file = path.resolve(flags["--config"] ?? await resolveDefaultConfigPath());
  let original: string;
  let config: Record<string, unknown>;
  try {
    original = await readFile(file, "utf8");
    config = JSON.parse(original);
    if (!config || typeof config !== "object" || Array.isArray(config) || !config.agents || typeof config.agents !== "object" || Array.isArray(config.agents)) throw Error();
  } catch { throw new Error(messages.relay.allowRepo.unreadable(file)); }
  messages = createTranslator(resolveLanguage({ explicitLanguage: flags["--language"], configLanguage: config.language as string | undefined }));
  const text = messages.relay.allowRepo;
  let policy;
  try { policy = config.relay === undefined ? { allowedTasks: [] as "review"[], reviewRepositories: [] as string[] } : validateRelayPolicy(config.relay); }
  catch { throw new Error(text.invalidPolicy(file)); }
  io.print(text.plan(repository, file));
  if (repository.endsWith("/*")) io.print(text.ownerWarning(repository.slice(0, -2)));
  io.print(text.trustNotice);
  if (!(await io.confirm(text.confirm))) { io.print(text.declined); return; }
  if (await readFile(file, "utf8") !== original) throw new Error(text.changed(file));
  config.relay = { allowedTasks: ["review"], reviewRepositories: [...new Set([...policy.reviewRepositories, repository])] };
  try {
    await writeTextFileAtomically(file, `${JSON.stringify(config, null, 2)}\n`);
    await io.trust(file);
  } catch { throw new Error(text.writeFailed(file)); }
  io.print(text.allowed(repository));
}
