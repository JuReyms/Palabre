/** @file Parseur d'arguments CLI : table d'arité des flags, syntaxe courte preset/sujet, alias `-s`/`--topic`. */
import { listPresetNames } from "./presets.js";
import type { Messages } from "./messages/index.js";

/** Résultat structuré du parsing de `process.argv`. */
export interface ParsedArgs {
  command: string;
  commandExplicit: boolean;
  positionals: string[];
  flags: Record<string, string | string[] | boolean>;
}

/** Arité d'un flag long connu : sans valeur, une valeur, ou plusieurs valeurs. */
type FlagArity = "boolean" | "single" | "multi";

interface FlagSpec {
  arity: FlagArity;
  /** Nombre maximum de valeurs collectées pour un flag `multi`. */
  max?: number;
}

/**
 * Table centrale décrivant l'arité de chaque flag long canonique.
 *
 * C'est la source de vérité du parser : un flag `boolean` ne consomme jamais le
 * token suivant (évite que `--plain codex-claude "x"` avale le preset), un flag
 * `single` exige une valeur, un flag `multi` collecte plusieurs valeurs.
 *
 * Les noms sont les noms canoniques après `normalizeFlagName` (ex. `subject`
 * est normalisé en `topic` avant la recherche dans cette table).
 */
const FLAG_SPECS: Record<string, FlagSpec> = {
  // Booléens : présence = vrai, aucune valeur consommée.
  help: { arity: "boolean" },
  version: { arity: "boolean" },
  tui: { arity: "boolean" },
  terminal: { arity: "boolean" },
  plain: { arity: "boolean" },
  json: { arity: "boolean" },
  "no-summary": { arity: "boolean" },
  "no-early-stop": { arity: "boolean" },
  "show-prompt": { arity: "boolean" },
  "pull-models": { arity: "boolean" },
  "trust-config": { arity: "boolean" },
  local: { arity: "boolean" },
  apply: { arity: "boolean" },
  "clear-defaults": { arity: "boolean" },
  "sync-agents": { arity: "boolean" },
  "sync-ollama-model": { arity: "boolean" },
  "ollama-models": { arity: "boolean" },
  // Valeur unique.
  "agent-a": { arity: "single" },
  "agent-b": { arity: "single" },
  config: { arity: "single" },
  interface: { arity: "single" },
  language: { arity: "single" },
  "model-a": { arity: "single" },
  "model-b": { arity: "single" },
  "role-a": { arity: "single" },
  "role-b": { arity: "single" },
  "ask-role": { arity: "single" },
  "ollama-url": { arity: "single" },
  mode: { arity: "single" },
  "set-ollama-model": { arity: "single" },
  preset: { arity: "single" },
  "summary-agent": { arity: "single" },
  "ask-summary-agent": { arity: "single" },
  "summary-model": { arity: "single" },
  topic: { arity: "single" },
  turns: { arity: "single" },
  renderer: { arity: "single" },
  // Valeurs multiples.
  agents: { arity: "multi" },
  "ask-agents": { arity: "multi" },
  "set-defaults": { arity: "multi", max: 2 },
  files: { arity: "multi" },
  context: { arity: "multi" }
};

/** Commandes acceptées comme premier argument positionnel. */
const COMMANDS = new Set([
  "run",
  "ask",
  "new",
  "init",
  "setup",
  "help",
  "version",
  "update",
  "doctor",
  "config",
  "agent",
  "agents",
  "agent-role",
  "preset",
  "presets",
  "history",
  "historique",
  "context"
]);

/**
 * Parse `process.argv` en une structure typée `ParsedArgs`.
 * Gère les flags courts (-h, -v, -s, -t, -a), les flags longs pilotés par
 * `FLAG_SPECS`, les flags multi-valeurs (--files, --context, --set-defaults) et
 * les positionnels.
 * @param args - Tableau d'arguments (généralement `process.argv.slice(2)`).
 * @returns Commande détectée, indicateur d'explicitation et map de flags.
 */
