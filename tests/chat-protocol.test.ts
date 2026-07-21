import assert from "node:assert/strict";
import test from "node:test";
import { parseChatInputLine } from "../src/chatProtocol.js";

test("structured Chat input preserves multiline messages", () => {
  assert.deepEqual(
    parseChatInputLine(JSON.stringify({ v: 1, type: "chat-send", content: "first line\nsecond line" })),
    { kind: "command", command: { v: 1, type: "chat-send", content: "first line\nsecond line" } }
  );
});

test("structured Chat input distinguishes consultation, handoff and end", () => {
  assert.deepEqual(parseChatInputLine('{"v":1,"type":"chat-consult","agent":"vibe"}'), {
    kind: "command", command: { v: 1, type: "chat-consult", agent: "vibe" }
  });
  assert.deepEqual(parseChatInputLine('{"v":1,"type":"chat-use","agent":"codex"}'), {
    kind: "command", command: { v: 1, type: "chat-use", agent: "codex" }
  });
  assert.deepEqual(parseChatInputLine('{"v":1,"type":"chat-end"}'), {
    kind: "command", command: { v: 1, type: "chat-end" }
  });
});

test("legacy Chat commands remain supported", () => {
  assert.deepEqual(parseChatInputLine("/consult vibe"), {
    kind: "command", command: { v: 1, type: "chat-consult", agent: "vibe" }
  });
  assert.deepEqual(parseChatInputLine("ordinary message"), {
    kind: "command", command: { v: 1, type: "chat-send", content: "ordinary message" }
  });
});

test("invalid structured Chat input is rejected without becoming a user message", () => {
  assert.equal(parseChatInputLine('{"v":2,"type":"chat-end"}').kind, "error");
  assert.equal(parseChatInputLine('{"v":1,"type":"chat-send","content":""}').kind, "error");
  assert.equal(parseChatInputLine("{not-json").kind, "error");
});
