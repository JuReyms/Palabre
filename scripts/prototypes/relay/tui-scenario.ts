/**
 * @file Scénario PTY du prototype relay (issue #96) : cible ouverte dans le TUI de son agent.
 *
 * Ouvre le TUI Codex ou Claude Code sur une session jetable dans un pseudo-terminal, la laisse
 * au repos ou lui fait générer une longue réponse, puis envoie un relay depuis un autre processus.
 * Le relay est envoyé sans contrôle préalable (expérience de concurrence). Le scénario échantillonne
 * les sondes d'attachement, vérifie si le tour relayé apparaît dans le TUI ouvert, puis demande au
 * TUI quel est le dernier code relayé qu'il connaît.
 *
 * Usage :
 *   node --experimental-strip-types scripts/prototypes/relay/tui-scenario.ts <codex|claude> <session> <idle|generating|queue>
 *
 * `queue` (Codex) dépose le message avec `codex queue` au lieu de `codex exec resume`.
 *
 * Trace complète (sortie TUI nettoyée, sondes, réponses) dans `.tmp/relay-probe/traces/`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn as spawnPty } from "node-pty";
import {
  ClaudeAdapter, CodexAdapter, cleanEnv, resolveCodexLauncher, run,
  type ExchangeResult, type ExternalSessionAdapter, type TargetProbe,
} from "./adapters.ts";

const [agent, sessionId, mode] = process.argv.slice(2) as ["codex" | "claude", string, "idle" | "generating" | "queue"];
const cwd = path.join(os.tmpdir(), "palabre-relay-probe", agent);
const token = `RELAY-${mode.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const strip = (text: string) =>
  text.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b\[[0-9;?<>=]*[ -/]*[@-~]/g, "").replace(/\x1b[()][A-Z0-9]/g, "").replace(/\x1b[=>78DEHMc]/g, "");
const compact = (text: string) => strip(text).replace(/\s+/g, "");

function tuiCommand(): { file: string; args: string[] } {
  if (agent === "claude") {
    return {
      file: process.env.PROBE_CLAUDE_COMMAND ?? "claude.exe",
      args: ["--resume", sessionId, "--model", "haiku", "--permission-mode", "plan", "--tools", "Read,Glob,Grep", "--strict-mcp-config"],
    };
  }
  const launcher = resolveCodexLauncher();
  // Invites interactives neutralisées pour cette exécution seulement (aucune écriture de config).
  const trust = `projects={${JSON.stringify(cwd)}={trust_level="trusted"}}`;
  return {
    file: launcher.command,
    args: [...launcher.prefix, "resume", sessionId, "-s", "read-only", "--disable", "memories", "--disable", "hooks",
      "--no-alt-screen", "-c", "check_for_update_on_startup=false", "-c", trust],
  };
}

function adapter(): ExternalSessionAdapter {
  // Le relay Codex garde ici la config utilisateur désactivée, comme les autres sessions jetables.
  return agent === "codex"
    ? new CodexAdapter({ ignoreUserConfig: true })
    : new ClaudeAdapter({ command: process.env.PROBE_CLAUDE_COMMAND ?? "claude.exe", model: "haiku", restrictTools: true });
}

/**
 * Mode `queue` (Codex seulement) : dépose le message via `codex queue` au lieu de `exec resume`.
 * `codex queue` ne rend qu'un accusé de mise en file : aucune réponse ni identité de session.
 */
async function codexQueue(message: string): Promise<ExchangeResult> {
  const launcher = resolveCodexLauncher();
  const result = await run({
    command: launcher.command,
    args: [...launcher.prefix, "queue", "--thread", sessionId, "--message", message],
    cwd,
    stdin: "",
    timeoutMs: 60_000,
    startSignal: () => undefined,
  });
  return {
    agent: "codex",
    argv: ["codex", "queue", "--thread", "<id>", "--message", "<msg>"],
    ...result,
    isError: result.exitCode !== 0,
    reply: result.stdout.trim(),
    identity: "unavailable",
    reportedSessionIds: [],
    observedModels: [],
    errors: [],
  };
}

