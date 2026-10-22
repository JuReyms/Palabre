/** @file Transport et commande sur une fausse CLI, un serveur local et des historiques jetables. */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCopyRelay } from "../src/externalSessions/copyRelay.js";
import { OpenCodeCopyTransport } from "../src/externalSessions/opencodeTransport.js";
import { executeRelay, renderRelayText } from "../src/commands/relay.js";
import { trustConfig } from "../src/configTrust.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";
import { createTranslator } from "../src/i18n.js";
import type { OpenCodeSnapshot } from "../src/externalSessions/opencodeCopy.js";
import { renderRelayMarkdown, type RelayExport } from "../src/output.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-opencode-fake-"));
after(() => rmSync(root, { recursive: true, force: true }));
const fixture = path.resolve("tests/fixtures/external-sessions/fake-opencode.cjs");
const sourceId = "ses_SourceABC", copyId = "ses_CopyXYZ";
let counter = 0;

test("export pur FR/EN : un seul mode copie, même sans mode explicite, jamais l'arrière-plan", () => {
  const report: RelayExport = { from: null, to: { agent: "laboratoire", session: copyId, provider: "opencode" },
    copy: { source: sourceId, session: copyId, verified: true, retention: "retained", sourceCheck: "unchanged", serverStop: "confirmed" },
    status: "cli-failure", delivery: { status: "replied", persisted: true, inActiveBranch: true }, identity: "same-as-target",
    observedModels: ["fake/test"], nonce: "fictif", startedAt: "2026-10-22T12:00:00Z", message: "Avis fictif", reply: "Réponse conservée" };
  for (const language of ["fr", "en"] as const) for (const mode of [undefined, "copy"] as const) {
    const messages = createTranslator(language);
    const md = renderRelayMarkdown({ ...report, ...(mode ? { mode } : {}) }, messages, { palabreVersion: "test" });
    assert.equal((md.match(/\| Mode \|/g) ?? []).length, 1);
    assert.ok(md.includes(`copy — ${messages.relay.export.modeNames.copy}`));
    assert.ok(md.includes(messages.relay.copy.notice)); assert.ok(md.includes(report.reply!));
    assert.equal(md.includes(messages.relay.export.readOnlyNotice), false);
    assert.doesNotMatch(md, /codex:\/\/|undefined/);
  }
});

/** Un projet et deux historiques totalement fictifs. */
function world(mode = "") {
  const cwd = path.join(root, String(++counter)); mkdirSync(cwd);
  const source: OpenCodeSnapshot = {
    info: { id: sourceId, location: { directory: cwd }, agent: "build", model: { providerID: "fake", id: "test" },
      permissions: [], outcome: "succeeded", time: { idle: 10 } },
    export: { info: { id: sourceId }, messages: [] }, inbox: [], instructions: [],
    context: [{ id: "msg_u", type: "user", text: "Bonjour" },
      { id: "msg_a", type: "assistant", finish: "stop", time: { completed: 9 }, content: [{ type: "text", text: "ACK" }] },
      { id: "msg_i", type: "idle", outcome: "succeeded" }]
  };
  const copy = structuredClone(source); copy.info.id = copyId; copy.info.fork = { sessionID: sourceId };
  copy.context.forEach(m => { m.id = `${m.id}Copy`; });
  const state = path.join(cwd, "state.json"), calls = path.join(cwd, "calls.jsonl");
  writeFileSync(state, JSON.stringify({ source, copy, mode })); writeFileSync(calls, "");
  const priorState = process.env.PALABRE_FAKE_COPY_STATE, priorCalls = process.env.PALABRE_FAKE_COPY_CALLS;
  process.env.PALABRE_FAKE_COPY_STATE = state; process.env.PALABRE_FAKE_COPY_CALLS = calls;
  const restore = () => {
    if (priorState === undefined) delete process.env.PALABRE_FAKE_COPY_STATE; else process.env.PALABRE_FAKE_COPY_STATE = priorState;
    if (priorCalls === undefined) delete process.env.PALABRE_FAKE_COPY_CALLS; else process.env.PALABRE_FAKE_COPY_CALLS = priorCalls;
  };
  return { cwd, state, calls, restore, source,
    readCalls: () => readFileSync(calls, "utf8").trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as { args: string[]; cwd: string }) };
}

