/**
 * @file Fausse CLI Claude Code pour `palabre relay --open` (B2.2), chargée par `fake-claude.cjs`.
 * Elle ne valide pas la sémantique réelle des permissions : elle vérifie seulement le code de Palabre.
 *
 * Sous-commandes :
 *   --version        FAKE_CLAUDE_VERSION (défaut : 2.1.293 (Claude Code)) ;
 *   agents --json    FAKE_CLAUDE_AGENTS ; à partir de l'appel n° FAKE_CLAUDE_AGENTS_SWITCH (défaut 2),
 *                    FAKE_CLAUDE_AGENTS_AFTER s'il est défini (compteur dans FAKE_CLAUDE_AGENTS_COUNTER) ;
 *   auth status      { loggedIn, projectsDirectory: FAKE_CLAUDE_PROJECTS } ;
 *   -p … --permission-prompt-tool …  messager : lance le garde décrit par --mcp-config, lui soumet
 *                    une demande SendMessage avec le texte de remplacement, puis, si elle est
 *                    autorisée, ajoute au transcript FAKE_CLAUDE_TRANSCRIPT la file, l'ancre de pair
 *                    au corps imposé par le garde et un tour de réponse.
 * FAKE_CLAUDE_OPEN : reply (défaut), send-only, twice, other-tool, no-guard, guard-failed,
 *                    fail-after-send, hold (autorisé, rien n'arrive).
 * Chaque invocation ajoute { argv, cwd, stdin, envKeys } à FAKE_CLAUDE_MARKER, et chaque décision
 * du garde { decision }.
 */
"use strict";
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const readline = require("node:readline");

const argv = process.argv.slice(2);
const env = process.env;
const mark = (entry) => { if (env.FAKE_CLAUDE_MARKER) fs.appendFileSync(env.FAKE_CLAUDE_MARKER, JSON.stringify(entry) + "\n"); };
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");
const record = (stdin = "") => mark({ argv, cwd: process.cwd(), stdin, envKeys: Object.keys(env) });

function agents() {
  const counter = env.FAKE_CLAUDE_AGENTS_COUNTER;
  let call = 1;
  if (counter) {
    call = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0) + 1;
    fs.writeFileSync(counter, String(call));
  }
  return call >= Number(env.FAKE_CLAUDE_AGENTS_SWITCH ?? 2) && env.FAKE_CLAUDE_AGENTS_AFTER !== undefined ? env.FAKE_CLAUDE_AGENTS_AFTER : (env.FAKE_CLAUDE_AGENTS ?? "[]");
}

/** Ajoute un tour de pair au transcript cible, chaîné sur la dernière entrée, comme Claude Code. */
function deliver(input, withReply) {
  const file = env.FAKE_CLAUDE_TRANSCRIPT;
  const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const sessionId = rows[0].sessionId;
  let parent = [...rows].reverse().find((row) => typeof row.uuid === "string").uuid;
  const lines = [{ type: "queue-operation", operation: "enqueue", sessionId, content: `<cross-session-message from="adresse-factice" from-name="palabre-relay" from-mode="default">\n${input.message}\n</cross-session-message>` }];
  const chained = (entry) => { const uuid = randomUUID(); lines.push({ parentUuid: parent, isSidechain: false, uuid, sessionId, ...entry }); parent = uuid; };
  chained({ type: "user", promptId: randomUUID(), message: { role: "user", content: `<cross-session-message from="adresse-factice">\n${input.message}\n</cross-session-message>` }, isMeta: true, permissionMode: "auto", origin: { kind: "peer", from: "adresse-factice", msg_id: "msg-factice", name: "palabre-relay", fromMode: "default", body: input.message }, promptSource: "system", turnOrigin: "peer", turnPosition: { promptIndex: 1, turnIndex: 2 } });
  if (withReply) {
    chained({ type: "assistant", message: { role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "FAKE-CLAUDE-OPEN « été »" }] } });
    chained({ type: "system", subtype: "stop_hook_summary", hookErrors: [], preventedContinuation: false, stopReason: "", hasOutput: false });
  }
  fs.appendFileSync(file, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
}

/** Client MCP minimal vers le garde : une requête, une réponse portant le même identifiant. */
function guardClient(server) {
  const child = spawn(server.command, server.args, { stdio: ["pipe", "pipe", "inherit"], env: { ...env, ...server.env } });
  const waiting = new Map();
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    waiting.get(message.id)?.(message);
  });
  let id = 0;
  const rpc = (method, params) => new Promise((resolve) => { id += 1; waiting.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
  const ask = async (toolName, input) => JSON.parse((await rpc("tools/call", { name: "decide", arguments: { tool_name: toolName, input, tool_use_id: `toolu_${id + 1}` } })).result.content[0].text);
  return { child, rpc, ask };
}

async function messenger(stdin) {
  record(stdin);
  const mode = env.FAKE_CLAUDE_OPEN || "reply";
  const server = JSON.parse(fs.readFileSync(argv[argv.indexOf("--mcp-config") + 1], "utf8")).mcpServers.palabre_guard;
  emit({ type: "system", subtype: "init", model: "claude-haiku-4-5", mcp_servers: [{ name: "palabre_guard", status: mode === "guard-failed" ? "failed" : "connected" }] });
  if (mode === "no-guard" || mode === "guard-failed") {
    emit({ type: "result", subtype: "success", is_error: false, result: "FIN" });
    return 0;
  }
  const guard = guardClient(server);
  await guard.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake-claude", version: "1" } });
  guard.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  await guard.rpc("tools/list", {});
  const proposed = { to: "nom-propose-par-le-modele", message: "PALABRE-RELAY-PLACEHOLDER", summary: "résumé", notify_when_idle: true };
  if (mode === "other-tool") mark({ decision: await guard.ask("Bash", { command: "echo" }) });
  const decision = await guard.ask("SendMessage", proposed);
  mark({ decision });
  if (mode === "twice") mark({ decision: await guard.ask("SendMessage", proposed) });
  guard.child.stdin.end();
  emit({ type: "assistant", message: { content: [{ type: "tool_use", id: "toolu_send", name: "SendMessage", input: proposed }] } });
  if (decision.behavior === "allow" && mode !== "hold") deliver(decision.updatedInput, mode !== "send-only");
  emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "toolu_send", content: decision.behavior === "allow" ? "sent" : "denied" }] } });
  emit({ type: "result", subtype: "success", is_error: false, result: "FIN" });
  return mode === "fail-after-send" ? 1 : 0;
}

if (argv[0] === "--version") {
  record();
  process.stdout.write(`${env.FAKE_CLAUDE_VERSION ?? "2.1.293 (Claude Code)"}\n`);
} else if (argv[0] === "agents") {
  record();
  process.stdout.write(agents());
} else if (argv[0] === "auth") {
  record();
  process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", projectsDirectory: env.FAKE_CLAUDE_PROJECTS }));
} else {
  let stdin = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { stdin += chunk; });
  process.stdin.on("end", () => { messenger(stdin).then((code) => { process.exitCode = code; }, (error) => { process.stderr.write(String(error)); process.exitCode = 2; }); });
}
