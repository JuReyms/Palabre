/** @file Dernier quota Codex écrit dans un token_count : lecture pure, format expérimental #205. */

/** Une fenêtre complète écrite par Codex, jamais estimée à partir de tokens ou de prose. */
export interface CodexQuotaWindow {
  usedPercent: number;
  windowMinutes: number;
  resetsAt: string;
}

/** Relevé daté du rollout de la cible ; le compte peut avoir servi ailleurs depuis. */
export interface CodexQuota {
  source: "codex-rollout";
  indicative: true;
  recordedAt: string;
  limitId: "codex";
  primary: CodexQuotaWindow;
  secondary: CodexQuotaWindow;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Horodatage avec fuseau explicite et date réelle ; aucun fuseau local deviné à l'entrée. */
function recordedAt(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return undefined;
  const wall = Date.parse(value.slice(0, 19) + "Z");
  const date = Date.parse(value);
  if (!Number.isFinite(wall) || !Number.isFinite(date) || new Date(wall).toISOString().slice(0, 19) !== value.slice(0, 19)) return undefined;
  return new Date(date).toISOString();
}

/** N'accepte que la fenêtre complète observée, dans des bornes représentables. */
function window(value: unknown): CodexQuotaWindow | undefined {
  const row = object(value);
  if (!row || typeof row.used_percent !== "number" || !Number.isFinite(row.used_percent) || row.used_percent < 0 || row.used_percent > 100
    || typeof row.window_minutes !== "number" || !Number.isSafeInteger(row.window_minutes) || row.window_minutes <= 0
    || typeof row.resets_at !== "number" || !Number.isSafeInteger(row.resets_at) || row.resets_at < 0) return undefined;
  const date = new Date(row.resets_at * 1000);
  if (!Number.isFinite(date.getTime())) return undefined;
  return { usedPercent: row.used_percent, windowMinutes: row.window_minutes, resetsAt: date.toISOString() };
}

/**
 * Dernier token_count portant rate_limits dans une fin de rollout déjà bornée. Les lignes de
 * bord incomplètes sont ignorées. null signifie aucun relevé ; on cherche le précédent.
 * Un dernier candidat non nul inconnu/invalide masque les précédents :
 * ne jamais présenter un ancien schéma valide comme le dernier relevé après un changement.
 * La forme connue exige les deux fenêtres et un timestamp ISO avec fuseau ; sinon undefined.
 */
export function lastCodexQuota(text: string, partialStart: boolean): CodexQuota | undefined {
  const lines = text.split("\n");
  lines.pop(); // Ne jamais accepter la dernière ligne sans son saut de ligne complet.
  if (partialStart) lines.shift();
  for (let i = lines.length - 1; i >= 0; i--) {
    let row: Record<string, unknown> | undefined;
    try { row = object(JSON.parse(lines[i]!)); } catch { continue; }
    const payload = row?.type === "event_msg" ? object(row.payload) : undefined;
    if (payload?.type !== "token_count" || !("rate_limits" in payload)) continue;
    if (payload.rate_limits === null) continue;
    const limits = object(payload.rate_limits);
    const at = recordedAt(row!.timestamp);
    const primary = window(limits?.primary), secondary = window(limits?.secondary);
    if (!at || limits?.limit_id !== "codex" || !primary || !secondary) return undefined;
    return { source: "codex-rollout", indicative: true, recordedAt: at, limitId: "codex", primary, secondary };
  }
  return undefined;
}
