/**
 * @file Primitives visuelles du TUI : détection couleur/TTY/Unicode, glyphes avec repli
 * ASCII (`PALABRE_ASCII=1`), cadre de boîte unifié, gouttière d'ancrage gauche, en-tête
 * de marque compact, colonnes label/valeur adaptatives, tokens sémantiques et palette agents.
 * Aucune logique produit ici : les écrans, prompts et le renderer consomment ces briques.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Messages } from "../messages/index.js";

/** `true` si stdout supporte les couleurs ANSI (TTY sans `NO_COLOR`). */
export const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
/** `true` si stdout permet un rendu interactif (clear screen, spinner, liens OSC 8). */
export const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

/** Jeu de glyphes du rendu : tracé de boîtes, séparateurs de prompt, marqueurs d'état et frames de spinner. */
export interface GlyphSet {
  h: string;
  v: string;
  tl: string;
  tr: string;
  bl: string;
  br: string;
  pointer: string;
  prompt: string;
  check: string;
  cross: string;
  spinner: string[];
}

const unicodeGlyphs: GlyphSet = {
  h: "─",
  v: "│",
  tl: "┌",
  tr: "┐",
  bl: "└",
  br: "┘",
  pointer: "›",
  prompt: "❯",
  check: "✓",
  cross: "✗",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
};

const asciiGlyphs: GlyphSet = {
  h: "-",
  v: "|",
  tl: "+",
  tr: "+",
  bl: "+",
  br: "+",
  pointer: ">",
  prompt: ">",
  check: "v",
  cross: "x",
  spinner: ["-", "\\", "|", "/"]
};

/**
 * Retourne le jeu de glyphes actif. Résolu paresseusement à chaque appel pour que
 * `PALABRE_ASCII=1` (et les tests) puissent forcer le repli ASCII sans réimporter le module.
 */
export function glyphs(): GlyphSet {
  return unicodeSupported() ? unicodeGlyphs : asciiGlyphs;
}

/**
 * Heuristique de support Unicode inspirée de `figures`/`ora` : hors Windows, seul le
 * TTY console `TERM=linux` pose problème ; sur Windows, Windows Terminal, ConEmu,
 * VS Code et les shells posant `TERM` gèrent le tracé Unicode. `PALABRE_ASCII` force le repli.
 */
function unicodeSupported(): boolean {
  const env = process.env;
  if (env.PALABRE_ASCII) {
    return false;
  }

  if (process.platform !== "win32") {
    return env.TERM !== "linux";
  }

  return Boolean(env.WT_SESSION)
    || env.ConEmuANSI === "ON"
    || env.TERM_PROGRAM === "vscode"
    || Boolean(env.TERM);
}

/** Efface l'écran et restaure le curseur. À n'appeler que si `supportsInteractiveOutput`. */
export function clearScreen(): void {
  process.stdout.write("\u001bc\u001b[?25h");
}

/** Largeur de la surface de contenu centrée : 72 à 96 colonnes selon le terminal. */
export function surfaceWidth(): number {
  return Math.max(72, Math.min(viewportWidth() - 8, 96));
}

/** Largeur totale exploitable du terminal, bornée entre 72 et 180 colonnes. */
export function viewportWidth(): number {
  return Math.max(72, Math.min(process.stdout.columns || 100, 180));
}

/**
 * Gouttière fixe à gauche de toute la sortie TUI. L'ancrage gauche remplace
 * l'ancien centrage : le rendu reste stable quelle que soit la largeur du terminal.
 */
export function surfacePadding(): string {
  return "  ";
}

/** Compacte un chemin trop long en gardant la fin (`...suffixe`). */
export function compactPath(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const marker = "...";
  const tailLength = Math.max(12, maxLength - marker.length);
  return `${marker}${value.slice(-tailLength)}`;
}

/** `path.dirname` tolérant aux séparateurs mixtes `/` et `\` des exports historiques. */
export function dirnamePortable(value: string): string {
  const separatorIndex = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
  return separatorIndex > 0 ? value.slice(0, separatorIndex) : path.dirname(value);
}

