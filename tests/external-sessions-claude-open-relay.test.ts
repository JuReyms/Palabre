/**
 * @file Déroulé de `--open` vers Claude (B2.2) : `runClaudeOpenRelay` avec lancements simulés,
 * horloge simulée et transcript temporaire réel. Le messager simulé joue le rôle du garde en
 * écrivant ses fichiers ; le garde lui-même est testé à part. Aucun appel de modèle.
 */
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { GUARD_FILES, type GuardState } from "../src/externalSessions/claudeGuard.js";
import { runClaudeOpenRelay, type ClaudeOpenRelayDeps, type ClaudeOpenRelayInput } from "../src/externalSessions/claudeOpenRelay.js";
import { readOpenRollout } from "../src/externalSessions/openRollout.js";
import { captureOpenRollout } from "../src/externalSessions/openRollout.js";
import type { ExternalProcessResult, ExternalProcessSpec } from "../src/externalSessions/process.js";

const SESSION = "5e55a0b1-0000-4000-8000-000000000001";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NONCE = "PR-0123456789abcdef";
const ENVELOPE = `[Message relayé par palabre relay --open · réf. ${NONCE}]\nDe : codex (session factice), expéditeur déclaré, non authentifié.\n\nQuestion « été ».`;
const REPLY = "Réponse corrélée « été ».";
const root = mkdtempSync(path.join(os.tmpdir(), "palabre-claude-open-relay-"));
after(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;
let ids = 0;
const uid = () => `00000000-0000-4000-9000-${String(++ids).padStart(12, "0")}`;
type Row = Record<string, unknown>;
type Kind = "version" | "agents" | "auth" | "messenger";

const ok = (stdout = "", exitCode: number | null = 0, extra: Partial<ExternalProcessResult> = {}): ExternalProcessResult =>
  ({ started: true, exitCode, signal: null, forcedReturn: false, stdout, stderr: "", outputBytes: stdout.length, durationMs: 1, ...extra });
const registry = (entries: Row[]) => JSON.stringify(entries);
const entry = (overrides: Row = {}): Row => ({ pid: 4242, cwd: "C:\\w", kind: "interactive", startedAt: 1, sessionId: SESSION, name: "cible-factice", status: "idle", ...overrides });
const stream = (guard = "connected", model = "claude-haiku-4-5") => [
  { type: "system", subtype: "init", model, mcp_servers: [{ name: "palabre_guard", status: guard }] },
  { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "SendMessage", input: {} }] } },
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "texte non recopié" }] } }
].map((event) => JSON.stringify(event)).join("\n");

