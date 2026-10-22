/** @file Refus Codex occupé : conseil lié à sa cause, avec sondes simulées et profil fictif. */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { executeRelay, renderRelayText } from "../src/commands/relay.js";
import { CodexSessionAdapter } from "../src/externalSessions/codex.js";
import { trustConfig } from "../src/configTrust.js";
import { createTranslator } from "../src/i18n.js";

const id = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const header = { kind: "mission" as const, id, step: 1 };
const cases = ["setting", "explicit", "review", "mission", "auto-race"] as const;
for (const kind of cases) for (const language of ["fr", "en"] as const) test(`target-busy : ${kind}, ${language}`, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-busy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(os, "homedir", () => root);
  const executable = path.join(root, process.platform === "win32" ? "codex.exe" : "codex");
  // Fichier inerte : résolu mais jamais exécuté, puisque le refus précède prepare/exchange.
  await writeFile(executable, "", { mode: 0o755 });
  const file = path.join(root, "palabre.config.json");
  await writeFile(file, JSON.stringify({ language, agents: { codex: { type: "cli", command: executable } }, relay: {
    view: kind === "setting" ? "background" : "auto", allowedTasks: ["review"], reviewRepositories: ["owner/repo"]
  } }));
  await trustConfig(file);
  const day = path.join(root, ".codex", "sessions", "2026", "10", "21");
  await mkdir(day, { recursive: true });
  await writeFile(path.join(day, `rollout-test-${id}.jsonl`), JSON.stringify({ type: "session_meta", payload: { id, cwd: root } }) + "\n");
  let probes = 0;
  t.mock.method(CodexSessionAdapter.prototype, "probe", () => ({
    attachment: kind === "auto-race" && probes++ === 0 ? "detached" : "attached",
    activity: "unknown", processes: [], evidence: []
  }));
  const result = await executeRelay(["relay", "--config", file, "--to", `codex:${id}`, "--no-export",
    ...(kind === "explicit" ? ["--background"] : []),
    ...(kind === "review" ? ["--task", "review", "--pr", "https://github.com/owner/repo/pull/1"] : []), "Review"],
    kind === "mission" ? { header } : {});
  assert.equal(result.status, "target-busy"); assert.equal(result.delivery.status, "not-delivered");
  assert.equal(result.mode, "background"); assert.equal(result.queue, undefined);
  const text = renderRelayText(result, createTranslator(language)).stderr;
  if (kind === "setting") {
    assert.match(result.remedy!, /config --relay-view auto --config/);
    assert.ok(result.error!.message.includes(result.remedy!)); assert.ok(text.includes(result.remedy!));
  } else {
    assert.equal(result.remedy, undefined); assert.ok(!text.includes("config --relay-view"));
    if (kind === "explicit") {
      assert.match(text, language === "fr" ? /Fermez-la dans Codex, puis relancez/ : /Close it in Codex, then retry/);
      assert.match(text, language === "fr" ? /Sans --background, avec auto.*permissions.*à ne faire que si/ : /Without --background, with auto.*permissions.*only do so if/);
      assert.doesNotMatch(text, /ou relancez sans --background|or retry without --background/);
    }
    else assert.equal(result.error!.message, createTranslator(language).relay.status("target-busy"));
  }
  if (kind === "auto-race") assert.equal(probes, 2);
});

for (const language of ["fr", "en"] as const) test(`Mission --open : explication ${language}`, async () => {
  const result = await executeRelay(["relay", "--open", "--language", language], { header });
  assert.equal(result.status, "invalid-request"); assert.equal(result.error!.reason, "invalid-arguments");
  assert.match(result.error!.message, language === "fr" ? /Mission reste en arrière-plan/ : /Mission stays in background/);
  assert.equal(result.remedy, undefined); assert.equal(result.delivery.status, "not-delivered");
});
