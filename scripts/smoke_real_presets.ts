import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

interface PresetInfo {
  name: string;
  agentA: string;
  agentB: string;
  available?: boolean;
  unavailableReasons?: string[];
}

interface PresetsPayload {
  v: 1;
  presets: PresetInfo[];
}

interface SmokeOptions {
  includeGemini: boolean;
  includeOllama: boolean;
  allAvailable: boolean;
  keepGoing: boolean;
  turns: number;
  topic: string;
}

interface SmokeResult {
  preset: string;
  ok: boolean;
  skipped?: string;
  exportPath?: string;
  errors: string[];
}

const DEFAULT_TOPIC = "Réponds en une phrase: quel jour sommes-nous ?";
const PRIMARY_PRESETS = [
  "codex-claude",
  "codex-antigravity",
  "claude-antigravity",
  "opencode-antigravity",
  "codex-opencode",
  "claude-opencode",
  "codex-vibe",
  "vibe-claude"
];
const LEGACY_GEMINI_PRESETS = [
  "codex-gemini",
  "claude-gemini",
  "gemini-opencode",
  "gemini-antigravity",
  "gemini-vibe"
];
const OLLAMA_PRESETS = [
  "codex-ollama",
  "claude-ollama",
  "opencode-ollama",
  "vibe-ollama",
  "antigravity-ollama"
];
const FORBIDDEN_OUTPUT_PATTERNS = [
  /Op.ration r.ussie/i,
  /processus de PID/i,
  /processus enfant de PID/i,
  /taskkill/i,
  /\uFFFD/
];

const options = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const palabreEntry = path.join(repoRoot, "dist", "index.js");

if (!existsSync(palabreEntry)) {
  fail(`Missing ${palabreEntry}. Run pnpm build before this smoke test.`);
}

const presets = await readPresets();
const selectedPresets = selectPresets(presets, options);

if (selectedPresets.length === 0) {
  fail("No presets selected. Check agent availability or flags.");
}

console.log(`Palabre real preset smoke test`);
console.log(`Presets: ${selectedPresets.map((preset) => preset.name).join(", ")}`);
console.log(`Turns: ${options.turns}`);
console.log("");

const results: SmokeResult[] = [];
for (const preset of selectedPresets) {
  const result = await runPreset(preset);
  results.push(result);
  printResult(result);

  if (!result.ok && !options.keepGoing) {
    break;
  }
}

const failed = results.filter((result) => !result.ok && !result.skipped);
const skipped = results.filter((result) => result.skipped);
console.log("");
console.log(`Summary: ${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped.`);

if (failed.length > 0) {
  process.exitCode = 1;
}

