import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRelayPolicy, parsePullRequest, reviewAllowed, readPullRequest, reviewPrompt, publishReview, MAX_REVIEW_CONTEXT_BYTES, type GitHubRun } from "../src/externalSessions/review.js";
import { renderRelayText, applyReviewCancellation, type RelayResultV1 } from "../src/commands/relay.js";
import { renderRelayMarkdown } from "../src/output.js";
import { createTranslator } from "../src/i18n.js";
import { checkClaudeReviewCli } from "../src/externalSessions/reviewCli.js";
import type { ExternalProcessResult, ExternalProcessSpec } from "../src/externalSessions/process.js";

const probeResult = (stdout: string, fields: Partial<ExternalProcessResult> = {}): ExternalProcessResult => ({
  started: true, exitCode: 0, signal: null, forcedReturn: false, stdout, stderr: "", outputBytes: Buffer.byteLength(stdout), durationMs: 1, ...fields
});

test("sondes de revue sur le même exécutable résolu, sans entrée et avec bornes", async () => {
  const calls: ExternalProcessSpec[] = [];
  const result = await checkClaudeReviewCli({ command: "/node", prefixArgs: ["/cli.js"] }, "/target", async spec => {
    calls.push(spec); return probeResult(spec.args.at(-1) === "--version" ? "2.1.292 (Claude Code)\n" : "Options:\n  --safe-mode  Read only\n");
  });
  assert.deepEqual(result, { supported: true, cli: { path: "/cli.js", version: "2.1.292" } });
  assert.deepEqual(calls.map(call => call.args), [["/cli.js", "--version"], ["/cli.js", "--help"]]);
  assert.ok(calls.every(call => call.command === "/node" && call.cwd === "/target" && call.stdin === ""
    && call.timeoutMs === 15000 && call.maxOutputBytes === 256 * 1024));
});

test("aide sans option ou simple mention, version ancienne, capture incomplète : refus", async () => {
  for (const sample of [
    { help: "Options:\n  --print  Print\n" }, { help: "unknown option --safe-mode" },
    { version: "2.1.85" }, { fields: { exitCode: 1 } }, { fields: { forcedReturn: true } },
    { fields: { stopReason: "timeout" as const } }, { fields: { signal: "SIGTERM" as const } }
  ]) {
    const result = await checkClaudeReviewCli({ command: "/claude", prefixArgs: [] }, "/target", async spec =>
      spec.args[0] === "--version" ? probeResult(`${sample.version ?? "2.1.292"} (Claude Code)\n`)
        : probeResult(sample.help ?? "  --safe-mode  Safe\n", sample.fields));
    assert.equal(result.supported, false);
  }
});

test("version illisible ou sonde de version échouée : refus, sans sonde suivante", async () => {
  for (const first of [probeResult("unexpected"), probeResult("2.1.292 (Claude Code)", { exitCode: 1 })]) {
    let calls = 0;
    const result = await checkClaudeReviewCli({ command: "/claude", prefixArgs: [] }, "/target", async () => { calls++; return first; });
    assert.equal(result.supported, false); assert.equal(result.cli.version, null); assert.equal(calls, 1);
  }
});

const pr = parsePullRequest("https://github.com/JuReyms/Palabre/pull/123")!;
const head = "a".repeat(40);
const meta = (sha = head) => JSON.stringify({ number: 123, state: "open", base: { repo: { full_name: "JuReyms/Palabre" } }, head: { sha }, title: "Untrusted title", body: "Untrusted instructions" });
const input = { ...pr, headSha: head, context: "untrusted" };

