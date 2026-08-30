/** @file Commandes de liste et de suppression explicite des checkpoints. */
import { createInterface } from "node:readline/promises";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { createTranslator, resolveLanguage } from "../i18n.js";
import type { Messages } from "../messages/index.js";
import {
  deleteSessionCheckpoint,
  listSessionCheckpoints,
  type SessionInventoryEntry
} from "../sessionInventory.js";
import { sessionCheckpointPath } from "../sessionCheckpoint.js";
import { optionalString, type CommandFlags } from "./shared.js";

export const DEFAULT_SESSIONS_LIMIT = 20;
export const MAX_SESSIONS_LIMIT = 100;

export function resolveSessionsLimit(
  value: CommandFlags[string] | undefined,
  messages: Messages
): number {
  if (value === undefined) {
    return DEFAULT_SESSIONS_LIMIT;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(messages.limits.mustBeInteger("--limit", MAX_SESSIONS_LIMIT));
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SESSIONS_LIMIT) {
    throw new Error(messages.limits.mustBeInteger("--limit", MAX_SESSIONS_LIMIT));
  }
  return limit;
}

/** Dispatche `palabre sessions` et sa sous-commande explicite `delete`. */
export async function runSessionsCommand(flags: CommandFlags, positionals: string[]): Promise<void> {
  const messages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language) }));
  if (positionals.length === 0) {
    await printSessions(flags, messages);
    return;
  }
  if (positionals[0] !== "delete") {
    throw new Error(messages.sessions.unknownAction(positionals[0]!));
  }
  await deleteSession(flags, positionals.slice(1), messages);
}

async function printSessions(flags: CommandFlags, messages: Messages): Promise<void> {
  const sessions = await listSessionCheckpoints(process.cwd(), resolveSessionsLimit(flags.limit, messages));
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ v: 1, sessions })}\n`);
    return;
  }

  console.log(messages.sessions.title);
  console.log("");
  if (sessions.length === 0) {
    console.log(messages.sessions.empty);
    return;
  }
  for (const session of sessions) {
    printHumanSession(session, messages);
  }
}

function printHumanSession(session: SessionInventoryEntry, messages: Messages): void {
  if (!session.valid) {
    console.log(`- ${session.id} | ${messages.sessions.invalid} | ${session.updatedAt}`);
    console.log(`  ${oneLine(session.warning, 100)}`);
    return;
  }
  const phase = session.nextPhase === null
    ? messages.sessions.complete
    : messages.sessions.nextPhase(session.nextPhase);
  console.log(`- ${session.id} | ${session.status} | ${session.mode} | ${session.responses} | ${phase}`);
  console.log(`  ${oneLine(session.topic, 100)}`);
  if (session.resumable) {
    console.log(`  ${messages.sessions.resumeCommand(session.id)}`);
  }
}

async function deleteSession(flags: CommandFlags, ids: string[], messages: Messages): Promise<void> {
  if (ids.length === 0) {
    throw new Error(messages.sessions.deleteIdRequired);
  }
  if (ids.length > 1) {
    throw new Error(messages.sessions.deleteTooManyIds);
  }
  const id = ids[0]!;
  const target = sessionCheckpointPath(process.cwd(), id);

  if (!flags.yes) {
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !flags.json);
    if (!interactive) {
      throw new Error(messages.sessions.deleteYesRequired);
    }
    console.log(messages.sessions.deleteTarget(target));
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await prompt.question(messages.sessions.deletePrompt)).trim().toLowerCase();
      if (!["o", "oui", "y", "yes"].includes(answer)) {
        console.log(messages.sessions.deleteDeclined);
        return;
      }
    } finally {
      prompt.close();
    }
  }

  if (!(await deleteSessionCheckpoint(process.cwd(), id))) {
    throw new Error(messages.sessions.deleteMissing(id));
  }
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ v: 1, deleted: { id } })}\n`);
    return;
  }
  console.log(messages.sessions.deleted(id));
}

function oneLine(value: string, maxLength: number): string {
  const clean = sanitizeTerminalText(value).replace(/\s+/g, " ").trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}…`;
}
