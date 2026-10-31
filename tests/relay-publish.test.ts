/** @file Publication sur profils/serveurs fictifs : aperçu, accord opérateur, races et absence de rejeu. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { getEventListeners } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { after, test } from "node:test";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { confirmPublication, executeRelayPublish, MAX_PUBLICATION_BODY_BYTES, type PublicationTerminal } from "../src/commands/relayPublish.js";
import { runPublicationGitHub, type PublicationGitHubRun } from "../src/githubPublication.js";
import type { ExternalProcessResult, ExternalProcessSpec } from "../src/externalSessions/process.js";
import { relayPublishText } from "../src/messages/relayPublish.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-publish-fake-"));
after(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;

/** Profil jetable, source choisie et API GitHub en mémoire ; aucune connexion réelle. */
function world(kind: "issue" | "pull-request" = "issue", language: "fr" | "en" = "fr") {
  const home = path.join(root, String(++counter)); mkdirSync(home);
  const file = path.join(home, "bilan.md");
  writeFileSync(file, "**Fait :** correction proposée.\r\n\r\nVérification : test fictif réussi.\r\nLimite : aucun outil réel lancé.\r\n");
  const to = `https://github.com/owner/repo/${kind === "issue" ? "issues" : "pull"}/42`;
  const remote = { repositoryId: 1, targetId: 42, publisherId: 7, publisher: "human", private: false, state: "open", head: "a".repeat(40), locked: false, archived: false };
  const calls: { args: string[]; input?: string }[] = [];
  let posted = 0, confirmations = 0;
  const prints: string[] = [];
  let onConfirm: () => boolean | Promise<boolean> = () => true;
  let onPost: (body: string) => string | Promise<string> = body => JSON.stringify({ id: 123, body,
    html_url: `${to}#issuecomment-123`, issue_url: "https://api.github.com/repos/owner/repo/issues/42", user: { login: remote.publisher, id: remote.publisherId } });
  const run: PublicationGitHubRun = async (args, input) => {
    calls.push({ args, ...(input === undefined ? {} : { input }) });
    if (args.includes("POST")) { posted++; return onPost(JSON.parse(input!).body); }
    if (args[0] === "user") return JSON.stringify({ id: remote.publisherId, login: remote.publisher });
    if (args[0] === "repos/owner/repo") return JSON.stringify({ id: remote.repositoryId, full_name: "owner/repo", private: remote.private,
      visibility: remote.private ? "private" : "public", archived: remote.archived });
    return JSON.stringify({ id: remote.targetId, html_url: to, number: 42, locked: remote.locked, state: remote.state,
      ...(kind === "issue" ? { repository_url: "https://api.github.com/repos/owner/repo" }
        : { base: { repo: { full_name: "owner/repo" } }, head: { sha: remote.head } }) });
  };
  const terminal: PublicationTerminal = { interactive: true, print: text => { prints.push(text); },
    confirm: async () => { confirmations++; return onConfirm(); } };
  const args = ["--to", to, "--from", "codex", "--participant", "Atlas", "--message-file", file, "--language", language];
  return { home, file, to, remote, calls, prints, terminal, args, run,
    get posted() { return posted; }, get confirmations() { return confirmations; },
    confirm: (fn: typeof onConfirm) => { onConfirm = fn; }, post: (fn: typeof onPost) => { onPost = fn; },
    execute: (extra: string[] = [], overrides: Parameters<typeof executeRelayPublish>[1] = {}) =>
      executeRelayPublish([...args, ...extra], { home, terminal, run, ...overrides }) };
}

test("aperçu FR/EN : contenu exact normalisé, attribution déclarée, compte/visibilité ; aucune mutation", async () => {
  for (const language of ["fr", "en"] as const) {
    const w = world("issue", language); w.terminal.interactive = false;
    const { result } = await w.execute(["--dry-run", "--json"]);
    assert.equal(result.status, "preview"); assert.equal(result.exitCode, 0);
    assert.equal(result.attempted, false); assert.equal(result.publication, "not-attempted");
    assert.equal(result.preview?.publisher, "human"); assert.equal(result.preview?.public, true);
    assert.ok(result.preview?.body.includes("Atlas (codex)"));
    assert.ok(result.preview?.body.includes(readFileSync(w.file, "utf8").replace(/\r\n/g, "\n")));
    assert.equal(result.preview?.body.includes("\r"), false);
    assert.equal(w.confirmations, 0); assert.equal(w.posted, 0);
    assert.deepEqual(readdirSync(w.home), ["bilan.md"]);
    assert.ok(w.calls.every(call => !call.args.includes("POST")));
  }
});

