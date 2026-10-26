/** @file Trace exacte #210 : bloc Markdown fidèle et notices sans promesse de réception. */
import assert from "node:assert/strict";
import test from "node:test";
import { renderRelayText, type RelayResultV1 } from "../src/commands/relay.js";
import { createTranslator } from "../src/i18n.js";
import { renderRelayMarkdown, type RelayExport } from "../src/output.js";

const report: RelayExport = {
  from: null, to: { agent: "claude", session: "123", provider: "claude" }, status: "timeout",
  delivery: { status: "unknown", persisted: "unknown", inActiveBranch: "unknown" }, identity: null,
  observedModels: [], nonce: "PR-test", startedAt: "2026-10-26T10:00:00.000Z", message: "**Objet :** éà"
};

test("export exact FR/EN : CRLF, Unicode, :**, fences et faux titres ne sont pas réécrits", () => {
  const envelope = "### 📧 PALABRE Relay\n\n**Objet :** éàœ\r\n\x60\x60\x60\x60text\r\n## Message Relay complet (enveloppe comprise)\r\n\x60\x60\x60\x60\nfin";
  for (const language of ["fr", "en"] as const) {
    const messages = createTranslator(language);
    const markdown = renderRelayMarkdown({ ...report, envelope, reply: "\x60\x60\x60text\nbloc non fermé" }, messages, { palabreVersion: "test" });
    assert.ok(markdown.includes(`\n\x60\x60\x60\x60\x60text\n${envelope}\n\x60\x60\x60\x60\x60\n`));
    assert.ok(markdown.indexOf(`## ${messages.relay.messageCopy.heading}`) < markdown.indexOf(`## ${messages.relay.export.message}\n`));
    assert.ok(markdown.includes(`## ${messages.relay.messageCopy.heading}\n`));
    assert.ok(markdown.includes(messages.relay.messageCopy.notice));
    assert.ok(markdown.includes("**Objet &#58;** éà"), "le rendu historique du corps reste inchangé");
    const legacy = renderRelayMarkdown(report, messages, { palabreVersion: "test" });
    assert.equal(legacy.includes(messages.relay.messageCopy.heading), false, "pas d'enveloppe reconstruite pour un ancien résultat ou un suivi");
  }
});

test("notices privées FR/EN : copie sauvée, désactivée, échec ; stdout et JSON inchangés", () => {
  const result: RelayResultV1 = {
    v: 1, type: "relay-result", status: "timeout", exitCode: 4, mode: "background", from: null,
    to: null, delivery: { status: "unknown", persisted: "unknown", inActiveBranch: "unknown" }, identity: null,
    observedModels: [], error: null, exportPath: null, durationMs: 0
  };
  const before = JSON.stringify(result);
  for (const language of ["fr", "en"] as const) {
    const messages = createTranslator(language);
    for (const messageCopy of ["disabled", "failed"] as const) {
      const rendered = renderRelayText(result, messages, { messageCopy });
      assert.equal(rendered.stdout, "");
      assert.ok(rendered.stderr.includes(messages.relay.messageCopy[messageCopy]));
      assert.equal(rendered.stderr.includes(messages.relay.messageCopy.heading), false);
    }
    assert.equal(renderRelayText(result, messages).stderr.includes(messages.relay.messageCopy.disabled), false);
    const saved = renderRelayText({ ...result, subject: "éà\u001b[31m", exportPath: "local/export.relay.md" }, messages, { messageCopy: "saved" });
    assert.match(saved.stderr, /local\/export.relay.md/);
    assert.equal(saved.stderr.includes("\u001b"), false);
    assert.equal(saved.stdout, "");
  }
  assert.equal(JSON.stringify(result), before);
});
