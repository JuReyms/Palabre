/** @file Qualification du lancement des témoins MCP par Codex avec les arguments Relay. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codexCreateArgs, codexResumeArgs, mcpNeutralizationArgs, parseMcpServerNames } from "../dist/externalSessions/codex.js";
import { runExternalProcess } from "../dist/externalSessions/process.js";
import { resolveExternalExecutable } from "../dist/externalSessions/resolve.js";

assert.equal(process.platform, "win32", "Ce scénario est qualifié sous Windows.");
const command = process.argv[2];
assert.ok(process.argv.length === 3 && path.isAbsolute(command), "Usage : node scripts/qualify_codex_mcp.mjs <chemin-absolu-de-Codex>");
const resolved = resolveExternalExecutable(command);
assert.ok(resolved.status === "resolved", "Commande Codex absente ou shim non reconnu.");
const { executable } = resolved;

const repo = fileURLToPath(new URL("..", import.meta.url));
const outputDir = path.join(repo, ".tmp");
await mkdir(outputDir, { recursive: true });
const root = await mkdtemp(path.join(outputDir, "qualify-mcp-"));
const profile = path.join(root, "profile");
const codexHome = path.join(profile, ".codex");
const project = path.join(root, "project");
const projectConfig = path.join(project, ".codex");
const temp = path.join(root, "temp");
await Promise.all([mkdir(codexHome, { recursive: true }), mkdir(projectConfig, { recursive: true }), mkdir(temp)]);
const env = {
  SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, ComSpec: process.env.ComSpec,
  Path: process.env.PATH, PATHEXT: process.env.PATHEXT,
  HOME: profile, USERPROFILE: profile, LOCALAPPDATA: path.join(profile, "Local"),
  APPDATA: path.join(profile, "Roaming"), TEMP: temp, TMP: temp, CODEX_HOME: codexHome,
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL", RUST_LOG: "info",
};
const git = spawnSync("git.exe", ["init", "--quiet", "--template="], {
  cwd: project, env, timeout: 10_000, windowsHide: true,
});
assert.equal(git.status, 0, "git init a échoué dans le projet témoin.");

const witness = path.join(repo, "scripts", "prototypes", "relay", "mcp-witness.cjs");
const journal = path.join(root, "witness.log");
const expected = ["witness_project", "witness_user"];
const witnessArgs = layer => [witness, "--log", journal, "--name", layer];
const witnessConfig = (name, layer) => [
  `[mcp_servers.${name}]`,
  `command = ${JSON.stringify(process.execPath)}`,
  `args = ${JSON.stringify(witnessArgs(layer))}`,
  "",
].join("\n");

const witnessToolCounts = [];
const endpoint = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/responses") {
    response.writeHead(404).end();
    return;
  }
  serveResponse(request, response, witnessToolCounts).catch(() => {
    if (response.headersSent) response.destroy();
    else response.writeHead(400).end();
  });
}).listen(0, "127.0.0.1");
await once(endpoint, "listening");

try {
  const origin = `http://127.0.0.1:${endpoint.address().port}`;
  Object.assign(env, { HTTP_PROXY: origin, HTTPS_PROXY: origin, NO_PROXY: "127.0.0.1,localhost" });
  const settings = [
    'model_provider = "qualification"',
    'model = "gpt-5.4"',
    'cli_auth_credentials_store = "file"',
    'check_for_update_on_startup = false',
    '',
    '[analytics]',
    'enabled = false',
    '',
    '[model_providers.qualification]',
    'name = "Qualification locale"',
    `base_url = "${origin}/v1"`,
    'wire_api = "responses"',
    'requires_openai_auth = false',
    'supports_websockets = false',
    'request_max_retries = 0',
    'stream_max_retries = 0',
    '',
    `[projects.${JSON.stringify(project)}]`,
    'trust_level = "trusted"',
    '',
    witnessConfig("witness_user", "user"),
  ].join("\n");
  await writeFile(path.join(codexHome, "config.toml"), settings, { flag: "wx" });
  await writeFile(path.join(projectConfig, "config.toml"), witnessConfig("witness_project", "project"), { flag: "wx" });

  const version = (await runCodex("version", ["--version"])).trim();
  assert.match(version, /^codex-cli \S+$/);
  const inventory = await runCodex("inventory", ["mcp", "list", "--json", ...mcpNeutralizationArgs([])]);
  const names = parseMcpServerNames(inventory);
  assert.ok(names && JSON.stringify([...names].sort()) === JSON.stringify(expected),
    "L'inventaire doit contenir exactement les deux témoins avant de poursuivre.");
  const entries = JSON.parse(inventory);
  assert.equal(entries.length, expected.length, "L'inventaire contient des doublons.");
  for (const layer of ["project", "user"]) {
    const entry = entries.find(item => item.name === `witness_${layer}`);
    const transport = entry?.transport;
    assert.ok(entry?.enabled === true && transport?.type === "stdio" && transport.command === process.execPath
      && JSON.stringify(transport.args) === JSON.stringify(witnessArgs(layer)) && transport.cwd === null
      && transport.env === null && Array.isArray(transport.env_vars) && transport.env_vars.length === 0,
    `Transport du témoin ${layer} inattendu. Aucun tour lancé.`);
  }
  assert.deepEqual(await witnessStarts(), [], "L'inventaire a lancé un témoin.");

  // Le contrôle positif établit que le journal et le compteur d'outils voient les deux couches.
  const session = await runTurn("baseline", codexCreateArgs(mcpNeutralizationArgs([])));
  assert.deepEqual(await witnessStarts(), ["project", "user"]);
  assert.deepEqual(witnessToolCounts, [2]);

  const resumed = await runTurn("neutralized", codexResumeArgs(session, mcpNeutralizationArgs(names)));
  assert.ok(resumed === session, "La reprise ne correspond pas à la conversation témoin.");
  assert.deepEqual(await witnessStarts(), ["project", "user"], "Un témoin a redémarré pendant la reprise.");
  assert.deepEqual(witnessToolCounts, [2, 0]);
  console.log(JSON.stringify({
    version, listed: expected, baselineStarts: 2, resumeStarts: 0,
    witnessToolCounts, sameSession: true, provider: "loopback", evidence: path.relative(repo, root),
  }));
} finally {
  endpoint.closeAllConnections();
  await new Promise((resolve, reject) => endpoint.close(error => error ? reject(error) : resolve()));
}

/** Exécute le vrai binaire avec une durée et une sortie bornées. Les flux restent locaux. */
async function runCodex(label, args, stdin = "") {
  const result = await runExternalProcess({
    command: executable.command, args: [...executable.prefixArgs, ...args],
    cwd: project, env, stdin, timeoutMs: 35_000, maxOutputBytes: 1024 * 1024, killGraceMs: 1_500,
  });
  await writeFile(path.join(root, `${label}.stdout.log`), result.stdout, { flag: "wx" });
  await writeFile(path.join(root, `${label}.stderr.log`), result.stderr, { flag: "wx" });
  assert.ok(result.exitCode === 0 && !result.stopReason && !result.forcedReturn,
    `Codex a échoué à l'étape ${label}. Journaux : ${path.relative(repo, root)}`);
  return result.stdout;
}

