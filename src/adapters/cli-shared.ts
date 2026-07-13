/** @file Constantes et utilitaires partagés entre les adapters `cli` et `cli-pty`. */

/** Limite de sortie par défaut des adapters CLI/PTY : 50 Mio avant `output-too-large`. */
export const DEFAULT_MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

/** Timeout dur par défaut d'un appel d'agent CLI/PTY (3 minutes). */
export const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Force les runtimes Python enfants à utiliser UTF-8 pour leurs flux standard.
 * Sous Windows, cela évite que les CLIs Python échouent en écrivant un caractère
 * absent de la page de code locale (par exemple une flèche Unicode).
 */
export function utf8ChildProcessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1"
  };
}

/** Une valeur invalide ne doit jamais désactiver silencieusement la protection mémoire. */
export function resolveMaxOutputBytes(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MAX_OUTPUT_BYTES;
}

/**
 * Cherche dans un texte (stderr ou flux PTY) une ligne signalant un quota ou un
 * rate-limit connu, pour classer l'erreur en `usage-limit`.
 * @returns La ligne fautive nettoyée et tronquée, ou `undefined` si rien ne matche.
 */
export function extractUsageLimitMessage(text: string): string | undefined {
  const match = uniqueNonEmptyLines(text).find((line) => isUsageLimitLine(line));

  if (!match) {
    return undefined;
  }

  return clipLine(stripLogPrefix(match), 500);
}

/**
 * Détecte un diagnostic de quota dans un flux PTY fusionné sans interpréter une
 * réponse normale qui mentionnerait simplement les notions de quota ou rate-limit.
 * Les motifs acceptés sont des erreurs machine ou des messages de quota autonomes.
 */
export function extractPtyUsageLimitMessage(text: string): string | undefined {
  const match = uniqueNonEmptyLines(text).find((line) => {
    const cleaned = stripLogPrefix(line);
    const normalized = cleaned.toLowerCase();
    const hasErrorPrefix = /^(error|fatal|warning)\s*:/i.test(line.trim());

    return /^individual quota reached(?:[.!:]|$)/i.test(cleaned)
      || /\b(resource_exhausted|insufficient_quota)\b/i.test(cleaned)
      || /\bhttp\s*429\b/i.test(cleaned)
      || /^too many requests(?:[.!:]|$)/i.test(cleaned)
      || (hasErrorPrefix && isUsageLimitLine(normalized));
  });

  return match ? clipLine(stripLogPrefix(match), 500) : undefined;
}
function isUsageLimitLine(line: string): boolean {
  const normalized = line.toLowerCase();

  return [
    "usage limit",
    "rate limit",
    "quota exceeded",
    "quota reached",
    "resource_exhausted",
    "too many requests",
    "insufficient_quota",
    "exceeded your current quota",
    "credit balance is too low",
    "billing hard limit"
  ].some((pattern) => normalized.includes(pattern));
}

/** Déduplique les lignes non vides d'un texte, en préservant l'ordre d'apparition. */
export function uniqueNonEmptyLines(value: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const line of value.split(/\r?\n/)) {
    const cleaned = line.trim();

    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    lines.push(cleaned);
  }

  return lines;
}

/** Retire un éventuel préfixe de log (`2026-01-01T... ERROR module:` ou `ERROR:`) d'une ligne. */
export function stripLogPrefix(line: string): string {
  return line
    .replace(/^\d{4}-\d{2}-\d{2}T\S+\s+(ERROR|WARN|INFO|DEBUG)\s+[^:]+:\s*/i, "")
    .replace(/^ERROR:\s*/i, "")
    .trim();
}

/** Tronque une ligne à `maxLength` caractères avec une ellipse. */
export function clipLine(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

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