test("transport réel avec CLI fictive : URL locale, auth, stdin, copie, fermeture et aucun override", async () => {
  const w = world();
  try {
    const result = await runCopyRelay({ source: sourceId, cwd: w.cwd, timeoutMs: 8000, envelope: () => "Corps exact PR-123" },
      { transport: new OpenCodeCopyTransport({ command: process.execPath, prefixArgs: [fixture] }, w.cwd, 8000), platform: "win32" });
    assert.equal(result.outcome.status, "replied", JSON.stringify(result));
    assert.equal(result.copy.serverStop, "confirmed"); assert.equal(result.reply, "Avis fictif transport");
    const calls = w.readCalls(); assert.equal(calls.length, 3);
    const run = calls.find(c => c.args[0] === "run")!;
    assert.equal(run.args[run.args.indexOf("--session") + 1], copyId);
    assert.equal(run.cwd, w.cwd); assert.equal(run.args.includes("--auto"), false); assert.equal(run.args.includes("--pure"), false);
    assert.equal(run.args.includes("--model"), false); assert.equal(run.args.includes("--agent"), false);
    assert.deepEqual(JSON.parse(readFileSync(w.state, "utf8")).source, w.source);
    assert.equal(JSON.stringify(result).includes("127.0.0.1"), false);
  } finally { w.restore(); }
});

test("transport : erreurs, redirect et dépassement API sans réponse partielle ni renvoi", async () => {
  for (const [mode, status, delivery] of [["client-error", "cli-failure", "persisted-no-reply"], ["partial", "no-valid-reply", "persisted-no-reply"],
    ["api-overflow", "output-too-large", "not-delivered"], ["api-redirect", "cli-failure", "not-delivered"], ["bad-fork", "identity-mismatch", "not-delivered"]]) {
    const w = world(mode);
    try {
      const result = await runCopyRelay({ source: sourceId, cwd: w.cwd, timeoutMs: 8000, envelope: () => "Corps exact" },
        { transport: new OpenCodeCopyTransport({ command: process.execPath, prefixArgs: [fixture] }, w.cwd, 8000), platform: "win32" });
      assert.equal(result.outcome.status, status, mode); assert.equal(result.delivery.status, delivery, mode);
      assert.equal(result.copy.serverStop, "confirmed", mode); assert.equal(result.reply, undefined, mode);
      assert.ok(w.readCalls().filter(c => c.args[0] === "run").length <= 1);
    } finally { w.restore(); }
  }
});

test("modèle explicite : catalogue et POST204 copie, puis run sans override ; refus sans envoi", async () => {
  for (const [mode, diagnostic] of [["", undefined], ["model-no-effect", "model-selection-unverified"],
    ["model-bad-ack", "model-selection-ack"], ["model-ack-lost", "api-request"], ["model-overflow", "api-output-limit"]] as const) {
    const w = world(mode);
    try {
      const result = await runCopyRelay({ source: sourceId, cwd: w.cwd, timeoutMs: 8000, model: "fake/other#high", envelope: () => "Corps exact" },
        { transport: new OpenCodeCopyTransport({ command: process.execPath, prefixArgs: [fixture] }, w.cwd, 8000), platform: "win32" });
      const state = JSON.parse(readFileSync(w.state, "utf8"));
      assert.deepEqual(state.source, w.source);
      assert.equal(state.apiCalls.filter((c: { route: string }) => c.route === `/api/session/${sourceId}/model`).length, 0);
      assert.ok(state.apiCalls.filter((c: { route: string }) => c.route === `/api/session/${copyId}/model`).length <= 1);
      const runs = w.readCalls().filter(c => c.args[0] === "run");
      if (diagnostic) {
        assert.equal(result.copy.diagnostic, diagnostic, mode); assert.equal(result.delivery.status, "not-delivered", mode);
        assert.equal(runs.length, 0, mode);
      } else {
        assert.equal(result.outcome.status, "replied", JSON.stringify(result)); assert.equal(result.copy.model?.selected, "fake/other#high");
        assert.deepEqual(result.observedModels, ["fake/other#high"]); assert.equal(runs.length, 1);
        assert.equal(runs[0]!.args.includes("--model"), false);
      }
    } finally { w.restore(); }
  }
});

test("transport : plafonds serveur et API cumulée restent bornés, même avec plusieurs chunks", async () => {
  for (const mode of ["server-overflow", "api-total-limit"]) {
    const w = world(mode);
    try {
      const result = await runCopyRelay({ source: sourceId, cwd: w.cwd, timeoutMs: 8000, envelope: () => "Corps exact" },
        { transport: new OpenCodeCopyTransport({ command: process.execPath, prefixArgs: [fixture] }, w.cwd, 8000), platform: "win32" });
      assert.equal(result.outcome.status, "output-too-large", mode);
      assert.equal(result.copy.serverStop, "confirmed", mode);
      assert.ok(w.readCalls().filter(c => c.args[0] === "run").length <= 1);
    } finally { w.restore(); }
  }
});

