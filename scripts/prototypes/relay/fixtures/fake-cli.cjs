#!/usr/bin/env node
/**
 * @file CLI simulée pour les tests du point d'entrée `probe.ts` (prototype relay, issue #96).
 *
 * Usage : node fake-cli.cjs <claude|codex> <arguments de la vraie CLI…>
 *
 * Variables :
 *   FAKE_MODE   comportement simulé (voir `MODES`) ;
 *   FAKE_MARKER fichier où chaque invocation ajoute une ligne JSON { argv, cwd, stdin } ;
 *   FAKE_MCP    sortie brute de `codex mcp list --json` (défaut `[]`, peut être invalide) ;
 *   FAKE_MCP_EXIT code de sortie non nul simulé pour `codex mcp list` ;
 *   PROBE_CLAUDE_HOME racine où le mode `persisted` écrit un transcript contenant le message reçu.
 *
 * Aucun réseau, aucune écriture hors des chemins fournis par le test.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const [agent, ...argv] = process.argv.slice(2);
const mode = process.env.FAKE_MODE || "ok";
const OTHER = "99999999-9999-4999-8999-999999999999";

function mark(stdin) {
  if (process.env.FAKE_MARKER) {
    fs.appendFileSync(process.env.FAKE_MARKER, JSON.stringify({ agent, argv, cwd: process.cwd(), stdin }) + "\n");
  }
}
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");
const after = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; };

function claude(stdin) {
  const target = after("--resume") ?? OTHER;
  const init = (id) => emit({ type: "system", subtype: "init", session_id: id, model: "claude-haiku-4-5-20251001" });
  const answer = (id) => {
    init(id);
    emit({ type: "assistant", session_id: id, message: { model: "claude-sonnet-4-6", content: [{ type: "text", text: "FAKE-OK" }] } });
    emit({ type: "result", subtype: "success", is_error: false, session_id: id, result: "FAKE-OK", modelUsage: { "claude-sonnet-4-6": {} } });
  };
  switch (mode) {
    case "ok": answer(target); return 0;
    case "mismatch": answer(OTHER); return 0;
    case "not-found":
      emit({ type: "result", subtype: "error_during_execution", is_error: true, session_id: OTHER, errors: [`No conversation found with session ID: ${target}`] });
      return 1;
    case "fail": process.stderr.write("boom\n"); return 1;
    case "no-result": init(target); return 0;
    case "persisted": {
      const dir = path.join(process.env.PROBE_CLAUDE_HOME, "projects", "fake");
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, `${target}.jsonl`), JSON.stringify({ uuid: "u1", parentUuid: null, type: "user", message: { content: stdin } }) + "\n");
      init(target);
      process.stderr.write("interrompu après persistance\n");
      return 1;
    }
    case "hang": init(target); return null;
    default: throw new Error(`mode inconnu ${mode}`);
  }
}

function codex(stdin) {
  if (argv[0] === "mcp" && argv[1] === "list") {
    if (process.env.FAKE_MCP_EXIT) {
      process.stderr.write("Error loading config.toml: simulated\n");
      return Number(process.env.FAKE_MCP_EXIT);
    }
    process.stdout.write(process.env.FAKE_MCP ?? "[]");
    return 0;
  }
  const dash = argv.lastIndexOf("-");
  const target = dash > 0 ? argv[dash - 1] : OTHER;
  const started = (id) => { emit({ type: "thread.started", thread_id: id }); emit({ type: "turn.started" }); };
  switch (mode) {
    case "ok":
      started(target);
      emit({ type: "item.completed", item: { type: "agent_message", text: "FAKE-OK" } });
      emit({ type: "turn.completed", usage: {} });
      return 0;
    case "mismatch":
      started(OTHER);
      emit({ type: "item.completed", item: { type: "agent_message", text: "FAKE-OK" } });
      emit({ type: "turn.completed", usage: {} });
      return 0;
    case "active-writer":
      process.stderr.write(`Error: thread/resume: thread/resume failed: thread ${target} already has an active writer (code -32600)\n`);
      return 1;
    case "not-found":
      process.stderr.write(`Error: thread/resume: thread/resume failed: no rollout found for thread id ${target} (code -32600)\n`);
      return 1;
    case "turn-failed":
      started(target);
      emit({ type: "error", message: "400" });
      emit({ type: "turn.failed", error: { message: "400" } });
      return 1;
    case "no-message":
      started(target);
      emit({ type: "turn.completed", usage: {} });
      return 0;
    case "hang": started(target); return null;
    default: throw new Error(`mode inconnu ${mode}`);
  }
}

let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { stdin += chunk; });
process.stdin.on("end", () => {
  mark(stdin);
  const code = agent === "claude" ? claude(stdin) : codex(stdin);
  if (code === null) setTimeout(() => process.exit(0), 60_000);
  else process.exitCode = code;
});