test("accord refusé ou terminal caché : aucun envoi ni trace ; pas de politique à approuver", async () => {
  const w = world(); w.confirm(() => false);
  const refused = await w.execute();
  assert.equal(refused.result.status, "declined"); assert.equal(w.posted, 0);
  assert.ok(w.prints[0]!.includes(refused.result.preview!.body));
  assert.deepEqual(readdirSync(w.home), ["bilan.md"]);
  w.terminal.interactive = false; w.calls.length = 0;
  const hidden = await w.execute();
  assert.equal(hidden.result.status, "confirmation-required"); assert.deepEqual(w.calls, []);
  assert.equal(w.confirmations, 1);
});

test("vraie invite sur streams fictifs : EOF/Ctrl+D refusent, Ctrl+C/signal annulent sans POST ni réservation", { timeout: 5000 }, async () => {
  for (const key of ["n\r", "\u0003", "\u0004", "eof", "signal"]) {
    const w = world(), controller = new AbortController();
    const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => input });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    output.on("data", () => {});
    w.terminal.confirm = (prompt, signal) => {
      const result = confirmPublication(prompt, signal, input, output);
      if (key === "eof") input.end();
      else if (key === "signal") controller.abort();
      else input.write(key);
      return result;
    };
    try {
      const { result } = await w.execute([], { signal: controller.signal });
      const cancelled = key === "\u0003" || key === "signal";
      assert.equal(result.status, cancelled ? "cancelled" : "declined", key);
      assert.equal(result.exitCode, cancelled ? 130 : 8, key);
      assert.equal(result.publication, "not-attempted"); assert.equal(result.attempted, false);
      assert.equal(w.posted, 0); assert.deepEqual(readdirSync(w.home), ["bilan.md"]);
      assert.equal(input.listenerCount("keypress"), 0); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    } finally { input.destroy(); output.destroy(); }
  }
  const input = new PassThrough(), output = new PassThrough(); output.on("data", () => {});
  try {
    const agreed = confirmPublication("Faux accord de test : ", undefined, input, output);
    input.write("oui\n"); assert.equal(await agreed, true);
    const cancelled = new AbortController(); cancelled.abort();
    await assert.rejects(confirmPublication("Faux accord de test : ", cancelled.signal, input, output), { name: "AbortError" });
  } finally { input.destroy(); output.destroy(); }
});

test("publication issue et PR, ouverte ou fermée : POST unique, accusé complet, trace et aucun doublon", async () => {
  for (const kind of ["issue", "pull-request"] as const) {
    const w = world(kind); w.remote.state = "closed"; w.remote.private = true;
    const extra = kind === "pull-request" ? ["--commit", w.remote.head] : [];
    const { result } = await w.execute(extra);
    assert.equal(result.status, "published", JSON.stringify(result)); assert.equal(result.publication, "published");
    assert.equal(result.preview?.public, false); assert.equal(result.attempted, true); assert.equal(w.posted, 1);
    assert.equal(w.prints[0]!.includes(result.preview!.body), true);
    assert.equal(result.commentUrl, `${w.to}#issuecomment-123`);
    const post = w.calls.find(call => call.args.includes("POST"))!;
    assert.deepEqual(post.args, ["repos/owner/repo/issues/42/comments", "--method", "POST", "--input", "-"]);
    assert.equal(JSON.parse(post.input!).body, result.preview?.body);
    const receipt = JSON.parse(readFileSync(result.receipt!.path, "utf8"));
    assert.equal(receipt.status, "published"); assert.equal(receipt.body, result.preview?.body);
    if (process.platform !== "win32") assert.equal(statSync(result.receipt!.path).mode & 0o777, 0o600);
    const repeated = await w.execute(extra);
    assert.equal(repeated.result.status, "already-published"); assert.equal(repeated.result.attempted, false);
    assert.equal(w.posted, 1); assert.equal(w.confirmations, 1);
  }
});

