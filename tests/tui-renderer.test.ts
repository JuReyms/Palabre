import test from "node:test";
import assert from "node:assert/strict";
import { createTuiRenderer, parseTuiOllamaUrlCommand, renderTuiAgentsHelp, renderTuiComposer, renderTuiConfig, renderTuiHelp, renderTuiHistory, renderTuiHome, renderTuiRolesHelp, renderTuiUpdate } from "../src/renderers/tui.js";
import { createTranslator } from "../src/i18n.js";
import type { DebateFailure, DebateOptions } from "../src/types.js";

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
  assert.match(text, /___/);
  assert.match(text, /DEBATE/);
  assert.match(text, /Subject: TUI test/);
  assert.match(text, /codex \(implementer\) - turn 1\/2/);
  assert.match(text, /------------------------------/);
  assert.match(text, /Hello from codex/);
  assert.match(text, /Session complete/);
  assert.match(text, /File\s+out\.debate\.md/);
  assert.match(text, /Folder\s+\./);
  assert.match(text, /Find your exports again with \/history\./);
  assert.equal(text.match(/out\.debate\.md/g)?.length, 1);
});

test("TuiRenderer keeps session header user-facing", () => {
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
  assert.match(text, /Agents: antigravity \(reviewer\) <-> codex \(implementer\)/);
  assert.match(text, /Tours: 2 \| Synthese: claude/);
  assert.doesNotMatch(text, /cli-pty|pseudo-terminal|Plan de session/);
});

test("TuiRenderer renders runtime errors as a centered card", () => {
  const output: string[] = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stderr.write;

  try {
    const renderer = createTuiRenderer(createTranslator("en"));
    const failure: DebateFailure = {
      phase: "debate",
      agent: "antigravity",
      role: "implementer",
      turn: 4,
      kind: "unknown",
      message: "antigravity cancelled by user."
    };
    renderer.error(failure);
  } finally {
    process.stderr.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /\| Error/);
  assert.match(text, /\| antigravity \(implementer, turn 4\): antigravity cancelled by user\./);
});

test("TuiRenderer renders notices as centered cards", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const renderer = createTuiRenderer(createTranslator("fr"));
    renderer.notice("Arret anticipe: Accord clair detecte apres un tour complet.");
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /\| Info: Arret anticipe: Accord clair detecte apres un tour complet\./);
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
    }, "palabre.config.json", createTranslator("en"), { version: "0.7.0", latestVersion: "0.8.0" });
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /___/);
  assert.match(text, /Orchestrate conversations between AI agents/);
  assert.match(text, /v0\.7\.0/);
  assert.match(text, /Update available: 0\.7\.0 -> 0\.8\.0\. Use \/update\./);
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
  assert.match(text, /___/);
  assert.match(text, /Commandes TUI/);
  assert.match(text, /\/ask/);
  assert.match(text, /mode Ask/);
  assert.match(text, /\/debat/);
  assert.match(text, /\/roles/);
  assert.match(text, /\/config/);
  assert.match(text, /\/retry/);
  assert.match(text, /relancer la derniere session/);
  assert.match(text, /\/history/);
  assert.match(text, /\/update/);
  assert.match(text, /\/home/);
  assert.match(text, /\/quit/);
  assert.match(text, /Tape un sujet ou une commande/);
  assert.doesNotMatch(text, /plusieurs reponses independantes/);
});

test("renderTuiUpdate renders update instructions inside the TUI", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiUpdate("PALABRE 0.7.0\n\nRecommended update:\n  pnpm add --global palabre@latest", createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /PALABRE 0\.7\.0/);
  assert.match(text, /pnpm add --global palabre@latest/);
});

