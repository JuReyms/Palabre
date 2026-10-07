#!/usr/bin/env node
/**
 * @file Serveur MCP témoin inoffensif (prototype relay, issue #96).
 *
 * Transport stdio, JSON-RPC délimité par des retours ligne. Il n'accède à aucun service et ne
 * modifie rien : il ajoute seulement une ligne JSON par événement dans le journal passé par
 * `--log <fichier>` (démarrage, chaque requête ou notification reçue, arrêt), et expose un seul
 * outil `witness_ping` qui renvoie un texte fixe.
 *
 * Usage : node mcp-witness.cjs --log <fichier> [--name <étiquette>]
 */
"use strict";
const fs = require("node:fs");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const logFile = option("--log", null);
const label = option("--name", "witness");

function record(event, detail = {}) {
  if (!logFile) return;
  fs.appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), pid: process.pid, label, event, ...detail }) + "\n");
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

const tools = [{
  name: "witness_ping",
  description: "Outil témoin inoffensif : renvoie un texte fixe et n'effectue aucune action.",
  inputSchema: { type: "object", properties: { note: { type: "string" } } },
}];

function handle(message) {
  record("receive", { method: message.method, id: message.id ?? null, tool: message.params?.name });
  if (message.id === undefined || message.id === null) return; // notification
  switch (message.method) {
    case "initialize":
      send({
        jsonrpc: "2.0", id: message.id,
        result: {
          protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: `palabre-${label}`, version: "0.0.1" },
        },
      });
      return;
    case "tools/list":
      send({ jsonrpc: "2.0", id: message.id, result: { tools } });
      return;
    case "tools/call":
      send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "WITNESS-PONG" }], isError: false } });
      return;
    case "ping":
      send({ jsonrpc: "2.0", id: message.id, result: {} });
      return;
    default:
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `méthode non prise en charge : ${message.method}` } });
  }
}

record("start", { argv: process.argv.slice(2) });
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (error) { record("parse-error", { message: String(error) }); }
  }
});
process.stdin.on("end", () => { record("stdin-end"); process.exit(0); });
process.on("SIGTERM", () => { record("sigterm"); process.exit(0); });
