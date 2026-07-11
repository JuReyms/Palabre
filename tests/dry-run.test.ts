import test from "node:test";
import assert from "node:assert/strict";
import { buildDryRunPreview } from "../src/dryRun.js";
import type { DebateOptions, PalabreConfig } from "../src/types.js";

const config: PalabreConfig = {
  agents: {
    codex: { type: "cli", command: "codex", role: "implementer" },
    claude: { type: "cli", command: "claude", role: "reviewer" }
  }
};

const options: DebateOptions = {
  mode: "debate", language: "en", topic: "Review", agentA: "codex", agentB: "claude", turns: 3,
  session: { startedAt: "2026-07-12T00:00:00.000Z", localDate: "2026-07-12", timeZone: "UTC", cwd: "C:\\work" },
  files: [], pullModels: false, summaryAgent: "claude", summaryEnabled: true, earlyStopOnAgreement: true, plainOutput: false
};

test("dry-run preview exposes resolved session metadata without runtime work", () => {
  const preview = buildDryRunPreview(config, "palabre.config.json", true, options, ["ignored file"], ".palabre");
  assert.equal(preview.type, "dry-run");
  assert.equal(preview.configTrusted, true);
  assert.deepEqual(preview.agents.map((agent) => agent.name), ["codex", "claude"]);
  assert.equal(preview.limits.requestedResponses, 3);
  assert.deepEqual(preview.context.warnings, ["ignored file"]);
});