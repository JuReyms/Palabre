/**
 * @file Indice fermé tiré du stderr d'une CLI externe en échec (#270, lot A).
 * Seule une valeur de la liste fermée sort de ce module : aucun texte, chemin ou ligne n'est
 * conservé. C'est un indice, jamais une cause établie ; il ne modifie ni l'issue ni la délivrance.
 * Les motifs sont précis (codes et formulations système) : un simple mot comme « auth » ou
 * « config » ne suffit pas. Sans correspondance, aucun indice n'est rendu.
 */
import { sanitizeTerminalText } from "../adapters/terminal.js";

/** Indices reconnus, par ordre de priorité quand plusieurs coexistent. */
export const STDERR_HINTS = ["access-denied", "network", "panic"] as const;
export type StderrHint = typeof STDERR_HINTS[number];

/**
 * Les codes numériques `os error N` changent de sens selon la plateforme : 5 est un accès refusé
 * sous Windows (ERROR_ACCESS_DENIED) mais une erreur d'entrée/sortie sous Linux (EIO) ; 13 est
 * EACCES sous POSIX mais ERROR_INVALID_DATA sous Windows. Les formulations explicites valent partout.
 * `\b` ignore les lettres accentuées : « refusé » est borné par `\p{L}`, pas par `\b`.
 */
function patterns(platform: NodeJS.Platform): Record<StderrHint, RegExp> {
  const accessCode = platform === "win32" ? String.raw`\bos error 5\b` : String.raw`\bos error 13\b`;
  return {
    "access-denied": new RegExp(String.raw`${accessCode}|\baccess is denied\b|(?<!\p{L})acc[eè]s refus[eé](?!\p{L})|\bE(?:ACCES|PERM)\b|\bpermission denied\b`, "iu"),
    // Codes réseau système et erreur d'envoi HTTP des CLIs Rust (reqwest).
    network: /\bE(?:CONNREFUSED|CONNRESET|NOTFOUND|TIMEDOUT|AI_AGAIN)\b|\bdns error\b|\berror sending request for url\b/iu,
    // Arrêt brutal d'un programme Rust.
    panic: /\bthread '[^'\n]*' panicked at\b/u
  };
}

/** Ligne d'erreur terminale (`Error: …`, `fatal: …`), à préférer aux avertissements. */
const FATAL_LINE = /^\s*(?:error|fatal)\s*:/iu;
/** Suite d'une erreur terminale : ligne vide, `Caused by:` ou ligne indentée (format anyhow). */
const CONTINUATION_LINE = /^(?:\s*$|\s*caused by\s*:|\s+\S)/iu;

/** Borne d'examen en caractères (unités UTF-16) : la fin du flux, où se trouve l'erreur terminale. */
const MAX_EXAMINED_CHARS = 64 * 1024;

/**
 * Classe le stderr d'un processus en échec. Les contrôles terminaux sont retirés d'abord, pour
 * qu'une couleur ne masque pas `Error:`. Si des erreurs terminales existent, seules elles et leurs
 * lignes de suite comptent : un avertissement « accès refusé » ne doit pas masquer une autre cause
 * fatale. Sinon, tout le flux examiné compte. Plusieurs indices : le premier de `STDERR_HINTS`.
 */
export function classifyStderr(stderr: string, platform: NodeJS.Platform = process.platform): StderrHint | undefined {
  const lines = sanitizeTerminalText(stderr.slice(-MAX_EXAMINED_CHARS)).split("\n");
  const fatal: string[] = [];
  let inFatal = false;
  for (const line of lines) {
    if (FATAL_LINE.test(line)) inFatal = true;
    else if (inFatal && !CONTINUATION_LINE.test(line)) inFatal = false;
    if (inFatal) fatal.push(line);
  }
  const examined = (fatal.length > 0 ? fatal : lines).join("\n");
  const byHint = patterns(platform);
  return STDERR_HINTS.find((hint) => byHint[hint].test(examined));
}
