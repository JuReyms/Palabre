/**
 * @file Banc d'essai manuel du prototype relay (issue #96). Hors `pnpm test` : appelle de vrais agents.
 *
 * Usage (Node 22+, sans compilation) :
 *   node --experimental-strip-types scripts/prototypes/relay/probe.ts create <codex|claude> "<prompt>"
 *   node --experimental-strip-types scripts/prototypes/relay/probe.ts send <codex|claude> <session> "<message>"
 *        [--fork] [--force] [--timeout ms] [--kill-after-start ms] [--cwd dir]
 *   node --experimental-strip-types scripts/prototypes/relay/probe.ts busy <codex|claude> <session>
 *   node --experimental-strip-types scripts/prototypes/relay/probe.ts delivery <codex|claude> <session> "<nonce ou texte>"
 *
 * `send` sonde la cible et refuse (`target-busy` / `target-state-unknown`) sauf `--force`, emballe
 * le message avec un nonce, classe la délivrance, puis sort avec le code de `relayOutcome` :
 * 0 réponse valide, 1 erreur interne, 2 échec CLI ou réponse invalide, 3 refus avant envoi
 * (cible attachée, état invérifiable, neutralisation MCP impossible), 4 timeout,
 * 5 identité incohérente, 6 session introuvable, 7 exécutable de la CLI introuvable,
 * 8 requête invalide (dossier de travail de la cible introuvable).
 *
 * Variables d'environnement :
 *   PROBE_CLAUDE_COMMAND, PROBE_CLAUDE_PREFIX_ARGS (JSON), PROBE_CLAUDE_MODEL (défaut haiku, "" = aucun),
 *   PROBE_CLAUDE_PLAN_ONLY=1, PROBE_CLAUDE_HOME,
 *   PROBE_CODEX_COMMAND, PROBE_CODEX_PREFIX_ARGS (JSON), PROBE_CODEX_USER_CONFIG=1, PROBE_CODEX_MODEL,
 *   PROBE_CODEX_DISABLE_NOTIFY=1, PROBE_CODEX_NEUTRALIZE_MCP=1, PROBE_CODEX_HOME,
 *   PROBE_DISABLE_HOOKS=1, PROBE_EXTRA_ARGS (JSON), PROBE_WORKSPACE_ROOT, PROBE_TRACE_DIR.
 *
 * Chaque appel écrit une trace complète (identifiants compris) dans `.tmp/relay-probe/traces/`,
 * ignoré par git. Les sessions jetables vivent dans `%TEMP%/palabre-relay-probe/<agent>/`.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessTarget, buildEnvelope, ClaudeAdapter, classifyDelivery, CodexAdapter, PreflightRefusal, relayOutcome,
  type ExchangeResult, type ExternalSessionAdapter,
} from "./adapters.ts";

type Env = NodeJS.ProcessEnv;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function jsonArray(value: string | undefined): string[] | undefined {
  return value ? (JSON.parse(value) as string[]) : undefined;
}

function adapterFor(agent: string, env: Env): ExternalSessionAdapter {
  if (agent === "codex") {
    return new CodexAdapter({
      ignoreUserConfig: env.PROBE_CODEX_USER_CONFIG !== "1",
      model: env.PROBE_CODEX_MODEL || undefined,
      disableHooks: env.PROBE_DISABLE_HOOKS === "1",
      disableNotify: env.PROBE_CODEX_DISABLE_NOTIFY === "1",
      neutralizeMcp: env.PROBE_CODEX_NEUTRALIZE_MCP === "1",
      extraArgs: jsonArray(env.PROBE_EXTRA_ARGS),
      home: env.PROBE_CODEX_HOME,
      launcher: env.PROBE_CODEX_COMMAND ? { command: env.PROBE_CODEX_COMMAND, prefix: jsonArray(env.PROBE_CODEX_PREFIX_ARGS) ?? [] } : undefined,
    });
  }
  if (agent === "claude") {
    return new ClaudeAdapter({
      command: env.PROBE_CLAUDE_COMMAND ?? "claude.exe",
      prefixArgs: jsonArray(env.PROBE_CLAUDE_PREFIX_ARGS),
      model: env.PROBE_CLAUDE_MODEL ?? "haiku",
      restrictTools: env.PROBE_CLAUDE_PLAN_ONLY !== "1",
      disableHooks: env.PROBE_DISABLE_HOOKS === "1",
      extraArgs: jsonArray(env.PROBE_EXTRA_ARGS),
      home: env.PROBE_CLAUDE_HOME,
    });
  }
  throw new Error(`agent inconnu : ${agent}`);
}

function workspace(agent: string, env: Env): string {
  const dir = path.join(env.PROBE_WORKSPACE_ROOT ?? path.join(os.tmpdir(), "palabre-relay-probe"), agent);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function trace(op: string, agent: string, payload: unknown, env: Env): string {
  const dir = env.PROBE_TRACE_DIR ?? path.resolve(".tmp", "relay-probe", "traces");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${agent}-${op}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function summarize(result: ExchangeResult): Record<string, unknown> {
  return {
    exitCode: result.exitCode,
    spawnErrorCode: result.spawnErrorCode,
    launchFailure: result.launchFailure,
    isError: result.isError,
    timedOut: result.timedOut,
    killedByProbe: result.killedByProbe,
    startSignalMs: result.startSignalMs,
    durationMs: result.durationMs,
    identity: result.identity,
    effectiveSessionId: result.effectiveSessionId,
    reportedSessionIds: [...new Set(result.reportedSessionIds)],
    declaredModel: result.declaredModel,
    observedModels: result.observedModels,
    errors: result.errors,
    reply: result.reply,
    stderrTail: result.stderr.trim().split(/\r?\n/).slice(-3).join("\n"),
  };
}

/** Point d'entrée testable : écrit le JSON sur `out` et retourne le code de sortie. */
export async function main(argv: string[], env: Env = process.env, out: (text: string) => void = console.log): Promise<number> {
  const [op, agent, ...rest] = argv;
  const adapter = adapterFor(agent, env);
  const timeoutMs = Number(flag(rest, "--timeout") ?? 300_000);

  if (op === "create") {
    const cwd = workspace(agent, env);
    const result = await adapter.createThrowaway(cwd, rest[0], timeoutMs);
    const outcome = relayOutcome({ result });
    const file = trace(op, agent, { op, cwd, outcome, ...result }, env);
    out(JSON.stringify({ trace: file, cwd, outcome, ...summarize(result) }, null, 2));
    return outcome.exitCode;
  }

  if (op === "send") {
    const [sessionId, message] = rest;
    const cwd = flag(rest, "--cwd") ?? workspace(agent, env);
    const target = { agent: adapter.agent, sessionId, cwd };
    const before = adapter.probeTarget(target);
    const decision = assessTarget(before);
    const nonce = `PR-${randomBytes(6).toString("hex")}`;
    if (!decision.allowed && !rest.includes("--force")) {
      const delivery = classifyDelivery({ refusedBeforeSend: true });
      const outcome = relayOutcome({ decision });
      const file = trace("refused", agent, { op, target, message, nonce, probe: before, decision, delivery, outcome }, env);
      out(JSON.stringify({ trace: file, outcome, probe: before, decision, delivery }, null, 2));
      return outcome.exitCode;
    }
    const killAfter = flag(rest, "--kill-after-start");
    let result: ExchangeResult;
    try {
      result = await adapter.send(target, buildEnvelope(message, nonce), {
        timeoutMs,
        fork: rest.includes("--fork"),
        killAfterStartMs: killAfter === undefined ? undefined : Number(killAfter),
      });
    } catch (error) {
      if (!(error instanceof PreflightRefusal)) throw error;
      // Étape préalable non garantie (neutralisation MCP, exécutable introuvable) : la reprise n'est jamais lancée.
      const delivery = classifyDelivery({ refusedBeforeSend: true });
      const outcome = relayOutcome({ preflightRefusal: error });
      const file = trace("refused", agent, { op, target, message, nonce, probe: before, decision, preflight: error.message, delivery, outcome }, env);
      out(JSON.stringify({ trace: file, outcome, probe: before, decision, preflight: error.message, delivery }, null, 2));
      return outcome.exitCode;
    }
    const certainRefusal = adapter.certainRefusal(result);
    const evidence = adapter.findNonce(target, nonce);
    // Erreur de lancement : la CLI n'a jamais démarré, la non-délivrance est certaine.
    const delivery = classifyDelivery({ refusedBeforeSend: result.launchFailure !== undefined, certainCliRefusal: certainRefusal !== undefined, result, evidence });
    const outcome = relayOutcome({ result, certainRefusal });
    const after = adapter.probeTarget(target);
    const file = trace(rest.includes("--fork") ? "fork" : "send", agent, { op, target, message, nonce, probeBefore: before, decision, probeAfter: after, evidence, delivery, outcome, ...result }, env);
    out(JSON.stringify({ trace: file, nonce, outcome, probeBefore: before, decision, delivery, evidence, ...summarize(result) }, null, 2));
    return outcome.exitCode;
  }

  if (op === "busy") {
    const target = { agent: adapter.agent, sessionId: rest[0], cwd: workspace(agent, env) };
    const probe = adapter.probeTarget(target);
    out(JSON.stringify({ probe, decision: assessTarget(probe) }, null, 2));
    return 0;
  }

  if (op === "delivery") {
    const target = { agent: adapter.agent, sessionId: rest[0], cwd: workspace(agent, env) };
    out(JSON.stringify(adapter.findNonce(target, rest[1]), null, 2));
    return 0;
  }

  throw new Error(`opération inconnue : ${op}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
}