/** Monde jetable : transcript avec un tour humain terminé, horloge et lancements simulés. */
function harness(options: {
  version?: string;
  registries?: string[];
  auth?: string;
  callerEnv?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  messenger?: (spec: ExternalProcessSpec, world: World) => Promise<ExternalProcessResult> | ExternalProcessResult;
  read?: ClaudeOpenRelayDeps["read"];
  envelope?: string;
} = {}) {
  const dir = path.join(root, `case-${++counter}`);
  const projects = path.join(dir, "projects");
  mkdirSync(path.join(projects, "C--w"), { recursive: true });
  const transcript = path.join(projects, "C--w", `${SESSION}.jsonl`);
  let last: string | null = null;
  const chained = (type: string, extra: Row): Row => { const uuid = uid(); const row = { parentUuid: last, isSidechain: false, type, uuid, sessionId: SESSION, ...extra }; last = uuid; return row; };
  const write = (rows: Row[]) => appendFileSync(transcript, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  writeFileSync(transcript, "");
  write([
    { type: "queue-operation", operation: "enqueue", sessionId: SESSION, content: "Consigne humaine factice." },
    chained("user", { promptId: uid(), message: { role: "user", content: "Consigne humaine factice." }, permissionMode: "auto", origin: { kind: "human" }, turnOrigin: "human", turnPosition: { promptIndex: 1, turnIndex: 1 } }),
    chained("assistant", { message: { role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "Réponse humaine." }] } }),
    chained("system", { subtype: "stop_hook_summary", hookErrors: [], preventedContinuation: false })
  ]);
  const world = {
    transcript,
    /** Tour de pair au corps exact, avec ou sans réponse ; `midTurn` le mêle à un tour en cours. */
    deliver(body: string, reply: string | null = REPLY, midTurn = false) {
      if (midTurn) write([chained("assistant", { message: { role: "assistant", content: [{ type: "text", text: "En cours" }] } })]);
      write([
        { type: "queue-operation", operation: "enqueue", sessionId: SESSION, content: `<cross-session-message from="a" from-name="palabre-relay" from-mode="default">\n${body}\n</cross-session-message>` },
        chained("user", { promptId: uid(), message: { role: "user", content: body }, permissionMode: "auto", origin: { kind: "peer", body }, turnOrigin: "peer", turnPosition: { promptIndex: 1, turnIndex: 2 } }),
        ...(reply === null ? [] : [
          chained("assistant", { message: { role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: reply }] } }),
          chained("system", { subtype: "stop_hook_summary", hookErrors: [], preventedContinuation: false })
        ])
      ]);
    }
  };
  type World = typeof world;
  const clock = { now: 0 };
  const calls: Kind[] = [];
  const messengerSpecs: ExternalProcessSpec[] = [];
  const removed: string[] = [];
  let agentsCall = 0;
  const controller = new AbortController();
  const deps: ClaudeOpenRelayDeps = {
    run: async (spec) => {
      const kind: Kind = spec.args[0] === "--version" ? "version" : spec.args[0] === "agents" ? "agents" : spec.args[0] === "auth" ? "auth" : "messenger";
      calls.push(kind);
      if (kind === "version") return ok(options.version ?? "2.1.293 (Claude Code)\n");
      if (kind === "agents") {
        const list = options.registries ?? [registry([entry()])];
        return ok(list[Math.min(agentsCall++, list.length - 1)]);
      }
      if (kind === "auth") return ok(options.auth ?? JSON.stringify({ loggedIn: true, projectsDirectory: projects }));
      messengerSpecs.push(spec);
      if (options.messenger) return options.messenger(spec, world);
      // Messager nominal : le garde est consulté et autorise ; la cible reçoit le corps imposé.
      const state = JSON.parse(readFileSync(path.join(spec.cwd, GUARD_FILES.state), "utf8")) as GuardState;
      writeFileSync(path.join(spec.cwd, GUARD_FILES.consulted), `${JSON.stringify({ decision: "allow" })}\n`);
      writeFileSync(path.join(spec.cwd, GUARD_FILES.allowed), "x");
      world.deliver(state.envelope);
      return ok(stream());
    },
    capture: captureOpenRollout,
    read: options.read ?? readOpenRollout,
    now: () => clock.now,
    wallNow: () => 1_000_000 + clock.now,
    sleep: async (ms) => { clock.now += ms; },
    makeStateDir: async () => mkdtempSync(path.join(dir, "etat-")),
    removeStateDir: async (stateDir) => { removed.push(stateDir); rmSync(stateDir, { recursive: true, force: true }); },
    nodePath: process.execPath,
    guardScript: "garde.js"
  };
  const input: ClaudeOpenRelayInput = {
    executable: { command: "claude.exe", prefixArgs: [] },
    sessionId: SESSION,
    envelope: options.envelope ?? ENVELOPE,
    nonce: NONCE,
    callerEnv: options.callerEnv ?? {},
    timeoutMs: options.timeoutMs ?? 10_000,
    signal: controller.signal
  };
  return { world, clock, calls, messengerSpecs, removed, controller, deps, input, run: () => runClaudeOpenRelay(input, deps) };
}
type World = ReturnType<typeof harness>["world"];
const allowIn = (spec: ExternalProcessSpec) => {
  writeFileSync(path.join(spec.cwd, GUARD_FILES.consulted), "{}\n");
  writeFileSync(path.join(spec.cwd, GUARD_FILES.allowed), "x");
};

