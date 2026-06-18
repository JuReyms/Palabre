import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listHistoryEntries } from "../src/history.js";

test("listHistoryEntries reads Palabre markdown exports", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-history-"));
  const file = path.join(dir, "palabre-test-2026-06-18t10-00-00.debate.md");

  await writeFile(file, [
    "# PALABRE Debate",
    "",
    "| Champ | Valeur |",
    "| --- | --- |",
    "| **Sujet** | Verifier l'historique |",
    "| **Mode** | debate |",
    "| **Agents** | codex <-> claude |",
    "| **Tours demandes** | 4 |",
    "| **Tours joues** | 2 |",
    "| **Date locale** | 2026-06-18 |",
    "",
    "## Synthese finale"
  ].join("\n"), "utf8");

  const entries = await listHistoryEntries(dir);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.mode, "debate");
  assert.equal(entries[0]?.topic, "Verifier l'historique");
  assert.equal(entries[0]?.agents, "codex <-> claude");
  assert.equal(entries[0]?.count, "2/4");
  assert.equal(entries[0]?.date, "2026-06-18");
});

test("listHistoryEntries returns an empty list when the export directory is missing", async () => {
  const entries = await listHistoryEntries(path.join(os.tmpdir(), "missing-palabre-history"));

  assert.deepEqual(entries, []);
});
