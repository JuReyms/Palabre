/** @file Banc de pannes sans SDK, timer réel, IO ou transport : compteur factice seulement. */
import { createOfflineMessengerGuard, type OfflineMessengerPlan, type OfflineGateDecision, type MessengerRefusal } from "./claudeMessenger.js";
import { inspectCalibrationTool } from "./claudeMessengerCalibration.js";

/** Horloge et ordonnanceur du banc ; le retour doit annuler le réveil programmé. */
export interface FixtureClock {
  now(): number;
  schedule(delayMs: number, expire: () => void): () => void;
}

type Refusal = MessengerRefusal | "hook-failed" | "already-attempted" | "not-reserved" | "call-changed";
type Phase = "ready" | "checking" | "reserved" | "consuming" | "consumed" | "closed";
type FixtureCall = { hook_event_name: string; session_id: string; tool_use_id: string; tool_name: string;
  tool_input: { recipient: string; text: string } };

/** Capture de données JSON simples, sans accesseur ; les copies figées ne partagent pas l'entrée. */
function capture(value: unknown): FixtureCall | undefined {
  const plain = (item: unknown): item is Record<string, unknown> => {
    if (!item || typeof item !== "object" || Array.isArray(item) || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) return false;
    return Reflect.ownKeys(item).every(key => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(item, key)!);
  };
  if (!plain(value) || !plain(value.tool_input) || Object.keys(value.tool_input).sort().join(",") !== "recipient,text") return;
  const { hook_event_name, session_id, tool_use_id, tool_name } = value;
  const { recipient, text } = value.tool_input;
  if (![hook_event_name, session_id, tool_use_id, tool_name, recipient, text].every(item => typeof item === "string")) return;
  return Object.freeze({ hook_event_name, session_id, tool_use_id, tool_name,
    tool_input: Object.freeze({ recipient, text }) }) as FixtureCall;
}

/**
 * Teste un contrôle asynchrone avant le garde puis un dernier contrôle AU COMPTEUR FACTICE.
 * beforeInspect est du code de banc injecté : ni plugin ni isolation contre du JS hostile.
 * Un refus ferme la tentative ; aucune nouvelle instance ou reprise automatique.
 * executeFake n'invoque jamais de callback d'effet : elle incrémente seulement un entier.
 * L'événement complet est injecté par le banc : sa disponibilité au gestionnaire SDK
 * n'est pas qualifiée, et aucune défense SendMessage natif n'est démontrée.
 * Contrôle suspendu + réveil absent : décision en attente, sans compteur exécuté.
 * La décision porte guard-failed générique ; state().reason garde la cause fixe précise.
 */
export function createFixtureFaultAttempt(plan: OfflineMessengerPlan, clock: FixtureClock, beforeInspect: () => void | Promise<void>) {
  const guard = createOfflineMessengerGuard(plan, raw => {
    const input = raw as FixtureCall["tool_input"];
    return { recipient: input.recipient, text: input.text };
  }, () => clock.now());
  const expiresAt = plan.expiresAt;
  const target = { ...plan.target };
  let phase: Phase = "ready", reason: Refusal | undefined, executions = 0;
  let reserved: FixtureCall | undefined;
  let finish: ((decision: OfflineGateDecision) => void) | undefined;
  let cancelTimer = () => {};
  const cleanup = () => {
    const cancel = cancelTimer;
    cancelTimer = () => {};
    try { cancel(); return true; } catch { return false; }
  };
  const close = (cause: Refusal): OfflineGateDecision => {
    if (phase !== "closed") reason = cause;
    phase = "closed";
    guard.cancel();
    cleanup();
    const decision: OfflineGateDecision = { disposition: "blocked", reason: "guard-failed", hook: {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `Fixture fault: ${reason}` }
    } };
    finish?.(decision);
    finish = undefined;
    return decision;
  };
  const inTime = () => { const now = clock.now(); return Number.isFinite(now) && now < expiresAt; };
  return {
    /** Une seule entrée ; toutes les réentrées ferment également un contrôle encore en attente. */
    inspect(event: unknown): Promise<OfflineGateDecision> {
      if (phase !== "ready") return Promise.resolve(close("already-attempted"));
      phase = "checking";
      return new Promise(resolve => {
        finish = resolve;
        try {
          const proposal = capture(event);
          if (!proposal) { close("invalid-event"); return; }
          const remaining = expiresAt - clock.now();
          if (!Number.isFinite(remaining) || remaining <= 0) { close("expired"); return; }
          cancelTimer = clock.schedule(remaining, () => { if (phase === "checking") close("expired"); });
          if (phase !== "checking") { cleanup(); return; }
          void Promise.resolve().then(() => {
            if (phase === "checking") return beforeInspect();
          }).then(() => {
            if (phase !== "checking") return;
            const decision = inspectCalibrationTool(guard, proposal, [target]);
            if (decision.disposition === "blocked") { close(decision.reason); return; }
            if (!inTime() || phase !== "checking") { close("expired"); return; }
            if (!cleanup()) { close("hook-failed"); return; }
            if (!inTime() || phase !== "checking") { close("expired"); return; }
            reserved = proposal;
            phase = "reserved";
            finish?.(decision);
            finish = undefined;
          }).catch(() => { close("hook-failed"); });
        } catch { close("hook-failed"); }
      });
    },
    /** Dernier contrôle possédé par le banc, même si un faux hôte ignore le refus du hook. */
    executeFake(event: unknown): boolean {
      try {
        if (phase !== "reserved" || !reserved) { close("not-reserved"); return false; }
        phase = "consuming";
        if (!inTime() || phase !== "consuming") { close("expired"); return false; }
        const call = capture(event);
        if (!call || JSON.stringify(call) !== JSON.stringify(reserved)) { close("call-changed"); return false; }
        if (!inTime() || phase !== "consuming") { close("expired"); return false; }
        // Consommation synchrone AVANT l'incrément ; aucun effet asynchrone dans ce banc.
        phase = "consumed";
        executions++;
        return true;
      } catch { close("hook-failed"); return false; }
    },
    cancel() { close("cancelled"); },
    state() { return Object.freeze({ phase, reason, executions, reservations: guard.state().reservations }); }
  };
}
