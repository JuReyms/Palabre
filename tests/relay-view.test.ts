/** @file Préférence Relay : matrice pure et confirmation sur profils exclusivement fictifs. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { resolveRelayView, shouldProbeRelayView } from "../src/externalSessions/relayView.js";
import { validateRelayPolicy, reviewAllowed } from "../src/externalSessions/review.js";
import { runRelayViewCommand } from "../src/commands/relayView.js";
import { runRelayAllowRepo, type AllowRepoIo } from "../src/commands/relayAllowRepo.js";
import { isConfigTrusted, trustConfig } from "../src/configTrust.js";

test("auto : seul un verrou tenu autorise open ; inconnu refuse tout transport", () => {
  for (const attachment of ["attached", "detached", "unknown"] as const) {
    const result = resolveRelayView({ open: false, background: false, provider: "codex", excluded: false, view: "auto" }, () => ({ attachment, activity: "unknown", processes: [], evidence: [] }));
    assert.deepEqual(result, { mode: attachment === "attached" ? "open" : "background", modeSource: "auto", ...(attachment === "unknown" ? { refusal: "target-state-unknown" } : {}) });
  }
});

test("sans préférence : arrière-plan sans sonde de sélection ni ouverture implicite", () => {
  assert.deepEqual(resolveRelayView({ open: false, background: false, provider: "codex", excluded: false },
    () => { throw Error("must not probe for open"); }), { mode: "background", modeSource: "default" });
});

test("préparation : sonde seulement pour auto enregistré, sans option ni exclusion", () => {
  const base = { open: false, background: false, provider: "codex" as const, excluded: false };
  assert.equal(shouldProbeRelayView(base), false);
  assert.equal(shouldProbeRelayView({ ...base, view: "background" }), false);
  assert.equal(shouldProbeRelayView({ ...base, view: "auto" }), true);
  assert.equal(shouldProbeRelayView({ ...base, view: "auto", open: true }), false);
  assert.equal(shouldProbeRelayView({ ...base, view: "auto", background: true }), false);
  assert.equal(shouldProbeRelayView({ ...base, view: "auto", excluded: true }), false);
  assert.equal(shouldProbeRelayView({ ...base, view: "auto", provider: "claude" }), false);
});

test("priorités : explicite, exclusions, préférence ; aucune sonde hors auto ordinaire", () => {
  const noProbe = (): never => { throw Error("must not probe"); };
  const base = { open: false, background: false, provider: "codex" as const, excluded: false, view: "auto" as const };
  assert.deepEqual(resolveRelayView({ ...base, open: true, view: "background" }, noProbe), { mode: "open", modeSource: "explicit" });
  assert.deepEqual(resolveRelayView({ ...base, background: true }, noProbe), { mode: "background", modeSource: "explicit" });
  assert.deepEqual(resolveRelayView({ ...base, view: "background" }, noProbe), { mode: "background", modeSource: "setting" });
  assert.deepEqual(resolveRelayView({ ...base, excluded: true, view: "background" }, noProbe), { mode: "background", modeSource: "auto" });
  assert.deepEqual(resolveRelayView({ ...base, provider: "claude" }, noProbe), { mode: "background", modeSource: "auto" });
});

test("view seul est valide sans accorder review ; anciennes politiques conservées", () => {
  assert.deepEqual(validateRelayPolicy({ view: "auto" }), { view: "auto", allowedTasks: [], reviewRepositories: [] });
  assert.deepEqual(validateRelayPolicy({ allowedTasks: [], reviewRepositories: [] }), { allowedTasks: [], reviewRepositories: [] });
  assert.equal(reviewAllowed(validateRelayPolicy({ view: "background" }), { repository: "owner/repo", number: 1, url: "x" }), false);
  for (const value of ["open", "", false, null, 1]) assert.throws(() => validateRelayPolicy({ view: value }));
  for (const value of [{ view: "auto", allowedTasks: ["review"] }, { view: "auto", extra: true }, { view: "auto", allowedTasks: ["review"], reviewRepositories: [] }]) assert.throws(() => validateRelayPolicy(value));
});

const root = await mkdtemp(path.join(os.tmpdir(), "palabre-relay-view-"));
after(() => rm(root, { recursive: true, force: true }));
let sequence = 0;
async function world(relay?: unknown) {
  const file = path.join(root, `config-${++sequence}.json`), trust = file + ".trust.json";
  const config = { language: "fr", agents: { codex: { type: "cli", command: "codex", args: ["custom"] } }, custom: { preserve: [1] }, ...(relay !== undefined ? { relay } : {}) };
  const before = JSON.stringify(config);
  await writeFile(file, before); await trustConfig(file, trust);
  let confirmations = 0;
  const lines: string[] = [];
  const io: AllowRepoIo = { interactive: true, print: line => lines.push(line), confirm: async () => { confirmations++; return true; },
    isTrusted: f => isConfigTrusted(f, trust), trust: (f, hash) => trustConfig(f, trust, hash) };
  return { file, trust, before, config, io, lines, confirmations: () => confirmations };
}

test("confirmation : view seul, champs bruts conservés, fichier approuvé exactement", async () => {
  const w = await world();
  await runRelayViewCommand(["--relay-view", "background", "--config", w.file], w.io);
  assert.deepEqual(JSON.parse(await readFile(w.file, "utf8")), { ...w.config, relay: { view: "background" } });
  assert.equal(w.confirmations(), 1); assert.equal(await isConfigTrusted(w.file, w.trust), true);
  assert.ok(w.lines.some(x => x.includes(w.file) && x.includes("Arrière-plan (défaut) -> Arrière-plan (enregistré)")));
  assert.ok(w.lines.some(x => x.includes("contenu entier")));
});

test("view et allow-repo se préservent mutuellement sans migrer les agents", async () => {
  const w = await world({ allowedTasks: ["review"], reviewRepositories: ["owner/repo"], view: "background" });
  await runRelayAllowRepo(["owner/other", "--config", w.file], w.io);
  assert.equal(JSON.parse(await readFile(w.file, "utf8")).relay.view, "background");
  await runRelayViewCommand(["--relay-view", "auto", "--config", w.file], w.io);
  assert.ok(w.lines.some(x => x.includes("Arrière-plan (enregistré) -> Privilégier la conversation ouverte (enregistré)")));
  assert.ok(w.lines.some(x => x.includes("y compris l'écriture") && x.includes("si elle est fermée")));
  const result = JSON.parse(await readFile(w.file, "utf8"));
  assert.deepEqual(result.relay, { allowedTasks: ["review"], reviewRepositories: ["owner/repo", "owner/other"], view: "auto" });
  assert.deepEqual(result.agents, w.config.agents);
});

test("sans préférence vers auto : défaut et choix enregistré expliqués avant toute écriture, FR/EN", async () => {
  for (const language of ["fr", "en"] as const) for (const relay of [undefined, { allowedTasks: [], reviewRepositories: [] }]) {
    const w = await world(relay);
    w.io.confirm = async () => {
      assert.equal(await readFile(w.file, "utf8"), w.before);
      const plan = w.lines.join("\n");
      assert.match(plan, language === "fr"
        ? /Arrière-plan \(défaut\) -> Privilégier la conversation ouverte \(enregistré\)/
        : /Background \(default\) -> Prefer the open conversation \(saved\)/);
      assert.match(plan, language === "fr" ? /écriture.*autorisée/ : /writing.*allowed/);
      assert.match(plan, language === "fr" ? /si elle est fermée.*arrière-plan/ : /when closed.*background/);
      return true;
    };
    await runRelayViewCommand(["--relay-view", "auto", "--config", w.file, "--language", language], w.io);
    assert.deepEqual(JSON.parse(await readFile(w.file, "utf8")), { ...w.config, relay: { ...relay, view: "auto" } });
    assert.equal(await isConfigTrusted(w.file, w.trust), true);
  }
});

test("sans TTY, refus ou interruption : ni fichier ni registre modifiés", async () => {
  for (const mode of ["tty", "decline", "interrupt"]) {
    const w = await world(), trustBefore = await readFile(w.trust, "utf8");
    if (mode === "tty") w.io.interactive = false;
    else w.io.confirm = async () => { if (mode === "interrupt") throw Error("interrupted"); return false; };
    await assert.rejects(runRelayViewCommand(["--relay-view", "background", "--config", w.file], w.io));
    assert.equal(await readFile(w.file, "utf8"), w.before); assert.equal(await readFile(w.trust, "utf8"), trustBefore);
  }
});

test("arguments stricts : pas d'option de contournement ni de mutation combinée", async () => {
  for (const extra of [["--yes"], ["--trust-config"], ["--json"], ["--sync-agents"], ["--prune-trust"], ["--relay-view", "auto"], ["extra"], ["--config"]]) {
    const w = await world();
    await assert.rejects(runRelayViewCommand(["--relay-view", "background", "--config", w.file, ...extra], w.io));
    assert.equal(w.confirmations(), 0); assert.equal(await readFile(w.file, "utf8"), w.before);
  }
});

test("absence, JSON/politique invalides ou config non approuvée : aucun accord implicite", async () => {
  for (const body of ["{", "null", "[]", JSON.stringify({ agents: {}, relay: { view: "invalid" } }), JSON.stringify({ agents: {}, modified: true })]) {
    const w = await world(); await writeFile(w.file, body);
    const trustBefore = await readFile(w.trust, "utf8");
    await assert.rejects(runRelayViewCommand(["--relay-view", "auto", "--config", w.file], w.io));
    assert.equal(w.confirmations(), 0); assert.equal(await readFile(w.file, "utf8"), body);
    assert.equal(await readFile(w.trust, "utf8"), trustBefore);
  }
  const w = await world();
  await assert.rejects(runRelayViewCommand(["--relay-view", "auto", "--config", w.file + ".absent"], w.io));
  assert.equal(w.confirmations(), 0);
});

test("édition ou retrait de confiance pendant l'accord : refus sans écraser", async () => {
  for (const change of ["file", "trust"]) {
    const w = await world();
    w.io.confirm = async () => { if (change === "file") await writeFile(w.file, "changed"); else w.io.isTrusted = async () => false; return true; };
    await assert.rejects(runRelayViewCommand(["--relay-view", "background", "--config", w.file], w.io), /modifiée pendant/);
    assert.equal(await readFile(w.file, "utf8"), change === "file" ? "changed" : w.before);
  }
});

test("écriture étrangère avant l'approbation : jamais approuvée ; erreur claire", async () => {
  const w = await world();
  w.io.trust = async (file, hash) => { await writeFile(file, "{}"); await trustConfig(file, w.trust, hash); };
  await assert.rejects(runRelayViewCommand(["--relay-view", "background", "--config", w.file], w.io), /incomplète/);
  assert.equal(await isConfigTrusted(w.file, w.trust), false);
});
