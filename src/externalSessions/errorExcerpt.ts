/**
 * @file Extrait privé du stderr d'une CLI externe en échec, seulement sur demande (#270, lot B).
 *
 * `palabre relay --save-error-excerpt` écrit, après un échec d'envoi ordinaire en arrière-plan, un
 * fichier local distinct de l'export : les dernières lignes du stderr de la phase en échec. Aucune
 * collecte directe du prompt, de l'enveloppe, des variables d'environnement ni de la configuration ;
 * le stderr peut néanmoins en recopier, et le masquage est partiel (un secret court, inconnu ou
 * découpé sur plusieurs lignes peut lui échapper). Le texte reste une donnée non fiable.
 *
 * Ordre fixe, sans copie brute intermédiaire sur disque : fenêtre de fin de flux, première ligne
 * partielle retirée, contrôles terminaux et caractères de mise en forme retirés, masquage sur le
 * texte entier, puis seulement les bornes (lignes, octets UTF-8). Écriture exclusive (`wx`), nom
 * daté et aléatoire indépendant des données, sans écrasement ni nouvelle tentative. `wx` protège le
 * fichier final seulement : un dossier parent peut être un lien ou une jonction. Le mode 0600 n'est
 * appliqué que sous POSIX ; sous Windows, Node ne réserve pas l'accès au propriétaire et les droits
 * suivent le dossier. Un échec rend `failed`, jamais un chemin supposé, sans effet sur le résultat Relay.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";

/** Champ facultatif `errorExcerpt` du JSON Relay v1 : emplacement seulement, jamais le texte. */
export type RelayErrorExcerptReport =
  | { status: "saved"; path: string }
  | { status: "empty" | "failed"; path?: never };

/** Fenêtre examinée en fin de flux (unités UTF-16), comme l'indice du lot A. */
const MAX_EXAMINED_CHARS = 64 * 1024;
/** Bornes de l'extrait conservé. */
export const MAX_EXCERPT_LINES = 40;
export const MAX_EXCERPT_BYTES = 8 * 1024;
/** Remplacement neutre, identique dans toutes les langues. */
export const MASK = "[***]";

/**
 * Caractères invisibles de mise en forme (`Cf` : bidi, largeur nulle, U+061C…) et contrôles bidi,
 * retirés avant le masquage : insérés dans un nom sensible (`pass` U+061C `word=`), ils le cacheraient.
 */
const FORMAT_CHARACTERS = /[\p{Cf}\p{Bidi_Control}]/gu;

/**
 * Masques appliqués dans cet ordre. Les formes précises passent avant la forme générique des
 * chaînes opaques, pour garder un texte lisible (`Bearer [***]`, `?[***]`).
 */