async function readPresets(): Promise<PresetInfo[]> {
  const result = await runPalabre(["presets", "--json"], { timeoutMs: 20_000 });

  if (result.exitCode !== 0) {
    fail(`palabre presets --json failed with exit ${result.exitCode}\n${result.stderr}`);
  }

  let payload: PresetsPayload;
  try {
    payload = JSON.parse(result.stdout) as PresetsPayload;
  } catch (error) {
    fail(`palabre presets --json returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (payload.v !== 1 || !Array.isArray(payload.presets)) {
    fail("palabre presets --json returned an unsupported schema.");
  }

  return payload.presets;
}

function selectPresets(presets: PresetInfo[], options: SmokeOptions): PresetInfo[] {
  const byName = new Map(presets.map((preset) => [preset.name, preset]));
  const names = options.allAvailable
    ? firstDirectionOnly(presets
      .filter((preset) => preset.available !== false)
      .filter((preset) => options.includeGemini || !preset.name.includes("gemini"))
      .filter((preset) => options.includeOllama || !preset.name.includes("ollama")))
      .map((preset) => preset.name)
    : [
      ...PRIMARY_PRESETS,
      ...(options.includeGemini ? LEGACY_GEMINI_PRESETS : []),
      ...(options.includeOllama ? OLLAMA_PRESETS : [])
    ];

  return names
    .map((name) => byName.get(name))
    .filter((preset): preset is PresetInfo => Boolean(preset));
}

function firstDirectionOnly(presets: PresetInfo[]): PresetInfo[] {
  const seen = new Set<string>();
  const result: PresetInfo[] = [];

  for (const preset of presets) {
    const key = [preset.agentA, preset.agentB].sort().join("<->");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(preset);
  }

  return result;
}

async function runPreset(preset: PresetInfo): Promise<SmokeResult> {
  if (preset.available === false) {
    return {
      preset: preset.name,
      ok: false,
      skipped: preset.unavailableReasons?.join(" | ") || "preset unavailable",
      errors: []
    };
  }

  const args = [
    "run",
    "--preset", preset.name,
    "--subject", options.topic,
    "--turns", String(options.turns),
    "--no-early-stop",
    "--renderer", "ndjson"
  ];
  const result = await runPalabre(args, { timeoutMs: 12 * 60_000 });
  const analysis = analyzeNdjson(result.stdout, preset, result.exitCode);

  if (result.stderr.trim()) {
    const noisyStderr = result.stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("[WARN]"));
    for (const line of noisyStderr) {
      analysis.errors.push(`stderr: ${line}`);
    }
  }

  return {
    preset: preset.name,
    ok: analysis.errors.length === 0,
    exportPath: analysis.exportPath,
    errors: analysis.errors
  };
}

function analyzeNdjson(stdout: string, preset: PresetInfo, exitCode: number): { exportPath?: string; errors: string[] } {
  const errors: string[] = [];
  const messages: Array<{ agent?: string; content?: string }> = [];
  let startSeen = false;
  let doneSeen = false;
  let exportPath: string | undefined;

  if (exitCode !== 0) {
    errors.push(`exit code ${exitCode}`);
  }

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      errors.push(`invalid NDJSON line: ${trimmed.slice(0, 160)}`);
      continue;
    }

    if (event.v !== 1) {
      errors.push(`unsupported event version: ${String(event.v)}`);
    }

    if (event.type === "start") {
      startSeen = true;
    }
    if (event.type === "message") {
      messages.push({
        agent: typeof event.agent === "string" ? event.agent : undefined,
        content: typeof event.content === "string" ? event.content : undefined
      });
    }
    if (event.type === "error") {
      errors.push(`runtime error: ${String(event.kind ?? "unknown")} ${String(event.message ?? "")}`);
    }
    if (event.type === "done") {
      doneSeen = true;
      exportPath = typeof event.outputPath === "string" ? event.outputPath : undefined;
    }
  }

  if (!startSeen) errors.push("missing start event");
  if (!doneSeen) errors.push("missing done event");
  if (!exportPath) errors.push("missing export path");
  if (exportPath && !existsSync(exportPath)) errors.push(`export missing on disk: ${exportPath}`);

  const expectedAgents = [preset.agentA, preset.agentB];
  for (const agent of expectedAgents) {
    const message = messages.find((entry) => entry.agent === agent);
    if (!message?.content?.trim()) {
      errors.push(`missing non-empty message for ${agent}`);
    }
  }

  if (messages.length < options.turns) {
    errors.push(`expected at least ${options.turns} debate messages, got ${messages.length}`);
  }

  for (const message of messages) {
    for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
      if (message.content && pattern.test(message.content)) {
        errors.push(`forbidden output pattern in ${message.agent}: ${pattern}`);
      }
    }
  }

  return { exportPath, errors };
}

function runPalabre(args: string[], options: { timeoutMs: number }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [palabreEntry, ...args], {
      cwd: repoRoot,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timed out after ${options.timeoutMs}ms: ${args.join(" ")}`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

function parseArgs(args: string[]): SmokeOptions {
  const options: SmokeOptions = {
    includeGemini: false,
    includeOllama: false,
    allAvailable: false,
    keepGoing: false,
    turns: 2,
    topic: DEFAULT_TOPIC
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--include-gemini") {
      options.includeGemini = true;
    } else if (arg === "--include-ollama") {
      options.includeOllama = true;
    } else if (arg === "--all-available") {
      options.allAvailable = true;
    } else if (arg === "--keep-going") {
      options.keepGoing = true;
    } else if (arg === "--turns") {
      options.turns = Number(args[++index]);
    } else if (arg === "--topic") {
      options.topic = args[++index] ?? options.topic;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(options.turns) || options.turns < 1 || options.turns > 20) {
    fail("--turns must be an integer between 1 and 20.");
  }

  return options;
}

function printResult(result: SmokeResult): void {
  if (result.skipped) {
    console.log(`SKIP ${result.preset}: ${result.skipped}`);
    return;
  }

  if (result.ok) {
    console.log(`OK   ${result.preset}${result.exportPath ? ` -> ${result.exportPath}` : ""}`);
    return;
  }

  console.log(`FAIL ${result.preset}`);
  for (const error of result.errors) {
    console.log(`  - ${error}`);
  }
}

function printHelp(): void {
  console.log(`Usage: pnpm smoke:real-presets [flags]

Runs real Palabre debates through the local dist/index.js build.

Flags:
  --include-gemini   Include legacy Gemini presets.
  --include-ollama   Include CLI <-> Ollama presets.
  --all-available    Run every available preset, skipping reverse duplicates.
  --keep-going       Continue after failures.
  --turns <n>        Debate turns, default 2.
  --topic <text>     Subject sent to the real agents.
`);
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
