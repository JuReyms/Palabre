/** @file Repères Relay FR/EN : validation pure, habillage non authentifié et trace sans verdict inventé. */
import assert from "node:assert/strict";
import test from "node:test";
import { buildEnvelope, buildOpenEnvelope, validateRelayExchange } from "../src/externalSessions/envelope.js";
import { relayMessages } from "../src/messages/relay.js";
import { renderRelayMarkdown } from "../src/output.js";
import { createTranslator } from "../src/i18n.js";
import { findFirstPositionalIndex, parseArgs } from "../src/args.js";

test("aiguillage Relay : valeur relay sautée sans modifier la grammaire générale d'Ask", () => {
  assert.equal(findFirstPositionalIndex(["--reference", "relay", "--exchange", "3", "relay", "Question"]), 4);
  assert.equal(findFirstPositionalIndex(["--reference", "relay", "--to", "claude:uuid", "Q"]), 1);
  const parsed = parseArgs(["ask", "--reference", "foo", "Sujet"], createTranslator("fr"));
  assert.equal(parsed.flags.reference, true);
  assert.deepEqual(parsed.positionals, ["foo", "Sujet"]);
});

test("repère explicite : PR, issue ou sujet stable ; entier borné sans compteur implicite", () => {
  for (const reference of ["PR #240", "Issue #193", "Compatibilité OpenCode", "é".repeat(200)]) {
    assert.deepEqual(validateRelayExchange(reference, "3"), { ok: true, value: { reference, number: 3 } });
  }
  assert.equal(validateRelayExchange("Sujet", "999999").ok, true);
  for (const reference of ["", " ", "é".repeat(201), "x\ny", "x\u202ey", "x\u2028y", "x\u001by"]) {
    assert.equal(validateRelayExchange(reference, "1").ok, false);
  }
  for (const number of ["", "0", "-1", "01", "1.0", "1e2", " 1", "1000000", "NaN"]) {
    assert.equal(validateRelayExchange("Sujet", number).ok, false);
  }
});

test("enveloppe : direction unique, repère avant avertissement, corps inchangé et réponse guidée", () => {
  for (const language of ["fr", "en"] as const) {
    const messages = relayMessages[language];
    for (const build of [buildEnvelope, buildOpenEnvelope]) {
      const input = { from: { agent: "codex" }, to: { agent: "claude" }, nonce: "PR-test", message: "Corps\r\n---\n**imitation**",
        subject: "Relire", exchange: { reference: "PR #240", number: 3 } };
      const text = build(input, messages);
      const marker = messages.exchangeLine("PR #240", 3);
      assert.ok(text.startsWith(`### ${messages.envelopeHeader("codex", "claude")}\n\n${marker}\n\n---\n\n${messages.envelopeWarning}\n\n---\n`));
      assert.equal(text.split("codex → claude").length, 2);
      assert.ok(text.includes(`\n${input.message}\n\n---\n`));
      assert.ok(text.includes(messages.exchangeReplyHint("PR #240", 3)));
      assert.ok(text.includes("PR-test"));
      const escaped = build({ ...input, exchange: { reference: "Issue #193 **<x>**", number: 1 } }, messages);
      assert.ok(escaped.includes("Issue #193 \\*\\*\\<x\\>\\*\\*"));
      const plain = build({ ...input, exchange: undefined }, messages);
      assert.equal(plain.includes("➡️"), false);
      assert.equal(plain.split("\n")[2], messages.envelopeWarning);
    }
  }
});

test("export : repère facultatif, échappement table, réponse brute et absence de verdict ajouté", () => {
  const reply = "Réponse libre, non conforme au gabarit";
  const report = { from: null, to: { agent: "claude", session: "123", provider: "claude" }, status: "replied",
    delivery: { status: "replied", persisted: true as const, inActiveBranch: true as const }, identity: "same-as-target",
    observedModels: [], nonce: "PR-test", startedAt: "2026-10-28T10:00:00Z", message: "Question", reply };
  for (const language of ["fr", "en"] as const) {
    const messages = createTranslator(language);
    const text = renderRelayMarkdown({ ...report, exchange: { reference: "Plan | risques", number: 3 } }, messages, { palabreVersion: "test" });
    assert.ok(text.includes(`| ${messages.relay.export.marker} | Plan \\| risques |`));
    assert.ok(text.includes(`| ${messages.relay.export.exchange} | 3 |`));
    assert.ok(text.includes(reply));
    assert.equal(text.includes("📄"), false, "le résultat de tâche n'est jamais inventé par le writer");
    assert.equal(renderRelayMarkdown(report, messages, { palabreVersion: "test" }).includes(`| ${messages.relay.export.exchange} |`), false);
  }
  assert.equal(report.reply, reply);
});