test("transport : arrêt pour plafond pendant les requêtes API conserve sa cause primaire", async () => {
  for (const mode of ["server-overflow-request", "api-disconnect"]) {
    const w = world(mode);
    try {
      const result = await runCopyRelay({ source: sourceId, cwd: w.cwd, timeoutMs: 8000, envelope: () => "Corps exact" },
        { transport: new OpenCodeCopyTransport({ command: process.execPath, prefixArgs: [fixture] }, w.cwd, 8000), platform: "win32" });
      const overflow = mode === "server-overflow-request";
      assert.equal(result.outcome.status, overflow ? "output-too-large" : "cli-failure", JSON.stringify(result));
      assert.equal(result.copy.diagnostic, overflow ? "server-output-limit" : "api-request");
      assert.equal(result.delivery.status, "not-delivered"); assert.equal(result.copy.retention, "none");
      assert.equal(result.copy.serverStop, "confirmed"); assert.equal(result.reply, undefined);
      assert.equal(w.readCalls().some(c => c.args[0] === "run"), false);
    } finally { w.restore(); }
  }
});

test("transport : plafond détecté à l'arrêt refuse le succès global sans effacer la réponse", async () => {
  const w = world("server-overflow-stop");
  try {
    const result = await runCopyRelay({ source: sourceId, cwd: w.cwd, timeoutMs: 8000, envelope: () => "Corps exact" },
      { transport: new OpenCodeCopyTransport({ command: process.execPath, prefixArgs: [fixture] }, w.cwd, 8000), platform: "win32" });
    assert.equal(result.outcome.status, "output-too-large", JSON.stringify(result));
    assert.equal(result.copy.diagnostic, "server-output-limit"); assert.equal(result.copy.serverStop, "confirmed");
    assert.equal(result.reply, "Avis fictif transport"); assert.equal(result.delivery.status, "replied");
    assert.equal(result.copy.sourceCheck, "unchanged"); assert.equal(result.copy.session, copyId);
    assert.equal(w.readCalls().filter(c => c.args[0] === "run").length, 1);
  } finally { w.restore(); }
});

test("commande Windows : copie et export FR/EN sous auto/background ; refus avant lancement", { skip: process.platform !== "win32" }, async () => {
  for (const [language, view] of [["fr", "auto"], ["fr", "background"], ["en", "auto"], ["en", "background"]] as const) {
    const w = world();
    try {
      const bin = path.join(w.cwd, "bin"); mkdirSync(bin);
      const script = "node_modules/fake-opencode/cli.js"; mkdirSync(path.join(bin, "node_modules/fake-opencode"), { recursive: true });
      writeFileSync(path.join(bin, script), `require(${JSON.stringify(fixture)});\n`);
      writeFileSync(path.join(bin, "opencode.ps1"), npmPowerShellShim(script));
      const config = path.join(w.cwd, "palabre.config.json");
      writeFileSync(config, JSON.stringify({ language, relay: { view }, outputDir: path.join(w.cwd, "exports"), agents: {
        laboratoire: { type: "cli", command: path.join(bin, "opencode.ps1"), role: "reviewer" }
      } }));
      await trustConfig(config);
      const args = ["relay", "--copy", "--to", `laboratoire:${sourceId}`, "--dir", w.cwd, "--config", config, "--language", language,
        "--model", "fake/other#high", "Lis le projet sans le modifier."];
      const r = await executeRelay(args);
      assert.equal(r.status, "replied", JSON.stringify(r)); assert.equal(r.mode, "copy"); assert.equal(r.to?.session, copyId);
      assert.equal(r.modeSource, "explicit");
      assert.deepEqual(r.copy?.model, { requested: "fake/other#high", source: "fake/test", selected: "fake/other#high", verified: true });
      for (const key of ["check", "nextTurn", "quota", "queue", "correlation", "targetPermissions", "receiver"]) assert.equal(key in r, false, key);
      assert.equal(r.copy?.source, sourceId); assert.equal(r.created, undefined);
      const exported = readFileSync(r.exportPath!, "utf8");
      assert.ok(exported.includes(sourceId)); assert.ok(exported.includes(copyId));
      assert.ok(exported.includes(createTranslator(language).relay.copy.notice));
      assert.equal(exported.includes(createTranslator(language).relay.export.readOnlyNotice), false);
      const rendered = renderRelayText(r, createTranslator(language)); assert.ok(rendered.stderr.includes(sourceId));
      for (const label of ["modelRequested", "modelSource", "modelSelected", "modelVerified"] as const) {
        assert.ok(rendered.stderr.includes(createTranslator(language).relay.copy[label]));
        assert.ok(exported.includes(createTranslator(language).relay.copy[label]));
      }
      assert.ok(rendered.stderr.includes(createTranslator(language).relay.modeLine("copy", "laboratoire", false)));
      assert.equal(rendered.stderr.includes(createTranslator(language).relay.modeLine("background", "laboratoire", false)), false);
      assert.equal((exported.match(/\| Mode \|/g) ?? []).length, 1);
      assert.ok(exported.includes(`copy — ${createTranslator(language).relay.export.modeNames.copy}`));
      assert.doesNotMatch(rendered.stderr + exported, /codex:\/\/|undefined/);
      const stored = JSON.parse(readFileSync(w.state, "utf8"));
      assert.ok(stored.copy.context.find((m: { type: string; text?: string }) => m.type === "user" && m.text?.includes("PALABRE")));
      const count = w.readCalls().length;
      for (const conflict of ["--new", "--open", "--background", "--check", "--follow", "--then-follow", "--write", "--task", "--pr"]) {
        const extra = conflict === "--then-follow" ? [conflict, "10"] : conflict === "--task" ? [conflict, "review"] : conflict === "--pr" ? [conflict, "https://github.com/o/r/pull/1"] : [conflict];
        const refused = await executeRelay([...args, ...extra]); assert.equal(refused.status, "invalid-request");
      }
      const noCopy = await executeRelay(args.filter(a => a !== "--copy" && a !== "--dir" && a !== w.cwd));
      assert.equal(noCopy.status, "invalid-request"); assert.equal(w.readCalls().length, count);
    } finally { w.restore(); }
  }
});