/** Compacte un nom de fichier export en préservant l'extension `.debate.md`/`.ask.md`. */
export function compactFileName(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const extension = value.match(/\.(debate|ask)\.md$/i)?.[0] ?? "";
  const marker = "...";
  const headLength = Math.max(12, maxLength - marker.length - extension.length);
  return `${value.slice(0, headLength)}${marker}${extension}`;
}

/** Rend un lien cliquable OSC 8 vers un fichier local, ou le label brut hors TTY. */
export function terminalLink(filePath: string, label: string): string {
  if (!supportsInteractiveOutput) {
    return label;
  }

  return `\u001b]8;;${pathToFileURL(filePath).href}\u001b\\${label}\u001b]8;;\u001b\\`;
}

/** Logo Palabre + tagline, réservés à l'écran d'accueil. */
export function logoBlock(messages: Messages): string[] {
  return [
    ...logo(),
    "",
    bold(messages.tui.tagline)
  ];
}

/**
 * Ligne de marque compacte des écrans hors accueil : titre accentué suivi d'une
 * règle horizontale jusqu'à la largeur de surface. Remplace le logo 5 lignes.
 */
export function brandHeader(title = "PALABRE"): string {
  const rule = Math.max(0, surfaceWidth() - visibleLength(title) - 1);
  return `${accent(bold(title))} ${dim(glyphs().h.repeat(rule))}`;
}

/** Logo "ANSI Shadow" (56 colonnes) en Unicode ; repli sur le logo ASCII historique sinon. */
const unicodeLogoLines = [
  "██████╗  █████╗ ██╗     █████╗ ██████╗ ██████╗ ███████╗",
  "██╔══██╗██╔══██╗██║    ██╔══██╗██╔══██╗██╔══██╗██╔════╝",
  "██████╔╝███████║██║    ███████║██████╔╝██████╔╝█████╗  ",
  "██╔═══╝ ██╔══██║██║    ██╔══██║██╔══██╗██╔══██╗██╔══╝  ",
  "██║     ██║  ██║██████╗██║  ██║██████╔╝██║  ██║███████╗",
  "╚═╝     ╚═╝  ╚═╝╚═════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝"
];

const asciiLogoLines = [
  " ___  ___  _    ___  ___  ___  ___ ",
  "| _ \\| _ || |  | _ || _ )| _ \\| __|",
  "|  _/|   || |_ |   || _ \\|   /| _| ",
  "|_|  |_|_||___||_|_||___/|_|_\\|___|"
];

function logo(): string[] {
  const lines = unicodeSupported() ? unicodeLogoLines : asciiLogoLines;
  return lines.map((line) => supportsColor ? `${codes.logoViolet}${line}${codes.reset}` : line);
}

/** Ancre un bloc de lignes à la gouttière gauche fixe. */
export function padBlock(lines: string[]): string[] {
  const gutter = surfacePadding();
  return lines.map((line) => `${gutter}${line}`);
}

/** Options du cadre unifié `frame`. */
interface FrameOptions {
  /** Titre intégré dans la bordure haute : `┌─ Titre ────┐`. */
  title?: string;
  /** Peinture de la bordure ; `dim` par défaut. */
  border?: (value: string) => string;
  /** Ajoute une ligne vide en haut et en bas du contenu. */
  padY?: boolean;
}

/**
 * Cadre fermé unique de tout le TUI (`┌─┐ │ └─┘`, repli ASCII `+-+ | +-+`).
 * Toutes les boîtes (`card`, `panel`, `composerCard`, `textSurface`) en dérivent
 * pour garantir un style homogène.
 */