test("dérive après aperçu : source, tête, compte, visibilité ou état ne sont jamais remplacés silencieusement", async () => {
  for (const change of ["source", "control", "head", "account", "visibility", "state", "repository-id", "target-id", "account-id"]) {
    const w = world("pull-request");
    w.confirm(() => {
      if (change === "source") writeFileSync(w.file, "Nouveau bilan");
      if (change === "control") writeFileSync(w.file, "\u001b[31mTexte masqué");
      if (change === "head") w.remote.head = "b".repeat(40);
      if (change === "account") w.remote.publisher = "other";
      if (change === "visibility") w.remote.private = true;
      if (change === "state") w.remote.state = "closed";
      if (change === "repository-id") w.remote.repositoryId++;
      if (change === "target-id") w.remote.targetId++;
      if (change === "account-id") w.remote.publisherId++;
      return true;
    });
    const { result } = await w.execute();
    assert.equal(result.status, "changed", change); assert.equal(w.posted, 0);
    assert.deepEqual(readdirSync(w.home), ["bilan.md"]);
  }
  const w = world("pull-request");
  assert.equal((await w.execute(["--commit", "b".repeat(40)])).result.status, "changed");
  assert.equal(w.confirmations, 0); assert.equal(w.posted, 0);
});

test("incertitude après POST : réponse vide, échec réseau ou accusé étranger ne provoquent jamais de renvoi", async () => {
  for (const mode of ["throw", "empty", "wrong-url", "wrong-body", "wrong-account", "wrong-account-id", "wrong-issue", "wrong-id"]) {
    const w = world();
    w.post(body => {
      if (mode === "throw") throw new Error("network uncertain");
      if (mode === "empty") return "";
      return JSON.stringify({ id: mode === "wrong-id" ? 124 : 123, body: mode === "wrong-body" ? "other" : body,
        html_url: mode === "wrong-url" ? "https://github.com/other/repo/issues/42#issuecomment-123" : `${w.to}#issuecomment-123`,
        issue_url: mode === "wrong-issue" ? "https://api.github.com/repos/owner/repo/issues/43" : "https://api.github.com/repos/owner/repo/issues/42",
        user: { login: mode === "wrong-account" ? "other" : w.remote.publisher, id: mode === "wrong-account-id" ? 8 : w.remote.publisherId } });
    });
    const { result } = await w.execute();
    assert.equal(result.status, "uncertain", mode); assert.equal(result.publication, "unknown"); assert.equal(result.commentUrl, undefined);
    assert.equal(result.attempted, true); assert.equal(w.posted, 1);
    const repeated = await w.execute();
    assert.equal(repeated.result.status, "uncertain"); assert.equal(repeated.result.attempted, false);
    assert.equal(w.posted, 1); assert.equal(w.confirmations, 1);
    assert.equal(JSON.parse(readFileSync(result.receipt!.path, "utf8")).status, "unknown");
  }
});

test("réservation exclusive entre deux appels concurrents et conservation d'une trace corrompue", async () => {
  const w = world();
  let count = 0, release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  w.confirm(async () => { if (++count === 2) release(); await barrier; return true; });
  const results = await Promise.all([w.execute(), w.execute()]);
  assert.equal(w.posted, 1);
  assert.deepEqual(results.map(r => r.result.status).sort(), ["published", "uncertain"]);
  const receipt = results.find(r => r.result.status === "published")!.result.receipt!.path;
  writeFileSync(receipt, "corrupted");
  assert.equal((await w.execute()).result.status, "uncertain");
  assert.equal(readFileSync(receipt, "utf8"), "corrupted"); assert.equal(w.posted, 1);
});

test("annulation avant envoi, pendant POST et après accusé : la preuve de publication reste prioritaire", async () => {
  const before = world(), first = new AbortController();
  before.confirm(() => { first.abort(); return false; });
  assert.equal((await before.execute([], { signal: first.signal })).result.status, "cancelled");
  assert.equal(before.posted, 0);
  for (const confirmed of [false, true]) {
    const w = world(), controller = new AbortController();
    w.post(body => { controller.abort(); if (!confirmed) throw new Error("aborted");
      return JSON.stringify({ id: 123, body, html_url: `${w.to}#issuecomment-123`, issue_url: "https://api.github.com/repos/owner/repo/issues/42", user: { login: "human", id: 7 } }); });
    const { result } = await w.execute([], { signal: controller.signal });
    assert.equal(result.status, confirmed ? "published" : "uncertain"); assert.equal(result.cancelled, true);
    assert.equal(w.posted, 1);
  }
});