const MASKS: Array<[RegExp, string]> = [
  // Paramètres de requête d'URL : souvent porteurs de jetons.
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#'"<>]*)\?[^\s'"<>)]*/giu, `$1?${MASK}`],
  // JWT.
  [/\beyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*/gu, MASK],
  // Préfixes de jetons connus (OpenAI/Anthropic, GitHub, Slack, AWS).
  [/\b(?:sk|pk|rk)-[\w-]{16,}/gu, MASK],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,})/gu, MASK],
  [/\bxox[abprs]-[\w-]{10,}/gu, MASK],
  [/\bAKIA[0-9A-Z]{16}\b/gu, MASK],
  // En-têtes d'autorisation.
  [/\b(Bearer|Basic|Token)\s+[\w.~+/=-]{8,}/giu, `$1 ${MASK}`],
  // Affectations nommées : `password=…`, `api_key: …`, `"token": "…"`. Valeur entre apostrophes ou
  // guillemets d'abord, espaces et échappements compris ; puis valeur sans délimiteur.
  [/\b([\w-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[\w-]*)(["']?\s*[=:]\s*)(["'])(?:\\.|(?!\3)[^\\\n])*\3/giu, `$1$2$3${MASK}$3`],
  [/\b([\w-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[\w-]*)(["']?\s*[=:]\s*["']?)[^\s"',;&]+/giu, `$1$2${MASK}`],
  // Adresses e-mail.
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu, MASK],
  // UUID (identifiants de conversation, de compte ou de requête).
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu, MASK],
  // Chaînes opaques longues mêlant lettres et chiffres (jetons, clés, empreintes). `/` en est exclu
  // pour garder les chemins lisibles : un jeton base64 contenant `/` peut échapper à ce masque.
  [/(?<![\w+=-])(?=[\w+=-]*\d)(?=[\w+=-]*[A-Za-z])[\w+=-]{32,}(?![\w+=-])/gu, MASK]
];

/** Échappe une chaîne pour une expression régulière. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Dossier personnel → `~`, sous ses formes usuelles : séparateurs `\`, `/` ou `\\` (texte
 * échappé). Insensible à la casse sous Windows. Un dossier trop court n'est pas masqué.
 */
function maskHome(text: string, home: string, platform: NodeJS.Platform): string {
  const trimmed = home.replace(/[\\/]+$/u, "");
  if (trimmed.length < 3) return text;
  const parts = trimmed.split(/[\\/]+/u).map(escapeRegExp);
  const pattern = new RegExp(`${parts.join(String.raw`(?:\\\\|\\|/)`)}(?![\\w.-])`, platform === "win32" ? "giu" : "gu");
  return text.replace(pattern, "~");
}

/** Applique tous les masques à un texte entier, avant toute troncature. */
export function maskErrorText(text: string, home = os.homedir(), platform: NodeJS.Platform = process.platform): string {
  return MASKS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), maskHome(text, home, platform));
}

/** Garde la fin d'une ligne trop longue, sans couper un caractère (points de code entiers). */
function tailWithinBytes(line: string, maxBytes: number): string {
  const characters = Array.from(line);
  let bytes = Buffer.byteLength(line, "utf8");
  let start = 0;
  const marker = Buffer.byteLength("…", "utf8");
  while (start < characters.length && bytes + marker > maxBytes) bytes -= Buffer.byteLength(characters[start++]!, "utf8");
  return `…${characters.slice(start).join("")}`;
}

/**
 * Construit l'extrait conservé, ou `undefined` si rien d'utile ne reste. Pur et testable.
 * Les lignes identiques consécutives sont fusionnées ; les lignes vides de bord retirées.
 */
export function buildErrorExcerpt(stderr: string, home = os.homedir(), platform: NodeJS.Platform = process.platform): string | undefined {
  let window = stderr.length > MAX_EXAMINED_CHARS ? stderr.slice(-MAX_EXAMINED_CHARS) : stderr;
  // Fenêtre coupée : la première ligne peut commencer au milieu d'un secret, qu'aucun masque ne reconnaîtrait.
  if (window.length < stderr.length) window = window.slice(window.search(/\r\n|\r|\n/u) + 1 || window.length);
  const cleaned = sanitizeTerminalText(window).replace(FORMAT_CHARACTERS, "");
  const lines = maskErrorText(cleaned, home, platform).split("\n").map((line) => line.trimEnd())
    .filter((line, index, all) => index === 0 || line !== all[index - 1]);
  while (lines.length > 0 && lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) return undefined;
  const kept = lines.slice(-MAX_EXCERPT_LINES);
  while (kept.length > 1 && Buffer.byteLength(kept.join("\n"), "utf8") > MAX_EXCERPT_BYTES) kept.shift();
  if (Buffer.byteLength(kept[0]!, "utf8") > MAX_EXCERPT_BYTES) kept[0] = tailWithinBytes(kept[0]!, MAX_EXCERPT_BYTES);
  return kept.join("\n");
}

/** Libellés fixes du fichier, sans donnée utilisateur. */
export interface RelayErrorExcerptLabels {
  title: string;
  warning: string;
}

/** Faits fermés écrits en tête du fichier, déjà présents dans `error.diagnostic`. */
export interface RelayErrorExcerptFacts {
  phase: "preparation" | "execution";
  exitCode: number | null;
}

/**
 * Écrit l'extrait sous `outputDir` (créé au besoin, comme les exports). Ne lève jamais.
 * `empty` si le stderr ne laisse rien d'utile (aucun fichier) ; `failed` si l'écriture échoue,
 * y compris quand le nom final existe déjà (fichier ou lien) : il n'est ni écrasé ni suivi.
 * Une écriture interrompue peut laisser un fichier partiel, jamais annoncé comme sauvegardé.
 */
export async function saveRelayErrorExcerpt(
  outputDir: string,
  stderr: string,
  facts: RelayErrorExcerptFacts,
  labels: RelayErrorExcerptLabels,
  options: { now?: Date; id?: string; home?: string; platform?: NodeJS.Platform } = {}
): Promise<RelayErrorExcerptReport> {
  try {
    const excerpt = buildErrorExcerpt(stderr, options.home, options.platform);
    if (excerpt === undefined) return { status: "empty" };
    const directory = path.resolve(outputDir);
    await mkdir(directory, { recursive: true });
    const stamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, "-");
    const file = path.join(directory, `palabre-error-${stamp}-${options.id ?? randomUUID()}.error.txt`);
    const body = [labels.title, labels.warning, `phase=${facts.phase} exitCode=${facts.exitCode ?? "null"}`, "---", excerpt, ""].join("\n");
    await writeFile(file, body, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return { status: "saved", path: file };
  } catch {
    return { status: "failed" };
  }
}
