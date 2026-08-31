/** @file Tests du renderer, des écrans, prompts et glyphes de repli du TUI. */
import test from "node:test";
import assert from "node:assert/strict";
import { createTuiRenderer, parseComposerTopic, parseTuiOllamaUrlCommand, renderTuiAgentsHelp, renderTuiComposer, renderTuiConfig, renderTuiHelp, renderTuiHistory, renderTuiHome, renderTuiRolesHelp, renderTuiUpdate } from "../src/renderers/tui.js";
import { createTranslator } from "../src/i18n.js";
import { packItems } from "../src/renderers/tui-theme.js";
import type { DebateFailure, DebateOptions } from "../src/types.js";
import type { UpdateInfo } from "../src/update.js";

// Force le repli ASCII des glyphes pour des assertions stables quel que soit le terminal.
process.env.PALABRE_ASCII = "1";

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
  assert.match(text, /Palabre Debate/);
  assert.doesNotMatch(text, /___/);
  assert.match(text, /DEBATE/);
  assert.match(text, /Subject: TUI test/);
  assert.match(text, /codex \(implementer\) - turn 1\/2/);
  assert.match(text, /------------------------------/);
  assert.match(text, /Hello from codex/);
  assert.match(text, /Session complete/);
  assert.match(text, /v Session complete/);
  assert.doesNotMatch(text, /√/);
  assert.match(text, /Folder: C:\\repo/);
  assert.match(text, /Exported file\s+out\.debate\.md/);
  assert.match(text, /Export folder\s+\./);
  assert.match(text, /\/retry\s+rerun the last session/);
  assert.match(text, /\/new\s+guided assistant/);
  assert.match(text, /\/ask\s+change mode/);
  assert.match(text, /\/history\s+show recent exports/);
  assert.match(text, /\/config\s+settings/);
  assert.match(text, /\/help\s+help/);
  assert.equal(text.match(/out\.debate\.md/g)?.length, 1);
});

test("TuiRenderer strips terminal controls from topics, agent names, and messages", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const renderer = createTuiRenderer(createTranslator("en"));
    renderer.start({ ...baseOptions(), topic: "\u001b]52;c;topic-payload\u0007Safe topic" });
    renderer.turnStart(1, 2, "\u001b[31magent\u001b[0m", "reviewer");
    renderer.message("\u001b]52;c;clipboard-payload\u0007Safe\u001b[31m red\u001b[0m");
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Safe topic/);
  assert.match(text, /agent \(reviewer\)/);
  assert.match(text, /Safe red/);
  assert.doesNotMatch(text, /topic-payload|clipboard-payload/);
  assert.doesNotMatch(text, /\u001b\]52/);
});

test("TuiRenderer offers the opposite mode after an Ask session", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const renderer = createTuiRenderer(createTranslator("fr"));
    renderer.start({ ...baseOptions(), mode: "ask" });
    renderer.done("out.ask.md");
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.match(output.join(""), /\/debat\s+changer de mode/);
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
  assert.match(text, /\| x Error/);
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
        summaryAgent: "ollama-local",
        turns: 2
      },
      agents: {
        codex: { type: "cli", command: "codex", role: "architect" },
        claude: { type: "cli", command: "claude", role: "critic" },
        opencode: { type: "cli", command: "opencode", role: "implementer" },
        "ollama-local": { type: "ollama", model: "test-model", role: "summarizer" }
      }
    }, "palabre.config.json", createTranslator("en"), {
      mode: "debate",
      version: "0.7.0",
      latestVersion: "0.8.0",
      discovery: {
        codex: { available: true, command: "codex" },
        claude: { available: true, command: "claude" },
        antigravity: { available: false, command: "agy" },
        opencode: { available: true, command: "opencode" },
        vibe: { available: false, command: "vibe" },
        ollama: { available: false, commandAvailable: false, baseUrl: "http://localhost:11434", models: [] }
      }
    });
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /___/);
  const unwrappedText = text.replace(/\|\s*\r?\n\s*\|\s*/g, " ").replace(/\s+/g, " ");
  assert.match(text, /Orchestrate AI agents to inform your decisions/);
  assert.match(unwrappedText, /Orchestrate AI agents to inform your decisions\s+v0\.7\.0/);
  assert.match(text, /v0\.7\.0/);
  assert.match(text, /Update available: 0\.7\.0 -> 0\.8\.0\. Use \/update\./);
  assert.match(unwrappedText, /Session\s+·\s+Debate\s+·\s+Agents\s+·\s+codex <-> claude\s+·\s+Roles\s+·\s+architect <-> critic/);
  assert.match(unwrappedText, /Responses\s+·\s+2\s+·\s+Summary\s+·\s+ollama-local/);
  assert.match(unwrappedText, /Check session: ollama-local unavailable\s+·\s+\/config/);
  assert.match(text, /Directory\s+·/);
  assert.ok(text.includes(process.cwd()));
  assert.ok(text.indexOf("Directory") < text.indexOf("⚠ Check session"));
  assert.ok(text.indexOf("Context") < text.indexOf("Directory"));
  assert.match(unwrappedText, /Commands\s+·\s+\/\s+·\s+\/help\s+·\s+\/config\s+·\s+Guided session \/new\s+·\s+Recent sessions \/history/);
  assert.match(unwrappedText, /Context\s+·\s+--context <directory>\s+·\s+--files <file\.\.\.>/);
  assert.doesNotMatch(text, /https:\/\/palab\.re\/en/);
  assert.doesNotMatch(text, /\/config settings/);
  assert.doesNotMatch(text, /Tip Add context/);
  assert.doesNotMatch(text, /Composer/);
  assert.doesNotMatch(text, /Invite/);
  assert.doesNotMatch(text, /Config\s+palabre\.config\.json/);
  assert.doesNotMatch(text, /palabre new/);
});