test("échec de trace : aucun POST avant réservation ; lien conservé après publication confirmée", async () => {
  const blocked = world(); writeFileSync(path.join(blocked.home, ".palabre"), "not a directory");
  const before = await blocked.execute();
  assert.ok(["uncertain", "trace-failed"].includes(before.result.status));
  assert.equal(before.result.attempted, false); assert.equal(blocked.posted, 0);
  const w = world();
  w.post(body => {
    const dir = path.join(w.home, ".palabre", "relay-publications");
    const file = path.join(dir, readdirSync(dir)[0]!); rmSync(file); mkdirSync(file);
    return JSON.stringify({ id: 123, body, html_url: `${w.to}#issuecomment-123`, issue_url: "https://api.github.com/repos/owner/repo/issues/42", user: { login: "human", id: 7 } });
  });
  const { result } = await w.execute();
  assert.equal(result.status, "published"); assert.equal(result.exitCode, 0);
  assert.equal(result.receipt?.status, "failed"); assert.equal(result.commentUrl, `${w.to}#issuecomment-123`);
  assert.equal((await w.execute()).result.status, "uncertain"); assert.equal(w.posted, 1);
});

test("requêtes et corps invalides : aucun accès GitHub ou profil", async () => {
  const w = world();
  for (const extra of [["--yes"], ["--trust-config"], ["--config", "fake"], ["--task", "review"], ["--commit", "a".repeat(40)],
    ["--participant", "Other"], ["--to", "https://github.com/o/r"], ["--dry-run", "--dry-run"], ["--unknown"], ["--message-file=x"]]) {
    assert.equal((await w.execute(extra)).result.status, "invalid-request");
  }
  for (const body of ["", " ", "bad\rline", "\u001b[31mhidden", "bad\u202etext", "x".repeat(MAX_PUBLICATION_BODY_BYTES + 1)]) {
    writeFileSync(w.file, body); assert.equal((await w.execute(["--dry-run"])).result.status, "invalid-request");
  }
  writeFileSync(w.file, Buffer.from([0xc3, 0x28]));
  assert.equal((await w.execute(["--dry-run"])).result.status, "invalid-request");
  const raw = path.join(w.home, "full.relay.md"); writeFileSync(raw, "private history");
  assert.equal((await executeRelayPublish(["--to", w.to, "--from", "codex", "--message-file", raw, "--dry-run"], { run: w.run, home: w.home })).result.status, "invalid-request");
  assert.deepEqual(w.calls, []);
});

test("CLI : routage dédié, aide, JSON unique et refus non interactif sans modèle/GitHub", () => {
  const cli = path.resolve(".tmp/test-dist/src/index.js");
  const w = world();
  const help = spawnSync(process.execPath, [cli, "relay", "publish", "--help"], { encoding: "utf8", cwd: w.home });
  assert.equal(help.status, 0); assert.ok(help.stdout.includes("relay publish")); assert.ok(help.stdout.includes("--dry-run"));
  const english = spawnSync(process.execPath, [cli, "relay", "publish", "--help", "--language", "en"], { encoding: "utf8", cwd: w.home });
  assert.equal(english.status, 0); assert.ok(english.stdout.startsWith("Usage: palabre relay publish"));
  for (const extra of [[], ["--yes"], ["--config", "invalid"]]) {
    const r = spawnSync(process.execPath, [cli, "relay", "publish", ...w.args, ...extra, "--json"], { encoding: "utf8", cwd: w.home });
    assert.equal(r.status, 8, r.stderr);
    const json = JSON.parse(r.stdout); assert.equal(json.type, "relay-publication-result");
    assert.equal(json.publication, "not-attempted"); assert.equal(json.attempted, false);
  }
  for (const prefix of [["--json"], ["--json", "--language", "en"]]) {
    const r = spawnSync(process.execPath, [cli, ...prefix, "relay", "publish", ...w.args.slice(0, -2)], { encoding: "utf8", cwd: w.home });
    const value = JSON.parse(r.stdout);
    assert.equal(value.type, "relay-publication-result"); assert.equal(value.publication, "not-attempted");
    assert.equal(value.status, "confirmation-required");
  }
  for (const option of ["--from", "--message-file", "--participant"]) {
    const r = spawnSync(process.execPath, [cli, "relay", option, "publish", "--to", "claude:44444444-4444-4444-8444-444444444444", "Q", "--json"], { encoding: "utf8", cwd: w.home });
    assert.equal(JSON.parse(r.stdout).type, "relay-result");
  }
  const ordinary = spawnSync(process.execPath, [cli, "relay", "--to", "claude:44444444-4444-4444-8444-444444444444", "publish", "--json"], { encoding: "utf8", cwd: w.home });
  assert.equal(JSON.parse(ordinary.stdout).type, "relay-result");
  assert.equal(relayPublishText("en").help.includes("--yes"), true);
});

