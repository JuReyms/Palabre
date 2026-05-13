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
  assert.equal(createTranslator("fr").common.topicRequired, "Le paramètre --subject est requis.");
  assert.equal(createTranslator("en").common.topicRequired, "The --subject parameter is required.");
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

test("createTranslator returns localized presets messages", () => {
  assert.equal(createTranslator("fr").presets.title, "Presets disponibles:");
  assert.equal(createTranslator("en").presets.title, "Available presets:");
  assert.equal(createTranslator("en").presets.unavailable("command not detected for opencode: opencode"), "unavailable (command not detected for opencode: opencode)");
  assert.equal(createTranslator("en").presets.missingOllamaModel("ollama-local", "gemma4:e4b"), "missing Ollama model for ollama-local: gemma4:e4b");
  assert.equal(createTranslator("en").presets.total(20), "Total: 20 preset(s). Use --json for machine-readable output.");
});

test("createTranslator returns localized update messages", () => {
  assert.equal(createTranslator("fr").update.upToDate, "PALABRE est a jour.");
  assert.equal(createTranslator("en").update.upToDate, "PALABRE is up to date.");
  assert.equal(createTranslator("en").update.stepFailed("pnpm", "build", "1"), "pnpm build failed with exit code 1.");
  assert.match(
    createTranslator("en").update.instructions({ version: "0.4.0", projectRoot: "C:\\repo\\Palabre", sourceCheckout: true }),
    /Source repository installation detected/
  );
  assert.match(
    createTranslator("en").update.instructions({ version: "0.4.0", projectRoot: "C:\\repo\\Palabre", sourceCheckout: false }),
    /Package installation detected/
  );
});

test("createTranslator returns localized preview messages", () => {
  assert.equal(createTranslator("fr").preview.title, "# Aperçu du prompt");
  assert.equal(createTranslator("en").preview.title, "# Prompt preview");
  assert.equal(createTranslator("en").preview.pullModels(true), "Pull missing Ollama models: yes");
  assert.equal(createTranslator("en").preview.summary(createTranslator("en").preview.disabled), "Summary: disabled");
  assert.match(createTranslator("en").preview.note, /first-turn prompts/);
});

test("createTranslator returns localized new wizard messages", () => {
  assert.equal(createTranslator("fr").new.title, "PALABRE - ASSISTANT DE CONFIGURATION");
  assert.equal(createTranslator("en").new.title, "PALABRE - SETUP ASSISTANT");
  assert.equal(createTranslator("en").new.detectedCli("reviewer"), "cli/reviewer detected");
  assert.equal(createTranslator("en").new.modelFor("codex"), "Model for codex (optional)");
  assert.equal(createTranslator("en").new.yesNoSuffix(false), "y/N");
  assert.equal(createTranslator("en").new.cancelled, "Debate creation cancelled.");
});

test("createTranslator returns localized console renderer messages", () => {
  assert.equal(createTranslator("fr").renderers.subject("Sujet test"), "Sujet: Sujet test");
  assert.equal(createTranslator("en").renderers.subject("Test subject"), "Subject: Test subject");
  assert.equal(createTranslator("en").renderers.responsesSummaryContext(4, "claude", "no injected files"), "Responses: 4 | Summary: claude | Context: no injected files");
  assert.equal(createTranslator("en").renderers.options(true, false), "Options: early stop enabled, Ollama auto-pull disabled");
  assert.equal(createTranslator("en").renderers.exported("out.md"), "Debate exported: out.md");
});

test("createTranslator returns localized context messages", () => {
  assert.equal(createTranslator("fr").context.explicitMustBeFile("src"), "Le contexte fichier doit pointer vers un fichier: src");
  assert.equal(createTranslator("en").context.explicitMustBeFile("src"), "File context must point to a file: src");
  assert.equal(createTranslator("en").context.ignoredNonTextExtension("image.png"), "Context ignored (non-text extension): image.png");
  assert.equal(createTranslator("en").context.explicitTotalTooLarge(200, 100), "Context files too large (200 bytes, max 100)");
});

test("createTranslator returns localized limits messages", () => {
  assert.equal(createTranslator("fr").limits.mustBeInteger("--turns", 20), "--turns doit être un nombre entier entre 1 et 20.");
  assert.equal(createTranslator("en").limits.mustBeInteger("--turns", 20), "--turns must be an integer between 1 and 20.");
  assert.equal(createTranslator("en").limits.expectsInteger("--turns", 20), "--turns expects an integer between 1 and 20.");
  assert.equal(createTranslator("en").limits.mustBeProvidedOnce("--turns"), "--turns must be provided only once.");
});

test("createTranslator returns localized orchestrator messages", () => {
  assert.equal(createTranslator("fr").orchestrator.earlyStop("Accord clair detecte apres un tour complet."), "Arret anticipe: Accord clair detecte apres un tour complet.");
  assert.equal(createTranslator("en").orchestrator.agreementStopReason, "Clear agreement detected after a complete round.");
  assert.equal(createTranslator("en").orchestrator.earlyStop("done"), "Early stop: done");
  assert.equal(createTranslator("en").orchestrator.ollamaNoContext("ollama-local"), "ollama-local cannot read the filesystem. Add --files or --context to provide project context.");
  assert.equal(createTranslator("en").orchestrator.unknownSummaryAgent("ghost"), "Unknown summary agent: ghost");
});

test("createTranslator returns localized output messages", () => {
  assert.equal(createTranslator("fr").output.contextTitle, "## Contexte");
  assert.equal(createTranslator("en").output.contextTitle, "## Context");
  assert.equal(createTranslator("en").output.fields.requestedTurns, "Requested turns");
  assert.equal(createTranslator("en").output.summaryDisabled, "_Summary disabled._");
});
