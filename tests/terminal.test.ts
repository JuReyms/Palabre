import assert from "node:assert/strict";
import test from "node:test";
import { cleanPtyOutput, cleanTerminalOutput, sanitizeTerminalText } from "../src/adapters/terminal.js";

test("sanitizeTerminalText removes ANSI, OSC, DCS, and unsafe controls", () => {
  const input = "before\u001b[31m red\u001b[0m\u001b]52;c;dHJhcA==\u0007\u001bPpayload\u001b\\\u001b=\u001b>\u0000after";
  assert.equal(sanitizeTerminalText(input), "before redafter");
});

test("sanitizeTerminalText preserves useful whitespace while cleanTerminalOutput trims", () => {
  assert.equal(sanitizeTerminalText("  first\r\nsecond  "), "  first\nsecond  ");
  assert.equal(cleanTerminalOutput("  first\rsecond  "), "first\nsecond");
});

test("sanitizeTerminalText preserves C1 NEL line breaks from pseudo-terminals", () => {
  const output = "### Consensus\u0085Une conclusion.\u0085\u0085### Actions proposees";

  assert.equal(
    sanitizeTerminalText(output),
    "### Consensus\nUne conclusion.\n\n### Actions proposees"
  );
});

test("cleanPtyOutput restores Markdown headings concatenated after punctuation", () => {
  assert.equal(
    cleanPtyOutput("### Consensus\nTexte.### Actions proposees\n- Action."),
    "### Consensus\nTexte.\n\n### Actions proposees\n- Action."
  );
});

test("sanitizeTerminalText drops unterminated OSC payloads", () => {
  assert.equal(sanitizeTerminalText("safe\u001b]52;c;payload"), "safe");
});
