/** @file Profil de calibration restrictif, sans SDK, IO ou droit d'envoi réel. */
import type { OfflineMessengerPlan, OfflineGateDecision } from "./claudeMessenger.js";
import { createFixtureFaultAttempt, type FixtureClock } from "./claudeMessengerFaults.js";

/** Options de banc uniquement : aucune préapprobation, décision normale, faux MCP toujours soumis au contrôle. */
export function guardedFixturePolicy() {
  return { allowedTools: [] as string[], permissionMode: "default" as const,
    mcpToolPolicy: [{ name: "fixture_send", permission_policy: "always_ask" as const }] };
}

/**
 * Convertit exception/rejet en deny et borne l'attente propre du banc à 2 s,
 * avant le délai SDK de 5 s du lanceur. L'ordonnanceur reste injecté dans les tests.
 * Le second contrôle refuse TOUT, même la bonne proposition : ce profil deny-only
 * mesure une protection et ne sait pas autoriser une tâche ou envoyer un message.
 * La disponibilité effective de canUseTool, notamment pour SendMessage, reste à qualifier.
 */
export function createGuardedCalibration(plan: OfflineMessengerPlan, clock: FixtureClock, beforeInspect: () => void | Promise<void>) {
  const attempt = createFixtureFaultAttempt(plan, {
    now: () => clock.now(), schedule: (delay, expire) => clock.schedule(Math.min(delay, 2000), expire)
  }, beforeInspect);
  let permissionCalls = 0;
  const deny = (): OfflineGateDecision["hook"] => {
    attempt.cancel();
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny",
      permissionDecisionReason: "Guarded fixture: blocked" } };
  };
  return {
    /** Aucun rejet de promesse ne doit sortir du callback, y compris pendant son nettoyage. */
    async hook(event: unknown, signal: AbortSignal): Promise<OfflineGateDecision["hook"]> {
      let output: OfflineGateDecision["hook"] = {};
      let listening = false;
      const onAbort = () => { attempt.cancel(); };
      try {
        if (signal.aborted) return deny();
        signal.addEventListener("abort", onAbort, { once: true });
        listening = true;
        if (signal.aborted) output = deny();
        else output = (await attempt.inspect(event)).hook;
      } catch { output = deny(); }
      try {
        if (listening) signal.removeEventListener("abort", onAbort);
        if (signal.aborted || attempt.state().phase === "closed") output = deny();
      } catch { output = deny(); }
      return output;
    },
    /** Refus sans mise à jour des droits ; protège le banc si le premier callback n'a pas tranché. */
    async canUseTool(): Promise<{ behavior: "deny"; message: string }> {
      permissionCalls++;
      attempt.cancel();
      return { behavior: "deny", message: "Guarded fixture: no execution permitted" };
    },
    cancel() { attempt.cancel(); },
    state() { return Object.freeze({ ...attempt.state(), permissionCalls }); }
  };
}