test("packItems wraps complete command-description blocks on narrow terminals", () => {
  assert.deepEqual(packItems([
    "/debat debate between two agents",
    "/chat conversation",
    "/ask multiple responses"
  ], 45, " · "), [
    "/debat debate between two agents",
    "/chat conversation · /ask multiple responses"
  ]);
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
  assert.doesNotMatch(text, /___/);
  assert.match(text, /Palabre Aide/);
  assert.match(text, /\+- Commandes -+/);
  assert.match(text, /Démarrer une session/);
  assert.match(text, /Préparer la session/);
  assert.match(text, /Continuer votre travail/);
  assert.match(text, /Naviguer dans Palabre/);
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
  assert.match(text, /--context <dossier>/);
  assert.match(text, /--files <fichiers>/);
  assert.doesNotMatch(text, /plusieurs reponses independantes/);
});

test("renderTuiUpdate renders a dedicated update card inside the TUI", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const info: UpdateInfo = {
      version: "0.7.0",
      latestVersion: "0.8.0",
      projectRoot: "C:\\repo\\Palabre",
      sourceCheckout: false,
      channel: "pnpm-global",
      steps: [{ command: "pnpm", args: ["add", "--global", "palabre@0.8.0"] }]
    };
    renderTuiUpdate(info, createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Palabre Update/);
  assert.match(text, /\+- Update -+/);
  assert.match(text, /Installed version\s+.*0\.7\.0/);
  assert.match(text, /Available\s+.*0\.8\.0/);
  assert.match(text, /Channel\s+.*global pnpm/);
  assert.match(text, /pnpm add --global palabre@0\.8\.0/);
  assert.match(text, /releases\/tag\/v0\.8\.0/);
});

test("renderTuiUpdate keeps a source checkout separate from npm releases", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiUpdate({
      version: "0.16.0",
      projectRoot: "C:\\repo\\Palabre",
      sourceCheckout: true,
      channel: "source",
      steps: [{ command: "git", args: ["pull", "--ff-only"] }]
    }, createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Checkout version\s+.*0\.16\.0/);
  assert.match(text, /Source repository installation: synchronization is optional\./);
  assert.match(text, /git pull --ff-only/);
  assert.doesNotMatch(text, /Available\s+.*0\./);
  assert.doesNotMatch(text, /releases\/tag/);
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
  assert.match(text, /Palabre Historique/);
  assert.match(text, /Sessions récentes/);
  assert.match(text, /Mode debat/);
  assert.match(text, /Fichier/);
  assert.match(text, /Dossier/);
  assert.match(text, /Verifier l'historique/);
  assert.match(text, /codex <-> claude/);
  assert.match(text, /Tours\s+2\/4/);
  assert.match(text, /palabre-verifier-l-historique/);
  assert.match(text, /C:\\repo\\.palabre/);
});

