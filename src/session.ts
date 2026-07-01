/** @file Construit le contexte de session factuel (date, fuseau, dossier) injecté dans chaque prompt agent. */
import path from "node:path";
import type { SessionContext } from "./types.js";

/**
 * Construit le contexte de session partagé par tous les agents pour la durée du débat.
 * `cwd` et `now` sont injectables pour la testabilité.
 */
export function createSessionContext(cwd = process.cwd(), now = new Date()): SessionContext {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";

  return {
    startedAt: now.toISOString(),
    localDate: formatDateInTimeZone(now, timeZone),
    timeZone,
    cwd: path.resolve(cwd)
  };
}

/** Formate une date dans le fuseau local via `Intl.DateTimeFormat`. Retombe sur la date UTC ISO si le runtime ne supporte pas le fuseau. */
function formatDateInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to UTC ISO date if the runtime cannot format the local timezone.
  }

  return date.toISOString().slice(0, 10);
}