describe("B2.2 : envoi nominal", () => {
  test("réponse corrélée, diagnostics du messager, permissions du tour, état supprimé", async () => {
    const h = harness();
    const result = await h.run();
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.reply, REPLY);
    assert.deepEqual(result.delivery, { status: "replied", persisted: true, inActiveBranch: "unknown" });
    assert.equal(result.identity, "same-as-target");
    assert.deepEqual(result.observedModels, ["claude-opus-5-5"]);
    assert.deepEqual(result.messenger, { attempted: true, guard: "loaded", guardConsulted: true, sendAllowed: true, toolResult: "returned", model: "claude-haiku-4-5" });
    assert.deepEqual(result.targetPermissions, { permissionMode: "auto" });
    assert.equal(result.queued, true);
    assert.deepEqual(result.correlation, { status: "replied", reason: "correlated-final" });
    assert.deepEqual(h.calls, ["version", "agents", "auth", "agents", "messenger"]);
    const [spec] = h.messengerSpecs;
    assert.ok(!spec!.stdin.includes(NONCE) && !spec!.stdin.includes("Question"), "l'enveloppe n'entre pas dans le contexte du messager");
    assert.ok(spec!.args.includes("--permission-prompt-tool"));
    assert.equal(spec!.timeoutMs, 10_000);
    assert.equal(h.removed.length, 1);
    assert.equal(existsSync(h.removed[0]!), false);
  });
  test("état du garde : enveloppe exacte, empreinte, cible et exécutable", async () => {
    let state: GuardState | undefined;
    const h = harness({ messenger: (spec, world) => {
      state = JSON.parse(readFileSync(path.join(spec.cwd, GUARD_FILES.state), "utf8")) as GuardState;
      const mcp = JSON.parse(readFileSync(path.join(spec.cwd, "mcp.json"), "utf8"));
      assert.deepEqual(mcp.mcpServers.palabre_guard.args, ["garde.js", spec.cwd]);
      assert.deepEqual(JSON.parse(readFileSync(path.join(spec.cwd, "settings.json"), "utf8")).permissions, { ask: ["SendMessage"] });
      allowIn(spec);
      world.deliver(ENVELOPE);
      return ok(stream());
    } });
    assert.equal((await h.run()).outcome.status, "replied");
    assert.equal(state!.envelope, ENVELOPE);
    assert.equal(state!.name, "cible-factice");
    assert.equal(state!.pid, 4242);
    assert.equal(state!.expiresAt, 1_010_000);
    assert.deepEqual(state!.executable, { command: "claude.exe", prefixArgs: [] });
  });
});