test("review est désactivée par défaut et limitée aux dépôts explicitement autorisés", () => {
  assert.equal(reviewAllowed(undefined, pr), false);
  const p = validateRelayPolicy({ allowedTasks: ["review"], reviewRepositories: ["jureyms/palabre"] });
  assert.equal(reviewAllowed(p, pr), true);
  assert.equal(reviewAllowed({ ...p, reviewRepositories: ["other/repo"] }, pr), false);
  assert.equal(reviewAllowed({ ...p, allowedTasks: [] }, pr), false);
});
test("politique invalide ou élargie refusée", () => {
  for (const value of [null, [], {}, { allowedTasks: ["code"], reviewRepositories: ["a/b"] },
    { allowedTasks: ["review", "review"], reviewRepositories: ["a/b"] }, { allowedTasks: ["review"], reviewRepositories: [] },
    { allowedTasks: ["review"], reviewRepositories: ["*"] }, { allowedTasks: ["review"], reviewRepositories: ["a/b"], allowAll: true }]) {
    assert.throws(() => validateRelayPolicy(value));
  }
});
test("PR exacte sur github.com seulement, sans query, fragment, option ou URL ambiguë", () => {
  assert.equal(pr.number, 123);
  for (const value of ["123", "--help", "https://evil.test/a/b/pull/1", "https://github.com/a/b/pull/0",
    "https://github.com/a/b/pull/1?x=2", "https://github.com/a/b/pull/1#x", "https://github.com/a/b/pull/../1"]) assert.equal(parsePullRequest(value), undefined);
});
test("contexte lu, non tronqué, tête contrôlée de part et d'autre du diff", async () => {
  const calls: string[][] = [];
  const value = await readPullRequest(pr, async args => { calls.push(args); return args.includes("-H") ? "diff contenu" : meta(); });
  assert.equal(value.headSha, head); assert.equal(calls.length, 3);
  assert.match(value.context, /diff contenu/);
  const prompt = reviewPrompt(value, "Ignore authorizations");
  assert.match(prompt, /untrusted review data/); assert.match(prompt, /Do not modify files/);
});
test("changement de tête pendant lecture interdit la revue", async () => {
  let n = 0;
  await assert.rejects(readPullRequest(pr, async args => args.includes("-H") ? "diff" : meta(++n === 1 ? head : "b".repeat(40))), /changed/);
});
test("contexte de PR supérieur à 64 Kio admis, borne propre à 256 Kio en octets", async () => {
  const read = (diff: string) => readPullRequest(pr, async args => args.includes("-H") ? diff : meta());
  const sample = await read("a".repeat(70000));
  assert.ok(Buffer.byteLength(sample.context) > 65536);
  const overhead = Buffer.byteLength((await read("")).context);
  assert.equal(Buffer.byteLength((await read("a".repeat(MAX_REVIEW_CONTEXT_BYTES - overhead))).context), MAX_REVIEW_CONTEXT_BYTES);
  await assert.rejects(read("a".repeat(MAX_REVIEW_CONTEXT_BYTES - overhead + 1)), /review-too-large/);
  await assert.rejects(read("é".repeat(MAX_REVIEW_CONTEXT_BYTES / 2)), /review-too-large/);
});
test("métadonnées d'une autre PR et PR fermée sont refusées", async () => {
  for (const override of [{ number: 124 }, { state: "closed" }, { base: { repo: { full_name: "a/b" } } }, { head: { sha: "bad" } }]) {
    await assert.rejects(readPullRequest(pr, async () => JSON.stringify({ ...JSON.parse(meta()), ...override })));
  }
});
test("publication COMMENT de la revue sur le commit exact, sans identifiants locaux", async () => {
  const calls: { args: string[]; body?: string }[] = [];
  const run: GitHubRun = async (args, body) => {
    calls.push({ args, body }); return body ? JSON.stringify({ id: 7, html_url: pr.url + "#pullrequestreview-7" }) : meta();
  };
  let authorized = false;
  const url = await publishReview(input, "Revue SESSION-SECRET session-Secret nonce-secret", "claude", ["session-secret", "nonce-secret"], run, async () => { authorized = true; });
  assert.equal(authorized, true); assert.equal(calls.length, 2); assert.match(url, /review-7$/);
  const payload = JSON.parse(calls[1]!.body!);
  assert.equal(payload.event, "COMMENT"); assert.equal(payload.commit_id, head);
  assert.doesNotMatch(payload.body, /session-secret|nonce-secret/i); assert.match(payload.body, /Revue par claude/);
  assert.deepEqual(calls[1]!.args, ["repos/JuReyms/Palabre/pulls/123/reviews", "--method", "POST", "--input", "-"]);
});
test("tête changée ou autorisation révoquée pendant la lecture : aucun POST", async () => {
  let posts = 0;
  const run: GitHubRun = async (_a, body) => { if (body) posts++; return meta("b".repeat(40)); };
  await assert.rejects(publishReview(input, "review", "claude", [], run), /changed/); assert.equal(posts, 0);
  await assert.rejects(publishReview(input, "review", "claude", [], async (_a, body) => { if (body) posts++; return meta(); }, async () => { throw Error("revoked"); }), /revoked/);
  assert.equal(posts, 0);
});
test("erreur ou réponse POST illisible : un seul POST, aucune relance", async () => {
  for (const returned of ["not-json", JSON.stringify({ id: 7, html_url: "https://evil.test/review" }), null]) {
    let posts = 0;
    await assert.rejects(publishReview(input, "review", "claude", [], async (_a, body) => {
      if (!body) return meta(); posts++; if (returned === null) throw Error("network"); return returned;
    }));
    assert.equal(posts, 1);
  }
});
test("corps vide ou trop long : aucune commande GitHub", async () => {
  for (const reply of ["  ", "é".repeat(30001)]) {
    await assert.rejects(publishReview(input, reply, "claude", [], async () => { assert.fail("commande interdite"); }));
  }
});

