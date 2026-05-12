import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator, parseLanguage, resolveLanguage } from "../src/i18n.js";

test("parseLanguage accepts supported languages", () => {
  assert.equal(parseLanguage("fr"), "fr");
  assert.equal(parseLanguage("EN"), "en");
});

test("parseLanguage rejects unsupported languages", () => {
  assert.throws(
    () => parseLanguage("de", "--language"),
    /--language invalide: de/
  );
});

test("resolveLanguage applies CLI, env, config, fallback precedence", () => {
  assert.equal(resolveLanguage({ explicitLanguage: "en", configLanguage: "fr", env: { PALABRE_LANGUAGE: "fr" } }), "en");
  assert.equal(resolveLanguage({ configLanguage: "fr", env: { PALABRE_LANGUAGE: "en" } }), "en");
  assert.equal(resolveLanguage({ configLanguage: "en", env: {} }), "en");
  assert.equal(resolveLanguage({ env: {} }), "fr");
});

test("createTranslator returns localized doctor messages", () => {
  assert.equal(createTranslator("fr").doctor.interfaceLanguage("fr"), "Langue interface: fr");
  assert.equal(createTranslator("en").doctor.interfaceLanguage("en"), "Interface language: en");
  assert.equal(createTranslator("en").doctor.sections.tools, "Local tools");
});