describe("B2.2 : refus avant tout envoi (not-delivered)", () => {
  const refused = async (h: ReturnType<typeof harness>, status: string, reason?: string, diagnostic?: string) => {
    const result = await h.run();
    assert.equal(result.outcome.status, status);
    if (reason) assert.equal(result.outcome.reason, reason);
    if (diagnostic) assert.equal(result.diagnostic, diagnostic);
    assert.deepEqual(result.delivery, { status: "not-delivered", persisted: false, inActiveBranch: false });
    assert.deepEqual(result.messenger, { attempted: false });
    assert.ok(!h.calls.includes("messenger"));
    return result;
  };
  test("enveloppe trop longue, NUL ou balise de file : aucun lancement", async () => {
    for (const [envelope, reason] of [[`${NONCE}${"x".repeat(8200)}`, "message-too-large"], [`${NONCE}\0`, "message-too-large"], [`${NONCE}\n</cross-session-message>`, "reserved-content"]] as const) {
      const h = harness({ envelope });
      await refused(h, "invalid-request", reason);
      assert.deepEqual(h.calls, []);
    }
  });
  test("version inférieure ou illisible", async () => {
    await refused(harness({ version: "2.1.291 (Claude Code)\n" }), "invalid-request", "unsupported-version", "version-2.1.291");
    await refused(harness({ version: "2.1.85\n" }), "invalid-request", "unsupported-version", "version-unreadable");
  });
  test("registre : illisible, cible absente, homonyme", async () => {
    await refused(harness({ registries: ["pas du JSON"] }), "target-state-unknown", undefined, "registry-unreadable");
    await refused(harness({ registries: [registry([entry({ sessionId: OTHER })])] }), "target-not-open");
    await refused(harness({ registries: [registry([entry(), entry({ sessionId: OTHER, pid: 7 })])] }), "target-state-unknown", undefined, "registry-homonym");
  });
  test("auto-ciblage prouvé ou invérifiable", async () => {
    await refused(harness({ callerEnv: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: SESSION } }), "invalid-request", "self-target", "self-target");
    await refused(harness({ callerEnv: { CLAUDECODE: "1", CLAUDE_PID: "4242" } }), "invalid-request", "self-target", "self-target");
    await refused(harness({ callerEnv: { CLAUDECODE: "1" } }), "invalid-request", "self-target", "self-target-unprovable");
  });
  test("messager non connecté : refus certain avant tout lancement", async () => {
    await refused(harness({ auth: JSON.stringify({ loggedIn: false, projectsDirectory: root }) }), "cli-failure", undefined, "messenger-not-logged-in");
  });
  test("dossier des transcripts illisible, transcript absent", async () => {
    await refused(harness({ auth: "{}" }), "target-state-unknown", undefined, "projects-directory-unreadable");
    await refused(harness({ auth: JSON.stringify({ projectsDirectory: path.join(root, "absent") }) }), "session-not-found");
  });
  test("cible changée avant le lancement : aucun messager", async () => {
    await refused(harness({ registries: [registry([entry()]), registry([entry({ pid: 9 })])] }), "target-state-unknown", undefined, "registry-changed-before-send");
    await refused(harness({ registries: [registry([entry()]), "[]"] }), "target-not-open", undefined, "registry-changed-before-send");
  });
  test("messager introuvable au lancement : command-not-found, état supprimé", async () => {
    const h = harness({ messenger: () => ({ ...ok(), started: false, exitCode: null, launchFailure: "command-not-found" }) });
    const result = await h.run();
    assert.equal(result.outcome.status, "command-not-found");
    assert.equal(result.delivery.status, "not-delivered");
    assert.deepEqual(result.messenger, { attempted: false });
    assert.equal(h.removed.length, 1);
  });
  test("annulation avant lancement : cancelled, not-delivered", async () => {
    const h = harness();
    h.controller.abort();
    await refused(h, "cancelled");
  });
  for (const phase of ["version", "agents", "auth", "recheck"] as const) {
    for (const status of ["cancelled", "timeout"] as const) {
      test(`${phase} finit normalement après ${status} : interruption prioritaire, aucun messager`, async () => {
        const h = harness({ timeoutMs: 1_000 });
        const run = h.deps.run;
        let registryCalls = 0;
        h.deps.run = async (spec) => {
          const result = await run(spec);
          const kind = spec.args[0] === "--version" ? "version" : spec.args[0] === "auth" ? "auth"
            : spec.args[0] === "agents" ? (++registryCalls === 1 ? "agents" : "recheck") : "messenger";
          if (kind !== phase) return result;
          if (status === "cancelled") h.controller.abort(); else h.clock.now = 1_000;
          return ok("{}"); // Exit normal, aucune stopReason ; sortie inutilisable.
        };
        const result = await refused(h, status);
        assert.equal(result.outcome.exitCode, status === "cancelled" ? 130 : 4);
      });
    }
  }
  test("annulation pendant le messager : marqueur retiré avant son retour", async () => {
    const h = harness({ messenger: (spec) => {
      const marker = path.join(spec.cwd, GUARD_FILES.active);
      assert.equal(readFileSync(marker, "utf8"), "active\n");
      h.controller.abort();
      assert.equal(existsSync(marker), false);
      return ok(stream(), null, { stopReason: "cancelled" });
    } });
    const result = await h.run();
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "unknown");
    assert.equal(result.messenger.attempted, true);
  });
  test("messager terminé : autorisation retirée avant la lecture de réponse", async () => {
    let marker = "";
    const h = harness({
      messenger: (spec, world) => { marker = path.join(spec.cwd, GUARD_FILES.active); allowIn(spec); world.deliver(ENVELOPE); return ok(stream()); },
      read: async (file, baseline) => { assert.equal(existsSync(marker), false); return readOpenRollout(file, baseline); }
    });
    assert.equal((await h.run()).outcome.status, "replied");
    assert.equal(getEventListeners(h.controller.signal, "abort").length, 0);
  });
  test("échéance du messager : marqueur retiré pendant une exécution encore en attente", async () => {
    const h = harness({ timeoutMs: 25, messenger: async (spec) => {
      const marker = path.join(spec.cwd, GUARD_FILES.active);
      assert.equal(existsSync(marker), true);
      await delay(60);
      assert.equal(existsSync(marker), false);
      h.clock.now = 25;
      return ok(stream(), null, { stopReason: "timeout" });
    } });
    const result = await h.run();
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.delivery.status, "unknown");
  });
  test("retrait du marqueur en erreur : diagnostic, sans promotion de délivrance", async () => {
    const h = harness({ messenger: (spec) => {
      const marker = path.join(spec.cwd, GUARD_FILES.active);
      rmSync(marker);
      mkdirSync(marker); // Simule un refus d'unlink, sans modifier des permissions réelles.
      h.controller.abort();
      return ok(stream(), null, { stopReason: "cancelled" });
    } });
    const result = await h.run();
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "unknown");
    // Même séparateur que les autres diagnostics du messager.
    assert.equal(result.messenger.diagnostic, "messenger-cancelled,guard-revocation-failed");
    assert.equal(getEventListeners(h.controller.signal, "abort").length, 0);
  });
});