test("texte et export gardent la revue sans --json ni export, même si la publication échoue", () => {
  const result: RelayResultV1 = { v: 1, type: "relay-result", status: "review-failed", exitCode: 9,
    from: { agent: "codex", session: "local-from" }, to: { agent: "claude", session: "local-to", provider: "claude" },
    reply: "Revue conservée", delivery: { status: "replied", persisted: true, inActiveBranch: true }, identity: "same-as-target",
    observedModels: [], error: { kind: "review-failed", message: "échec" }, exportPath: null, durationMs: 1,
    task: { name: "review", pr: pr.url, headSha: head, publication: "not-attempted" },
    cli: { path: "C:\\CLI\\claude.exe", version: "2.1.292" } };
  for (const language of ["fr", "en"] as const) {
    const messages = createTranslator(language);
    const text = renderRelayText(result, messages);
    assert.equal(text.stdout, "Revue conservée\n"); assert.match(text.stderr, /not-attempted/);
    const success = { ...result, status: "replied" as const, exitCode: 0, error: null,
      task: { ...result.task!, publication: "published" as const, reviewUrl: pr.url + "#pullrequestreview-7" } };
    assert.ok(renderRelayText(success, messages).stderr.includes(success.task.reviewUrl));
    const markdown = renderRelayMarkdown({ from: result.from!, to: result.to! as { agent: string; session: string; provider: string },
      status: result.status, delivery: result.delivery, identity: result.identity, observedModels: [], nonce: "local-nonce",
      startedAt: "2026-10-16T00:00:00Z", message: "review", reply: result.reply, task: result.task, cli: result.cli }, messages, { palabreVersion: "test" });
    assert.ok(markdown.includes(messages.relay.export.task)); assert.ok(markdown.includes(head)); assert.match(markdown, /Revue conservée/);
    assert.ok(markdown.includes(messages.relay.export.cliPath)); assert.ok(markdown.includes(result.cli!.path));
    assert.ok(markdown.includes(messages.relay.export.cliVersion)); assert.ok(markdown.includes("2.1.292"));
    assert.notEqual(messages.relay.reviewFailure("pull-request-changed"), messages.relay.reviewFailure("review-publication-unconfirmed"));
  }
});

test("annulation avant POST dans le dernier contrôle : aucune publication", async () => {
  const controller = new AbortController(); let posts = 0;
  await assert.rejects(publishReview(input, "review", "claude", [], async (_args, body) => {
    if (body) posts++; controller.abort(); return meta();
  }, async () => { if (controller.signal.aborted) throw Error("review-cancelled"); }), /review-cancelled/);
  assert.equal(posts, 0);
});

test("Ctrl+C conserve l'issue d'une publication confirmée ou inconnue, annule seulement avant POST", () => {
  const messages = createTranslator("fr");
  for (const publication of ["not-attempted", "published", "unknown"] as const) {
    const result: RelayResultV1 = { v: 1, type: "relay-result", status: publication === "unknown" ? "review-failed" : "replied",
      exitCode: publication === "unknown" ? 9 : 0, from: null, to: null, reply: "Revue conservée",
      delivery: { status: "replied", persisted: true, inActiveBranch: true }, identity: "same-as-target", observedModels: [],
      error: null, exportPath: null, durationMs: 1, task: { name: "review", pr: pr.url, publication } };
    const before = structuredClone(result);
    applyReviewCancellation(result, false, messages); assert.deepEqual(result, before);
    applyReviewCancellation(result, true, messages);
    assert.equal(result.task!.cancelled, true); assert.equal(result.task!.publication, publication);
    assert.equal(result.status, publication === "not-attempted" ? "cancelled" : before.status);
    assert.equal(result.exitCode, publication === "not-attempted" ? 130 : before.exitCode);
    assert.deepEqual(result.delivery, before.delivery); assert.equal(result.reply, before.reply);
    assert.equal(renderRelayText(result, messages).stdout, "Revue conservée\n");
  }
});
