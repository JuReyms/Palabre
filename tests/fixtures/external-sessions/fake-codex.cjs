#!/usr/bin/env node
/**
 * @file CLI Codex simulée pour les tests de l'adapter de session externe.
 *
 * Variables :
 *   FAKE_CODEX_MODE      comportement de `exec resume` : ok, mismatch, active-writer, not-found,
 *                        turn-failed, no-message, blank, two-completed, usage-limit, hang ;
 *   FAKE_CODEX_MCP       sortie brute de `codex mcp list --json` (défaut `[]`, peut être invalide) ;
 *   FAKE_CODEX_MCP_EXIT  code de sortie non nul simulé pour `codex mcp list` ;
 *   FAKE_CODEX_ROLLOUT   rollout de la cible, où le message reçu est ajouté (modes qui jouent un tour) ;
 *   FAKE_CODEX_MARKER    fichier où chaque invocation ajoute une ligne JSON { argv, cwd, stdin, envKeys }.
 *   FAKE_CODEX_QUEUE     comportement de `queue` (relay --open) : reply (accusé, puis tour complet
 *                        ajouté au rollout, comme le ferait le récepteur), ack-only, no-ack,
 *                        foreign-ack, unsupported (refus de l'analyseur d'arguments), fail.
 *
 * Aucun réseau ; aucune écriture hors des chemins fournis.
 */
"use strict";
const fs = require("node:fs");

const argv = process.argv.slice(2);
const mode = process.env.FAKE_CODEX_MODE || "ok";
const OTHER = "99999999-9999-4999-8999-999999999999";
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");

/** Ajoute au rollout le message utilisateur, comme le fait Codex au début d'un tour. */
function recordUserMessage(text) {
  const entry = { timestamp: new Date().toISOString(), type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } };
  fs.appendFileSync(process.env.FAKE_CODEX_ROLLOUT, JSON.stringify(entry) + "\n");
}

function turn(threadId, stdin, messages) {
  recordUserMessage(stdin);
  emit({ type: "thread.started", thread_id: threadId });
  emit({ type: "turn.started" });
  for (const text of messages) emit({ type: "item.completed", item: { id: "item", type: "agent_message", text } });
}

let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { stdin += chunk; });
process.stdin.on("end", () => {
  if (process.env.FAKE_CODEX_MARKER) {
    fs.appendFileSync(process.env.FAKE_CODEX_MARKER, JSON.stringify({ argv, cwd: process.cwd(), stdin, envKeys: Object.keys(process.env) }) + "\n");
  }
  if (argv[0] === "mcp" && argv[1] === "list") {
    if (process.env.FAKE_CODEX_MCP_EXIT) {
      process.stderr.write("Error loading config.toml: simulated\n");
      process.exitCode = Number(process.env.FAKE_CODEX_MCP_EXIT);
      return;
    }
    process.stdout.write(process.env.FAKE_CODEX_MCP ?? "[]");
    return;
  }
  if (argv[0] === "queue") {
    const thread = argv[argv.indexOf("--thread") + 1];
    const message = argv[argv.indexOf("--message") + 1];
    const queueMode = process.env.FAKE_CODEX_QUEUE || "reply";
    const ack = (id) => process.stdout.write(`Queued message 01a1-item for thread ${id}.\n`);
    if (queueMode === "unsupported") {
      // Forme observée avec l'analyseur de Codex 0.151.0 pour une sous-commande inconnue.
      process.stderr.write("error: unexpected argument '--thread' found\n\n  tip: to pass '--thread' as a value, use '-- --thread'\n\nUsage: codex [OPTIONS] [PROMPT]\n       codex [OPTIONS] <COMMAND> [ARGS]\n\nFor more information, try '--help'.\n");
      process.exitCode = 2;
      return;
    }
    if (queueMode === "fail") {
      process.stderr.write("Error: queue database unavailable\n");
      process.exitCode = 1;
      return;
    }
    if (queueMode === "no-ack") return;
    if (queueMode === "foreign-ack") {
      ack(OTHER);
      return;
    }
    ack(thread);
    if (queueMode === "ack-only") return;
    // Tour traité par le récepteur, au format Codex 0.151.0 / 0.160.1.
    const turnId = "turn-relayed";
    const rows = [
      { type: "event_msg", payload: { type: "task_started", turn_id: turnId } },
      { type: "turn_context", payload: { turn_id: turnId, model: "gpt-fake", approval_policy: "on-request", sandbox_policy: { type: "read-only" }, permission_profile: { network: "restricted" }, cwd: process.cwd() } },
      { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: message }] } },
      { type: "event_msg", payload: { type: "item_completed", thread_id: thread, turn_id: turnId, item: { type: "UserMessage", content: [{ type: "text", text: message }] } } },
      { type: "event_msg", payload: { type: "item_completed", thread_id: thread, turn_id: turnId, item: { type: "AgentMessage", phase: "final_answer", content: [{ type: "Text", text: "FAKE-OPEN « été »" }] } } },
      { type: "event_msg", payload: { type: "task_complete", turn_id: turnId, last_agent_message: "FAKE-OPEN « été »" } }
    ];
    fs.appendFileSync(process.env.FAKE_CODEX_ROLLOUT, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
    return;
  }
  const target = argv[argv.length - 2];
  switch (mode) {
    case "ok":
      turn(target, stdin, ["Je regarde.", "FAKE-OK"]);
      emit({ type: "turn.completed", usage: {} });
      return;
    case "mismatch":
      turn(OTHER, stdin, ["FAKE-OK"]);
      emit({ type: "turn.completed", usage: {} });
      return;
    case "active-writer":
      process.stderr.write(`Error: thread/resume: thread/resume failed: thread ${target} already has an active writer (code -32600)\n`);
      process.exitCode = 1;
      return;
    case "not-found":
      process.stderr.write(`Error: thread/resume: thread/resume failed: no rollout found for thread id ${target} (code -32600)\n`);
      process.exitCode = 1;
      return;
    case "turn-failed":
      turn(target, stdin, []);
      emit({ type: "error", message: "400 Bad Request" });
      emit({ type: "turn.failed", error: { message: "400 Bad Request" } });
      process.exitCode = 1;
      return;
    case "no-message":
      turn(target, stdin, []);
      emit({ type: "turn.completed", usage: {} });
      return;
    case "blank":
      turn(target, stdin, ["  \n "]);
      emit({ type: "turn.completed", usage: {} });
      return;
    case "two-completed":
      turn(target, stdin, ["FAKE-OK"]);
      emit({ type: "turn.completed", usage: {} });
      emit({ type: "turn.completed", usage: {} });
      return;
    case "usage-limit":
      process.stderr.write("ERROR: You've hit your usage limit. Try again later.\n");
      process.exitCode = 1;
      return;
    case "hang":
      turn(target, stdin, []);
      setTimeout(() => {}, 60_000);
      return;
    default:
      throw new Error(`mode inconnu ${mode}`);
  }
});
