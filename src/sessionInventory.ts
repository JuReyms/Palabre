/** @file Inventaire borné et suppression ciblée des checkpoints de session. */
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import {
  readSessionCheckpoint,
  SessionCheckpointError,
  sessionCheckpointDirectory,
  sessionCheckpointPath,
  type SessionCheckpointPhase,
  type SessionCheckpointStatus
} from "./sessionCheckpoint.js";
import type { OrchestrationMode } from "./types.js";

const SAFE_SESSION_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface ValidSessionInventoryEntry {
  valid: true;
  id: string;
  status: SessionCheckpointStatus;
  mode: OrchestrationMode;
  topic: string;
  updatedAt: string;
  responses: number;
  nextPhase: SessionCheckpointPhase | null;
  resumable: boolean;
}

export interface InvalidSessionInventoryEntry {
  valid: false;
  id: string;
  updatedAt: string;
  warning: string;
}

export type SessionInventoryEntry = ValidSessionInventoryEntry | InvalidSessionInventoryEntry;

/** Liste les checkpoints les plus récents sans laisser un fichier corrompu bloquer l'inventaire. */
export async function listSessionCheckpoints(
  workspace: string,
  limit: number
): Promise<SessionInventoryEntry[]> {
  const directory = sessionCheckpointDirectory(workspace);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return [];
    }
    throw error;
  }

  const inventory = await Promise.all(entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".json")
    .map((entry) => path.basename(entry.name, path.extname(entry.name)))
    .filter((id) => SAFE_SESSION_ID.test(id))
    .map(async (id): Promise<SessionInventoryEntry> => {
      try {
        const checkpoint = await readSessionCheckpoint(workspace, id);
        return {
          valid: true,
          id: checkpoint.id,
          status: checkpoint.status,
          mode: checkpoint.mode,
          topic: checkpoint.topic,
          updatedAt: checkpoint.updatedAt,
          responses: checkpoint.transcript.length,
          nextPhase: checkpoint.nextPhase,
          resumable: checkpoint.status !== "completed"
        };
      } catch (error) {
        const filePath = sessionCheckpointPath(workspace, id);
        const metadata = await stat(filePath).catch(() => undefined);
        return {
          valid: false,
          id,
          updatedAt: metadata?.mtime.toISOString() ?? new Date(0).toISOString(),
          warning: boundedWarning(error)
        };
      }
    }));

  return inventory
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

/** Supprime uniquement le checkpoint JSON correspondant exactement à l'identifiant validé. */
export async function deleteSessionCheckpoint(workspace: string, id: string): Promise<boolean> {
  const target = sessionCheckpointPath(workspace, id);
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function boundedWarning(error: unknown): string {
  if (error instanceof SessionCheckpointError) {
    return error.kind;
  }
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return `unreadable-checkpoint:${error.code}`;
  }
  return "unreadable-checkpoint";
}

function isFileSystemError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
