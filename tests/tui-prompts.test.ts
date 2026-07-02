import test from "node:test";
import assert from "node:assert/strict";
import { tuiHomeInterruptInput } from "../src/renderers/tui-prompts.js";

test("first Ctrl+C from a TUI view returns home and the second quits", () => {
  assert.deepEqual(tuiHomeInterruptInput("back"), { kind: "home" });
  assert.equal(tuiHomeInterruptInput("quit"), undefined);
});