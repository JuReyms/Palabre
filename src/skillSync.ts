/** @file Comparaison locale et rafraîchissement explicite du skill livré par la CLI exécutée. */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** La racine vient du module installé, jamais du cwd, d'une branche Git ou du réseau. */
export const BUNDLED_SKILL_ROOT = fileURLToPath(new URL("../skills/palabre/", import.meta.url));

/** Chemins injectables uniquement pour les profils fictifs des tests. */
export interface SkillSyncOptions { source?: string; home?: string; cwd?: string; backupRoot?: string; }
/** État comparé sur les fichiers livrés, après normalisation CRLF/LF. Les ajouts privés sont conservés. */
export interface SkillCopy { directory: string; canonical?: string; state: "current" | "different" | "unreadable"; fingerprint?: string; }
/** Cibles figées avant confirmation ; une modification ultérieure est refusée. */
export interface SkillSyncPlan { source: string; backupRoot: string; copies: SkillCopy[]; }
/** Erreurs stables : la commande fournit une explication localisée et aucune réparation implicite. */
export class SkillSyncError extends Error {
  constructor(public readonly kind: "source" | "unsafe" | "changed" | "backup" | "write", public readonly directory: string) { super(kind); }
}

type Files = Map<string, Buffer>;
const REQUIRED = ["SKILL.md", "agents/openai.yaml", "references/chat.md", "references/cli.md", "references/outputs.md", "references/relay.md"];

/** Lecture bornée, sans suivre de lien interne (la jonction à la racine est résolue séparément). */
function filesIn(root: string): Files {
  const files: Files = new Map();
  let bytes = 0;
  let entries = 0;
  function walk(directory: string, depth: number): void {
    if (depth > 12) throw Error("depth");
    for (const name of readdirSync(directory).sort()) {
      if (++entries > 256) throw Error("entries");
      const file = path.join(directory, name);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw Error("link");
      if (stat.isDirectory()) walk(file, depth + 1);
      else if (stat.isFile()) {
        if (stat.size > 2 * 1024 * 1024 || (bytes += stat.size) > 8 * 1024 * 1024) throw Error("size");
        files.set(path.relative(root, file).split(path.sep).join("/"), readFileSync(file));
      } else throw Error("entry");
    }
  }
  walk(root, 0);
  return files;
}

function fingerprint(files: Files): string {
  const hash = createHash("sha256");
  for (const [name, contents] of files) hash.update(name).update("\0").update(String(contents.length)).update("\0").update(contents);
  return hash.digest("hex");
}

function sourceFiles(source: string): Files {
  try {
    const files = filesIn(realpathSync(source));
    if (!REQUIRED.every(name => files.has(name))) throw Error("missing");
    return files;
  } catch { throw new SkillSyncError("source", source); }
}

function sameBundledFiles(bundled: Files, installed: Files): boolean {
  return [...bundled].every(([name, content]) => installed.get(name)?.toString("utf8").replace(/\r\n/g, "\n") === content.toString("utf8").replace(/\r\n/g, "\n"));
}

/** Présence de SKILL.md dans les trois emplacements projet/personnel connus, sans écrire. */
export function installedSkillDirectories(options: SkillSyncOptions = {}): string[] {
  return [...new Set([options.home ?? os.homedir(), options.cwd ?? process.cwd()].flatMap(root =>
    [".agents", ".claude", ".codex"].map(agent => path.join(root, agent, "skills", "palabre"))
  ))].filter(directory => { try { return lstatSync(path.join(directory, "SKILL.md")).isFile(); } catch { return false; } });
}

/** Compare chaque copie ; les erreurs restent non vérifiées et ne deviennent jamais « à jour ». */
export function inspectSkillCopies(directories: string[], options: SkillSyncOptions = {}): SkillCopy[] {
  let bundled: Files;
  try { bundled = sourceFiles(options.source ?? BUNDLED_SKILL_ROOT); }
  catch { return directories.map(directory => ({ directory, state: "unreadable" })); }
  return directories.map(directory => {
    try {
      const canonical = realpathSync(directory);
      const installed = filesIn(canonical);
      const equal = sameBundledFiles(bundled, installed);
      return { directory, canonical, state: equal ? "current" : "different", fingerprint: fingerprint(installed) };
    } catch { return { directory, state: "unreadable" }; }
  });
}

/** Plan local : aucune mutation, aucune installation implicite en l'absence de copie. */
export function planSkillSync(options: SkillSyncOptions = {}, directories = installedSkillDirectories(options)): SkillSyncPlan {
  const source = options.source ?? BUNDLED_SKILL_ROOT;
  return { source, backupRoot: options.backupRoot ?? path.join(options.home ?? os.homedir(), ".palabre", "skill-backups"), copies: inspectSkillCopies(directories, { ...options, source }) };
}

