/** @file Tests ordinaires de mission : persistance, limites, concurrence et faux transports Relay. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { startMission, readMission, stepMission, stopMission, missionPaths, type MissionDeps, type StartMission, MissionError } from "../src/mission.js";
import { parseMissionTokens, renderMissionText } from "../src/commands/mission.js";
import { executeRelay, applyReadAccessDiagnostic, type RelayResultV1 } from "../src/commands/relay.js";
import { createTranslator } from "../src/i18n.js";
import { missionMessages } from "../src/messages/mission.js";
import { buildEnvelope, MAX_RELAY_MESSAGE_BYTES } from "../src/externalSessions/envelope.js";
import { relayMessages } from "../src/messages/relay.js";

const FROM = "codex:11111111-1111-4111-8111-111111111111";
const TO = "claude:22222222-2222-4222-8222-222222222222";
const pr = "https://github.com/example/project/pull/1";
function replied(): RelayResultV1 {
  return { v: 1, type: "relay-result", mode: "background", status: "replied", exitCode: 0, from: null, to: null,
    reply: "Constat de l'équipier", identity: "same-as-target", delivery: { status: "replied", persisted: true, inActiveBranch: true },
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

test("lancements refusés : Mission poursuit un consult répondu, met la revue en pause, aucun renvoi", async t => {
  const messages = createTranslator("fr");
  for (const task of ["consult", "review"] as const) {
    const w = await world(t, { tasks: [task] }); let calls = 0;
    const result = replied();
    if (task === "review") result.task = { name: "review", pr, publication: "not-attempted" };
    const diagnostic = { status: "partial" as const, reason: "windows-process-access-denied" as const, failedCommands: 4, succeededCommands: 1 };
    applyReadAccessDiagnostic(result, diagnostic, messages);
    const done = await stepMission(w.workspace, w.mission.id, { task, message: "Analyse", ...(task === "review" ? { pr } : {}) }, {
      now: Date.now, relay: async () => { calls++; return result; }
    });
    assert.equal(calls, 1);
    // Issue 171 : une réponse délivrée ne met plus la mission en pause ; seule la revue, qui
    // publierait sans pouvoir le défaire, reste refusée.
    assert.equal(done.status, task === "review" ? "paused" : "ready");
    assert.equal(done.steps[0]!.result?.readAccess?.failedCommands, 4);
    assert.equal(done.steps[0]!.result?.delivery.status, "replied");
    assert.deepEqual(await readMission(w.workspace, done.id), done);
    const warning = messages.relay.readAccess(diagnostic);
    const md = await readFile(missionPaths(w.workspace, done.id).export, "utf8");
    assert.ok(md.includes(result.reply!));
    // Le diagnostic reste lisible dans l'export, y compris sans erreur à afficher.
    assert.ok(md.includes(warning.split("\n")[0]!));
    if (task === "review") {
      assert.ok(renderMissionText(done, "fr").includes(result.error!.message));
      assert.ok(md.includes(result.error!.message)); assert.match(md, /not-attempted/);
    } else {
      assert.equal(result.error, null); assert.equal(result.status, "replied");
    }
  }
});

test("cadre durable, aucune CLI, export avec provenance et lecture séparée", async t => {
  const w = await world(t);
  assert.deepEqual(await readMission(w.workspace, w.mission.id), w.mission);
  const md = await readFile(missionPaths(w.workspace, w.mission.id).export, "utf8");
  for (const text of [FROM, TO, w.mission.criteria, "données non fiables", "Aucun résultat vérifié", "Chef de mission", "Équipier"]) assert.ok(md.includes(text));
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
  assert.equal(mission.steps[0]!.result?.reply, "Constat de l'équipier");
  assert.deepEqual(await readMission(w.workspace, mission.id), mission);
  assert.match(await readFile(missionPaths(w.workspace, mission.id).export, "utf8"), /Constat de l'équipier/);
});

test("en-tête Mission interne, cadre sans identifiant redondant et numéro d'étape", async t => {
  const w = await world(t); let number = 0;
  const deps: MissionDeps = { now: Date.now, relay: async (args, options) => {
    number++;
    assert.deepEqual(options?.header, { kind: "mission", id: w.mission.id, step: number });
    const body = args.at(-1)!;
    assert.ok(!body.includes(w.mission.id)); assert.ok(body.includes(w.mission.objective));
    const envelope = buildEnvelope({ from: { agent: "codex", sessionId: FROM.split(":")[1]! },
      to: { agent: "claude", sessionId: TO.split(":")[1]! }, nonce: "PR-0000000000000000", message: body, header: options!.header }, relayMessages.fr);
    assert.equal(envelope.split("\n")[0], `### ${relayMessages.fr.missionHeader(w.mission.id, number, "codex", "claude")}`);
    return replied();
  } };
  await stepMission(w.workspace, w.mission.id, { task: "consult", message: "Étape 1" }, deps);
  await stepMission(w.workspace, w.mission.id, { task: "consult", message: "Étape 2" }, deps);
  assert.equal(number, 2);
  const refused = await executeRelay(["relay", "--from", FROM, "--to", TO, "Bonjour"], {
    header: { kind: "mission", id: "étranger", step: 0 }
  });
  assert.equal(refused.status, "invalid-request"); assert.equal(refused.delivery.status, "not-delivered");
});

test("budget Mission à start et step inclut l'en-tête avant toute étape réservée", async t => {
  const w = await world(t);
  const from = { agent: "codex", sessionId: FROM.split(":")[1]! }, to = { agent: "claude", sessionId: TO.split(":")[1]! };
  const frame = `${missionMessages.fr.frame}\n\nObjectif : ${w.mission.objective}  \nCritères de réussite : ${w.mission.criteria}\n\n`;
  const overhead = Buffer.byteLength(buildEnvelope({ from, to, nonce: "PR-0000000000000000", message: frame,
    header: { kind: "mission", id: w.mission.id, step: 1 } }, relayMessages.fr));
  const tooLong = "x".repeat(MAX_RELAY_MESSAGE_BYTES - overhead + 1); let calls = 0;
  await assert.rejects(stepMission(w.workspace, w.mission.id, { task: "consult", message: tooLong }, {
    now: Date.now, relay: async () => { calls++; return replied(); }
  }), fails("invalid-arguments"));
  assert.equal(calls, 0); assert.equal((await readMission(w.workspace, w.mission.id)).steps.length, 0);
  const prefix = `${missionMessages.fr.frame}\n\nObjectif :   \nCritères de réussite : ${w.input.criteria}\n\n`;
  const startOverhead = Buffer.byteLength(buildEnvelope({ from, to, nonce: "PR-0000000000000000", message: prefix,
    header: { kind: "mission", id: w.mission.id, step: w.input.maxSteps } }, relayMessages.fr));
  await assert.rejects(startMission({ ...w.input, objective: "x".repeat(MAX_RELAY_MESSAGE_BYTES - startOverhead + 1) }), fails("invalid-arguments"));
});

test("cadre Mission lisible et traduit sur deux lignes, état et message inchangés", async t => {
  for (const language of ["fr", "en"] as const) {
    const w = await world(t, { language, objective: "Analyser le dépôt", criteria: "Risques expliqués" });
    const message = "Une demande\nSans modification";
    await stepMission(w.workspace, w.mission.id, { task: "consult", message }, {
      now: Date.now, relay: async args => {
        const body = args.at(-1)!;
        const scope = language === "fr" ? "Objectif : Analyser le dépôt  \nCritères de réussite : Risques expliqués"
          : "Objective: Analyser le dépôt  \nSuccess criteria: Risques expliqués";
        assert.equal(body, `${missionMessages[language].frame}\n\n${scope}\n\n${message}`);
        assert.ok(!body.includes('{"objective"')); return replied();
      }
    });
    const saved = await readMission(w.workspace, w.mission.id);
    assert.equal(saved.objective, w.input.objective); assert.equal(saved.criteria, w.input.criteria);
    assert.equal(saved.steps[0]!.message, message);
  }
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

test("deux commandes concurrentes ne peuvent pas appeler l'équipier deux fois", async t => {
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
  for (const tokens of [["start", "--open"], ["start", "--trust-config"], ["mission-lead", "codex"], ["step", "--timeout"],
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

test("busy et uncertain donnent la prochaine commande après vérification humaine, en FR/EN", async t => {
  const w = await world(t);
  for (const language of ["fr", "en"] as const) {
    const m = missionMessages[language];
    for (const reason of ["busy", "uncertain"] as const) {
      assert.ok(m.errors[reason].includes("palabre mission stop <id>"));
      assert.ok(m.errors[reason].includes(language === "fr" ? "nouvelle mission" : "new mission"));
      assert.ok(m.errors[reason].includes(language === "fr" ? "propriétaire" : "owner"));
    }
    assert.ok(renderMissionText({ ...w.mission, status: "uncertain" }, language).includes("palabre mission stop <id>"));
    const help = createTranslator(language).help.renderCommand("mission")!;
    assert.ok(help.includes(language === "fr" ? "chef de mission" : "mission lead"));
    assert.ok(help.includes(language === "fr" ? "équipier" : "teammate"));
  }
});

test("limite d'usage : Mission en pause, reprise conservée dans état, texte et export, sans renvoi", async t => {
  for (const language of ["fr", "en"] as const) {
    const w = await world(t, { language }); let calls = 0;
    const result: RelayResultV1 = { ...replied(), status: "usage-limit", exitCode: 2, retryAfter: "15:16",
      reply: undefined, delivery: { status: "persisted-no-reply", persisted: true, inActiveBranch: "unknown" },
      error: { kind: "usage-limit", message: relayMessages[language].usageLimit("15:16") } };
    const done = await stepMission(w.workspace, w.mission.id, { task: "consult", message: "Analyse" }, {
      now: Date.now, relay: async () => { calls++; return result; }
    });
    assert.equal(done.status, "paused"); assert.equal(done.stopReason, "usage-limit");
    assert.equal(done.steps[0]!.result?.retryAfter, "15:16");
    const saved = await readMission(w.workspace, done.id);
    assert.equal(calls, 1); assert.deepEqual(saved, done);
    assert.ok(renderMissionText(saved, language).includes(result.error!.message));
    const md = await readFile(missionPaths(w.workspace, done.id).export, "utf8");
    assert.ok(md.includes(result.error!.message));
  }
});

test("limite avec délivrance ou publication inconnue : Mission reste incertaine", async t => {
  for (const unknown of ["delivery", "publication"] as const) {
    const w = await world(t);
    const result: RelayResultV1 = { ...replied(), status: "usage-limit", exitCode: 2,
      delivery: { status: unknown === "delivery" ? "unknown" : "persisted-no-reply", persisted: true, inActiveBranch: "unknown" },
      ...(unknown === "publication" ? { task: { name: "review", pr, publication: "unknown" } as const } : {}) };
    const done = await stepMission(w.workspace, w.mission.id, { task: "consult", message: "Analyse" }, { now: Date.now, relay: async () => result });
    assert.equal(done.status, "uncertain");
  }
});