test("renderTuiHistory sanitizes metadata loaded from exports", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiHistory([{
      fileName: "safe.debate.md",
      path: "C:\\repo\\.palabre\\safe.debate.md",
      mode: "debate",
      topic: "\u001b]52;c;topic\u0007Safe topic",
      agents: "\u001b[31mcodex\u001b[0m",
      date: "2026-07-07",
      count: "1/1",
      mtimeMs: 1
    }], createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Safe topic/);
  assert.match(text, /codex/);
  assert.doesNotMatch(text, /\u001b\]52|\u001b\[31m/);
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
  assert.doesNotMatch(text, /___/);
  assert.match(text, /Palabre Rôles/);
  assert.match(text, /Choisir les rôles/);
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
  assert.doesNotMatch(text, /___/);
  assert.match(text, /Palabre Agents/);
  assert.match(text, /Choisir les agents/);
  assert.match(text, /Agents actifs/);
  assert.match(text, /codex <-> claude/);
  assert.match(text, /Agents disponibles/);
  assert.match(text, /opencode/);
  assert.match(text, /Exemple: Debat > Agents > codex claude/);
});


test("parseComposerTopic extracts inline context and files from the subject", () => {
  assert.deepEqual(parseComposerTopic("comment améliorer --context src\\renderers\\tui.ts"), {
    topic: "comment améliorer",
    files: [],
    context: ["src\\renderers\\tui.ts"]
  });
  assert.deepEqual(parseComposerTopic("sujet simple"), {
    topic: "sujet simple",
    files: [],
    context: []
  });
  assert.deepEqual(parseComposerTopic("audit du module --files a.ts b.ts --context docs"), {
    topic: "audit du module",
    files: ["a.ts", "b.ts"],
    context: ["docs"]
  });
  assert.deepEqual(parseComposerTopic("--context src"), {
    topic: "",
    files: [],
    context: ["src"]
  });
  assert.deepEqual(parseComposerTopic("sujet avec --turns 6 dedans"), {
    topic: "sujet avec --turns 6 dedans",
    files: [],
    context: []
  });
  assert.deepEqual(parseComposerTopic("first line\nsecond line"), {
    topic: "first line\nsecond line",
    files: [],
    context: []
  });
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
  assert.doesNotMatch(text, /___/);
  assert.match(text, /Palabre Configuration/);
  assert.match(text, /Active session/);
  assert.equal(text.match(/Active session/g)?.length, 1);
  assert.match(text, /Edit session/);
  assert.match(text, /Active agents/);
  assert.match(text, /Application/);
  assert.match(text, /Language/);
  assert.match(text, /\/language/);
  assert.match(text, /Type \/ to show every available setting/);
  assert.match(text, /Usage: \/agents <agentA> <agentB>/);
  assert.match(text, /Usage: \/roles <role\.\.\.>/);
  assert.match(text, /Usage: \/turns <turns>/);
  assert.match(text, /Usage: \/summary <agent\|none>/);
  assert.match(text, /Usage: \/interface <tui\|terminal>/);
  assert.match(text, /Usage: \/language <fr\|en>/);
  assert.match(text, /Debate/);
  assert.match(text, /Roles\s+implementer <-> critic/);
  assert.match(text, /Config\s+·\s+palabre\.config\.json/);
  assert.doesNotMatch(text, /gemini/);
  assert.doesNotMatch(text, /Ollama model|Ollama address|\/ollama-model/);
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
  assert.match(text, /Ask/);
  assert.doesNotMatch(text, /Sujet/);
  assert.match(text, /Quelle question voulez-vous poser aux agents/);
  assert.doesNotMatch(text, /Tip Ajoute du contexte/);
  assert.ok((text.match(/-+/g) ?? []).length >= 1);
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
  assert.match(text, /Config/);
  assert.match(text, /Saisissez une commande de configuration/);
  assert.doesNotMatch(text, /Mode debat/);
  assert.doesNotMatch(text, /\/home accueil · Ctrl\+C retour · \/quit quitter/);
  assert.ok((text.match(/-+/g) ?? []).length >= 1);
  assert.doesNotMatch(text, /Débat :|Debate:/);
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

test("renderTuiConfig keeps Chat scoped to one active agent", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiConfig({
      language: "en",
      defaults: { mode: "chat", agentA: "codex", agentB: "claude" },
      agents: {
        codex: { type: "cli", command: "codex", role: "architect" },
        claude: { type: "cli", command: "claude", role: "critic" }
      }
    }, "palabre.config.json", "chat", createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Chat/);
  assert.match(text, /Active agents\s+codex/);
  assert.match(text, /Roles\s+architect/);
  assert.match(text, /Usage: \/agents <agent>/);
  assert.doesNotMatch(text, /codex <-> claude/);
});
test("Chat composer uses the standard prompt cursor instead of a You label", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    renderTuiComposer("chat", createTranslator("en"), undefined, { force: true });
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Palabre > Chat/);
  assert.match(text, />/);
  assert.doesNotMatch(text, /You:/);
  assert.match(text, /What would you like to discuss/);
});