test("options --copy incompatibles : refus avant lecture message/config, même sans projet", async () => {
  for (const language of ["fr", "en"] as const) {
    for (const extra of [["--background"], ["--check"], ["--follow"], ["--open", "--follow"], ["--then-follow", "10"]]) {
      const r = await executeRelay(["relay", "--copy", "--to", `opencode:${sourceId}`, "--language", language,
        "--config", path.join(root, "absent-config.json"), "--message-file", path.join(root, "absent-message.md"), ...extra]);
      assert.equal(r.status, "invalid-request"); assert.equal(r.error?.reason, "invalid-arguments");
      assert.ok(r.error?.message.endsWith(createTranslator(language).relay.copy.conflict));
      assert.equal(r.delivery.status, "not-delivered"); assert.equal(r.exportPath, null);
      assert.equal(r.copy, undefined); assert.equal(r.to, null);
    }
  }
});

test("--model réservé à --copy, syntaxe et duplications refusées avant IO", async () => {
  for (const language of ["fr", "en"] as const) {
    for (const extra of [["--model", "fake/other"], ["--new", "--model", "fake/other"],
      ["--open", "--model", "fake/other"], ["--check", "--model", "fake/other"],
      ["--copy", "--model", "auto"], ["--copy", "--model", "fake/other", "--model", "fake/test"]]) {
      const r = await executeRelay(["relay", "--to", `opencode:${sourceId}`, "--language", language,
        "--config", path.join(root, "absent-config.json"), "--message-file", path.join(root, "absent-message.md"), ...extra]);
      assert.equal(r.status, "invalid-request"); assert.equal(r.delivery.status, "not-delivered");
      assert.equal(r.to, null); assert.equal(r.exportPath, null);
    }
  }
  const invalidLanguage = await executeRelay(["relay", "--copy", "--to", `opencode:${sourceId}`, "--model", "fake/other", "--language", "unknown"]);
  assert.equal(invalidLanguage.status, "invalid-request"); assert.equal(invalidLanguage.delivery.status, "not-delivered");
});

test("commande : échec export conserve réponse/délivrance ; --no-export conserve la copie", { skip: process.platform !== "win32" }, async () => {
  for (const disabled of [false, true]) {
    const w = world();
    try {
      const bin = path.join(w.cwd, "bin"); mkdirSync(path.join(bin, "node_modules/fake-opencode"), { recursive: true });
      writeFileSync(path.join(bin, "node_modules/fake-opencode/cli.js"), `require(${JSON.stringify(fixture)});\n`);
      writeFileSync(path.join(bin, "opencode.ps1"), npmPowerShellShim("node_modules/fake-opencode/cli.js"));
      const blocked = path.join(w.cwd, "not-a-directory"); writeFileSync(blocked, "fixture");
      const config = path.join(w.cwd, "palabre.config.json");
      writeFileSync(config, JSON.stringify({ outputDir: path.join(blocked, "exports"), agents: {
        opencode: { type: "cli", command: path.join(bin, "opencode.ps1"), role: "reviewer" }
      } }));
      await trustConfig(config);
      const r = await executeRelay(["relay", "--copy", "--to", `opencode:${sourceId}`, "--dir", w.cwd, "--config", config,
        ...(disabled ? ["--no-export"] : []), "Donne un avis sans modification."]);
      assert.equal(r.status, disabled ? "replied" : "cli-failure"); assert.equal(r.exportPath, null);
      assert.equal(r.reply, "Avis fictif transport"); assert.equal(r.delivery.status, "replied");
      assert.equal(r.copy?.session, copyId); assert.equal(r.copy?.retention, "retained");
      if (!disabled) assert.equal(r.copy?.diagnostic, "export-failed");
    } finally { w.restore(); }
  }
});
