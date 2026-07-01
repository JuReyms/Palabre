/** @file Constantes et utilitaires partagés entre les adapters `cli` et `cli-pty`. */

/** Limite de sortie par défaut des adapters CLI/PTY : 50 Mio avant `output-too-large`. */
export const DEFAULT_MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

/** Timeout dur par défaut d'un appel d'agent CLI/PTY (3 minutes). */
export const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Insère `modelArg model` dans la liste d'arguments d'une commande CLI.
 * Si le dernier argument est `-` (marqueur stdin), insère avant lui pour
 * préserver l'ordre attendu par les CLIs qui lisent le prompt sur stdin.
 */
export function withModelArgs(args: string[], model: string | undefined, modelArg: string): string[] {
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
