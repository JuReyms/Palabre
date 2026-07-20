import assert from "node:assert/strict";
import test from "node:test";
import { resolveInvocationContext } from "../src/session.js";

test("invocation metadata defaults to the direct CLI", () => {
  assert.deepEqual(resolveInvocationContext({}), { client: "direct-cli" });
});

test("invocation metadata accepts future clients without a hard-coded registry", () => {
  assert.deepEqual(resolveInvocationContext({
    PALABRE_CLIENT: "palabre-vscode",
    PALABRE_CLIENT_VERSION: "1.7.1"
  }), {
    client: "palabre-vscode",
    clientVersion: "1.7.1"
  });

  assert.deepEqual(resolveInvocationContext({
    PALABRE_CLIENT: "future-integration",
    PALABRE_CLIENT_VERSION: "2027.4-beta"
  }), {
    client: "future-integration",
    clientVersion: "2027.4-beta"
  });
});

test("invocation metadata is bounded and ignores orphan client versions", () => {
  assert.deepEqual(resolveInvocationContext({ PALABRE_CLIENT_VERSION: "1.0.0" }), { client: "direct-cli" });
  assert.deepEqual(resolveInvocationContext({ PALABRE_CLIENT: "\u001bclient\nname" }), { client: "clientname" });
  assert.equal(resolveInvocationContext({ PALABRE_CLIENT: "x".repeat(200) }).client.length, 128);
});
