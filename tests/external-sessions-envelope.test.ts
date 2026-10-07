/** @file Tests des références de session, du message, du nonce et de l'enveloppe du relay. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildEnvelope,
  createNonce,
  MAX_RELAY_MESSAGE_BYTES,
  parseSessionRef,
  validateRelayMessage
} from "../src/externalSessions/envelope.js";
import { relayMessages } from "../src/messages/relay.js";

const SESSION = "44444444-4444-4444-8444-444444444444";

describe("parseSessionRef", () => {
  test("accepte <agent>:<uuid> et normalise l'UUID en minuscules", () => {
    assert.deepEqual(parseSessionRef(`codex:${SESSION}`), { ok: true, value: { agent: "codex", sessionId: SESSION } });
    assert.deepEqual(parseSessionRef(`claude-opus:${SESSION.toUpperCase()}`), { ok: true, value: { agent: "claude-opus", sessionId: SESSION } });
    assert.equal(parseSessionRef(`codex-5.5:${SESSION}`).ok, true);
  });

  test("refuse un identifiant de session qui n'est pas un UUID", () => {
    for (const value of ["codex:latest", "codex:", `codex:${SESSION}x`, "codex:../../etc", `codex:${SESSION.replaceAll("-", "")}`]) {
      assert.deepEqual(parseSessionRef(value), { ok: false, reason: "invalid-session-id" }, value);
    }
  });

  test("refuse une référence sans agent ou avec un agent invalide", () => {
    for (const value of [SESSION, `:${SESSION}`, `co dex:${SESSION}`, `-codex:${SESSION}`, `co\ndex:${SESSION}`, "codex"]) {
      assert.deepEqual(parseSessionRef(value), { ok: false, reason: "invalid-arguments" }, JSON.stringify(value));
    }
  });
});

describe("validateRelayMessage", () => {
  test("refuse un message vide ou blanc", () => {
    assert.deepEqual(validateRelayMessage(""), { ok: false, reason: "invalid-arguments" });
    assert.deepEqual(validateRelayMessage(" \n\t"), { ok: false, reason: "invalid-arguments" });
  });

  test("limite en octets UTF-8, pas en caractères", () => {
    assert.equal(validateRelayMessage("a".repeat(MAX_RELAY_MESSAGE_BYTES)).ok, true);
    assert.deepEqual(validateRelayMessage("a".repeat(MAX_RELAY_MESSAGE_BYTES + 1)), { ok: false, reason: "message-too-large" });
    // « é » occupe deux octets.
    assert.deepEqual(validateRelayMessage("é".repeat(MAX_RELAY_MESSAGE_BYTES / 2 + 1)), { ok: false, reason: "message-too-large" });
  });

  test("renvoie le message inchangé", () => {
    assert.deepEqual(validateRelayMessage("  Bonjour\n"), { ok: true, value: "  Bonjour\n" });
  });
});

describe("nonce et enveloppe", () => {
  test("nonce à usage unique, alphabet stable en JSON", () => {
    const nonces = new Set(Array.from({ length: 200 }, () => createNonce()));
    assert.equal(nonces.size, 200);
    for (const nonce of nonces) {
      assert.match(nonce, /^PR-[0-9a-f]{16}$/);
      assert.equal(JSON.stringify(nonce), `"${nonce}"`);
    }
  });

  test("l'enveloppe porte le nonce, l'expéditeur et la consigne, puis le message inchangé", () => {
    const from = { agent: "codex", sessionId: SESSION };
    for (const language of ["fr", "en"] as const) {
      const messages = relayMessages[language];
      const envelope = buildEnvelope({ from, nonce: "PR-0123456789abcdef", message: "Ligne 1\nLigne 2" }, messages);
      const lines = envelope.split("\n");
      assert.equal(lines[0], messages.envelopeHeader("PR-0123456789abcdef"));
      assert.equal(lines[1], messages.envelopeFrom("codex", SESSION));
      assert.equal(lines[2], messages.envelopeReplyHint);
      assert.equal(lines[3], "");
      assert.ok(envelope.endsWith("\n\nLigne 1\nLigne 2"));
      assert.ok(envelope.includes("PR-0123456789abcdef"));
    }
  });
});
