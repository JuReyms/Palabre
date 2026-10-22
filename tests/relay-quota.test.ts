/** @file Dernier quota connu : données fictives, lecteur pur et accès disque borné, aucun agent. */
import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { lastCodexQuota } from "../src/externalSessions/quota.js";
import { LAST_CONTEXT_TAIL_BYTES, readLastCodexQuota, type OpenFile } from "../src/externalSessions/openRollout.js";
import { relayQuotaText } from "../src/messages/relayQuota.js";
import { quotaEvent } from "./fixtures/external-sessions/quota.js";

const line = (row: unknown) => JSON.stringify(row) + "\n";
const known = () => lastCodexQuota(line(quotaEvent), false)!;

test("forme reconnue, pourcentages utilisés et dates ISO, sans estimation", () => {
  const quota = known();
  assert.equal(quota.source, "codex-rollout"); assert.equal(quota.indicative, true);
  assert.equal(quota.recordedAt, "2026-10-22T12:00:00.000Z"); assert.equal(quota.limitId, "codex");
  assert.equal(quota.primary.usedPercent, 52); assert.equal(quota.secondary.usedPercent, 88);
  assert.equal(quota.primary.windowMinutes, 300); assert.equal(quota.secondary.windowMinutes, 10080);
  assert.equal(quota.primary.resetsAt, new Date(1792612031 * 1000).toISOString());
  assert.equal(quota.secondary.resetsAt, new Date(1793103085 * 1000).toISOString());
  assert.equal(lastCodexQuota("99 % quota\n", false), undefined);
  assert.equal(lastCodexQuota(line({ type: "response_item", payload: quotaEvent.payload }), false), undefined);
});

test("rate_limits null : aucun relevé, conserver le précédent sans masquer un schéma inconnu", () => {
  const empty = { ...quotaEvent, payload: { type: "token_count", rate_limits: null } };
  assert.deepEqual(lastCodexQuota(line(quotaEvent) + line(empty), false), known());
  assert.equal(lastCodexQuota(line(empty), false), undefined);
  const unknown = { ...empty, payload: { type: "token_count", rate_limits: {} } };
  assert.equal(lastCodexQuota(line(quotaEvent) + line(unknown) + line(empty), false), undefined);
});

test("dernier candidat inconnu : pas de repli vers un ancien relevé", () => {
  const changed = structuredClone(quotaEvent); changed.payload.rate_limits.limit_id = "autre";
  assert.equal(lastCodexQuota(line(quotaEvent) + line(changed), false), undefined);
  changed.payload.rate_limits.limit_id = "codex"; changed.payload.rate_limits.primary.used_percent = 73;
  assert.equal(lastCodexQuota(line(quotaEvent) + line(changed), false)?.primary.usedPercent, 73);
});

test("valeurs absentes ou invalides, schémas inconnus et dates non datables : rien", () => {
  const cases: unknown[] = [null, {}, { ...quotaEvent, timestamp: "invalid" }, { ...quotaEvent, timestamp: "2026-10-22T12:00:00" },
    { ...quotaEvent, timestamp: "2026-02-31T12:00:00Z" }];
  for (const value of [-1, 101, "52", null, NaN, Infinity]) {
    const row: any = structuredClone(quotaEvent); row.payload.rate_limits.primary.used_percent = value; cases.push(row);
  }
  for (const [field, value] of [["window_minutes", 0], ["window_minutes", 1.5], ["resets_at", -1], ["resets_at", "1792612031"], ["resets_at", 1e20]]) {
    const row: any = structuredClone(quotaEvent); row.payload.rate_limits.secondary[field as string] = value; cases.push(row);
  }
  for (const field of ["primary", "secondary"]) {
    const row: any = structuredClone(quotaEvent); delete row.payload.rate_limits[field]; cases.push(row);
  }
  for (const row of cases) assert.equal(lastCodexQuota(line(row), false), undefined, JSON.stringify(row));
  const zero = structuredClone(quotaEvent); zero.payload.rate_limits.primary.used_percent = 0;
  assert.equal(lastCodexQuota(line(zero), false)?.primary.usedPercent, 0, "zéro doit être explicite");
});

test("lignes de bord partielles ignorées, timestamp avec offset normalisé", () => {
  assert.equal(lastCodexQuota(line(quotaEvent), true), undefined);
  assert.equal(lastCodexQuota(JSON.stringify(quotaEvent), false), undefined);
  const row = { ...quotaEvent, timestamp: "2026-10-22T14:00:00+02:00" };
  assert.equal(lastCodexQuota("{partiel\n" + line(row) + "{\"timestamp\":", true)?.recordedAt, known().recordedAt);
});

test("texte fr/en : relevé indicatif daté et heures locales avec fuseau", () => {
  const quota = known();
  const fr = relayQuotaText("fr", "Europe/Paris")(quota), en = relayQuotaText("en", "America/New_York")(quota);
  assert.match(fr, /indicatif.*22\/10\/2026.*14:00:00/); assert.match(fr, /52 % utilisé sur 5 h/); assert.match(fr, /88 % utilisé sur 7 j/);
  assert.match(fr, /réinitialisation le/); assert.match(fr, /pas servi ailleurs|pu servir ailleurs/);
  assert.match(en, /indicative.*10\/22\/2026.*08:00:00/); assert.match(en, /52% used over 5 h/); assert.match(en, /88% used over 7 d/);
  assert.match(en, /Not a live measurement/); assert.match(en, /EDT|GMT-4/);
  assert.notEqual(relayQuotaText("en", "UTC")(quota), en);
});

test("historique de 150 Mio : lecture au plus 1 Mio + 1 octet, rien hors de la fenêtre", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-quota-")); t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "rollout.jsonl"), handle = await open(file, "w+");
  try { await handle.write(line(quotaEvent), 0); await handle.write("\n" + line(quotaEvent), 150 * 1024 * 1024); } finally { await handle.close(); }
  let bytes = 0;
  const counting: OpenFile = async (name, flags) => {
    const fileHandle = await open(name, flags);
    const read = fileHandle.read.bind(fileHandle) as (...args: unknown[]) => Promise<{ bytesRead: number }>;
    (fileHandle as unknown as { read: (...args: unknown[]) => Promise<{ bytesRead: number }> }).read = async (...args) => { const result = await read(...args); bytes += result.bytesRead; return result; };
    return fileHandle;
  };
  assert.deepEqual(await readLastCodexQuota(file, counting), known()); assert.ok(bytes <= LAST_CONTEXT_TAIL_BYTES + 1, String(bytes));
  await writeFile(file, line(quotaEvent) + " ".repeat(LAST_CONTEXT_TAIL_BYTES + 10) + "\n");
  assert.equal(await readLastCodexQuota(file), undefined); assert.equal(await readLastCodexQuota(path.join(root, "absent")), undefined);
  await writeFile(file, Buffer.from([0xff, 10])); assert.equal(await readLastCodexQuota(file), undefined);
  await writeFile(file, line(quotaEvent) + '{"incomplet":'); assert.deepEqual(await readLastCodexQuota(file), known());
});