/** Installation explicite dans un seul emplacement personnel ; un dossier préexistant est sauvegardé. */
export function planSkillInstall(agent: "codex" | "claude", options: SkillSyncOptions = {}): SkillSyncPlan {
  const directory = path.join(options.home ?? os.homedir(), agent === "codex" ? ".agents" : ".claude", "skills", "palabre");
  const plan = planSkillSync(options, [directory]);
  try { lstatSync(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") plan.copies = [{ directory, state: "different", fingerprint: "absent" }];
  }
  return plan;
}

/** Valide encore l'état et la destination physique présentés au propriétaire avant toute écriture. */
export function assertSkillPlanUnchanged(plan: SkillSyncPlan): void {
  for (const copy of plan.copies) {
    if (copy.state === "unreadable") continue;
    if (copy.fingerprint === "absent") {
      try { lstatSync(copy.directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; }
      throw new SkillSyncError("changed", copy.directory);
    }
    if (!copy.canonical || !copy.fingerprint) throw new SkillSyncError("unsafe", copy.directory);
    try {
      if (realpathSync(copy.directory) !== copy.canonical || fingerprint(filesIn(copy.canonical)) !== copy.fingerprint) throw Error("changed");
    } catch { throw new SkillSyncError("changed", copy.directory); }
  }
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

/**
 * Applique seulement un plan confirmé. Chaque cible physique est sauvegardée une fois hors des
 * dossiers de skills ; les jonctions racines restent en place, les fichiers privés restent intacts.
 * Après mise à jour CLI, source désigne le paquet nouvellement installé, même si pnpm a changé de store.
 */
export function applySkillSync(plan: SkillSyncPlan, source = plan.source, onBackup?: (directory: string) => void): string[] {
  const readable = plan.copies.filter(copy => copy.state !== "unreadable");
  if (!readable.length) return [];
  const bundled = sourceFiles(source);
  assertSkillPlanUnchanged(plan);
  const backups: string[] = [];
  const seen = new Set<string>();
  for (const copy of readable) {
    const destination = copy.canonical ?? copy.directory;
    const key = process.platform === "win32" ? destination.toLowerCase() : destination;
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = copy.fingerprint === "absent" ? new Map<string, Buffer>() : filesIn(destination);
    if (sameBundledFiles(bundled, existing)) continue;
    // Sauvegarde avant tout remplacement, y compris une copie personnalisée. Pas de suppression.
    if (copy.fingerprint !== "absent") {
      try {
        const backupRoot = path.resolve(plan.backupRoot);
        const lexicalTargets = [...plan.copies.flatMap(c => [c.directory, c.canonical].filter((p): p is string => Boolean(p)))];
        if (lexicalTargets.some(target => inside(path.dirname(target), backupRoot))) throw Error("backup in skills");
        mkdirSync(backupRoot, { recursive: true });
        const physicalBackup = realpathSync(backupRoot);
        if (lexicalTargets.some(target => inside(path.dirname(target), physicalBackup))) throw Error("backup link in skills");
        const backup = mkdtempSync(path.join(physicalBackup, `palabre-${new Date().toISOString().replace(/[:.]/g, "-")}-`));
        for (const [name, contents] of existing) {
          const target = path.join(backup, name);
          mkdirSync(path.dirname(target), { recursive: true });
          writeFileSync(target, contents, { flag: "wx" });
        }
        if (fingerprint(filesIn(backup)) !== fingerprint(existing)) throw Error("backup mismatch");
        backups.push(backup);
        onBackup?.(backup);
      } catch { throw new SkillSyncError("backup", destination); }
    }
    // Refuse une édition effectuée pendant la sauvegarde. Valide aussi les alias de la cible.
    assertSkillPlanUnchanged({ ...plan, copies: plan.copies.filter(c => (c.canonical ?? c.directory) === destination) });
    try {
      mkdirSync(destination, { recursive: true });
      const root = realpathSync(destination);
      for (const [name, contents] of bundled) {
        const target = path.join(root, name);
        mkdirSync(path.dirname(target), { recursive: true });
        if (!inside(root, realpathSync(path.dirname(target)))) throw Error("outside");
        try { if (lstatSync(target).isSymbolicLink()) throw Error("link"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        const temporary = `${target}.palabre-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`;
        try { writeFileSync(temporary, contents, { flag: "wx" }); renameSync(temporary, target); }
        finally { try { unlinkSync(temporary); } catch { /* Déjà renommé ou création refusée. */ } }
      }
      if (![...bundled].every(([name, contents]) => readFileSync(path.join(root, name)).equals(contents))) throw Error("mismatch");
    } catch { throw new SkillSyncError("write", destination); }
  }
  return backups;
}
