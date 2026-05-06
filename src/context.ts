import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ProjectFileContext } from "./types.js";

const MAX_FILE_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 192 * 1024;
const DEFAULT_EXCLUDED_NAMES = new Set([
  ".git",
  ".gitignore",
  ".tmp",
  ".pnpm-store",
  "node_modules",
  "dist"
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

/** Résultat combiné du chargement de contexte. `warnings` liste les fichiers ignorés ou tronqués. */
export interface ProjectContextLoadResult {
  files: ProjectFileContext[];
  warnings: string[];
}

interface LoadState {
  files: ProjectFileContext[];
  warnings: string[];
  seen: Set<string>;
  totalBytes: number;
  gitignoreRules: string[];
}

/**
 * Mode strict (`--files`) : charge uniquement les fichiers explicitement listés.
 * Lève une erreur si un chemin est un dossier, un binaire, ou dépasse 64 KiB / 192 KiB au total.
 */
export async function loadProjectFiles(paths: string[], cwd = process.cwd()): Promise<ProjectFileContext[]> {
  const result = await loadProjectInputs(paths, [], cwd);
  return result.files;
}

/**
 * Combine le chargement strict (`--files`) et tolérant (`--context`).
 * Les fichiers explicites sont chargés en premier et comptent dans le budget total.
 * Les chemins de contexte acceptent fichiers et dossiers ; les fichiers ignorés génèrent des warnings, pas des erreurs.
 */
export async function loadProjectInputs(
  filePaths: string[],
  contextPaths: string[],
  cwd = process.cwd()
): Promise<ProjectContextLoadResult> {
  const state: LoadState = {
    files: [],
    warnings: [],
    seen: new Set(),
    totalBytes: 0,
    gitignoreRules: await loadGitignoreRules(cwd)
  };

  await addExplicitFiles(filePaths, cwd, state);
  await addContextPaths(contextPaths, cwd, state);

  return {
    files: state.files,
    warnings: state.warnings
  };
}

async function addExplicitFiles(paths: string[], cwd: string, state: LoadState): Promise<void> {
  const uniquePaths = [...new Set(paths.map((item) => item.trim()).filter(Boolean))];

  for (const inputPath of uniquePaths) {
    const absolutePath = path.resolve(cwd, inputPath);
    const fileStat = await stat(absolutePath);

    if (!fileStat.isFile()) {
      throw new Error(`Le contexte fichier doit pointer vers un fichier: ${inputPath}`);
    }

    if (fileStat.size > MAX_FILE_BYTES) {
      throw new Error(
        `Fichier trop gros pour le contexte: ${inputPath} (${fileStat.size} bytes, max ${MAX_FILE_BYTES})`
      );
    }

    const content = await readFile(absolutePath, "utf8");

    if (content.includes("\u0000")) {
      throw new Error(`Fichier binaire ou non texte refuse: ${inputPath}`);
    }

    addFileToState(cwd, state, absolutePath, content, fileStat.size, "explicit");
  }
}

async function addContextPaths(paths: string[], cwd: string, state: LoadState): Promise<void> {
  const uniquePaths = [...new Set(paths.map((item) => item.trim()).filter(Boolean))];

  for (const inputPath of uniquePaths) {
    const absolutePath = path.resolve(cwd, inputPath);
    const fileStat = await stat(absolutePath);

    if (fileStat.isFile()) {
      await addContextFile(absolutePath, cwd, state);
      continue;
    }

    if (!fileStat.isDirectory()) {
      state.warnings.push(`Contexte ignore (ni fichier ni dossier): ${inputPath}`);
      continue;
    }

    await walkContextDirectory(absolutePath, cwd, state);
  }
}

async function walkContextDirectory(dir: string, cwd: string, state: LoadState): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = normalizePath(path.relative(cwd, absolutePath));

    if (shouldIgnore(relativePath, entry.name, state.gitignoreRules)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkContextDirectory(absolutePath, cwd, state);
      continue;
    }

    if (entry.isFile()) {
      await addContextFile(absolutePath, cwd, state);
    }
  }
}

async function addContextFile(absolutePath: string, cwd: string, state: LoadState): Promise<void> {
  const relativePath = normalizePath(path.relative(cwd, absolutePath));

  if (state.seen.has(absolutePath)) {
    return;
  }

  if (!isLikelyTextFile(absolutePath)) {
    state.warnings.push(`Contexte ignore (extension non texte): ${relativePath}`);
    return;
  }

  const fileStat = await stat(absolutePath);

  if (fileStat.size > MAX_FILE_BYTES) {
    state.warnings.push(`Contexte ignore (fichier trop gros): ${relativePath} (${fileStat.size} bytes)`);
    return;
  }

  if (state.totalBytes + fileStat.size > MAX_TOTAL_BYTES) {
    state.warnings.push(`Contexte ignore (limite totale atteinte): ${relativePath}`);
    return;
  }

  const content = await readFile(absolutePath, "utf8");

  if (content.includes("\u0000")) {
    state.warnings.push(`Contexte ignore (binaire detecte): ${relativePath}`);
    return;
  }

  addFileToState(cwd, state, absolutePath, content, fileStat.size, "context");
}

function addFileToState(
  cwd: string,
  state: LoadState,
  absolutePath: string,
  content: string,
  sizeBytes: number,
  source: "explicit" | "context"
): void {
  if (state.seen.has(absolutePath)) {
    return;
  }

  if (state.totalBytes + sizeBytes > MAX_TOTAL_BYTES) {
    if (source === "explicit") {
      throw new Error(`Contexte fichiers trop gros (${state.totalBytes + sizeBytes} bytes, max ${MAX_TOTAL_BYTES})`);
    }

    state.warnings.push(`Contexte ignore (limite totale atteinte): ${normalizePath(path.relative(cwd, absolutePath))}`);
    return;
  }

  state.seen.add(absolutePath);
  state.totalBytes += sizeBytes;
  state.files.push({
    path: normalizePath(path.relative(cwd, absolutePath)),
    absolutePath,
    content,
    sizeBytes
  });
}

async function loadGitignoreRules(cwd: string): Promise<string[]> {
  try {
    const content = await readFile(path.resolve(cwd, ".gitignore"), "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));
  } catch {
    return [];
  }
}

function shouldIgnore(relativePath: string, basename: string, gitignoreRules: string[]): boolean {
  if (DEFAULT_EXCLUDED_NAMES.has(basename)) {
    return true;
  }

  return gitignoreRules.some((rule) => matchesGitignoreRule(relativePath, basename, rule));
}

function matchesGitignoreRule(relativePath: string, basename: string, rule: string): boolean {
  const normalizedRule = normalizePath(rule).replace(/\/$/, "");

  if (normalizedRule.includes("*")) {
    const pattern = `^${globToRegex(normalizedRule)}$`;
    return new RegExp(pattern).test(relativePath) || new RegExp(pattern).test(basename);
  }

  return relativePath === normalizedRule ||
    relativePath.startsWith(`${normalizedRule}/`) ||
    basename === normalizedRule;
}

function isLikelyTextFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(value: string): string {
  return value
    .split("*")
    .map((part) => escapeRegex(part))
    .join(".*");
}