describe("B2.2 : après lancement, unknown sans preuve de réception", () => {
  test("garde chargé mais jamais consulté : no-valid-reply, unknown, pas de promotion", async () => {
    const h = harness({ messenger: () => ok(stream()) });
    const result = await h.run();
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.diagnostic, "guard-not-consulted");
    assert.deepEqual(result.delivery, { status: "unknown", persisted: false, inActiveBranch: "unknown" });
    assert.equal(result.messenger.guard, "loaded");
    assert.equal(result.messenger.guardConsulted, false);
    assert.equal(result.messenger.sendAllowed, "unknown");
    assert.equal(result.receptionObserved, false);
  });
  test("garde non chargé : diagnostic dédié, toujours unknown", async () => {
    const result = await harness({ messenger: () => ok(stream("failed")) }).run();
    assert.equal(result.diagnostic, "guard-not-loaded");
    assert.equal(result.delivery.status, "unknown");
  });
  test("garde consulté sans autorisation : sendAllowed false, toujours unknown", async () => {
    const result = await harness({ messenger: (spec) => { writeFileSync(path.join(spec.cwd, GUARD_FILES.consulted), "{}\n"); return ok(stream()); } }).run();
    assert.equal(result.diagnostic, "send-not-allowed");
    assert.equal(result.messenger.sendAllowed, false);
    assert.equal(result.delivery.status, "unknown");
  });
  test("réception sans autorisation enregistrée (garde contourné) : la preuve l'emporte, sans réponse", async () => {
    const result = await harness({ messenger: (_spec, world) => { world.deliver(ENVELOPE); return ok(stream()); } }).run();
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.reply, undefined);
    assert.deepEqual(result.delivery, { status: "persisted-no-reply", persisted: true, inActiveBranch: "unknown" });
  });
  test("autorisé puis retenu par la cible (hold) : échéance, unknown, réception non observée", async () => {
    const h = harness({ timeoutMs: 3_000, messenger: (spec) => { allowIn(spec); return ok(stream()); } });
    const result = await h.run();
    assert.equal(result.outcome.status, "timeout");
    assert.deepEqual(result.delivery, { status: "unknown", persisted: false, inActiveBranch: "unknown" });
    assert.equal(result.receptionObserved, false);
    assert.equal(result.correlation?.status, "awaiting-message");
  });
  test("file seule observée : diagnostic queued, sans changer la délivrance", async () => {
    const h = harness({ timeoutMs: 2_000, messenger: (spec, world) => {
      allowIn(spec);
      appendFileSync(world.transcript, `${JSON.stringify({ type: "queue-operation", operation: "enqueue", sessionId: SESSION, content: `<cross-session-message from="a" from-name="b" from-mode="default">\n${ENVELOPE}\n</cross-session-message>` })}\n`);
      return ok(stream());
    } });
    const result = await h.run();
    assert.equal(result.queued, true);
    assert.equal(result.delivery.status, "unknown");
  });
  test("modèle annoncé autre que haiku : signalé, jamais accepté en silence", async () => {
    const result = await harness({ messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE); return ok(stream("connected", "claude-opus-5-5")); } }).run();
    assert.equal(result.outcome.status, "replied");
    assert.match(result.messenger.diagnostic ?? "", /messenger-model-unexpected/);
  });
});