async function runTurn(label, args) {
  const stdout = await runCodex(label, args, "Qualification locale. Réponds OK sans utiliser d’outil.");
  const events = stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const threadId = events.find(event => event.type === "thread.started")?.thread_id;
  assert.ok(typeof threadId === "string" && /^[a-f0-9-]{36}$/.test(threadId), "Identifiant témoin absent ou invalide.");
  assert.ok(events.some(event => event.type === "turn.completed"), `Tour local incomplet : ${label}.`);
  return threadId;
}

async function witnessStarts() {
  const text = await readFile(journal, "utf8").catch(error => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    .filter(event => event.event === "start").map(event => event.label).sort();
}

/** Retourne une réponse fixe via SSE. Ne conserve que le nombre d'outils témoins. */
async function serveResponse(request, response, counts) {
  request.setEncoding("utf8");
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 1024 * 1024) {
      response.writeHead(413).end();
      return;
    }
  }
  const incoming = JSON.parse(body);
  counts.push(incoming.tools?.filter(tool => JSON.stringify(tool).includes("witness_ping")).length ?? 0);
  const item = {
    type: "message", id: `msg_qualification_${counts.length}`, role: "assistant", status: "completed",
    content: [{ type: "output_text", text: "OK QUALIFICATION", annotations: [] }],
  };
  const completed = {
    id: `resp_qualification_${counts.length}`, object: "response", status: "completed",
    model: incoming.model, output: [item],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
  };
  const events = [
    { type: "response.created", response: { ...completed, status: "in_progress", output: [] } },
    { type: "response.output_item.added", output_index: 0, item: { ...item, status: "in_progress", content: [] } },
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response: completed },
  ];
  response.writeHead(200, { "Content-Type": "text/event-stream" });
  response.end(events.map((event, sequence_number) => `data: ${JSON.stringify({ ...event, sequence_number })}\n\n`).join(""));
}
