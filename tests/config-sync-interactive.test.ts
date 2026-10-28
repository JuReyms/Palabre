/**
 * @file Synchronisation des agents depuis l'accueil TUI et l'assistant `palabre config` : une édition
 * concurrente du fichier n'est jamais écrasée, un fichier sain reste synchronisé. Découverte simulée,
 * aucun outil réel ; profils fictifs fournis par `scripts/test.mjs`.
 */
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exampleConfig, loadConfig } from "../src/config.js";
import { syncConfigWizardAgents } from "../src/configWizard.js";
import { createTranslator } from "../src/i18n.js";
import { syncInteractiveDetectedAgents } from "../src/tuiController.js";
import type { ToolDiscovery } from "../src/discovery.js";
import type { PalabreConfig } from "../src/types.js";

const messages = createTranslator("fr");

/** Config sans Codex : une découverte qui le voit l'ajoute, donc la synchronisation veut écrire. */
function storedConfig(): PalabreConfig {
  const config = structuredClone(exampleConfig);
  delete config.agents.codex;
  return config;
}

function codexDetected(): ToolDiscovery {
  return {
    codex: { available: true, command: "codex" },
    claude: { available: false, command: "claude" },
    antigravity: { available: false, command: "agy" },
    opencode: { available: false, command: "opencode" },
    vibe: { available: false, command: "vibe" },
    ollama: { available: false, commandAvailable: false, baseUrl: "http://localhost:11434", models: [] }
  };
}

async function setup(t: TestContext, config: PalabreConfig = storedConfig()): Promise<{ file: string; original: string; editedText: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-sync-interactive-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "palabre.config.json");
  const original = JSON.stringify(config, null, 2);
  await writeFile(file, original);
  const edited = structuredClone(config);
  edited.language = "en";
  return { file, original, editedText: JSON.stringify(edited, null, 2) };
}

/** Capture stdout/stderr du wizard et rétablit le code de sortie positionné par un conflit. */
function captureConsole(t: TestContext): { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  t.mock.method(console, "log", (line: string) => { out.push(line); });
  t.mock.method(console, "error", (line: string) => { err.push(line); });
  const previousExitCode = process.exitCode;
  t.after(() => { process.exitCode = previousExitCode; });
  return { out, err };
}

test("accueil TUI : une édition pendant la découverte n'est pas écrasée et la session continue", async (t) => {
  const { file, editedText } = await setup(t);
  const config = await loadConfig(file);

  const result = await syncInteractiveDetectedAgents(file, config, async () => {
    await writeFile(file, editedText);
    return codexDetected();
  });

  assert.equal(result.conflict, true);
  assert.equal(result.discovery.codex.available, true, "découverte conservée pour l'accueil");
  assert.equal(await readFile(file, "utf8"), editedText, "édition humaine conservée");
  assert.equal(config.language, "fr", "la session garde la configuration chargée");
});

test("accueil TUI : une édition entre le chargement et la synchronisation n'est pas écrasée", async (t) => {
  const { file, editedText } = await setup(t);
  const config = await loadConfig(file);
  await writeFile(file, editedText);

  const result = await syncInteractiveDetectedAgents(file, config, async () => codexDetected());

  assert.equal(result.conflict, true);
  assert.deepEqual(result.addedAgents, []);
  assert.equal(await readFile(file, "utf8"), editedText);
});

test("accueil TUI : un fichier sain est toujours synchronisé", async (t) => {
  const { file } = await setup(t);
  const config = await loadConfig(file);

  const result = await syncInteractiveDetectedAgents(file, config, async () => codexDetected());

  assert.equal(result.conflict, undefined);
  assert.deepEqual(result.addedAgents, ["codex"]);
  assert.ok((await loadConfig(file)).agents.codex, "Codex écrit dans le fichier");
});

test("accueil TUI : un ancien défaut d'arguments seul ne déclenche pas d'écriture automatique", async (t) => {
  const config = structuredClone(exampleConfig);
  if (config.agents.opencode?.type === "cli") config.agents.opencode.args = ["run", "--pure"];
  const { file, original } = await setup(t, config);
  const discovery = codexDetected();
  discovery.codex = { available: false, command: "codex" };

  const result = await syncInteractiveDetectedAgents(file, await loadConfig(file), async () => discovery);

  assert.equal(result.conflict, undefined);
  assert.equal(await readFile(file, "utf8"), original);
});

test("assistant config : une édition pendant la découverte n'est pas écrasée", async (t) => {
  const { file, editedText } = await setup(t);
  const { out, err } = captureConsole(t);

  await syncConfigWizardAgents(file, await loadConfig(file), messages, async () => {
    await writeFile(file, editedText);
    return codexDetected();
  });

  assert.equal(await readFile(file, "utf8"), editedText);
  assert.deepEqual(err, [messages.config.syncConflict(file)]);
  assert.deepEqual(out, []);
  assert.equal(process.exitCode, 1);
});

test("assistant config : une édition entre le chargement et la synchronisation n'est pas écrasée", async (t) => {
  const { file, editedText } = await setup(t);
  const { err } = captureConsole(t);
  const config = await loadConfig(file);
  await writeFile(file, editedText);
  let discovered = false;

  await syncConfigWizardAgents(file, config, messages, async () => { discovered = true; return codexDetected(); });

  assert.equal(discovered, false, "refus avant toute découverte");
  assert.equal(await readFile(file, "utf8"), editedText);
  assert.deepEqual(err, [messages.config.syncConflict(file)]);
  assert.equal(process.exitCode, 1);
});

test("assistant config : un fichier sain est toujours synchronisé", async (t) => {
  const { file } = await setup(t);
  const { out, err } = captureConsole(t);

  await syncConfigWizardAgents(file, await loadConfig(file), messages, async () => codexDetected());

  assert.deepEqual(err, []);
  assert.deepEqual(out, [messages.config.syncAdded(file, "codex")]);
  assert.ok((await loadConfig(file)).agents.codex);
  assert.notEqual(process.exitCode, 1);
});
