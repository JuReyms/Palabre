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

test("createTranslator returns localized common errors", () => {
  assert.equal(createTranslator("fr").common.topicRequired, "Le paramètre --topic/--subject est requis.");
  assert.equal(createTranslator("en").common.topicRequired, "The --topic/--subject parameter is required.");
  assert.equal(createTranslator("en").common.errorPrefix, "Error");
  assert.match(createTranslator("en").common.optionRequiresValue("--topic"), /expects a value/);
});

test("createTranslator returns localized help text", () => {
  assert.match(createTranslator("fr").help.render("codex-claude"), /Usage rapide/);
  assert.match(createTranslator("en").help.render("codex-claude"), /Quick usage/);
  assert.match(createTranslator("en").help.render("codex-claude"), /codex-claude/);
});

test("createTranslator returns localized init messages", () => {
  assert.equal(createTranslator("fr").init.localDetectionTitle, "Détection locale:");
  assert.equal(createTranslator("en").init.localDetectionTitle, "Local detection:");
  assert.equal(createTranslator("en").init.configCreated("x.json"), "x.json created.");
});

test("createTranslator returns localized agents messages", () => {
  assert.equal(createTranslator("fr").agents.title, "Agents déclarés:");
  assert.equal(createTranslator("en").agents.title, "Declared agents:");
  assert.equal(createTranslator("en").agents.defaults("codex", "claude", 4, "claude"), "Defaults: codex <-> claude, responses: 4, summary: claude");
  assert.equal(createTranslator("en").agents.command("codex", "gpt-5.5"), "command: codex | model: gpt-5.5");
  assert.equal(createTranslator("en").agents.missingModel("gemma4:e4b"), "missing model (gemma4:e4b)");
});

test("createTranslator returns localized config messages", () => {
  assert.equal(createTranslator("fr").config.syncNoMissing("palabre.config.json"), "Aucun agent détecté manquant dans palabre.config.json.");
  assert.equal(createTranslator("en").config.syncNoMissing("palabre.config.json"), "No missing detected agent in palabre.config.json.");
  assert.equal(createTranslator("en").config.defaultsSummary("codex", "claude", 4, undefined), "agents: codex <-> claude, responses: 4, summary: agent B");
  assert.equal(createTranslator("en").config.wizardChoiceQuestion("Type the number of your choice", "1"), "Type the number of your choice (Enter = 1): ");
  assert.equal(createTranslator("en").config.wizardDefaults({ agentA: "codex", agentB: "claude", turns: 4, summaryAgent: "claude" }), "codex <-> claude, responses: 4, summary: claude");
});
