/** @file Identité du processus et titre temporaire du terminal, hors des flux machine. */
import { rawCommandName } from "./args.js";
import type { Language } from "./types.js";

/** Effets isolés pour éprouver les consoles sans modifier celle des tests. */
export interface CliIdentityHost {
  getTitle(): string;
  setTitle(title: string): void;
  write(text: string): void;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
}

/** Cycle d'identité : le mode peut changer depuis l'accueil TUI. */
export interface CliIdentity {
  update(mode: string, language: Language): void;
  dispose(): void;
}

const MODES: Record<string, [string, string]> = {
  debate: ["Débat", "Debate"],
  ask: ["Ask", "Ask"],
  chat: ["Chat", "Chat"],
  relay: ["Relay", "Relay"],
  mission: ["Mission", "Mission"]
};

/** Décoration facultative : une console indisponible ne change jamais le résultat de la commande. */
function bestEffort(effect: () => void): void {
  try { effect(); } catch { /* Un hôte peut refuser les titres. */ }
}

/**
 * Pose tôt le nom logique, puis un titre humain uniquement en TTY sans JSON/NDJSON.
 * La pile xterm précède process.title, qui change aussi le titre natif sous Windows.
 * À la fin, restaurer process.title d'abord fournit le repli console classique Windows ;
 * la pile restaure ensuite le titre de l'hôte lorsqu'il la prend en charge.
 */
export function startCliIdentity(args: readonly string[], language: Language, host: CliIdentityHost = {
  getTitle: () => process.title,
  setTitle: (title) => { process.title = title; },
  write: (text) => { process.stdout.write(text); },
  isTTY: Boolean(process.stdout.isTTY),
  env: process.env
}): CliIdentity {
  const command = rawCommandName(args);
  const machine = args.some((arg, index) => arg === "--json" || arg.startsWith("--json=")
    || arg === "--renderer=ndjson" || (arg === "--renderer" && args[index + 1] === "ndjson"));
  const terminal = host.isTTY && !machine && host.env.NO_COLOR === undefined && host.env.TERM !== "dumb";
  let original: string | undefined;
  bestEffort(() => { original = host.getTitle(); });
  let pushed = false;
  if (terminal) bestEffort(() => { host.write("\x1b[22;0t"); pushed = true; });
  bestEffort(() => { host.setTitle(`palabre ${command}`); });
  let disposed = false;
  let lastTitle: string | undefined;
  const identity: CliIdentity = {
    update(mode, currentLanguage) {
      if (!terminal || disposed) return;
      const labels = Object.hasOwn(MODES, mode) ? MODES[mode] : undefined;
      const ascii = Boolean(host.env.PALABRE_ASCII);
      const label = labels?.[currentLanguage === "fr" ? 0 : 1];
      const title = label ? `Palabre${ascii ? " - " : " · "}${ascii ? label.replace("é", "e") : label}` : "Palabre";
      if (title === lastTitle) return;
      bestEffort(() => { host.write(`\x1b]2;${title}\x1b\\`); lastTitle = title; });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Le repli natif Windows fonctionne aussi lorsque la console ignore la pile xterm.
      if (original !== undefined) bestEffort(() => { host.setTitle(original!); });
      if (pushed) bestEffort(() => { host.write("\x1b[23;0t"); });
    }
  };
  const modeIndex = args.indexOf("--mode");
  const initialMode = command === "run" ? (modeIndex >= 0 ? args[modeIndex + 1] ?? "" : "") : command;
  identity.update(initialMode, language);
  return identity;
}
