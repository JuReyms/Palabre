/**
 * @file Rappel visible des copies du skill après une mise à jour directe de la CLI.
 *
 * npm masque par défaut la sortie des scripts d'installation : aucun postinstall. Le rappel vit
 * dans Palabre, sur stderr d'un terminal humain (aide, version) et dans la notice de l'accueil TUI.
 * Il réutilise la comparaison locale de `skillSync.ts` avec le skill du paquet exécuté : ni écriture,
 * ni réseau, ni configuration ou registre de confiance, ni agent lancé. Un échec du rappel ne change
 * jamais le résultat de la commande. La comparaison ne prouve pas ce qu'un agent a chargé.
 */
import { skillReminderMessages } from "./messages/skillSync.js";
import { planSkillSync, type SkillSyncPlan } from "./skillSync.js";
import type { Language } from "./types.js";

/** Drapeaux bruts de la commande, comme `ParsedArgs.flags`. */
type Flags = Record<string, string | string[] | boolean>;

/** Flux observés ; `process` par défaut, remplacés seulement dans les tests. */
export interface SkillReminderStreams {
  stdin: { isTTY?: boolean };
  stdout: { isTTY?: boolean };
  stderr: { isTTY?: boolean; write(chunk: string): unknown };
}

/** Entrées du rappel en terminal. */
export interface SkillReminderOptions {
  flags: Flags;
  /** Résolue seulement quand un rappel doit être affiché (peut lire la langue enregistrée). */
  language: () => Language | Promise<Language>;
  /** Plan local ; `planSkillSync()` par défaut, appelé seulement en terminal humain. */
  plan?: () => SkillSyncPlan;
  streams?: SkillReminderStreams;
}

/**
 * Terminal humain : stdin, stdout et stderr sont des TTY, sans `--json` ni renderer NDJSON.
 * Hors de ce cas, aucune copie n'est inspectée.
 */
export function isHumanTerminal(streams: SkillReminderStreams, flags: Flags): boolean {
  if (flags.json || flags.renderer === "ndjson") return false;
  return Boolean(streams.stdin.isTTY && streams.stdout.isTTY && streams.stderr.isTTY);
}

/** Vrai si au moins une copie détectée est `different` ou `unreadable` ; faux sans copie. */
export function needsSkillReminder(plan: SkillSyncPlan | undefined): boolean {
  return Boolean(plan?.copies.some(copy => copy.state !== "current"));
}

/**
 * Texte du rappel, ou `undefined` sans copie ou avec des copies toutes `current`.
 * Une copie différente peut être une personnalisation ; une copie illisible n'est jamais
 * présentée comme à jour. Aucun chemin ni contenu de copie n'est repris.
 */
export function skillReminderText(plan: SkillSyncPlan | undefined, language: Language): string | undefined {
  if (!plan || !needsSkillReminder(plan)) return undefined;
  const different = plan.copies.some(copy => copy.state === "different");
  const unreadable = plan.copies.some(copy => copy.state === "unreadable");
  return skillReminderMessages[language].notice(different, unreadable).join("\n");
}

/**
 * Ajoute le rappel à la notice initiale de l'accueil TUI sans remplacer une notice existante
 * (configuration créée, conflit, agents ajoutés). Le plan vient de `getUpdateInfo` : aucune
 * nouvelle détection. La TUI replie les retours ligne d'une notice en espaces.
 */
export function withSkillReminder(notice: string | undefined, plan: SkillSyncPlan | undefined, language: Language): string | undefined {
  const reminder = skillReminderText(plan, language);
  if (!reminder) return notice;
  return notice ? `${notice} ${reminder}` : reminder;
}

/**
 * Écrit le rappel sur stderr après la sortie normale (aide, version) ; stdout n'est jamais touché.
 * La langue n'est résolue que si un rappel est nécessaire. Toute erreur est ignorée.
 */
export async function printSkillReminder(options: SkillReminderOptions): Promise<void> {
  const streams = options.streams ?? { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };
  try {
    if (!isHumanTerminal(streams, options.flags)) return;
    const plan = options.plan ? options.plan() : planSkillSync();
    if (!needsSkillReminder(plan)) return;
    const text = skillReminderText(plan, await options.language());
    if (text) streams.stderr.write(`\n${text}\n`);
  } catch {
    // Rappel facultatif : il ne change jamais le résultat de la commande.
  }
}
