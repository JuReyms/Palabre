import test from "node:test";
import assert from "node:assert/strict";
import { createTuiRenderer, renderTuiAgentsHelp, renderTuiComposer, renderTuiConfig, renderTuiHelp, renderTuiHome, renderTuiRolesHelp } from "../src/renderers/tui.js";
import { createTranslator } from "../src/i18n.js";
import type { DebateOptions } from "../src/types.js";

test("TuiRenderer renders a lightweight terminal dashboard", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const renderer = createTuiRenderer(createTranslator("en"));
    renderer.start(baseOptions());
    renderer.turnStart(1, 2, "codex", "implementer");
    renderer.message("Hello from codex");
    renderer.done("out.debate.md");
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /PALABRE/);
  assert.match(text, /Subject: TUI test/);
  assert.match(text, /codex \(implementer\) - turn 1\/2/);
  assert.match(text, /------------------------------/);
  assert.match(text, /Hello from codex/);
  assert.match(text, /Session complete/);
  assert.match(text, /Markdown export/);
  assert.match(text, /Palabre exported: out\.debate\.md/);
  assert.equal(text.match(/out\.debate\.md/g)?.length, 1);
});

test("TuiRenderer warns when a PTY agent may open a terminal window", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const renderer = createTuiRenderer(createTranslator("fr"));
    renderer.start(baseOptions(), [
      { name: "antigravity", role: "reviewer", type: "cli-pty" },
      { name: "codex", role: "implementer", type: "cli" }
    ]);
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /pseudo-terminal/);
  assert.match(text, /fenetre peut apparaitre brievement/);
});

test("renderTuiHome renders a Palabre launch screen", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiHome({
      language: "en",
      defaults: {
        mode: "ask",
        agentA: "codex",
        agentB: "claude",
        askAgents: ["codex", "claude", "opencode"],
        askSummaryAgent: "opencode",
        turns: 2
      },
      agents: {
        codex: { type: "cli", command: "codex", role: "architect" },
        claude: { type: "cli", command: "claude", role: "critic" },
        opencode: { type: "cli", command: "opencode", role: "implementer" }
      }
    }, "palabre.config.json", createTranslator("en"), { version: "0.7.0" });
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /___/);
  assert.match(text, /Orchestrate conversations between AI agents/);
  assert.match(text, /v0\.7\.0/);
  assert.match(text, /Folder /);
  assert.match(text, /https:\/\/palab\.re\/en/);
  assert.match(text, /\/help/);
  assert.match(text, /\/roles/);
  assert.match(text, /\/debat/);
  assert.match(text, /\/config/);
  assert.match(text, /Roles/);
  assert.match(text, /architect, critic, implementer/);
  assert.doesNotMatch(text, /\/new/);
  assert.doesNotMatch(text, /Session/);
  assert.doesNotMatch(text, /Composer/);
  assert.doesNotMatch(text, /Invite/);
  assert.doesNotMatch(text, /Config\s+palabre\.config\.json/);
  assert.doesNotMatch(text, /palabre new/);
  assert.match(text, /opencode/);
});

test("renderTuiHelp renders slash commands", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiHelp(createTranslator("fr"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Commandes TUI/);
  assert.match(text, /\/ask/);
  assert.match(text, /\/debat/);
  assert.match(text, /\/roles/);
  assert.match(text, /\/config/);
  assert.match(text, /\/quit/);
});

test("renderTuiRolesHelp renders available roles", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiRolesHelp("debate", createTranslator("fr"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Roles Palabre/);
  assert.match(text, /implementer/);
  assert.match(text, /critic/);
  assert.match(text, /Exemple: Debat > Roles > implementer critic/);
});

test("renderTuiAgentsHelp renders configured agents", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiAgentsHelp({
      language: "en",
      defaults: {
        mode: "debate",
        agentA: "codex",
        agentB: "claude",
        turns: 2
      },
      agents: {
        codex: { type: "cli", command: "codex", role: "implementer" },
        claude: { type: "cli", command: "claude", role: "critic" },
        opencode: { type: "cli", command: "opencode", role: "reviewer" }
      }
    }, "debate", createTranslator("fr"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Agents Palabre/);
  assert.match(text, /Agents actifs/);
  assert.match(text, /codex <-> claude/);
  assert.match(text, /Agents disponibles/);
  assert.match(text, /opencode/);
  assert.match(text, /Exemple: Debat > Agents > codex claude/);
});

test("renderTuiConfig keeps the Palabre brand header", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiConfig({
      language: "en",
      defaults: {
        mode: "debate",
        agentA: "codex",
        agentB: "claude",
        summaryAgent: "opencode",
        turns: 2
      },
      agents: {
        codex: { type: "cli", command: "codex", role: "implementer" },
        claude: { type: "cli", command: "claude", role: "critic" },
        opencode: { type: "cli", command: "opencode", role: "summarizer" }
      }
    }, "palabre.config.json", "debate", createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /___/);
  assert.match(text, /Orchestrate conversations between AI agents/);
  assert.match(text, /Palabre Configuration/);
  assert.match(text, /Active agents/);
  assert.match(text, /Agents/);
  assert.match(text, /Language/);
  assert.match(text, /\/language/);
  assert.match(text, /Current config/);
  assert.match(text, /Available commands/);
  assert.match(text, /\/back/);
  assert.match(text, /Debate/);
  assert.doesNotMatch(text, /Langue/);
  assert.doesNotMatch(text, /Commandes disponibles/);
});

test("renderTuiComposer renders a framed subject input hint", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiComposer("ask", createTranslator("fr"), "Sujet", { force: true });
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Mode ask/);
  assert.match(text, /Sujet/);
  assert.doesNotMatch(text, /Ecris ton sujet/);
  assert.doesNotMatch(text, /\/config/);
});

test("renderTuiComposer renders config commands in config mode", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiComposer("debate", createTranslator("fr"), "Config", { force: true });
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Mode debat/);
  assert.match(text, /Config/);
  assert.doesNotMatch(text, /commande de configuration/);
  assert.doesNotMatch(text, /\/agents/);
  assert.doesNotMatch(text, /\/back/);
});

function baseOptions(): DebateOptions {
  return {
    mode: "debate",
    language: "en",
    topic: "TUI test",
    agentA: "codex",
    agentB: "claude",
    turns: 2,
    session: {
      startedAt: "2026-06-15T00:00:00.000Z",
      localDate: "2026-06-15",
      timeZone: "Europe/Paris",
      cwd: "C:\\repo"
    },
    files: [],
    pullModels: false,
    summaryEnabled: true,
    earlyStopOnAgreement: true,
    plainOutput: false
  };
}
