/** @file Décision de lancement d'une commande `run` : accueil TUI, Chat direct ou Débat/Ask. */
import type { ParsedArgs } from "./args.js";
import { optionalString } from "./commands/shared.js";
import type { PalabreConfig } from "./types.js";

/**
 * Détermine si l'accueil TUI doit s'ouvrir : commande `run` implicite, sans sujet, preset
 * ni flag de rendu déjà fourni. Toute intention explicite de lancer directement une session
 * (topic, `--renderer`, `--json`, `--plain`, `--terminal`) désactive l'accueil.
 */
export function shouldOpenTuiHome(parsed: ParsedArgs): boolean {
  return parsed.command === "run"
    && !parsed.commandExplicit
    && parsed.positionals.length === 0
    && optionalString(parsed.flags.topic) === undefined
    && optionalString(parsed.flags.renderer) === undefined
    && parsed.flags.json !== true
    && parsed.flags.plain !== true
    && parsed.flags.terminal !== true;
}

/**
 * Indique si un lancement direct doit ouvrir Chat : `palabre chat`, ou toute commande `run` qui
 * n'ouvre pas l'accueil TUI (`palabre run`, raccourci avec sujet, preset, `--json`…) quand le mode
 * effectif est Chat. Le mode effectif est `--mode`, puis `defaults.mode` ; un `--mode debate` ou
 * `--mode ask` explicite reste donc prioritaire. Le lancement nu garde l'accueil et son mode.
 */
export function isDirectChatLaunch(parsed: ParsedArgs, config: Pick<PalabreConfig, "defaults">): boolean {
  if (parsed.command === "chat") return true;
  return parsed.command === "run"
    && !shouldOpenTuiHome(parsed)
    && (optionalString(parsed.flags.mode) ?? config.defaults?.mode) === "chat";
}