function frame(lines: string[], width: number, options: FrameOptions = {}): string[] {
  const g = glyphs();
  const paint = options.border ?? dim;
  const contentWidth = Math.max(18, width - 4);
  const wrapped = lines.flatMap((line) => wrapLine(line, contentWidth));
  const body = wrapped.length > 0 ? wrapped : [""];
  const inner = options.padY ? ["", ...body, ""] : body;
  const titleLength = options.title ? visibleLength(options.title) + 2 : 0;
  const top = options.title
    ? `${paint(`${g.tl}${g.h}`)} ${bold(options.title)} ${paint(`${g.h.repeat(Math.max(0, contentWidth - titleLength + 1))}${g.tr}`)}`
    : paint(`${g.tl}${g.h.repeat(contentWidth + 2)}${g.tr}`);
  const bottom = paint(`${g.bl}${g.h.repeat(contentWidth + 2)}${g.br}`);

  return [
    top,
    ...inner.map((line) => `${paint(g.v)} ${padRight(line, contentWidth)} ${paint(g.v)}`),
    bottom
  ];
}

/** Boîte de contenu standard, avec titre optionnel intégré à la bordure. */
export function card(lines: string[], width: number, title?: string): string[] {
  return frame(lines, width, { title });
}

/** Boîte "héro" de l'accueil : même cadre que `card` avec respirations verticales. */
export function composerCard(lines: string[], width: number): string[] {
  return frame(lines, width, { padY: true });
}

/** Panneau de session et d'historique ; même cadre que `card`, titre optionnel. */
export function panel(lines: string[], width: number, title?: string): string[] {
  return frame(lines, width, { title });
}

/**
 * Bloc à barre latérale gauche seule, à la couleur de l'agent : utilisé pour les
 * messages de débat/ask, moins chargé qu'un cadre fermé quand les blocs s'enchaînent.
 */
export function accentBar(lines: string[], width: number, agent?: string): string[] {
  const g = glyphs();
  const paint = agent ? (value: string) => agentColor(agent, value) : violet;
  const contentWidth = Math.max(24, width - 2);
  const body = lines.flatMap((line) => line ? wrapLine(line, contentWidth) : [""]);
  return (body.length > 0 ? body : [""]).map((line) => `${paint(g.v)} ${line}`);
}

/**
 * Règle horizontale portant un label : `── Label ──────`.
 * Sert de séparateur de zone de saisie avec le fil d'Ariane intégré.
 */
export function labeledRule(label: string, paint: (value: string) => string = dim): string {
  const g = glyphs();
  const fill = Math.max(0, surfaceWidth() - visibleLength(label) - 4);
  return `${paint(g.h.repeat(2))} ${label} ${paint(g.h.repeat(fill))}`;
}

/** Trait de soulignement d'un titre, à la couleur de l'agent quand elle est connue. */
export function underlineFor(title: string, width: number, agent?: string): string {
  const length = Math.max(8, Math.min(48, visibleLength(title), width - 4));
  const line = glyphs().h.repeat(length);
  return agent ? agentColor(agent, line) : accent(line);
}

/** Ligne `label  valeur` avec label en gras aligné sur `labelWidth` colonnes. */
export function row(label: string, value: string, labelWidth = 16): string {
  return `${bold(label.padEnd(labelWidth))} ${value}`;
}

/** Entrée de `rows` : paire label/valeur alignée, ou ligne brute insérée telle quelle. */
export type RowEntry = readonly [string, string] | string;

/**
 * Rend un bloc de lignes label/valeur avec une colonne de labels adaptative :
 * la largeur s'aligne sur le label le plus long du bloc au lieu d'une constante,
 * ce qui évite les colonnes cassées quand un label dépasse 16 caractères.
 */
export function rows(entries: ReadonlyArray<RowEntry>): string[] {
  const labels = entries.filter((entry): entry is readonly [string, string] => typeof entry !== "string");
  const labelWidth = Math.max(...labels.map(([label]) => label.length), 0) + 2;
  return entries.map((entry) => typeof entry === "string" ? entry : row(entry[0], entry[1], labelWidth));
}

