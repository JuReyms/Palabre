import test from "node:test";
import assert from "node:assert/strict";
import { AdapterError, formatAdapterError } from "../src/errors.js";
import { createTranslator } from "../src/i18n.js";

test("formatAdapterError localizes actionable hints", () => {
  const error = new AdapterError("command-not-found", "codex", "codex failed to start.");

  assert.equal(
    formatAdapterError(error, createTranslator("en")),
    "codex failed to start.\nSuggestion: Check that the CLI is installed, authenticated, and available in PATH."
  );

  assert.equal(
    formatAdapterError(error, createTranslator("fr")),
    "codex failed to start.\nSuggestion: Verifie que la CLI est installee, authentifiee et disponible dans le PATH."
  );
});