test("trace volumineuse et modifiée après POST : relisible ou préservée, jamais écrasée pour rejouer", async () => {
  const large = world(); writeFileSync(large.file, '"'.repeat(MAX_PUBLICATION_BODY_BYTES));
  const first = await large.execute();
  assert.equal(first.result.status, "published");
  assert.ok(statSync(first.result.receipt!.path).size > 120 * 1024);
  assert.equal((await large.execute()).result.status, "already-published");
  assert.equal(large.posted, 1);
  const changed = world();
  changed.post(body => {
    const dir = path.join(changed.home, ".palabre", "relay-publications");
    writeFileSync(path.join(dir, readdirSync(dir)[0]!), "external edit");
    return JSON.stringify({ id: 123, body, html_url: `${changed.to}#issuecomment-123`, issue_url: "https://api.github.com/repos/owner/repo/issues/42", user: { login: "human", id: 7 } });
  });
  const result = (await changed.execute()).result;
  assert.equal(result.status, "published"); assert.equal(result.receipt?.status, "failed");
  assert.equal(readFileSync(result.receipt!.path, "utf8"), "external edit");
});

test("métadonnées GitHub étrangères, incomplètes, verrouillées ou archivées : aucun accord ou POST", async () => {
  for (const mode of ["repository-id", "target-id", "account-id", "repository", "url", "locked", "archived", "type", "visibility"]) {
    const w = world();
    const run: PublicationGitHubRun = async (args, input, signal) => {
      const value = JSON.parse(await w.run(args, input, signal));
      if (args[0] === "user" && mode === "account-id") delete value.id;
      if (args[0] === "repos/owner/repo") {
        if (mode === "repository-id") value.id = -1;
        if (mode === "repository") value.full_name = "other/repo";
        if (mode === "archived") value.archived = true;
        if (mode === "visibility") value.visibility = "internal";
      }
      if (args[0] === "repos/owner/repo/issues/42") {
        if (mode === "target-id") value.id = "42";
        if (mode === "url") value.html_url = "https://github.com/other/repo/issues/42";
        if (mode === "locked") value.locked = true;
        if (mode === "type") value.pull_request = {};
      }
      return JSON.stringify(value);
    };
    const { result } = await w.execute(["--dry-run"], { run });
    assert.equal(result.status, "unavailable", mode); assert.equal(w.posted, 0); assert.equal(w.confirmations, 0);
  }
});

test("transport GitHub : arguments et stdin séparés, plafonds communs, erreurs/retour forcé sans réponse partielle", async () => {
  const accepted: ExternalProcessResult = { started: true, exitCode: 0, signal: null, forcedReturn: false,
    stdout: '{"ok":true}', stderr: "", outputBytes: 11, durationMs: 1 };
  const specs: ExternalProcessSpec[] = [];
  const execute = async (spec: ExternalProcessSpec) => { specs.push(spec); return accepted; };
  const input = '{"body":"éà **texte** $(commande)"}';
  const args = ["repos/o/r/issues/1/comments", "--method", "POST", "--input", "-"];
  assert.equal(await runPublicationGitHub(args, input, undefined, { resolve: () => "fake-gh", execute }), accepted.stdout);
  assert.deepEqual(specs[0]!.args, ["api", "--hostname", "github.com", ...args]);
  assert.equal(specs[0]!.stdin, input); assert.equal(specs[0]!.maxOutputBytes, 256 * 1024);
  assert.equal(specs[0]!.timeoutMs, 60000); assert.equal(specs[0]!.killGraceMs, 1000);
  assert.equal(specs[0]!.env?.GH_PROMPT_DISABLED, "1");
  for (const failure of [{ exitCode: 1 }, { forcedReturn: true }, { started: false },
    { stopReason: "output-too-large" as const }, { stopReason: "timeout" as const }, { stopReason: "cancelled" as const }]) {
    await assert.rejects(runPublicationGitHub(args, input, undefined, { resolve: () => "fake-gh", execute: async () => ({ ...accepted, ...failure }) }));
  }
  let launched = false;
  await assert.rejects(runPublicationGitHub(args, input, undefined, { resolve: () => undefined, execute: async () => { launched = true; return accepted; } }));
  assert.equal(launched, false);
});