/** Coupe une ligne aux mots pour tenir dans `width` colonnes visibles (ANSI ignoré). */
export function wrapLine(value: string, width: number): string[] {
  const clean = value.replace(/\r?\n/g, " ");
  if (visibleLength(clean) <= width) {
    return [clean];
  }

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (visibleLength(next) <= width) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function padRight(value: string, width: number): string {
  const missing = Math.max(0, width - visibleLength(value));
  return `${value}${" ".repeat(missing)}`;
}

function visibleLength(value: string): number {
  return stripAnsi(value).length;
}

function stripAnsi(value: string): string {
  return value
    .replace(/\u001b\][^\u001b]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
}

/** Met en gras si les couleurs sont supportées, sinon retourne la valeur brute. */
export function bold(value: string): string {
  return supportsColor ? `${codes.bright}${value}${codes.reset}` : value;
}

/** Atténue si les couleurs sont supportées, sinon retourne la valeur brute. */
export function dim(value: string): string {
  return supportsColor ? `${codes.dim}${value}${codes.reset}` : value;
}

/** Couleur d'accent Palabre (violet). */
export function accent(value: string): string {
  return supportsColor ? `${codes.violet}${value}${codes.reset}` : value;
}

/** Violet des règles horizontales et bordures neutres. */
export function violet(value: string): string {
  return supportsColor ? `${codes.violet}${value}${codes.reset}` : value;
}

/** Token sémantique : succès (fin de session, confirmation). */
export function success(value: string): string {
  return supportsColor ? `${codes.green}${value}${codes.reset}` : value;
}

/** Token sémantique : avertissement non bloquant. */
export function warning(value: string): string {
  return supportsColor ? `${codes.yellow}${value}${codes.reset}` : value;
}

/** Token sémantique : erreur. */
export function danger(value: string): string {
  return supportsColor ? `${codes.red}${value}${codes.reset}` : value;
}

/** Nom d'agent rendu dans sa couleur stable. */
export function agentLabel(agent: string): string {
  return supportsColor ? `${agentAnsi(agent)}${agent}${codes.reset}` : agent;
}

/** Applique la couleur stable d'un agent à une valeur arbitraire. */
export function agentColor(agent: string, value: string): string {
  return supportsColor ? `${agentAnsi(agent)}${value}${codes.reset}` : value;
}

function agentAnsi(agent: string): string {
  const normalized = agent.toLowerCase();
  const color = agentColors[normalized] ?? hashedAgentColor(normalized);
  return `\u001b[38;2;${color[0]};${color[1]};${color[2]}m`;
}

function hashedAgentColor(agent: string): [number, number, number] {
  let hash = 0;
  for (let index = 0; index < agent.length; index += 1) {
    hash = (hash * 31 + agent.charCodeAt(index)) | 0;
  }

  const hue = Math.abs(hash) % 360;
  return hslToRgb(hue, 55, 55);
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
      : hue < 180 ? [0, c, x]
        : hue < 240 ? [0, x, c]
          : hue < 300 ? [x, 0, c]
            : [c, 0, x];

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/** Couleurs fixes des agents connus ; les agents custom reçoivent une couleur hashée stable. */
const agentColors: Record<string, [number, number, number]> = {
  antigravity: [76, 141, 255],
  claude: [222, 115, 86],
  codex: [136, 82, 197],
  opencode: [80, 168, 103],
  vibe: [234, 92, 126],
  "ollama-local": [179, 176, 31],
  ollama: [179, 176, 31]
};

/** Codes ANSI bruts utilisés par le thème et le renderer de débat. */
export const codes = {
  reset: "\u001b[0m",
  bright: "\u001b[1m",
  dim: "\u001b[2m",
  logoViolet: "\u001b[38;2;167;139;250m",
  violet: "\u001b[38;5;141m",
  cyan: "\u001b[36m",
  gray: "\u001b[38;5;244m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  orange: "\u001b[38;5;214m",
  red: "\u001b[31m",
  yellow: "\u001b[33m"
};
