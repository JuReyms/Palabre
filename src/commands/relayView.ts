/** @file Préférence Relay : seule commande opérateur, confirmation clavier et configuration approuvée. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { resolveDefaultConfigPath } from "../config.js";
import { isConfigTrusted, trustConfig } from "../configTrust.js";
import { validateRelayPolicy } from "../externalSessions/review.js";
import { writeTextFileAtomically } from "../atomicFile.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { relayViewText } from "../messages/relayView.js";
import { DEFAULT_RELAY_VIEW } from "../externalSessions/relayView.js";
import type { AllowRepoIo } from "./relayAllowRepo.js";

const terminal: AllowRepoIo = {
  get interactive() { return Boolean(stdin.isTTY && stdout.isTTY); },
  print: text => console.log(sanitizeTerminalText(text)),
  confirm: async text => {
    const prompt = createInterface({ input: stdin, output: stdout });
    try { return ["o", "oui", "y", "yes"].includes((await prompt.question(sanitizeTerminalText(text))).trim().toLowerCase()); }
    finally { prompt.close(); }
  },
  isTrusted: isConfigTrusted,
  trust: (file, sha256) => trustConfig(file, undefined, sha256)
};

/** Commande exacte visant le même fichier, à exécuter seulement par le propriétaire. */
export function relayViewCommand(file: string): string {
  const absolute = path.resolve(file);
  const quoted = process.platform === "win32" ? `'${absolute.replaceAll("'", "''")}'` : `'${absolute.replaceAll("'", "'\\''")}'`;
  return `palabre config --relay-view auto --config ${quoted}`;
}

/**
 * Ne crée pas de config, ne migre pas ses autres champs et n'approuve jamais un fichier non
 * approuvé. IO injectables pour profils fictifs seulement ; aucun flag ne remplace le clavier.
 */
export async function runRelayViewCommand(tokens: readonly string[], io: AllowRepoIo = terminal): Promise<void> {
  const flags: Record<string, string> = {};
  let invalid = false;
  for (let i = 0; i < tokens.length; i++) {
    const name = tokens[i] === "--lang" ? "--language" : tokens[i]!;
    if (!["--relay-view", "--config", "--language"].includes(name) || flags[name] !== undefined || !tokens[i + 1] || tokens[i + 1]!.startsWith("-")) { invalid = true; break; }
    flags[name] = tokens[++i]!;
  }
  let language = resolveLanguage({ explicitLanguage: flags["--language"] });
  let text = relayViewText(language);
  const view = flags["--relay-view"];
  if (invalid || (view !== "auto" && view !== "background")) throw new Error(text.usage);
  if (!io.interactive) throw new Error(text.terminal);
  const file = path.resolve(flags["--config"] ?? await resolveDefaultConfigPath());
  let original: string;
  let config: Record<string, unknown>;
  let before: string;
  try {
    original = await readFile(file, "utf8");
    config = JSON.parse(original);
    if (!config || typeof config !== "object" || Array.isArray(config) || !config.agents || typeof config.agents !== "object" || Array.isArray(config.agents)) throw Error();
    before = config.relay === undefined ? DEFAULT_RELAY_VIEW : validateRelayPolicy(config.relay).view ?? DEFAULT_RELAY_VIEW;
  } catch { throw new Error(text.unreadable(file)); }
  language = resolveLanguage({ explicitLanguage: flags["--language"], configLanguage: config.language as string | undefined });
  text = relayViewText(language);
  if (!(await io.isTrusted(file))) {
    const command = relayViewCommand(file).replace("--relay-view auto ", "") + " --trust-config";
    throw new Error(createTranslator(language).relay.allowRepo.untrusted(file, command));
  }
  io.print(text.plan(file, before, view));
  io.print(text.notice);
  if (!(await io.confirm(text.confirm))) throw new Error(text.declined);
  if (await readFile(file, "utf8") !== original || !(await io.isTrusted(file))) throw new Error(text.changed(file));
  config.relay = { ...(config.relay as Record<string, unknown> | undefined), view };
  const updated = `${JSON.stringify(config, null, 2)}\n`;
  try {
    await writeTextFileAtomically(file, updated);
    await io.trust(file, createHash("sha256").update(updated).digest("hex"));
  } catch { throw new Error(text.failed(file)); }
  io.print(text.done(file, view));
}
