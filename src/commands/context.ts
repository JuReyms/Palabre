/** @file Commande palabre context scan et rendu de son contrat versionne. */
import { buildContextScan } from "../contextScan.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { optionalString, type CommandFlags } from "./shared.js";

/**
 * Scanne les chemins demandés avec les mêmes règles que `--context`.
 * @param flags - Flags de langue et de format JSON.
 * @param positionals - Sous-commande puis chemins à scanner.
 * @returns Une promesse résolue après écriture du résultat et des warnings.
 */
export async function runContextCommand(flags: CommandFlags, positionals: string[]): Promise<void> {
  const messages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language) }));
  const subcommand = positionals[0] ?? "scan";
  if (subcommand !== "scan") {
    throw new Error(messages.common.unknownCommand(`context ${subcommand}`, "context scan"));
  }

  const result = await buildContextScan(positionals.slice(1), process.cwd(), messages);
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const folder of result.items.filter((item) => item.kind === "folder")) {
    console.log(`[folder] ${folder.path}`);
  }
  for (const file of result.items.filter((item) => item.kind === "file")) {
    console.log(`[file] ${file.path} (${file.sizeBytes} bytes)`);
  }
  for (const warning of result.warnings) {
    console.error(`${messages.renderers.warningPrefix} ${warning}`);
  }
}
