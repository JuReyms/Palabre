import { buildContextScan } from "../contextScan.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import { optionalString, type CommandFlags } from "./shared.js";

/** Exécute `palabre context scan` en sortie humaine ou JSON versionné. */
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