test("renderTuiHistory renders recent exports", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiHistory([{
      fileName: "palabre-verifier-l-historique-2026-06-18T10-00-00-000Z.debate.md",
      path: "C:\\repo\\.palabre\\palabre-verifier-l-historique-2026-06-18T10-00-00-000Z.debate.md",
      mode: "debate",
      topic: "Verifier l'historique",
      agents: "codex <-> claude",
      date: "2026-06-18",
      count: "2/4",
      mtimeMs: 1
    }], createTranslator("fr"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Historique Palabre/);
  assert.match(text, /Mode debat/);
  assert.match(text, /Fichier/);
  assert.match(text, /Dossier/);
  assert.match(text, /Verifier l'historique/);
  assert.match(text, /codex <-> claude/);
  assert.match(text, /Tours\s+2\/4/);
  assert.match(text, /palabre-verifier-l-historique/);
  assert.match(text, /C:\\repo\\.palabre/);
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
  assert.match(text, /___/);
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
  assert.match(text, /___/);
  assert.match(text, /Orchestrez des conversations entre agents IA/);
  assert.match(text, /Agents Palabre/);
  assert.match(text, /Agents actifs/);
  assert.match(text, /codex <-> claude/);
  assert.match(text, /Agents disponibles/);
  assert.match(text, /opencode/);
  assert.match(text, /Exemple: Debat > Agents > codex claude/);
});


test("parseTuiOllamaUrlCommand parses an address and reports missing values", () => {
  const messages = createTranslator("en");

  assert.deepEqual(parseTuiOllamaUrlCommand(["/ollama-url", "gpu-box:11434"], messages), {
    kind: "ollama-url",
    url: "gpu-box:11434"
  });
  assert.deepEqual(parseTuiOllamaUrlCommand(["/ollama-url"], messages), {
    kind: "unknown",
    message: "Usage: /ollama-url <url|default>"
  });
});

test("renderTuiConfig keeps the Palabre brand header", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  const originalHost = process.env.OLLAMA_HOST;
  process.env.OLLAMA_HOST = "gpu-box:11434";
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
        opencode: { type: "cli", command: "opencode", role: "summarizer" },
        gemini: { type: "cli", command: "gemini", role: "reviewer" },
        "ollama-local": { type: "ollama", baseUrl: "http://localhost:11434", model: "llama3.2:3b", role: "critic" }
      }
    }, "palabre.config.json", "debate", createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
    if (originalHost === undefined) {
      delete process.env.OLLAMA_HOST;
    } else {
      process.env.OLLAMA_HOST = originalHost;
    }
  }

  const text = output.join("");
  assert.match(text, /___/);
  assert.match(text, /Orchestrate conversations between AI agents/);
  assert.match(text, /Palabre Configuration/);
  assert.match(text, /Active agents/);
  assert.match(text, /Agents/);
  assert.match(text, /Language/);
  assert.match(text, /\/language/);
  assert.match(text, /Available commands/);
  assert.match(text, /Ollama model/);
  assert.match(text, /llama3\.2:3b/);
  assert.match(text, /Configured Ollama address/);
  assert.match(text, /Effective Ollama address/);
  assert.match(text, /http:\/\/localhost:11434/);
  assert.match(text, /http:\/\/gpu-box:11434/);
  assert.match(text, /\/ollama/);
  assert.match(text, /\/ollama-model/);
  assert.match(text, /\/ollama-url/);
  assert.match(text, /<url\|default>/);
  assert.match(text, /\/ollama-sync/);
  assert.match(text, /Usage: \/agents <agentA> <agentB>/);
  assert.match(text, /Usage: \/roles <role\.\.\.>/);
  assert.match(text, /Usage: \/turns <turns>/);
  assert.match(text, /Usage: \/summary <agent\|none>/);
  assert.match(text, /Usage: \/ollama-model <model>/);
  assert.match(text, /Usage: \/interface <tui\|terminal>/);
  assert.match(text, /Usage: \/language <fr\|en>/);
  assert.match(text, /\/home/);
  assert.match(text, /Debate/);
  assert.match(text, /Roles\s+implementer <-> critic/);
  assert.doesNotMatch(text, /gemini/);
  assert.doesNotMatch(text, /\/default/);
  assert.doesNotMatch(text, /Current config/);
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
  assert.match(text, /Palabre/);
  assert.match(text, /Mode ask/);
  assert.doesNotMatch(text, /Sujet/);
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
  assert.match(text, /Palabre/);
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
    summaryAgent: "claude",
    earlyStopOnAgreement: true,
    plainOutput: false
  };
}
