/** @file Tests ordinaires de mission : persistance, limites, concurrence et faux transports Relay. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { startMission, readMission, stepMission, stopMission, missionPaths, type MissionDeps, type StartMission, MissionError } from "../src/mission.js";
import { parseMissionTokens, renderMissionText } from "../src/commands/mission.js";
import { executeRelay, type RelayResultV1 } from "../src/commands/relay.js";
import { createTranslator } from "../src/i18n.js";

const FROM = "codex:11111111-1111-4111-8111-111111111111";
const TO = "claude:22222222-2222-4222-8222-222222222222";
const pr = "https://github.com/example/project/pull/1";
function replied(): RelayResultV1 {
  return { v: 1, type: "relay-result", status: "replied", exitCode: 0, from: null, to: null,
    reply: "Constat du collègue", identity: "same-as-target", delivery: { status: "replied", persisted: true, inActiveBranch: true },
    observedModels: [], error: null, exportPath: null, durationMs: 1 };
}
async function world(t: { after(fn: () => Promise<void>): void }, patch: Partial<StartMission> = {}) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-mission-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const input: StartMission = { workspace, config: path.join(workspace, "palabre.config.json"), language: "fr",
    objective: "Analyser sans modifier", criteria: "Risques expliqués", from: FROM, to: TO,
    tasks: ["consult"], maxSteps: 3, maxDurationSeconds: 3600, timeoutSeconds: 600, ...patch };
  return { workspace, input, mission: await startMission(input) };
}
const fails = (kind: string) => (e: unknown) => e instanceof MissionError && e.code === kind;

test("cadre durable, aucune CLI, export avec provenance et lecture séparée", async t => {
  const w = await world(t);
  assert.deepEqual(await readMission(w.workspace, w.mission.id), w.mission);
  const md = await readFile(missionPaths(w.workspace, w.mission.id).export, "utf8");
  for (const text of [FROM, TO, w.mission.criteria, "données non fiables", "Aucun résultat vérifié"]) assert.ok(md.includes(text));
  assert.match(renderMissionText(w.mission, "fr"), /Rien à faire pour vous/);
  assert.match(renderMissionText(w.mission, "en"), /Nothing for you/);
});

test("une étape réserve son état avant un seul Relay ; réponse et identité conservées", async t => {
  const w = await world(t); let calls = 0;
  const deps: MissionDeps = { now: Date.now, relay: async (args, options) => {
    calls++;
    const saved = await readMission(w.workspace, w.mission.id);
    assert.equal(saved.status, "running"); assert.equal(saved.steps.length, 1);
    assert.deepEqual(args.slice(0, 5), ["relay", "--from", FROM, "--to", TO]);
    assert.ok(args.includes("--no-export")); assert.ok(!args.includes("--open")); assert.ok(!args.includes("--trust-config"));
    assert.ok(args.some(x => x.includes("coordination non authentifiée") && x.includes(w.mission.objective) && x.includes("Inspecte les limites")));
    assert.equal(options?.signal?.aborted, false); return replied();
  } };
  const mission = await stepMission(w.workspace, w.mission.id, { task: "consult", message: "Inspecte les limites" }, deps);
  assert.equal(calls, 1); assert.equal(mission.status, "ready");
  assert.equal(mission.steps[0]!.result?.reply, "Constat du collègue");
  assert.deepEqual(await readMission(w.workspace, mission.id), mission);
  assert.match(await readFile(missionPaths(w.workspace, mission.id).export, "utf8"), /Constat du collègue/);
});

test("tâche review conserve PR et publication sans contourner la politique Relay", async t => {
  const w = await world(t, { tasks: ["review"] }); let calls = 0;
  const report = replied(); report.task = { name: "review", pr, publication: "published", reviewUrl: pr + "#pullrequestreview-1" };
  const done = await stepMission(w.workspace, w.mission.id, { task: "review", pr, message: "Relis la PR" }, {
    now: Date.now, relay: async args => { calls++; assert.deepEqual(args.slice(-4), ["--task", "review", "--pr", pr]); return report; }
  });
  assert.equal(calls, 1); assert.equal(done.steps[0]!.result?.task?.reviewUrl, report.task.reviewUrl);
  const md = await readFile(missionPaths(w.workspace, done.id).export, "utf8"); assert.ok(md.includes(report.task.reviewUrl!));
});

test("hors cadre, mauvaise PR et message trop grand refusés sans transport ni étape", async t => {
  const w = await world(t); let calls = 0;
  const deps: MissionDeps = { now: Date.now, relay: async () => { calls++; return replied(); } };
  await assert.rejects(stepMission(w.workspace, w.mission.id, { task: "review", pr, message: "review" }, deps), fails("task-not-allowed"));
  for (const input of [{ task: "consult" as const, pr, message: "hello" }, { task: "consult" as const, message: "x".repeat(65536) },
    { task: "consult" as const, message: "  " }, { task: "consult" as const, message: "x", timeoutSeconds: 0 }]) {
    await assert.rejects(stepMission(w.workspace, w.mission.id, input, deps), fails("invalid-arguments"));
  }
  assert.equal(calls, 0); assert.equal((await readMission(w.workspace, w.mission.id)).steps.length, 0);
});

test("durée depuis start, nombre d'essais et surcharge du délai par étape", async t => {
  const w = await world(t, { maxSteps: 1 }); let calls = 0;
  const deps: MissionDeps = { now: () => w.mission.deadline - 25000, relay: async args => {
    calls++; assert.equal(args[args.indexOf("--timeout") + 1], "25"); return replied();
  } };
  await stepMission(w.workspace, w.mission.id, { task: "consult", message: "x", timeoutSeconds: 60 }, deps);
  await assert.rejects(stepMission(w.workspace, w.mission.id, { task: "consult", message: "x" }, deps), fails("budget"));
  const second = await world(t);
  await assert.rejects(stepMission(second.workspace, second.mission.id, { task: "consult", message: "x" },
    { ...deps, now: () => second.mission.deadline - 9000 }), fails("budget"));
  assert.equal(calls, 1);
});

test("deux commandes concurrentes ne peuvent pas appeler le collègue deux fois", async t => {
  const w = await world(t); let release!: () => void; let entered!: () => void;
  const pending = new Promise<void>(r => { release = r; }); const called = new Promise<void>(r => { entered = r; }); let calls = 0;
  const deps: MissionDeps = { now: Date.now, relay: async () => { calls++; entered(); await pending; return replied(); } };
  const first = stepMission(w.workspace, w.mission.id, { task: "consult", message: "premier" }, deps);
  await called;
  try { await assert.rejects(stepMission(w.workspace, w.mission.id, { task: "consult", message: "second" }, deps), fails("busy")); }
  finally { release(); }
  await first; assert.equal(calls, 1);
});

test("budget franchi pendant la réservation : aucun appel tardif", async t => {
  const w = await world(t); let checks = 0; let calls = 0;
  const done = await stepMission(w.workspace, w.mission.id, { task: "consult", message: "analyse" }, {
    now: () => ++checks <= 3 ? w.mission.deadline - 20000 : w.mission.deadline + 1,
    relay: async () => { calls++; return replied(); }
  });
  assert.equal(calls, 0); assert.equal(done.status, "uncertain");
  assert.equal(done.steps.length, 1);
});

test("budget épuisé visible sans proposer une étape interdite", async t => {
  const w = await world(t, { maxSteps: 1 });
  const done = await stepMission(w.workspace, w.mission.id, { task: "consult", message: "analyse" }, { now: Date.now, relay: async () => replied() });
  assert.equal(done.status, "paused"); assert.equal(done.stopReason, "budget");
  const text = renderMissionText(done, "fr"); assert.match(text, /maximale est atteint/); assert.ok(!text.includes("palabre mission step"));
});

test("stop reste accessible pendant l'appel, annule le transport et interdit toute suite", async t => {
  const w = await world(t); let entered!: () => void; let calls = 0;
  const called = new Promise<void>(r => { entered = r; });
  const running = stepMission(w.workspace, w.mission.id, { task: "consult", message: "analyse" }, {
    now: Date.now, relay: async (_args, options) => {
      calls++; entered();
      await new Promise<void>(resolve => options!.signal!.addEventListener("abort", () => resolve(), { once: true }));
      return { ...replied(), status: "cancelled", exitCode: 130, delivery: { status: "unknown", persisted: "unknown", inActiveBranch: "unknown" } };
    }
  });
  await called;
  const stopped = await stopMission(w.workspace, w.mission.id, "décision humaine"); assert.equal(stopped.status, "stopped");
  const done = await running;
  assert.equal(done.status, "stopped"); assert.equal(done.steps[0]!.result!.status, "cancelled");
  assert.equal((await stopMission(w.workspace, done.id, "autre")).stopReason, "décision humaine");
  await assert.rejects(stepMission(w.workspace, done.id, { task: "consult", message: "encore" }), fails("stopped"));
  assert.equal(calls, 1);
});

test("coupure avec verrou orphelin : stop fonctionne sans effacer la réservation", async t => {
  const w = await world(t); const files = missionPaths(w.workspace, w.mission.id);
  await writeFile(files.lock, "");
  assert.equal((await stopMission(w.workspace, w.mission.id, "coupure")).status, "stopped");
  assert.equal(await readFile(files.lock, "utf8"), "");
});

test("délivrance incertaine et publication inconnue bloquent toute nouvelle étape", async t => {
  for (const kind of ["unknown", "persisted-no-reply", "publication", "throw", "running"] as const) {
    const w = await world(t); let calls = 0;
    const deps: MissionDeps = { now: Date.now, relay: async () => {
      calls++; if (kind === "throw") throw Error("après l'envoi");
      const result = replied();
      if (kind === "publication") { result.status = "review-failed"; result.task = { name: "review", pr, publication: "unknown" }; }
      else result.delivery.status = kind === "running" ? "unknown" : kind;
      return result;
    } };
    if (kind === "running") {
      const mission = w.mission; mission.status = "running";
      mission.steps.push({ number: 1, task: "consult", message: "déjà commencé", startedAt: mission.createdAt });
      await writeFile(missionPaths(w.workspace, mission.id).state, JSON.stringify(mission));
    } else {
      assert.equal((await stepMission(w.workspace, w.mission.id, { task: "consult", message: "x" }, deps)).status, "uncertain");
    }
    const before = calls;
    await assert.rejects(stepMission(w.workspace, w.mission.id, { task: "consult", message: "retry" }, deps), fails("uncertain"));
    assert.equal(calls, before);
  }
});

test("occupation certaine suspend ; seule une nouvelle étape explicite peut continuer", async t => {
  const w = await world(t); let calls = 0;
  const deps: MissionDeps = { now: Date.now, relay: async () => {
    calls++; return calls === 1 ? { ...replied(), status: "target-busy", exitCode: 3, retryable: true, reply: undefined,
      delivery: { status: "not-delivered", persisted: false, inActiveBranch: false } } : replied();
  } };
  assert.equal((await stepMission(w.workspace, w.mission.id, { task: "consult", message: "x" }, deps)).status, "paused");
  assert.equal(calls, 1);
  assert.equal((await stepMission(w.workspace, w.mission.id, { task: "consult", message: "nouvelle demande" }, deps)).status, "ready");
  assert.equal(calls, 2);
});

test("état et identifiants invalides : refus avant le transport", async t => {
  const w = await world(t);
  for (const id of ["../autre", "", "-x"]) await assert.rejects(readMission(w.workspace, id), fails("invalid-arguments"));
  const files = missionPaths(w.workspace, w.mission.id);
  for (const value of ["{", JSON.stringify({ ...w.mission, to: "--open" }), JSON.stringify({ ...w.mission, tasks: ["code"] }),
    JSON.stringify({ ...w.mission, timeoutSeconds: "600" }), JSON.stringify({ ...w.mission, id: "11111111-1111-4111-8111-111111111111" })]) {
    await writeFile(files.state, value); await assert.rejects(readMission(w.workspace, w.mission.id), fails("invalid-state"));
  }
});

test("cadres invalides : pas de mission ni d'autorisation implicite", async t => {
  const w = await world(t);
  for (const patch of [{ to: FROM }, { from: "codex:latest" }, { criteria: "" }, { maxSteps: 0 }, { maxDurationSeconds: 0 },
    { timeoutSeconds: 3601 }, { tasks: ["code"] }, { tasks: ["consult", "consult"] }]) {
    await assert.rejects(startMission({ ...w.input, ...patch } as StartMission), fails("invalid-arguments"));
  }
});

test("parseur strict et aide FR/EN autonome", () => {
  for (const tokens of [["start", "--open"], ["start", "--trust-config"], ["chef", "codex"], ["step", "--timeout"],
    ["status", "--json", "--json"], ["start", "--from=x"], ["step", "-q"]]) assert.throws(() => parseMissionTokens(tokens), fails("invalid-arguments"));
  assert.equal(parseMissionTokens(["step", "id", "Bonjour", "--timeout", "1200", "--json"]).flags.timeout, "1200");
  for (const lang of ["fr", "en"] as const) {
    const help = createTranslator(lang).help.renderCommand("mission")!;
    for (const term of ["mission start", "mission step", "mission status", "mission stop", "--timeout", ".mission.md", "--json", "review"]) assert.ok(help.includes(term));
  }
});

test("Relay programmatique annulé avant lancement ne lit ni config ni session", async () => {
  const controller = new AbortController(); controller.abort();
  const result = await executeRelay(["relay", "--from", FROM, "--to", TO, "hello"], { signal: controller.signal });
  assert.equal(result.status, "cancelled"); assert.equal(result.delivery.status, "not-delivered");
});
