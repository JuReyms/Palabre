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

type SmokeMode = "debate" | "ask";

interface SmokeOptions {
  includeOllama: boolean;
  allAvailable: boolean;
  allDirections: boolean;
  keepGoing: boolean;
  modes: SmokeMode[];
  noSummary: boolean;
  turns: number;
  topic: string;
}

interface SmokeJob {
  preset: PresetInfo;
  mode: SmokeMode;
}

interface SmokeResult {
  label: string;
  ok: boolean;
  skipped?: string;
  exportPath?: string;
  durationMs: number;
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
  "vibe-claude",
  "opencode-vibe",
  "antigravity-vibe"
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
const jobs: SmokeJob[] = selectedPresets.flatMap((preset) => options.modes.map((mode) => ({ preset, mode })));

if (jobs.length === 0) {
  fail("No smoke jobs selected. Check agent availability or flags.");
}

console.log("Palabre real preset smoke test");
console.log(`Presets: ${selectedPresets.map((preset) => preset.name).join(", ")}`);
console.log(`Modes: ${options.modes.join(", ")}`);
console.log(`Turns: ${options.turns}`);
console.log(`Summary: ${options.noSummary ? "disabled" : "enabled"}`);
console.log("");

const results: SmokeResult[] = [];
for (const job of jobs) {
  const startedAt = Date.now();
  let result: SmokeResult;
  try {
    result = await runJob(job, startedAt);
  } catch (error) {
    result = {
      label: jobLabel(job),
      ok: false,
      durationMs: Date.now() - startedAt,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
  results.push(result);
  printResult(result);

  if (!result.ok && !result.skipped && !options.keepGoing) {
    break;
  }
}

const failed = results.filter((result) => !result.ok && !result.skipped);
const skipped = results.filter((result) => result.skipped);
const passed = results.length - failed.length - skipped.length;
const durationMs = results.reduce((total, result) => total + result.durationMs, 0);
console.log("");
console.log(`Summary: ${passed} passed, ${failed.length} failed, ${skipped.length} skipped in ${formatDuration(durationMs)}.`);

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
  const candidates = presets
    .filter((preset) => preset.available !== false)
    .filter((preset) => options.includeOllama || !isOllamaPreset(preset));

  if (options.allAvailable) {
    return options.allDirections ? candidates : firstDirectionOnly(candidates);
  }

  const names = [
    ...PRIMARY_PRESETS,
    ...(options.includeOllama ? OLLAMA_PRESETS : [])
  ];
  const missing = names.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    fail(`Smoke preset list is stale; missing from palabre presets --json: ${missing.join(", ")}`);
  }

  return names.map((name) => byName.get(name) as PresetInfo);
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

function isOllamaPreset(preset: PresetInfo): boolean {
  return preset.agentA === "ollama-local" || preset.agentB === "ollama-local";
}
async function runJob(job: SmokeJob, startedAt: number): Promise<SmokeResult> {
  const { preset, mode } = job;
  if (preset.available === false) {
    return {
      label: jobLabel(job),
      ok: false,
      skipped: preset.unavailableReasons?.join(" | ") || "preset unavailable",
      durationMs: Date.now() - startedAt,
      errors: []
    };
  }

  const args = mode === "debate"
    ? [
      "run",
      "--preset", preset.name,
      "--subject", options.topic,
      "--turns", String(options.turns),
      "--no-early-stop",
      "--renderer", "ndjson"
    ]
    : [
      "ask",
      "--agents", preset.agentA, preset.agentB,
      "--subject", options.topic,
      "--renderer", "ndjson"
    ];
  if (options.noSummary) args.push("--no-summary");

  const result = await runPalabre(args, { timeoutMs: 12 * 60_000 });
  const analysis = analyzeNdjson(result.stdout, job, result.exitCode);

  if (result.stderr.trim()) {
    const noisyStderr = result.stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("[WARN]") && !line.startsWith("[AVERTISSEMENT]"));
    for (const line of noisyStderr) {
      analysis.errors.push(`stderr: ${line}`);
    }
  }

  return {
    label: jobLabel(job),
    ok: analysis.errors.length === 0,
    exportPath: analysis.exportPath,
    durationMs: Date.now() - startedAt,
    errors: analysis.errors
  };
}
function analyzeNdjson(stdout: string, job: SmokeJob, exitCode: number): { exportPath?: string; errors: string[] } {
  const preset = job.preset;
  const errors: string[] = [];
  const messages: Array<{ type?: string; agent?: string; content?: string }> = [];
  let startSeen = false;
  let startMode: unknown;
  let announcedAgents: string[] = [];
  let turnStartCount = 0;
  let askResponseStartCount = 0;
  let summaryStartCount = 0;
  let summaryMessageCount = 0;
  let thinkingStartCount = 0;
  let thinkingEndCount = 0;
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
      startMode = event.mode;
      announcedAgents = Array.isArray(event.agents)
        ? event.agents.flatMap((agent) => typeof agent === "object" && agent !== null && typeof (agent as Record<string, unknown>).name === "string" ? [(agent as Record<string, unknown>).name as string] : [])
        : [];
    }
    if (event.type === "message" || event.type === "ask-response" || event.type === "summary-message") {
      messages.push({
        type: typeof event.type === "string" ? event.type : undefined,
        agent: typeof event.agent === "string" ? event.agent : undefined,
        content: typeof event.content === "string" ? event.content : undefined
      });
    }
    if (event.type === "turn-start") turnStartCount += 1;
    if (event.type === "ask-response-start") askResponseStartCount += 1;
    if (event.type === "summary-start") summaryStartCount += 1;
    if (event.type === "summary-message") summaryMessageCount += 1;
    if (event.type === "thinking-start") thinkingStartCount += 1;
    if (event.type === "thinking-end") thinkingEndCount += 1;
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
  if (startMode !== job.mode) errors.push(`start mode mismatch: expected ${job.mode}, got ${String(startMode)}`);
  for (const agent of [preset.agentA, preset.agentB]) {
    if (!announcedAgents.includes(agent)) errors.push(`start event missing agent ${agent}`);
  }

