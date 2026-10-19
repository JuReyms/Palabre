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

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-opencode-fake-"));
after(() => rmSync(root, { recursive: true, force: true }));
const fixture = path.resolve("tests/fixtures/external-sessions/fake-opencode.cjs");
const sourceId = "ses_SourceABC", copyId = "ses_CopyXYZ";
let counter = 0;

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

test("commande Windows : copie et export FR/EN ; refus incompatibles avant lancement", { skip: process.platform !== "win32" }, async () => {
  for (const language of ["fr", "en"] as const) {
    const w = world();
    try {
      const bin = path.join(w.cwd, "bin"); mkdirSync(bin);
      const script = "node_modules/fake-opencode/cli.js"; mkdirSync(path.join(bin, "node_modules/fake-opencode"), { recursive: true });
      writeFileSync(path.join(bin, script), `require(${JSON.stringify(fixture)});\n`);
      writeFileSync(path.join(bin, "opencode.ps1"), npmPowerShellShim(script));
      const config = path.join(w.cwd, "palabre.config.json");
      writeFileSync(config, JSON.stringify({ language, outputDir: path.join(w.cwd, "exports"), agents: {
        laboratoire: { type: "cli", command: path.join(bin, "opencode.ps1"), role: "reviewer" }
      } }));
      await trustConfig(config);
      const args = ["relay", "--copy", "--to", `laboratoire:${sourceId}`, "--dir", w.cwd, "--config", config, "--language", language, "Lis le projet sans le modifier."];
      const r = await executeRelay(args);
      assert.equal(r.status, "replied", JSON.stringify(r)); assert.equal(r.mode, "copy"); assert.equal(r.to?.session, copyId);
      assert.equal(r.copy?.source, sourceId); assert.equal(r.created, undefined);
      const exported = readFileSync(r.exportPath!, "utf8");
      assert.ok(exported.includes(sourceId)); assert.ok(exported.includes(copyId));
      assert.ok(exported.includes(createTranslator(language).relay.copy.notice));
      assert.equal(exported.includes(createTranslator(language).relay.export.readOnlyNotice), false);
      const rendered = renderRelayText(r, createTranslator(language)); assert.ok(rendered.stderr.includes(sourceId));
      const stored = JSON.parse(readFileSync(w.state, "utf8"));
      assert.ok(stored.copy.context.find((m: { type: string; text?: string }) => m.type === "user" && m.text?.includes("PALABRE")));
      const count = w.readCalls().length;
      for (const conflict of ["--new", "--open", "--write", "--task", "--pr"]) {
        const extra = conflict === "--task" ? [conflict, "review"] : conflict === "--pr" ? [conflict, "https://github.com/o/r/pull/1"] : [conflict];
        const refused = await executeRelay([...args, ...extra]); assert.equal(refused.status, "invalid-request");
      }
      const noCopy = await executeRelay(args.filter(a => a !== "--copy" && a !== "--dir" && a !== w.cwd));
      assert.equal(noCopy.status, "invalid-request"); assert.equal(w.readCalls().length, count);
    } finally { w.restore(); }
  }
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
