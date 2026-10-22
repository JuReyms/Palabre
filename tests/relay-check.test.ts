/**
 * @file `palabre relay --check` (#203) : contrôles d'avant envoi sans rien envoyer ni lancer, sur un
 * profil fictif. La sonde du verrou Codex est simulée ; les exécutables sont des fichiers inertes,
 * jamais lancés. Lecture bornée des dernières permissions (`lastTurnContext`, `readLastTurnContext`).
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import { executeRelay, renderRelayText } from "../src/commands/relay.js";
import { CodexSessionAdapter } from "../src/externalSessions/codex.js";
import { lastTurnContext } from "../src/externalSessions/openReader.js";
import { LAST_CONTEXT_TAIL_BYTES, readLastTurnContext } from "../src/externalSessions/openRollout.js";
import { trustConfig } from "../src/configTrust.js";
import { createTranslator } from "../src/i18n.js";

const CODEX = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const CLAUDE = "44444444-4444-4444-8444-444444444444";
const exe = (name: string) => (process.platform === "win32" ? `${name}.exe` : name);
const turnContext = (approval: string, sandbox: string, network: boolean, timestamp?: string) =>
  JSON.stringify({ ...(timestamp ? { timestamp } : {}), type: "turn_context", payload: { model: "gpt-test", approval_policy: approval, sandbox_policy: { type: sandbox, network_access: network } } });

interface WorldOptions {
  view?: "auto" | "background";
  attachment?: "attached" | "detached" | "unknown";
  rolloutLines?: string[];
}

/** Profil jetable : config approuvée, rollout Codex, transcript Claude, registre Claude vide. */
async function world(t: TestContext, options: WorldOptions = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(os, "homedir", () => root);
  // Fichiers inertes : résolus comme exécutables natifs, jamais lancés par --check.
  for (const name of ["codex", "claude"]) await writeFile(path.join(root, exe(name)), "", { mode: 0o755 });
  const file = path.join(root, "palabre.config.json");
  await writeFile(file, JSON.stringify({
    language: "fr",
    agents: { codex: { type: "cli", command: path.join(root, exe("codex")) }, claude: { type: "cli", command: path.join(root, exe("claude")) } },
    ...(options.view ? { relay: { view: options.view } } : {})
  }));
  await trustConfig(file);
  const day = path.join(root, ".codex", "sessions", "2026", "10", "22");
  await mkdir(day, { recursive: true });
  await writeFile(path.join(day, `rollout-test-${CODEX}.jsonl`),
    [JSON.stringify({ type: "session_meta", payload: { id: CODEX, cwd: root } }), ...(options.rolloutLines ?? [])].join("\n") + "\n");
  const project = path.join(root, ".claude", "projects", "C--projet");
  await mkdir(project, { recursive: true });
  await mkdir(path.join(root, ".claude", "sessions"), { recursive: true });
  await writeFile(path.join(project, `${CLAUDE}.jsonl`), JSON.stringify({ type: "user", uuid: "u1", parentUuid: null, cwd: root, sessionId: CLAUDE, message: { content: "Bonjour" } }) + "\n");
  let probes = 0;
  t.mock.method(CodexSessionAdapter.prototype, "probe", () => {
    probes++;
    return { attachment: options.attachment ?? "detached", activity: "unknown", processes: [], evidence: [] };
  });
  return { root, file, probes: () => probes };
}

const check = (file: string, ...args: string[]) => executeRelay(["relay", "--check", "--config", file, ...args]);
const fr = createTranslator("fr");

