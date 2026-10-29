/**
 * @file Révision déclarée et lecture bornée du skill du paquet exécuté. Ni profil, config,
 * copie installée, réseau, cache de conversations ni écriture. Ce contrôle de confort ne prouve
 * pas ce qu'un modèle a lu et n'accorde aucun droit. La source CLI n'est jamais le cwd.
 */
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { BUNDLED_SKILL_ROOT } from "./skillSync.js";
import { skillRuntimeMessages } from "./messages/skillRuntime.js";
import type { Language } from "./types.js";

const REFERENCES = ["relay.md", "relay-desktop.md", "relay-opencode.md", "relay-frozen.md", "chat.md", "cli.md", "outputs.md"];
const MAX_SKILL_BYTES = 64 * 1024;

/** Métadonnée optionnelle v1 : current signifie accord de révisions déclarées, pas chargement prouvé. */
export interface SkillRuntimeInfo {
  status: "current" | "reload-required" | "unverified" | "unavailable";
  revision?: number;
  entrypoint?: string;
  references?: Record<string, string>;
  action?: "read-bundled-skill" | "report-unavailable";
  message?: string;
  /** Texte réservé à la commande explicite skill --read ; absent des inventaires et checks. */
  instructions?: string;
}

/** Source injectable pour tests fictifs seulement ; aucune option CLI ne choisit ce chemin. */
export interface SkillRuntimeOptions { source?: string; includeInstructions?: boolean; }

/** Entier décimal positif canonique ; aucune coercition partielle, valeur malformée non vérifiée. */
function revision(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^[1-9]\d{0,15}$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

/** Lit au plus 64 Kio + un octet par descripteur, même si le fichier grossit pendant la lecture. */
function readEntrypoint(file: string): string {
  const fd = openSync(file, "r");
  try {
    if (!fstatSync(fd).isFile()) throw Error("not-file");
    const buffer = Buffer.alloc(MAX_SKILL_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > MAX_SKILL_BYTES) throw Error("too-large");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
  } finally { closeSync(fd); }
}

/**
 * Compare la révision déclarée par l'appelant à celle du frontmatter livré. Sans déclaration
 * (anciens skills), donner un amorçage actionnable. Une source absente/incorrecte donne unavailable,
 * jamais current, sans faire échouer l'inventaire ou le check hôte. Références fixes uniquement,
 * aucun chemin provenant du Markdown ; les liens internes sont refusés, pas les racines pnpm.
 */
export function inspectSkillRuntime(reported?: unknown, language: Language = "fr", options: SkillRuntimeOptions = {}): SkillRuntimeInfo {
  const text = skillRuntimeMessages[language];
  try {
    const root = realpathSync(options.source ?? BUNDLED_SKILL_ROOT);
    const entrypoint = path.join(root, "SKILL.md");
    const referenceRoot = path.join(root, "references");
    const entryStat = lstatSync(entrypoint);
    if (!entryStat.isFile() || entryStat.isSymbolicLink() || !lstatSync(referenceRoot).isDirectory() || lstatSync(referenceRoot).isSymbolicLink()) throw Error("link");
    const references: Record<string, string> = {};
    for (const name of REFERENCES) {
      const file = path.join(referenceRoot, name);
      const stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw Error("reference");
      references[name] = file;
    }
    const instructions = readEntrypoint(entrypoint);
    const frontmatter = instructions.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
    const declared = frontmatter?.match(/^metadata:\n  revision: "([1-9]\d*)"$/m);
    const expected = frontmatter?.match(/^metadata:$/gm)?.length === 1 ? revision(declared?.[1]) : undefined;
    if (!expected) throw Error("revision");
    const loaded = revision(reported);
    const status = loaded === undefined ? "unverified" : loaded === expected ? "current" : "reload-required";
    return { status, revision: expected, entrypoint, references,
      ...(status !== "current" ? { action: "read-bundled-skill", message: text.reload } as const : {}),
      ...(options.includeInstructions ? { instructions } : {}) };
  } catch {
    return { status: "unavailable", action: "report-unavailable", message: text.unavailable };
  }
}
