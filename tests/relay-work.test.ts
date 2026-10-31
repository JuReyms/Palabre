/** @file Contexte Relay : validation locale, attribution déclarative, traces FR/EN et réponse brute. */
import assert from "node:assert/strict";
import test from "node:test";
import { parseRelayGitHub, validRelayParticipant } from "../src/externalSessions/relayWork.js";
import { buildEnvelope, buildOpenEnvelope } from "../src/externalSessions/envelope.js";
import { createTranslator } from "../src/i18n.js";
import { renderRelayMarkdown } from "../src/output.js";
import { parseRecentRelayHeader } from "../src/relayRecent.js";
import { findFirstPositionalIndex } from "../src/args.js";

test("rattachement explicite : dépôt, issue ou PR ; URL sans autre destination ou données cachées", () => {
  for (const [suffix, kind, number] of [["", "repository", undefined], ["/issues/12", "issue", 12], ["/pull/34", "pull-request", 34]] as const) {
    assert.deepEqual(parseRelayGitHub(`https://github.com/owner/repo${suffix}/`), {
      url: `https://github.com/owner/repo${suffix}`, repository: "owner/repo", kind, ...(number ? { number } : {})
    });
  }
  for (const url of ["", "owner/repo#1", "http://github.com/o/r", "https://github.com.evil/o/r", "https://user@github.com/o/r",
    "https://github.com/o/r?token=secret", "https://github.com/o/r#x", "https://github.com/o/../r", "https://github.com/o/%72",
    "https://github.com/o/r/issues/01", "https://github.com/o/r/pull/0", "https://github.com/o/r/issues/10000000000", "https://github.com/o/r\n"]) {
    assert.equal(parseRelayGitHub(url), undefined, url);
  }
  assert.equal(findFirstPositionalIndex(["--participant", "relay", "--github", "https://github.com/o/r", "relay", "Q"]), 4);
});

test("participant : nom court, pas de contrôle ou formatage invisible", () => {
  assert.ok(validRelayParticipant("Atlas · relecture"));
  assert.ok(validRelayParticipant("é".repeat(64)));
  for (const value of ["", " ", " Atlas", "Atlas ", "x\ny", "x\u202ey", "x\u2028y", "x".repeat(65)]) assert.equal(validRelayParticipant(value), false);
});

test("contexte transmis et exporté sans changer le verdict ou réécrire la réponse", () => {
  const work = { github: parseRelayGitHub("https://github.com/owner/repo/pull/34")!, participant: "Atlas | **revue**" };
  const input = { from: { agent: "claude" }, to: { agent: "codex" }, nonce: "PR-test", message: "Relis src/example.ts", work };
  for (const language of ["fr", "en"] as const) {
    const messages = createTranslator(language);
    for (const build of [buildEnvelope, buildOpenEnvelope]) {
      const text = build(input, messages.relay);
      assert.ok(text.includes(work.github.url));
      assert.ok(text.includes("Atlas | \\*\\*revue\\*\\* (codex)"));
      assert.ok(text.includes(messages.relay.work.notice));
      assert.ok(text.includes(messages.relay.work.replyFormat));
      assert.equal(build({ ...input, replyFormat: false }, messages.relay).includes(messages.relay.work.replyFormat), false);
      assert.equal(build({ ...input, work: undefined }, messages.relay).includes(work.github.url), false);
      assert.equal(build({ ...input, work: undefined, header: { kind: "mission", id: "x", step: 1 } }, messages.relay).includes(messages.relay.work.replyFormat), false);
    }
    const report = { from: null, to: { agent: "codex", session: "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee", provider: "codex" },
      status: "replied", delivery: { status: "replied", persisted: true as const, inActiveBranch: true as const },
      identity: "same-as-target", observedModels: [], nonce: "PR-test", startedAt: "2026-10-31T10:00:00.000Z",
      message: input.message, reply: "Travail non réalisé : décision nécessaire.", work };
    const markdown = renderRelayMarkdown(report, messages, { palabreVersion: "test" });
    assert.deepEqual(parseRecentRelayHeader(markdown, "example.relay.md")?.work, work);
    assert.ok(markdown.includes(report.reply));
    assert.equal(parseRecentRelayHeader(markdown.replace(work.github.url, "https://evil.invalid/o/r"), "x.relay.md"), undefined);
    const plain = renderRelayMarkdown({ ...report, work: undefined }, messages, { palabreVersion: "test" });
    assert.equal(parseRecentRelayHeader(plain, "plain.relay.md")?.work, undefined);
  }
});