describe("relay --check (#203)", () => {
  test("Codex ouverte en auto : checked, mode ouvert, dernières permissions indicatives, rien d'envoyé", async (t) => {
    const w = await world(t, { attachment: "attached", rolloutLines: [
      turnContext("never", "read-only", false, "2026-10-22T08:00:00Z"),
      turnContext("on-request", "workspace-write", false, "2026-10-22T09:30:00Z")
    ] });
    const result = await check(w.file, "--to", `codex:${CODEX}`);
    assert.equal(result.status, "checked");
    assert.equal(result.exitCode, 0);
    assert.equal(result.error, null);
    assert.equal(result.mode, "open");
    assert.equal(result.modeSource, "auto");
    assert.deepEqual(result.delivery, { status: "not-delivered", persisted: false, inActiveBranch: false });
    assert.deepEqual(result.check, {
      target: "open",
      lastPermissions: { approvalPolicy: "on-request", sandbox: "workspace-write", network: "restricted" },
      lastPermissionsAt: "2026-10-22T09:30:00.000Z"
    });
    for (const field of ["queue", "receiver", "targetPermissions", "correlation", "reply"]) assert.equal(field in result, false, field);
    assert.equal(result.exportPath, null);
    const text = renderRelayText(result, fr).stderr;
    assert.match(text, /Vérification seulement, rien n'a été envoyé : la conversation codex est ouverte/);
    assert.match(text, /Permissions du dernier tour connu \(2026-10-22T09:30:00\.000Z\) : approval=on-request, sandbox=workspace-write, network=restricted\. C'est une indication/);
    assert.match(text, /Mode : dans l'app desktop/);
    assert.doesNotMatch(text, /Récepteur non vérifié/);
  });

  test("Codex fermée en auto : checked, arrière-plan, conversation fermée", async (t) => {
    const w = await world(t, { attachment: "detached" });
    const result = await check(w.file, "--to", `codex:${CODEX}`);
    assert.equal(result.status, "checked");
    assert.equal(result.mode, "background");
    assert.equal(result.modeSource, "auto");
    assert.deepEqual(result.check, { target: "closed" });
    assert.match(renderRelayText(result, createTranslator("en")).stderr, /Check only, nothing was sent: the codex conversation is closed\. A send would run in background\./);
  });

  test("Claude : checked en arrière-plan, sans sonde Codex", async (t) => {
    const w = await world(t);
    const result = await check(w.file, "--to", `claude:${CLAUDE}`);
    assert.equal(result.status, "checked");
    assert.equal(result.mode, "background");
    assert.deepEqual(result.check, { target: "closed" });
    assert.equal(w.probes(), 0);
  });

  test("refus identiques à l'envoi : statut, code et check présent, rien d'envoyé", async (t) => {
    const cases: Array<[WorldOptions, string[], string, number]> = [
      [{ attachment: "attached" }, ["--background"], "target-busy", 3],
      [{ attachment: "attached", view: "background" }, [], "target-busy", 3],
      [{ attachment: "detached" }, ["--open"], "target-not-open", 3],
      [{ attachment: "unknown" }, [], "target-state-unknown", 3]
    ];
    for (const [options, extra, status, exitCode] of cases) {
      const w = await world(t, options);
      const result = await check(w.file, "--to", `codex:${CODEX}`, ...extra);
      assert.equal(result.status, status, extra.join(" "));
      assert.equal(result.exitCode, exitCode);
      assert.equal(result.delivery.status, "not-delivered");
      assert.ok(result.check, "rapport de vérification présent");
      assert.equal(result.queue, undefined);
      const text = renderRelayText(result, fr).stderr;
      assert.match(text, /Vérification seulement : rien n'a été envoyé\. Un envoi recevrait ce même refus\./);
      assert.ok(!text.includes(fr.relay.delivery("not-delivered")), "pas de consigne de renvoi : rien n'a été envoyé");
      if (options.view === "background") assert.match(result.remedy!, /config --relay-view auto/);
      if (extra.includes("--background")) assert.match(result.error!.message, /Fermez-la dans Codex, puis relancez/);
    }
  });

  test("conversation introuvable : session-not-found, code 6", async (t) => {
    const w = await world(t);
    const result = await check(w.file, "--to", "codex:0199bbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb");
    assert.equal(result.status, "session-not-found");
    assert.equal(result.exitCode, 6);
  });

  test("--open vers Claude : unsupported-agent, comme l'envoi", async (t) => {
    const w = await world(t);
    const result = await check(w.file, "--open", "--to", `claude:${CLAUDE}`);
    assert.equal(result.status, "invalid-request");
    assert.equal(result.error!.reason, "unsupported-agent");
  });

  test("ouverte sans turn_context lisible : permissions inconnues", async (t) => {
    const w = await world(t, { attachment: "attached", rolloutLines: ["{ ligne illisible", JSON.stringify({ type: "event_msg", payload: {} })] });
    const result = await check(w.file, "--to", `codex:${CODEX}`);
    assert.equal(result.status, "checked");
    assert.deepEqual(result.check, { target: "open", lastPermissions: "unknown" });
    assert.match(renderRelayText(result, fr).stderr, /Permissions du dernier tour : inconnues/);
  });

  test("options d'envoi, de suivi ou Mission refusées avant toute lecture", async (t) => {
    const w = await world(t, { attachment: "attached" });
    for (const extra of [["Bonjour"], ["--from", "claude"], ["--subject", "Objet"], ["--message-file", "m.md"], ["--follow"],
      ["--timeout", "30"], ["--no-export"], ["--new"], ["--write"], ["--task", "review"], ["--pr", "https://github.com/o/r/pull/1"]]) {
      const result = await check(w.file, "--to", `codex:${CODEX}`, ...extra);
      assert.equal(result.status, "invalid-request", extra.join(" "));
      assert.equal(result.error!.reason, "invalid-arguments");
      assert.match(result.error!.message, /--check vérifie seulement/);
    }
    const mission = await executeRelay(["relay", "--check", "--config", w.file, "--to", `codex:${CODEX}`], { header: { kind: "mission", id: CODEX, step: 1 } });
    assert.equal(mission.error!.reason, "invalid-arguments");
    assert.equal(w.probes(), 0, "aucune sonde avant le refus");
  });
});

describe("dernières permissions connues (#203)", () => {
  test("lastTurnContext : dernier relevé lisible, ligne partielle et horodatage invalide ignorés", () => {
    const text = [turnContext("never", "read-only", false), "{ cassée", turnContext("on-request", "workspace-write", true, "pas une date"), JSON.stringify({ type: "event_msg" })].join("\n");
    assert.deepEqual(lastTurnContext(text, false), { context: { model: "gpt-test", approvalPolicy: "on-request", sandbox: "workspace-write", network: "enabled" } });
    assert.equal(lastTurnContext(turnContext("never", "read-only", false), true), undefined, "seule ligne, partielle");
    assert.equal(lastTurnContext("", false), undefined);
  });

  test("readLastTurnContext : lit seulement la fin du fichier", async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "palabre-check-tail-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const padding = `${JSON.stringify({ type: "event_msg", payload: { text: "x".repeat(1000) } })}\n`.repeat(Math.ceil(LAST_CONTEXT_TAIL_BYTES / 1000) + 10);
    const early = path.join(root, "early.jsonl");
    await writeFile(early, `${turnContext("never", "read-only", false)}\n${padding}`);
    assert.equal(await readLastTurnContext(early), undefined, "relevé hors de la fin bornée");
    const late = path.join(root, "late.jsonl");
    await writeFile(late, `${padding}${turnContext("on-request", "workspace-write", false, "2026-10-22T10:00:00Z")}\n`);
    assert.deepEqual(await readLastTurnContext(late), {
      context: { model: "gpt-test", approvalPolicy: "on-request", sandbox: "workspace-write", network: "restricted" },
      observedAt: "2026-10-22T10:00:00.000Z"
    });
    assert.equal(await readLastTurnContext(path.join(root, "absent.jsonl")), undefined);
  });
});