async function main(): Promise<void> {
  const target = { agent, sessionId, cwd };
  const relay = adapter();
  const { file, args } = tuiCommand();
  const timeline: Array<{ t: number; event: string; data?: unknown }> = [];
  const started = Date.now();
  const log = (event: string, data?: unknown) => {
    timeline.push({ t: Date.now() - started, event, data });
    console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${event}${data === undefined ? "" : " " + JSON.stringify(data)}`);
  };

  let screen = "";
  const pty = spawnPty(file, args, { name: "xterm-256color", cols: 140, rows: 50, cwd, env: cleanEnv() as Record<string, string> });
  pty.onData((data) => { screen += data; });
  const type = async (text: string) => {
    // Saisie progressive : certains TUIs traitent un collage d'un bloc comme une seule touche.
    for (const char of text) { pty.write(char); await sleep(8); }
    await sleep(300);
    pty.write("\r");
  };

  log("tui:spawn", { file: path.basename(file), args: args.filter((arg) => arg !== sessionId) });
  await sleep(15_000);
  log("tui:ready-screen-tail", strip(screen).split(/\r?\n/).filter((line) => line.trim()).slice(-6));
  log("probe", relay.probeTarget(target));

  if (mode === "generating") {
    await type("Écris les nombres de 1 à 400 en toutes lettres en français, un par ligne, sans aucun autre texte.");
    log("tui:prompt-sent");
    await sleep(6_000);
    log("probe", relay.probeTarget(target));
  }

  const samples: TargetProbe[] = [];
  const sampler = setInterval(() => samples.push(relay.probeTarget(target)), 1_000);
  const screenBeforeRelay = screen.length;
  log("relay:send", { token });
  const message = `Relais de test (${mode}). Réponds uniquement : ${token}`;
  const result = mode === "queue" ? await codexQueue(message) : await relay.send(target, message, { timeoutMs: 240_000 });
  clearInterval(sampler);
  log("relay:result", { exitCode: result.exitCode, reply: result.reply, durationMs: result.durationMs, effectiveSessionIdMatches: result.effectiveSessionId === sessionId, stderrTail: result.stderr.trim().split(/\r?\n/).slice(-4) });
  log("probe:during-relay", [...new Set(samples.map((sample) => `${sample.attachment}/${sample.activity} :: ${sample.evidence.join(" | ")}`))]);

  await sleep(mode === "idle" ? 8_000 : mode === "queue" ? 40_000 : 60_000);
  const afterRelay = screen.slice(screenBeforeRelay);
  log("tui:token-visible-after-relay", compact(afterRelay).includes(token));
  log("probe", relay.probeTarget(target));

  // Le TUI connaît-il le tour ajouté par le relay ? (contexte en mémoire du processus ouvert)
  const screenBeforeQuestion = screen.length;
  await type("Question de contrôle : quel est le dernier code commençant par RELAY- que tu as vu dans cette conversation ? Réponds uniquement par ce code, ou AUCUN.");
  log("tui:question-sent");
  await sleep(45_000);
  const answer = strip(screen.slice(screenBeforeQuestion));
  log("tui:answer-contains-token", compact(answer).includes(token));
  log("tui:answer-tail", answer.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-12));

  pty.write("\x03");
  await sleep(800);
  pty.write("\x03");
  await sleep(1_500);
  try { pty.kill(); } catch { /* déjà terminé */ }

  const traceDir = path.resolve(".tmp", "relay-probe", "traces");
  mkdirSync(traceDir, { recursive: true });
  const trace = path.join(traceDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${agent}-tui-${mode}.json`);
  writeFileSync(trace, JSON.stringify({ agent, sessionId, mode, token, cwd, timeline, relay: result, screen: strip(screen) }, null, 2));
  console.log(`trace: ${trace}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