describe("B2.2 : échec, annulation et échéance conservent la réception, sans réponse", () => {
  test("messager en échec après réception et réponse : cli-failure, persisted-no-reply, aucune réponse", async () => {
    const result = await harness({ messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE); return ok(stream(), 1); } }).run();
    assert.equal(result.outcome.status, "cli-failure");
    assert.equal(result.diagnostic, "messenger-exit-1");
    assert.equal(result.reply, undefined);
    assert.equal(result.identity, "unavailable");
    assert.deepEqual(result.delivery, { status: "persisted-no-reply", persisted: true, inActiveBranch: "unknown" });
    assert.deepEqual(result.targetPermissions, "unknown");
  });
  test("messager arrêté à l'échéance après réception : timeout, persisted-no-reply, aucune réponse", async () => {
    const h = harness({ messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE); h.clock.now = 5_000; return ok(stream(), null, { stopReason: "timeout" }); } });
    const result = await h.run();
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.reply, undefined);
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("annulation pendant l'attente, après réception : cancelled, preuve conservée", async () => {
    let reads = 0;
    const h = harness({
      messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE, null); return ok(stream()); },
      read: async (file, base) => { const snapshot = await readOpenRollout(file, base); if (++reads === 2) h.controller.abort(); return snapshot; }
    });
    const result = await h.run();
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.reply, undefined);
  });
  test("lecture terminée après Ctrl+C, réponse présente : cancelled, jamais replied", async () => {
    const h = harness({
      messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE); return ok(stream()); },
      read: async (file, base) => { const snapshot = await readOpenRollout(file, base); h.controller.abort(); return snapshot; }
    });
    const result = await h.run();
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.reply, undefined);
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("lecture terminée après l'échéance, réponse présente : timeout, jamais replied", async () => {
    const h = harness({
      messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE); return ok(stream()); },
      read: async (file, base) => { const snapshot = await readOpenRollout(file, base); h.clock.now = 60_000; return snapshot; }
    });
    const result = await h.run();
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.reply, undefined);
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("message mêlé à un tour en cours : no-valid-reply, réception conservée", async () => {
    const result = await harness({ messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE, REPLY, true); return ok(stream()); } }).run();
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.correlation?.reason, "turn-start-not-proven");
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("lecture en échec après une réception prouvée : la preuve n'est pas effacée", async () => {
    let reads = 0;
    const h = harness({
      timeoutMs: 3_000,
      messenger: (spec, world) => { allowIn(spec); world.deliver(ENVELOPE, null); return ok(stream()); },
      read: async (file, base) => { if (++reads >= 2) throw new Error("history-replaced"); return readOpenRollout(file, base); }
    });
    const result = await h.run();
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.receptionObserved, true);
  });
  test("budget épuisé par les préconditions : timeout sans lancement", async () => {
    const h = harness({ timeoutMs: 1_000 });
    const run = h.deps.run;
    h.deps.run = async (spec) => { const result = await run(spec); if (spec.args[0] === "agents") h.clock.now += 600; return result; };
    const result = await h.run();
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.delivery.status, "not-delivered");
    assert.ok(!h.calls.includes("messenger"));
  });
});