export function parseArgs(args: string[], messages: Messages): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  let command = "run";
  let commandExplicit = false;
  const positionals: string[] = [];
  const presets = new Set(listPresetNames());

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value.startsWith("-") && !commandExplicit && positionals.length === 0 && COMMANDS.has(value)) {
      command = value;
      commandExplicit = true;
      continue;
    }

    if (!value.startsWith("-") && index === 0) {
      if (COMMANDS.has(value)) {
        command = value;
        commandExplicit = true;
      } else if (isLikelyCommandTypo(value, COMMANDS)) {
        throw new Error(messages.common.unknownCommand(value, Array.from(COMMANDS).join(", ")));
      } else {
        positionals.push(value);
      }
      continue;
    }

    if (!value.startsWith("-")) {
      positionals.push(value);
      continue;
    }

    if (value === "-h") {
      flags.help = true;
      continue;
    }

    if (value === "-v") {
      flags.version = true;
      continue;
    }

    if (value === "-a") {
      command = "agents";
      commandExplicit = true;
      continue;
    }

    if (value === "-s") {
      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        throw new Error(messages.common.optionRequiresValue("-s"));
      }

      flags.topic = next;
      index += 1;
      continue;
    }

    if (value === "-t") {
      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        throw new Error(messages.common.optionRequiresValue("-t"));
      }

      flags.turns = next;
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      const rawKey = value.slice(2);
      const key = normalizeFlagName(rawKey);
      const spec = FLAG_SPECS[key];

      if (spec?.arity === "multi") {
        const values: string[] = [];

        while (args[index + 1] && !args[index + 1].startsWith("-") && (spec.max === undefined || values.length < spec.max)) {
          values.push(args[index + 1]);
          index += 1;
        }

        if (key === "set-defaults" && values.length !== 2) {
          throw new Error(messages.common.setDefaultsRequiresTwo);
        }

        flags[key] = key === "set-defaults"
          ? values
          : [...getStringListFlag(flags[key]), ...values];
        continue;
      }

      if (spec?.arity === "boolean") {
        flags[key] = true;
        continue;
      }

      const next = args[index + 1];
      const wantsValue = spec?.arity === "single";

      if (!next || next.startsWith("-")) {
        if (wantsValue) {
          throw new Error(messages.common.optionRequiresValue(`--${rawKey}`));
        }

        flags[key] = true;
      } else if (wantsValue) {
        flags[key] = next;
        index += 1;
      } else {
        // Flag inconnu : traité comme booléen pour ne jamais avaler un positionnel.
        flags[key] = true;
      }
    }
  }

  if (command === "run") {
    applyRunPositionals(positionals, flags, presets, commandExplicit, COMMANDS, messages);
  } else if (command === "ask") {
    flags.mode = "ask";
    applyTopicPositionals(positionals, flags);
  }

  return { command, commandExplicit, positionals, flags };
}

function applyTopicPositionals(positionals: string[], flags: Record<string, string | string[] | boolean>): void {
  if (positionals.length > 0) {
    flags.topic ??= positionals.join(" ");
  }
}

/**
 * Détecte si une valeur ressemble à une faute de frappe d'une commande connue
 * (même première lettre et distance de Levenshtein ≤ 2).
 * @param value - Token saisi par l'utilisateur.
 * @param commands - Ensemble des commandes valides.
 */
export function isLikelyCommandTypo(value: string, commands: Set<string>): boolean {
  const normalized = value.toLowerCase();

  for (const command of commands) {
    if (normalized[0] === command[0] && levenshteinDistance(normalized, command) <= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes (insertions, suppressions, substitutions).
 * @param left - Première chaîne.
 * @param right - Deuxième chaîne.
 * @returns Distance entière ≥ 0.
 */
function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertCost = previous[rightIndex + 1] + 1;
      const deleteCost = previous[rightIndex] + 1;
      const replaceCost = diagonal + (left[leftIndex] === right[rightIndex] ? 0 : 1);
      diagonal = previous[rightIndex + 1];
      previous[rightIndex + 1] = Math.min(insertCost, deleteCost, replaceCost);
    }
  }

  return previous[right.length] ?? 0;
}

/**
 * Interprète les arguments positionnels pour la commande `run` :
 * premier positionnel = preset si connu, sinon sujet complet concaténé.
 * @param positionals - Arguments positionnels extraits du parseur.
 * @param flags - Map de flags à muter si un preset ou un sujet est détecté.
 * @param presets - Ensemble des noms de presets valides.
 * @param commandExplicit - `true` si l'utilisateur a tapé `palabre run` explicitement.
 */
function applyRunPositionals(
  positionals: string[],
  flags: Record<string, string | string[] | boolean>,
  presets: Set<string>,
  commandExplicit: boolean,
  commands: Set<string>,
  messages: Messages
): void {
  if (positionals.length === 0) {
    return;
  }

  const [first, ...rest] = positionals;

  if (presets.has(first)) {
    flags.preset ??= first;

    if (rest.length > 0) {
      flags.topic ??= rest.join(" ");
    }

    return;
  }

  if (!commandExplicit && positionals.length === 1 && !positionals[0]?.includes(" ")) {
    if (isLikelyCommandTypo(positionals[0], commands)) {
      throw new Error(messages.common.unknownCommand(positionals[0], Array.from(commands).join(", ")));
    }
    throw new Error(messages.common.ambiguousSubject(positionals[0]));
  }

  flags.topic ??= positionals.join(" ");
}

/**
 * Normalise un nom de flag long en son alias canonique (ex. `subject` → `topic`).
 * @param value - Nom brut extrait après `--`.
 */
export function normalizeFlagName(value: string): string {
  const aliases: Record<string, string> = {
    lang: "language",
    s: "topic",
    subject: "topic",
    t: "turns",
    "no-tui": "terminal"
  };

  return aliases[value] ?? value;
}

/**
 * Normalise une valeur de flag multi-valeur en tableau de chaînes.
 * @param value - Valeur brute (tableau, chaîne unique ou absent).
 * @returns Tableau de chaînes, vide si la valeur n'est pas applicable.
 */
export function getStringListFlag(value: string | string[] | boolean | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}
