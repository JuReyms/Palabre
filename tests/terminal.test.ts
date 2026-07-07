import assert from "node:assert/strict";
import test from "node:test";
import { cleanTerminalOutput, sanitizeTerminalText } from "../src/adapters/terminal.js";

test("sanitizeTerminalText removes ANSI, OSC, DCS, and unsafe controls", () => {
  const input = "before\u001b[31m red\u001b[0m\u001b]52;c;dHJhcA==\u0007\u001bPpayload\u001b\\\u001b=\u001b>\u0000after";
  assert.equal(sanitizeTerminalText(input), "before redafter");
});

test("sanitizeTerminalText preserves useful whitespace while cleanTerminalOutput trims", () => {
  assert.equal(sanitizeTerminalText("  first\r\nsecond  "), "  first\nsecond  ");
  assert.equal(cleanTerminalOutput("  first\rsecond  "), "first\nsecond");
});

test("sanitizeTerminalText drops unterminated OSC payloads", () => {
  assert.equal(sanitizeTerminalText("safe\u001b]52;c;payload"), "safe");
});
