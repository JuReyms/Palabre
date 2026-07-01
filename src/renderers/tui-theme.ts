/**
 * @file Primitives visuelles du TUI : détection couleur/TTY, largeurs de surface,
 * boîtes (card, panel, composer), wrapping, liens terminal, palette agents et codes ANSI.
 * Aucune logique produit ici : les écrans, prompts et le renderer consomment ces briques.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Messages } from "../messages/index.js";

/** `true` si stdout supporte les couleurs ANSI (TTY sans `NO_COLOR`). */
export const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
/** `true` si stdout permet un rendu interactif (clear screen, spinner, liens OSC 8). */
export const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

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

/** Marge gauche qui centre la surface de contenu dans le viewport. */
export function surfacePadding(): string {
  return " ".repeat(Math.max(0, Math.floor((viewportWidth() - surfaceWidth()) / 2)));
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

/** Logo Palabre + tagline, centrés dans `width`. */
export function centerLogo(width: number, messages: Messages): string[] {
  return [
    ...logo(),
    "",
    bold(messages.tui.tagline)
  ].map((line) => padLeft(line, Math.max(0, Math.floor((width - visibleLength(line)) / 2))));
}

function logo(): string[] {
  return [
    " ___  ___  _    ___  ___  ___  ___ ",
    "| _ \\| _ || |  | _ || _ )| _ \\| __|",
    "|  _/|   || |_ |   || _ \\|   /| _| ",
    "|_|  |_|_||___||_|_||___/|_|_\\|___|"
  ].map((line) => supportsColor ? `${codes.logoViolet}${line}${codes.reset}` : line);
}

/** Centre horizontalement un bloc de lignes déjà rendues dans `width`. */
export function centerBlock(lines: string[], width: number): string[] {
  const blockWidth = Math.max(...lines.map(visibleLength), 0);
  const left = Math.max(0, Math.floor((width - blockWidth) / 2));
  return lines.map((line) => padLeft(line, left));
}

/** Boîte simple bordée de `|`, avec wrapping du contenu. */
export function card(lines: string[], width: number): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return body.map((line) => `${dim("|")} ${padRight(line, contentWidth)} ${dim("|")}`);
}

/** Variante de `card` avec lignes vides haut/bas et alignement optionnel centré. */
export function composerCard(lines: string[], width: number, align: "left" | "center" = "left"): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return [
    `${dim("|")} ${" ".repeat(contentWidth)} ${dim("|")}`,
    ...body.map((line) => `${dim("|")} ${padRight(align === "center" ? centerLine(line, contentWidth) : line, contentWidth)} ${dim("|")}`),
    `${dim("|")} ${" ".repeat(contentWidth)} ${dim("|")}`
  ];
}

function centerLine(line: string, width: number): string {
  const left = Math.max(0, Math.floor((width - visibleLength(line)) / 2));
  return `${" ".repeat(left)}${line}`;
}

/** Boîte fermée `+---+` utilisée pour les panneaux de session et l'historique. */
export function panel(lines: string[], width: number): string[] {
  const contentWidth = Math.max(18, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return [
    `${dim("+")}${dim("-".repeat(contentWidth + 2))}${dim("+")}`,
    ...body.map((line) => `${dim("|")} ${padRight(line, contentWidth)} ${dim("|")}`),
    `${dim("+")}${dim("-".repeat(contentWidth + 2))}${dim("+")}`
  ];
}

/** Surface de texte bordée à la couleur de l'agent (contenu des messages de débat). */
export function textSurface(lines: string[], width: number, agent?: string): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.length > 0 ? lines : [""];
  const border = agent ? (value: string) => agentColor(agent, value) : violet;
  return [
    `${border("|")} ${" ".repeat(contentWidth)} ${border("|")}`,
    ...body.map((line) => `${border("|")} ${padRight(line, contentWidth)} ${border("|")}`),
    `${border("|")} ${" ".repeat(contentWidth)} ${border("|")}`
  ];
}

/** Trait de soulignement d'un titre, à la couleur de l'agent quand elle est connue. */
export function underlineFor(title: string, width: number, agent?: string): string {
  const length = Math.max(8, Math.min(48, visibleLength(title), width - 4));
  const line = "-".repeat(length);
  return agent ? agentColor(agent, line) : accent(line);
}

/** Ligne `label  valeur` avec label en gras aligné sur 16 colonnes. */
export function row(label: string, value: string): string {
  return `${bold(label.padEnd(16))} ${value}`;
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

function padLeft(value: string, width: number): string {
  return `${" ".repeat(width)}${value}`;
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
