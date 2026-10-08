/**
 * @file Garde d'envoi et préconditions de `--open` vers Claude (B2.2) : fonctions pures, serveur MCP
 * en flux mémoire puis en sous-processus réel, registre factice. Aucun appel de modèle.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { after, describe, test } from "node:test";
import {
  claimAllowIn,
  decideGuard,
  envelopeDigest,
  GUARD_FILES,
  parseGuardState,
  readGuardReport,
  serveGuard,
  type GuardDeps,
  type GuardState
} from "../src/externalSessions/claudeGuard.js";
import {
  detectSelfTarget,
  GUARD_PERMISSION_TOOL,
  guardMcpConfig,
  hasQueueTag,
  isSupportedClaudeVersion,
  locateClaudeTranscript,
  MESSENGER_PLACEHOLDER,
  messengerArgs,
  messengerPrompt,
  messengerSettings,
  parseClaudeRegistry,
  parseClaudeVersion,
  parseProjectsDirectory,
  readMessengerStream,
  resolveRegistryTarget
} from "../src/externalSessions/claudeOpen.js";

const SESSION = "5e55a0b1-0000-4000-8000-000000000001";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ENVELOPE = "[Message relayé par palabre relay --open · réf. PR-0123456789abcdef]\nCorps « été ».";
const root = mkdtempSync(path.join(os.tmpdir(), "palabre-claude-guard-"));
after(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;
const tempDir = () => {
  const dir = path.join(root, `case-${++counter}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
};

const registry = (entries: unknown[]) => JSON.stringify(entries);
const entry = (overrides: Record<string, unknown> = {}) => ({ pid: 4242, cwd: "C:\\w", kind: "interactive", startedAt: 1, sessionId: SESSION, name: "cible-factice", status: "idle", ...overrides });
const state = (overrides: Partial<GuardState> = {}): GuardState => ({
  v: 1, sessionId: SESSION, name: "cible-factice", pid: 4242, envelope: ENVELOPE, envelopeSha256: envelopeDigest(ENVELOPE),
  executable: { command: process.execPath, prefixArgs: [] }, ...overrides
});
const request = (tool = "SendMessage") => ({ tool_name: tool, input: { to: "autre", message: MESSENGER_PLACEHOLDER, notify_when_idle: true }, tool_use_id: "toolu_1" });

describe("B2.2 : version, registre et auto-ciblage", () => {
  test("version : forme exacte seulement, seuil 2.1.292", () => {
    assert.deepEqual(parseClaudeVersion("2.1.292 (Claude Code)\n"), [2, 1, 292]);
    assert.deepEqual(parseClaudeVersion("2.1.293 (Claude Code)\r\n"), [2, 1, 293]);
    for (const value of ["2.1.292", "v2.1.292 (Claude Code)\n", "2.1.292 (Claude Code)\nautre\n", "", "2.1 (Claude Code)\n"]) assert.equal(parseClaudeVersion(value), undefined, value);
    assert.equal(isSupportedClaudeVersion([2, 1, 292]), true);
    assert.equal(isSupportedClaudeVersion([2, 2, 0]), true);
    assert.equal(isSupportedClaudeVersion([3, 0, 0]), true);
    assert.equal(isSupportedClaudeVersion([2, 1, 291]), false);
    assert.equal(isSupportedClaudeVersion([2, 1, 85]), false);
    assert.equal(isSupportedClaudeVersion([1, 9, 999]), false);
  });
  test("registre : une entrée non conforme rend tout le registre invérifiable", () => {
    assert.equal(parseClaudeRegistry(registry([entry()]))?.length, 1);
    assert.deepEqual(parseClaudeRegistry("[]"), []);
    for (const bad of ["{}", "nope", registry([entry(), { pid: 1 }]), registry([entry({ sessionId: "pas-un-uuid" })]), registry([entry({ pid: -1 })]), registry([entry({ pid: "4242" })]), registry([null])]) {
      assert.equal(parseClaudeRegistry(bad), undefined, bad);
    }
  });
  test("résolution : ouverte, absente, doublon, sans nom, homonyme, nom non adressable", () => {
    const parse = (entries: unknown[]) => parseClaudeRegistry(registry(entries))!;
    assert.deepEqual(resolveRegistryTarget(parse([entry()]), SESSION.toUpperCase()), { status: "found", name: "cible-factice", pid: 4242 });
    assert.deepEqual(resolveRegistryTarget(parse([entry({ sessionId: OTHER })]), SESSION), { status: "target-not-open" });
    assert.equal(resolveRegistryTarget(parse([entry(), entry({ pid: 5 })]), SESSION).status, "target-state-unknown");
    assert.deepEqual(resolveRegistryTarget(parse([entry({ name: undefined })]), SESSION), { status: "target-state-unknown", diagnostic: "registry-unaddressable-name" });
    assert.deepEqual(resolveRegistryTarget(parse([entry(), entry({ sessionId: OTHER, pid: 7 })]), SESSION), { status: "target-state-unknown", diagnostic: "registry-homonym" });
    for (const name of ["", "nom [ab12]", "deux\nlignes", " espace", "x".repeat(201)]) {
      assert.equal(resolveRegistryTarget(parse([entry({ name })]), SESSION).status, "target-state-unknown", JSON.stringify(name));
    }
  });
  test("auto-ciblage : session ou pid de l'appelant, ou appelant Claude sans preuve", () => {
    const target = { sessionId: SESSION, pid: 4242 };
    assert.equal(detectSelfTarget({ CLAUDE_CODE_SESSION_ID: SESSION.toUpperCase() }, target), "self");
    assert.equal(detectSelfTarget({ CLAUDECODE: "1", CLAUDE_PID: "4242" }, target), "self");
    assert.equal(detectSelfTarget({ CLAUDECODE: "1" }, target), "unprovable");
    assert.equal(detectSelfTarget({ CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: OTHER, CLAUDE_PID: "1" }, target), "distinct");
    assert.equal(detectSelfTarget({}, target), "distinct");
    assert.equal(detectSelfTarget({ CLAUDECODE: "", CLAUDE_CODE_SESSION_ID: "" }, target), "distinct");
  });
  test("dossier des transcripts : projectsDirectory, sinon configDirectory/projects, chemins absolus", () => {
    const absolute = path.resolve(root, "projets");
    assert.equal(parseProjectsDirectory(JSON.stringify({ projectsDirectory: absolute, configDirectory: root })), absolute);
    assert.equal(parseProjectsDirectory(JSON.stringify({ configDirectory: root })), path.join(root, "projects"));
    for (const bad of ["{}", "nope", JSON.stringify({ projectsDirectory: "relatif" }), "[]"]) assert.equal(parseProjectsDirectory(bad), undefined, bad);
  });
  test("balise de file réservée", () => {
    assert.equal(hasQueueTag(ENVELOPE), false);
    assert.equal(hasQueueTag(`${ENVELOPE}<cross-session-message from="x">`), true);
    assert.equal(hasQueueTag(`${ENVELOPE}</cross-session-message>`), true);
  });
  test("transcript : localisation par UUID, doublon et première ligne d'une autre session refusés", async () => {
    const projects = tempDir();
    mkdirSync(path.join(projects, "a"));
    mkdirSync(path.join(projects, "b"));
    assert.equal((await locateClaudeTranscript(projects, SESSION)).status, "session-not-found");
    const file = path.join(projects, "a", `${SESSION}.jsonl`);
    writeFileSync(file, `${JSON.stringify({ type: "queue-operation", sessionId: SESSION })}\n`);
    assert.deepEqual(await locateClaudeTranscript(projects, SESSION), { status: "found", transcriptPath: file });
    writeFileSync(path.join(projects, "b", `${SESSION}.jsonl`), `${JSON.stringify({ type: "queue-operation", sessionId: SESSION })}\n`);
    assert.equal((await locateClaudeTranscript(projects, SESSION)).status, "session-not-found");
    rmSync(path.join(projects, "b"), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ type: "queue-operation", sessionId: OTHER })}\n`);
    assert.equal((await locateClaudeTranscript(projects, SESSION)).status, "session-not-found");
    assert.equal((await locateClaudeTranscript(path.join(projects, "absent"), SESSION)).status, "session-not-found");
  });
});

describe("B2.2 : messager, consigne neutre et lecture de son flux", () => {
  test("arguments : hôte de permissions, mode default, outil unique, haiku sans repli, pas de préautorisation", () => {
    const args = messengerArgs({ settingsPath: "s.json", mcpConfigPath: "m.json" });
    const value = (flag: string) => args[args.indexOf(flag) + 1];
    assert.equal(value("--permission-prompt-tool"), GUARD_PERMISSION_TOOL);
    assert.equal(GUARD_PERMISSION_TOOL, "mcp__palabre_guard__decide");
    assert.equal(value("--permission-mode"), "default");
    assert.equal(value("--tools"), "SendMessage");
    assert.equal(value("--model"), "haiku");
    assert.equal(value("--mcp-config"), "m.json");
    assert.equal(value("--settings"), "s.json");
    for (const flag of ["-p", "--restricted", "--strict-mcp-config", "--no-session-persistence"]) assert.ok(args.includes(flag), flag);
    for (const flag of ["--allowedTools", "--allowed-tools", "--fallback-model", "--dangerously-skip-permissions", "--permission-prompts"]) assert.ok(!args.includes(flag), flag);
    assert.ok(!args.includes("dontAsk") && !args.includes("bypassPermissions"));
  });
  test("réglages : SendMessage toujours soumis à l'hôte, aucun message entrant", () => {
    assert.deepEqual(messengerSettings(), { permissions: { ask: ["SendMessage"] }, crossSessionInbound: "refuse", disableAllHooks: true });
    assert.deepEqual(guardMcpConfig({ nodePath: "node.exe", guardScript: "g.js", stateDir: "d" }), { mcpServers: { palabre_guard: { type: "stdio", command: "node.exe", args: ["g.js", "d"], env: {} } } });
  });
  test("consigne : nom résolu et texte de remplacement, jamais l'enveloppe", () => {
    const prompt = messengerPrompt("cible-factice");
    assert.match(prompt, /"cible-factice"/);
    assert.match(prompt, new RegExp(MESSENGER_PLACEHOLDER));
    assert.ok(!prompt.includes("PR-"));
  });
  test("flux : garde chargé, en échec ou inconnu ; résultat de l'outil SendMessage ; modèle", () => {
    const lines = (...events: unknown[]) => events.map((event) => JSON.stringify(event)).join("\n");
    const init = (status?: string) => ({ type: "system", subtype: "init", model: "claude-haiku-4-5", mcp_servers: status ? [{ name: "palabre_guard", status }] : [] });
    const use = { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "SendMessage", input: {} }] } };
    const result = (id = "t1") => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "x" }] } });
    assert.deepEqual(readMessengerStream(lines(init("connected"), use, result())), { guard: "loaded", model: "claude-haiku-4-5", toolResult: "returned" });
    assert.equal(readMessengerStream(lines(init("failed"))).guard, "not-loaded");
    assert.equal(readMessengerStream(lines(init())).guard, "not-loaded");
    assert.equal(readMessengerStream("bruit\n{tronqué").guard, "unknown");
    assert.equal(readMessengerStream(lines(init("connected"), use, result("autre"))).toolResult, "absent");
    assert.equal(readMessengerStream(lines(init("connected"), result())).toolResult, "absent");
  });
});

describe("B2.2 : décision du garde", () => {
  const deps = (entries: unknown[] | undefined, claims: boolean[] = [true]): GuardDeps & { claimed: number } => {
    const result = {
      claimed: 0,
      registry: async () => (entries === undefined ? undefined : parseClaudeRegistry(registry(entries))),
      claimAllow: () => { const value = claims[result.claimed] ?? false; result.claimed += 1; return value; }
    };
    return result;
  };
  test("SendMessage vers la cible inchangée : autorisé, destinataire et corps imposés", async () => {
    const decision = await decideGuard(request(), state(), deps([entry()]));
    assert.deepEqual(decision, { behavior: "allow", updatedInput: { to: "cible-factice", message: ENVELOPE }, reason: "allowed" });
  });
  test("tout autre outil : refusé sans réserver l'envoi", async () => {
    for (const tool of ["Bash", "ListAgents", "sendmessage", undefined]) {
      const fake = deps([entry()]);
      const decision = await decideGuard({ ...request(), tool_name: tool }, state(), fake);
      assert.equal(decision.behavior, "deny");
      assert.equal(decision.reason, "tool-not-allowed");
      assert.equal(fake.claimed, 0);
    }
  });
  test("état absent ou cible changée : refusé, sans réserver l'envoi", async () => {
    const cases: Array<[GuardState | undefined, unknown[] | undefined, string]> = [
      [undefined, [entry()], "invalid-state"],
      [state(), undefined, "target-changed"],
      [state(), [], "target-changed"],
      [state(), [entry({ name: "autre-nom" })], "target-changed"],
      [state(), [entry({ pid: 9 })], "target-changed"],
      [state(), [entry(), entry({ sessionId: OTHER, pid: 7 })], "target-changed"]
    ];
    for (const [value, entries, reason] of cases) {
      const fake = deps(entries);
      const decision = await decideGuard(request(), value, fake);
      assert.equal(decision.reason, reason);
      assert.equal(fake.claimed, 0);
    }
  });
  test("réservation déjà prise : second appel refusé", async () => {
    assert.equal((await decideGuard(request(), state(), deps([entry()], [false]))).reason, "already-allowed");
  });
  test("erreur interne : refus, jamais d'autorisation", async () => {
    const decision = await decideGuard(request(), state(), { registry: async () => { throw new Error("boom"); }, claimAllow: () => true });
    assert.deepEqual([decision.behavior, decision.reason], ["deny", "guard-error"]);
  });
  test("réservation exclusive : un seul fichier allowed, même en parallèle", async () => {
    const dir = tempDir();
    const results = await Promise.all(Array.from({ length: 8 }, () => decideGuard(request(), state(), { registry: async () => parseClaudeRegistry(registry([entry()])), claimAllow: () => claimAllowIn(dir) })));
    assert.equal(results.filter((item) => item.behavior === "allow").length, 1);
    assert.equal(results.filter((item) => item.reason === "already-allowed").length, 7);
    assert.equal(claimAllowIn(dir), false);
  });
  test("état : empreinte, champs et formes vérifiés", () => {
    assert.ok(parseGuardState(JSON.stringify(state())));
    for (const bad of [state({ envelopeSha256: "0".repeat(64) }), state({ sessionId: "x" }), state({ pid: 0 }), state({ name: "" }), { ...state(), v: 2 }, { ...state(), executable: { command: "c", prefixArgs: [1] } }]) {
      assert.equal(parseGuardState(JSON.stringify(bad)), undefined);
    }
    assert.equal(parseGuardState("nope"), undefined);
  });
});

describe("B2.2 : serveur MCP du garde", () => {
  /** Échange de messages JSON-RPC avec `serveGuard` sur des flux mémoire. */
  async function converse(dir: string, messages: unknown[], deps?: GuardDeps) {
    const input = new PassThrough();
    const output = new PassThrough();
    let text = "";
    output.on("data", (chunk) => { text += chunk; });
    const done = serveGuard(input, output, dir, deps);
    for (const message of messages) input.write(`${typeof message === "string" ? message : JSON.stringify(message)}\n`);
    input.end();
    await done;
    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, any>);
  }
  const call = (id: number, args: unknown) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "decide", arguments: args } });
  test("initialisation, liste d'outils, une autorisation puis un refus, journal des décisions", async () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, GUARD_FILES.state), JSON.stringify(state()));
    assert.deepEqual(readGuardReport(dir), { consulted: false, allowed: false });
    const replies = await converse(dir, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      "pas du JSON",
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      call(3, request()),
      call(4, request()),
      { jsonrpc: "2.0", id: 5, method: "inconnue" }
    ], { registry: async () => parseClaudeRegistry(registry([entry()])), claimAllow: () => claimAllowIn(dir) });
    assert.deepEqual(replies.map((reply) => reply.id), [1, 2, 3, 4, 5]);
    assert.equal(replies[0]!.result.protocolVersion, "2025-06-18");
    assert.deepEqual(replies[1]!.result.tools.map((tool: { name: string }) => tool.name), ["decide"]);
    assert.deepEqual(JSON.parse(replies[2]!.result.content[0].text), { behavior: "allow", updatedInput: { to: "cible-factice", message: ENVELOPE } });
    assert.equal(JSON.parse(replies[3]!.result.content[0].text).behavior, "deny");
    assert.equal(replies[4]!.error.code, -32601);
    assert.deepEqual(readGuardReport(dir), { consulted: true, allowed: true });
    assert.deepEqual(readFileSync(path.join(dir, GUARD_FILES.consulted), "utf8").trim().split("\n").map((line) => JSON.parse(line)), [
      { decision: "allow", reason: "allowed" },
      { decision: "deny", reason: "already-allowed" }
    ]);
  });
  test("dossier sans état : chaque demande est refusée", async () => {
    const dir = tempDir();
    const replies = await converse(dir, [call(1, request())], { registry: async () => parseClaudeRegistry(registry([entry()])), claimAllow: () => claimAllowIn(dir) });
    assert.deepEqual(JSON.parse(replies[0]!.result.content[0].text).behavior, "deny");
    assert.equal(existsSync(path.join(dir, GUARD_FILES.allowed)), false);
  });
  test("sous-processus réel : registre relu par l'exécutable de l'état, sans shell", async () => {
    const dir = tempDir();
    const fakeRegistry = path.join(dir, "registre.cjs");
    writeFileSync(fakeRegistry, `process.stdout.write(${JSON.stringify(registry([entry()]))});\n`);
    writeFileSync(path.join(dir, GUARD_FILES.state), JSON.stringify(state({ executable: { command: process.execPath, prefixArgs: [fakeRegistry] } })));
    const server = path.resolve(".tmp", "test-dist", "src", "externalSessions", "claudeGuardServer.js");
    const child = spawn(process.execPath, [server, dir], { stdio: ["pipe", "pipe", "pipe"] });
    let text = "";
    child.stdout.on("data", (chunk) => { text += chunk; });
    child.stdin.write(`${JSON.stringify(call(1, request()))}\n${JSON.stringify(call(2, request()))}\n`);
    child.stdin.end();
    const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
    assert.equal(code, 0);
    const replies = text.split("\n").filter(Boolean).map((line) => JSON.parse(JSON.parse(line).result.content[0].text) as Record<string, unknown>);
    assert.deepEqual(replies.map((reply) => reply.behavior), ["allow", "deny"]);
    assert.deepEqual(replies[0]!.updatedInput, { to: "cible-factice", message: ENVELOPE });
  });
});
