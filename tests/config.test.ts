import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertRunnableConfig, DEFAULT_OUTPUT_DIR, createConfigFromDiscovery, exampleConfig, legacyArgsInConfigFile, loadConfig, persistAgentSync, resolveOutputDir, setOllamaBaseUrl, setOllamaModel, syncDetectedAgents, syncDetectedAgentsDetailed, syncOllamaModel } from "../src/config.js";
import { createTranslator } from "../src/i18n.js";
import type { ToolDiscovery } from "../src/discovery.js";

test("resolveOutputDir groups default and legacy root exports in .palabre", () => {
  assert.equal(DEFAULT_OUTPUT_DIR, ".palabre");
  assert.equal(resolveOutputDir(undefined), ".palabre");
  assert.equal(resolveOutputDir(""), ".palabre");
  assert.equal(resolveOutputDir("."), ".palabre");
});

test("resolveOutputDir preserves explicit custom output folders", () => {
  assert.equal(resolveOutputDir("debates"), "debates");
  assert.equal(resolveOutputDir("exports/palabre"), "exports/palabre");
});

test("exampleConfig declares the default interface language", () => {
  assert.equal(exampleConfig.language, "fr");
  assert.equal(exampleConfig.defaults?.interface, "tui");
});

test("loadConfig migrates legacy Codex stdin dash arg in memory", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-config-"));
  const configPath = path.join(dir, "palabre.config.json");

  try {
    await writeFile(configPath, JSON.stringify({
      agents: {
        codex: {
          type: "cli",
          command: "codex",
          args: ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"],
          promptMode: "stdin",
          shell: true,
          role: "implementer"
        }
      }
    }), "utf8");

    const config = await loadConfig(configPath);

    assert.deepEqual(
      config.agents.codex?.type === "cli" ? config.agents.codex.args : undefined,
      ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"]
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("createConfigFromDiscovery clears default agents when no pair is detected", () => {
  const config = createConfigFromDiscovery(noDetectedTools());

  assert.equal(config.defaults?.agentA, undefined);
  assert.equal(config.defaults?.agentB, undefined);
  assert.equal(config.defaults?.summaryAgent, undefined);
  assert.equal(config.defaults?.askSummaryAgent, undefined);
  assert.equal(config.defaults?.turns, 4);
  assert.equal(config.defaults?.interface, "tui");
});

test("createConfigFromDiscovery applies the detected Antigravity command alias", () => {
  const discovery = noDetectedTools();
  discovery.codex = { available: true, command: "codex" };
  discovery.antigravity = { available: true, command: "antigravity", path: "C:/bin/antigravity.cmd" };

  const config = createConfigFromDiscovery(discovery);
  const antigravity = config.agents.antigravity;

  assert.equal(antigravity?.type, "cli-pty");
  assert.equal(antigravity?.command, "antigravity");
});

test("syncDetectedAgents refreshes commands for already configured known agents", () => {
  const discovery = noDetectedTools();
  discovery.claude = { available: true, command: "claude", path: "C:/bin/claude.cmd" };
  discovery.antigravity = { available: true, command: "agy", path: "C:/bin/agy.exe" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const claude = config.agents.claude;

  assert.equal(claude?.type, "cli");
  if (claude?.type === "cli") {
    claude.command = "claude.exe";
  }
  delete config.agents.antigravity;

  const added = syncDetectedAgents(config, discovery);

  assert.deepEqual(added, ["antigravity"]);
  assert.equal(config.agents.claude?.type === "cli" ? config.agents.claude.command : undefined, "claude");
  assert.equal(config.agents.antigravity?.type, "cli-pty");
});

test("sync-agents et accueil TUI préservent le chemin choisi, sans annoncer de faux rafraîchissement", () => {
  const discovery = noDetectedTools();
  discovery.claude = { available: true, command: "claude.exe", path: "C:/Old/claude.exe" };
  const config = structuredClone(exampleConfig);
  const cli = config.agents.claude;
  if (cli.type !== "cli") throw Error("CLI required");
  cli.command = "C:/Chosen/claude.exe";
  const beforeArgs = structuredClone(cli.args);
  const result = syncDetectedAgentsDetailed(config, discovery);
  assert.equal(cli.command, "C:/Chosen/claude.exe");
  assert.deepEqual(cli.args, beforeArgs);
  assert.equal(result.changed, false);
});

test("syncDetectedAgentsDetailed reports command refreshes without new agents", () => {
  const discovery = noDetectedTools();
  discovery.claude = { available: true, command: "claude", path: "C:/bin/claude.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const claude = config.agents.claude;

  assert.equal(claude?.type, "cli");
  if (claude?.type === "cli") {
    claude.command = "claude.exe";
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.deepEqual(result.addedAgents, []);
  assert.equal(result.changed, true);
  assert.equal(config.agents.claude?.type === "cli" ? config.agents.claude.command : undefined, "claude");
});

test("syncDetectedAgentsDetailed leaves custom CLI agents untouched", () => {
  const discovery = noDetectedTools();
  discovery.codex = { available: true, command: "codex", path: "C:/bin/codex.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const codex = config.agents.codex;
  assert.equal(codex?.type, "cli");
  if (codex?.type === "cli") {
    codex.command = "old-codex";
  }
  config.agents.custom = {
    type: "cli",
    command: "my-custom-agent",
    role: "reviewer"
  };

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, true);
  assert.deepEqual(result.addedAgents, []);
  assert.equal(config.agents.custom?.type === "cli" ? config.agents.custom.command : undefined, "my-custom-agent");
  assert.equal(config.agents.codex?.type === "cli" ? config.agents.codex.command : undefined, "codex");
});

test("syncDetectedAgentsDetailed migrates legacy Codex stdin dash arg", () => {
  const discovery = noDetectedTools();
  discovery.codex = { available: true, command: "codex", path: "C:/Users/jurey/AppData/Roaming/npm/codex.ps1" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const codex = config.agents.codex;

  assert.equal(codex?.type, "cli");
  if (codex?.type === "cli") {
    codex.args = ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"];
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, true);
  assert.deepEqual(
    config.agents.codex?.type === "cli" ? config.agents.codex.args : undefined,
    ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"]
  );
});
test("syncDetectedAgentsDetailed migrates legacy Vibe plan args", () => {
  const discovery = noDetectedTools();
  discovery.vibe = { available: true, command: "vibe", path: "C:/bin/vibe.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const vibe = config.agents.vibe;

  assert.equal(vibe?.type, "cli");
  if (vibe?.type === "cli") {
    vibe.args = ["--output", "text", "--agent", "plan", "--trust", "--prompt"];
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, true);
  assert.deepEqual(
    config.agents.vibe?.type === "cli" ? config.agents.vibe.args : undefined,
    ["--output", "text", "--trust", "--enabled-tools", "read", "--enabled-tools", "grep", "--prompt"]
  );
});

test("syncDetectedAgentsDetailed hardens unchanged Claude defaults and keeps OpenCode run", () => {
  const discovery = noDetectedTools();
  discovery.claude = { available: true, command: "claude", path: "C:/bin/claude.exe" };
  discovery.opencode = { available: true, command: "opencode", path: "C:/bin/opencode.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const claude = config.agents.claude;
  const opencode = config.agents.opencode;
  if (claude?.type === "cli") {
    claude.args = ["--print", "--output-format", "text", "--no-session-persistence"];
  }
  if (opencode?.type === "cli") {
    opencode.args = ["run"];
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, true);
  assert.deepEqual(
    config.agents.claude?.type === "cli" ? config.agents.claude.args : undefined,
    ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"]
  );
  // OpenCode 2 n'a plus `--pure` : `run` seul est le défaut actuel, plus jamais « durci ».
  assert.deepEqual(
    config.agents.opencode?.type === "cli" ? config.agents.opencode.args : undefined,
    ["run"]
  );
});

test("syncDetectedAgentsDetailed migre seulement l'ancien défaut OpenCode exact", () => {
  const discovery = noDetectedTools();
  discovery.opencode = { available: true, command: "opencode", path: "C:/bin/opencode.cmd" };

  const exact = createConfigFromDiscovery(noDetectedTools());
  if (exact.agents.opencode?.type === "cli") exact.agents.opencode.args = ["run", "--pure"];
  assert.equal(syncDetectedAgentsDetailed(exact, discovery).changed, true);
  assert.deepEqual(exact.agents.opencode?.type === "cli" ? exact.agents.opencode.args : undefined, ["run"]);

  for (const custom of [["run", "--pure", "--agent", "plan"], ["--pure", "run"], ["run", "--model", "x", "--pure"]]) {
    const config = createConfigFromDiscovery(noDetectedTools());
    if (config.agents.opencode?.type === "cli") config.agents.opencode.args = [...custom];
    syncDetectedAgentsDetailed(config, discovery);
    assert.deepEqual(config.agents.opencode?.type === "cli" ? config.agents.opencode.args : undefined, custom, JSON.stringify(custom));
  }
});

test("sync-agents écrit la migration exacte d'OpenCode même déjà appliquée en mémoire", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-sync-opencode-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "palabre.config.json");
  const stored = structuredClone(exampleConfig);
  if (stored.agents.opencode?.type === "cli") stored.agents.opencode.args = ["run", "--pure"];
  if (stored.agents.claude?.type === "cli") stored.agents.claude.args = ["--print", "--pure", "--custom"];
  await writeFile(file, JSON.stringify(stored, null, 2));
  assert.deepEqual(await legacyArgsInConfigFile(file), ["opencode"]);

  const loaded = await loadConfig(file);
  assert.deepEqual(loaded.agents.opencode?.type === "cli" ? loaded.agents.opencode.args : undefined, ["run"], "migré en mémoire au chargement");
  const result = await persistAgentSync(file, loaded, async () => noDetectedTools());
  assert.equal(result.changed, true, "fichier encore ancien : la synchronisation doit l'écrire");
  assert.equal(result.conflict, undefined);

  const written = JSON.parse(await readFile(file, "utf8")) as typeof stored;
  assert.deepEqual(written.agents.opencode?.type === "cli" ? written.agents.opencode.args : undefined, ["run"]);
  assert.deepEqual(written.agents.claude?.type === "cli" ? written.agents.claude.args : undefined, ["--print", "--pure", "--custom"], "arguments personnalisés intacts");
  assert.deepEqual(await legacyArgsInConfigFile(file), []);
  assert.equal((await persistAgentSync(file, await loadConfig(file), async () => noDetectedTools())).changed, false, "seconde synchronisation sans écriture");
});

test("sync-agents refuse d'écrire après une édition faite depuis le chargement ou pendant la découverte", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-sync-race-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "palabre.config.json");
  const stored = structuredClone(exampleConfig);
  if (stored.agents.opencode?.type === "cli") { stored.agents.opencode.args = ["run", "--pure"]; stored.agents.opencode.model = "avant-edition"; }
  await writeFile(file, JSON.stringify(stored, null, 2));
  const edited = structuredClone(stored);
  if (edited.agents.opencode?.type === "cli") edited.agents.opencode.model = "edition-humaine";
  const editedText = JSON.stringify(edited, null, 2);

  // Édition pendant la découverte des outils, après le premier contrôle.
  const duringDiscovery = await persistAgentSync(file, await loadConfig(file), async () => {
    await writeFile(file, editedText);
    return noDetectedTools();
  });
  assert.deepEqual(duringDiscovery, { addedAgents: [], changed: false, conflict: true });
  assert.equal(await readFile(file, "utf8"), editedText, "édition humaine conservée");

  // Édition entre le chargement et la synchronisation.
  await writeFile(file, JSON.stringify(stored, null, 2));
  const loaded = await loadConfig(file);
  await writeFile(file, editedText);
  let discovered = false;
  const afterLoad = await persistAgentSync(file, loaded, async () => { discovered = true; return noDetectedTools(); });
  assert.equal(afterLoad.conflict, true);
  assert.equal(discovered, false, "refus avant toute découverte");
  assert.equal(await readFile(file, "utf8"), editedText);
});

test("exampleConfig : OpenCode lancé avec run seul, sans --pure", () => {
  const opencode = createConfigFromDiscovery(noDetectedTools()).agents.opencode;
  assert.deepEqual(opencode?.type === "cli" ? opencode.args : undefined, ["run"]);
});

test("syncDetectedAgentsDetailed preserves custom Claude and OpenCode args", () => {
  const discovery = noDetectedTools();
  const config = createConfigFromDiscovery(noDetectedTools());
  const claude = config.agents.claude;
  const opencode = config.agents.opencode;
  if (claude?.type === "cli") {
    claude.args = ["--print", "--permission-mode", "default"];
  }
  if (opencode?.type === "cli") {
    opencode.args = ["run", "--agent", "custom"];
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, false);
  assert.deepEqual(
    config.agents.claude?.type === "cli" ? config.agents.claude.args : undefined,
    ["--print", "--permission-mode", "default"]
  );
  assert.deepEqual(
    config.agents.opencode?.type === "cli" ? config.agents.opencode.args : undefined,
    ["run", "--agent", "custom"]
  );
});

test("syncDetectedAgentsDetailed preserves custom Vibe args", () => {
  const discovery = noDetectedTools();
  discovery.vibe = { available: true, command: "vibe", path: "C:/bin/vibe.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const vibe = config.agents.vibe;

  assert.equal(vibe?.type, "cli");
  if (vibe?.type === "cli") {
    vibe.args = ["--output", "json", "--trust", "--prompt"];
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, false);
  assert.deepEqual(
    config.agents.vibe?.type === "cli" ? config.agents.vibe.args : undefined,
    ["--output", "json", "--trust", "--prompt"]
  );
});

test("syncOllamaModel updates a missing configured model to an installed model", () => {
  const config = createConfigFromDiscovery(noDetectedTools());
  const agent = config.agents["ollama-local"];
  assert.equal(agent?.type, "ollama");
  if (agent?.type !== "ollama") return;
  agent.model = "missing-model:latest";

  const discovery = noDetectedTools();
  discovery.ollama = {
    available: true,
    commandAvailable: true,
    baseUrl: "http://localhost:11434",
    models: ["gemma3:4b", "gemma3:12b"]
  };

  const result = syncOllamaModel(config, discovery);

  assert.deepEqual(result, {
    previousModel: "missing-model:latest",
    nextModel: "gemma3:4b"
  });
  assert.equal(agent.model, "gemma3:4b");
});

test("setOllamaModel updates the configured Ollama model", () => {
  const config = createConfigFromDiscovery(noDetectedTools());
  const result = setOllamaModel(config, "gemma3:12b");

  assert.equal(config.agents["ollama-local"]?.type, "ollama");
  assert.equal(
    config.agents["ollama-local"]?.type === "ollama"
      ? config.agents["ollama-local"].model
      : undefined,
    "gemma3:12b"
  );
  assert.equal(result?.nextModel, "gemma3:12b");
});

test("setOllamaBaseUrl updates every configured Ollama agent", () => {
  const config = createConfigFromDiscovery(noDetectedTools());
  config.agents["ollama-reviewer"] = {
    type: "ollama",
    baseUrl: "http://old-reviewer:11434",
    model: "test-model",
    role: "reviewer"
  };

  const count = setOllamaBaseUrl(config, "http://gpu-box:11434");

  assert.equal(count, 2);
  assert.equal(
    config.agents["ollama-local"]?.type === "ollama" ? config.agents["ollama-local"].baseUrl : undefined,
    "http://gpu-box:11434"
  );
  assert.equal(
    config.agents["ollama-reviewer"]?.type === "ollama" ? config.agents["ollama-reviewer"].baseUrl : undefined,
    "http://gpu-box:11434"
  );
});

test("assertRunnableConfig rejects configs without a usable agents block", () => {
  const messages = createTranslator("en");

  assert.throws(
    () => assertRunnableConfig(null as never, messages, "broken.json"),
    /does not contain a JSON object/
  );
  assert.throws(
    () => assertRunnableConfig({} as never, messages, "broken.json"),
    /has no "agents" block/
  );
  assert.throws(
    () => assertRunnableConfig({ agents: {} } as never, messages, "broken.json"),
    /declares no agent/
  );
});

function noDetectedTools(): ToolDiscovery {
  return {
    codex: { available: false, command: "codex" },
    claude: { available: false, command: "claude" },
    antigravity: { available: false, command: "agy" },
    opencode: { available: false, command: "opencode" },
    vibe: { available: false, command: "vibe" },
    ollama: {
      available: false,
      commandAvailable: false,
      baseUrl: "http://localhost:11434",
      models: []
    }
  };
}