  if (!exportPath) {
    errors.push("missing export path");
  } else {
    const extension = job.mode === "ask" ? ".ask.md" : ".debate.md";
    if (!exportPath.endsWith(extension)) errors.push(`expected ${extension} export, got ${exportPath}`);
    if (!existsSync(exportPath)) errors.push(`export missing on disk: ${exportPath}`);
  }

  const expectedMessages = job.mode === "ask" ? 2 : options.turns;
  if (messages.length !== expectedMessages + (options.noSummary ? 0 : 1)) {
    errors.push(`expected ${expectedMessages} agent messages${options.noSummary ? "" : " plus one summary"}, got ${messages.length}`);
  }
  if (job.mode === "debate" && turnStartCount !== options.turns) {
    errors.push(`expected ${options.turns} turn-start events, got ${turnStartCount}`);
  }
  if (job.mode === "ask" && askResponseStartCount !== 2) {
    errors.push(`expected 2 ask-response-start events, got ${askResponseStartCount}`);
  }
  if (options.noSummary) {
    if (summaryStartCount || summaryMessageCount) errors.push("summary events emitted despite --no-summary");
  } else {
    if (summaryStartCount !== 1) errors.push(`expected one summary-start event, got ${summaryStartCount}`);
    if (summaryMessageCount !== 1) errors.push(`expected one summary-message event, got ${summaryMessageCount}`);
  }
  if (thinkingStartCount !== thinkingEndCount) {
    errors.push(`unbalanced thinking events: ${thinkingStartCount} start, ${thinkingEndCount} end`);
  }
  const agentMessages = messages.filter((message) => message.type !== "summary-message");
  const expectedAgents = job.mode === "ask"
    ? [preset.agentA, preset.agentB]
    : Array.from({ length: options.turns }, (_, index) => index % 2 === 0 ? preset.agentA : preset.agentB);
  for (const agent of new Set(expectedAgents)) {
    if (!agentMessages.some((message) => message.agent === agent && message.content?.trim())) {
      errors.push(`missing non-empty agent message for ${agent}`);
    }
  }
  for (const message of messages) {
    if (!message.content?.trim()) errors.push(`empty ${message.type ?? "message"} content for ${message.agent ?? "unknown"}`);
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
    includeOllama: false,
    allAvailable: false,
    allDirections: false,
    keepGoing: false,
    modes: ["debate"],
    noSummary: false,
    turns: 2,
    topic: DEFAULT_TOPIC
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--include-ollama") {
      options.includeOllama = true;
    } else if (arg === "--all-available") {
      options.allAvailable = true;
    } else if (arg === "--all-directions") {
      options.allDirections = true;
    } else if (arg === "--keep-going") {
      options.keepGoing = true;
    } else if (arg === "--mode") {
      const mode = args[++index];
      if (mode !== "debate" && mode !== "ask" && mode !== "both") fail("--mode must be debate, ask, or both.");
      options.modes = mode === "both" ? ["debate", "ask"] : [mode];
    } else if (arg === "--no-summary") {
      options.noSummary = true;
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

function jobLabel(job: SmokeJob): string {
  return `${job.mode}:${job.preset.name}`;
}

function formatDuration(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function printResult(result: SmokeResult): void {
  const duration = ` (${formatDuration(result.durationMs)})`;
  if (result.skipped) {
    console.log(`SKIP ${result.label}${duration}: ${result.skipped}`);
    return;
  }

  if (result.ok) {
    console.log(`OK   ${result.label}${duration}${result.exportPath ? ` -> ${result.exportPath}` : ""}`);
    return;
  }

  console.log(`FAIL ${result.label}${duration}`);
  for (const error of result.errors) console.log(`  - ${error}`);
}

function printHelp(): void {
  console.log(`Usage: pnpm smoke:real-presets -- [flags]

Runs real Palabre sessions through the local dist/index.js build.

Flags:
  --include-ollama   Include CLI <-> Ollama presets.
  --all-available    Run every available preset instead of the priority set.
  --all-directions   With --all-available, keep reverse preset directions.
  --mode <mode>      Run debate, ask, or both; default debate.
  --no-summary       Disable final summaries to reduce quota usage.
  --keep-going       Continue after failures, timeouts, and spawn errors.
  --turns <n>        Debate turns, default 2 (ignored by Ask mode).
  --topic <text>     Subject sent to the real agents.
`);
}
function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
