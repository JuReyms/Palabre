/** @file Second contrôle natif, banc hors ligne : neutralité unique, callback toujours refusant ; aucune IO ou SDK. */
import { createNativeDenyProbe, nativeFirstProbePolicy, nativeHookDeny, parseNativeProbePlan, type NativeProbePlan } from "./claudeNativeProbe.js";

/** Politique candidate ; une option typable ne prouve pas que sa règle ask est appliquée. */
export function nativeAskProbePolicy() {
  const first = nativeFirstProbePolicy();
  return { ...first, settings: { ...first.settings, permissions: { ask: ["SendMessage"] } } };
}

/** Plan copié et figé, message court sur une ligne ; ni autorisation ni schéma natif qualifié. */
export function parseNativeAskPlan(raw: unknown): NativeProbePlan {
  const plan = parseNativeProbePlan(raw);
  if (new TextEncoder().encode(plan.message).length > 160 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(plan.message)) {
    throw new Error("Essai ask : message bénin sur une ligne, sans contrôle et limité à 160 octets UTF-8.");
  }
  return plan;
}

/** Lit une propriété propre sans appeler son accesseur ; un objet inconnu reste un défaut bloquant. */
function field(raw: unknown, key: string): any {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) throw new Error("not-plain");
  const descriptor = Object.getOwnPropertyDescriptor(raw, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, "value")) throw new Error("not-data");
  return descriptor.value;
}

/** Forme observée seulement : aucune sélection entre champs ni normalisation de leur texte. */
function matchesInput(raw: unknown, plan: NativeProbePlan, withSummary: boolean): boolean {
  const expected: Record<string, string> = { to: plan.target.recipient, message: plan.message, type: "message",
    recipient: plan.target.recipient, recipient_kind: "name", content: plan.message };
  if (withSummary) expected.summary = plan.message;
  if (!raw || typeof raw !== "object" || Reflect.ownKeys(raw).length !== Object.keys(expected).length) return false;
  return Object.entries(expected).every(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    return descriptor?.enumerable === true && field(raw, key) === value;
  });
}

/** Règle entière candidate attendue ; source à observer, pas une preuve préalable de paramètres. */
function matchesAskRule(raw: unknown): boolean {
  return !!raw && typeof raw === "object" && Reflect.ownKeys(raw).length === 2
    && field(raw, "source") === "flagSettings" && field(raw, "toolName") === "SendMessage";
}

/** Horloge et annulation de l'hôte injectées ; aucun timer, réveil ou retrait de message promis. */
export interface NativeAskBudget { now: () => number; deadline: number; signal?: AbortSignal }

/**
 * Banc candidat, sans lanceur : handshake injecté, au plus un hook neutre, permissions toujours deny.
 * Toute erreur, répétition ou expiration ferme le banc avant lecture de données externes.
 * La neutralité ne protège PAS contre une règle ask ignorée par un futur runtime.
 */
export function createNativeAskProbe(sessionId: string, rawPlan: unknown, budget: NativeAskBudget) {
  const plan = parseNativeAskPlan(rawPlan), log = createNativeDenyProbe(sessionId);
  const { now, deadline, signal } = budget;
  if (typeof now !== "function" || !Number.isFinite(deadline)) throw new Error("Invalid ask probe budget");
  let phase: "unarmed" | "ready" | "neutral" | "denied" | "closed" = "unarmed";
  let armed = false, armCalls = 0, neutralCount = 0, stopped = false, callId: string | null = null;
  const live = () => { try { const at = now(); return Number.isFinite(at) && at < deadline && !signal?.aborted && !stopped; } catch { return false; } };
  return {
    /** Déclaration du handshake de la même instance, à fournir par un futur hôte ; aucun appel SDK ici. */
    arm(handshake: unknown): boolean {
      const eligible = phase === "unarmed";
      phase = "closed"; armCalls++;
      try {
        if (!eligible || field(handshake, "claude_code_version") !== "2.1.302" || field(handshake, "hooks_applied") !== true || !live()) return false;
        const state = log.state();
        if (armCalls !== 1 || state.hookCalls || state.permissionCalls) return false;
        armed = true; phase = "ready"; return true;
      } catch { return false; }
    },
    /** Réserve avant toute capture : même une réentrée pendant celle-ci ne peut ouvrir un second passage. */
    hook(event: unknown, callbackId?: string) {
      const eligible = phase === "ready";
      phase = "closed";
      try {
        log.hook(event, callbackId);
        if (!eligible || !live()) return nativeHookDeny();
        const state = log.state(), hook = state.hooks[0]?.event;
        if (state.captureFailed || state.hookCalls !== 1 || state.permissionCalls !== 0
          || hook?.hook_event_name !== "PreToolUse" || hook.session_id !== sessionId || hook.tool_name !== "SendMessage"
          || typeof callbackId !== "string" || !callbackId || hook.tool_use_id !== callbackId
          || !matchesInput(hook.tool_input, plan, true)) return nativeHookDeny();
        callId = callbackId; neutralCount++; phase = "neutral";
        return {}; // Pas allow : le runtime doit encore appliquer la règle ask.
      } catch { return nativeHookDeny(); }
    },
    /** Capture bornée de l'indication ask et de l'entrée, sans copier le signal ou d'autres objets hôte. */
    permission(tool: unknown, input: unknown, context: unknown) {
      const eligible = phase === "neutral";
      phase = "closed";
      let id: unknown, rule: unknown;
      try { id = field(context, "toolUseID"); rule = field(context, "matchedAskRule") ?? null; }
      catch { /* L'échec de capture sera consigné et le refus reste fixe. */ }
      const denial = log.permission(tool, { input, matchedAskRule: rule }, id);
      try {
        if (!eligible || !live()) return denial;
        const state = log.state(), captured = state.permissions[0];
        if (!state.captureFailed && state.hookCalls === 1 && state.permissionCalls === 1 && captured?.tool === "SendMessage"
          && captured.callId === callId && matchesAskRule(captured.input.matchedAskRule)
          && JSON.stringify(captured.input.input) === JSON.stringify(state.hooks[0].event.tool_input)) phase = "denied";
      } catch { /* Même une preuve absente ou inconnue ne change jamais deny. */ }
      return denial;
    },
    /** Fermeture terminale, sans remise à zéro ni rejeu ; à utiliser sur annulation/erreur de l'hôte. */
    close() { stopped = true; phase = "closed"; },
    /**
     * Copies indépendantes ; possibleSend devient vrai dès la neutralité et ne revient jamais à faux,
     * même après close ou deny : le banc n'a aucun compteur natif attestant la non-exécution.
     * Sa valeur false n'est pas non plus une preuve de non-réception dans un runtime externe.
     */
    state() { return { phase, armed, armCalls, neutralCount, possibleSend: neutralCount > 0, callId, capture: log.state() }; }
  };
}

/**
 * Oracle PARTIEL candidat figé avant essai : preuve liée d'un callback refusant, pas d'un non-envoi.
 * Formes et source de refus attendues extrapolées du faux MCP ; toute variation reste négative.
 * Ne pas utiliser l'oracle du premier essai, ni retirer summary pour rendre les entrées égales.
 */
export function hasNativeAskDenial(events: readonly unknown[], sessionId: string, rawPlan: unknown,
  state: ReturnType<ReturnType<typeof createNativeAskProbe>["state"]>): boolean {
  try {
    const plan = parseNativeAskPlan(rawPlan), capture = state.capture;
    if (state.phase !== "denied" || !state.armed || state.armCalls !== 1 || state.neutralCount !== 1 || !state.possibleSend || !state.callId
      || capture.captureFailed || capture.hookCalls !== 1 || capture.permissionCalls !== 1
      || capture.hooks.length !== 1 || capture.permissions.length !== 1 || events.length > 256) return false;
    const rows = events as any[];
    const init = rows.filter(row => row?.type === "system" && row.subtype === "init");
    const results = rows.filter(row => row?.type === "result");
    const assistants = rows.filter(row => row?.type === "assistant");
    const calls = assistants.flatMap(row => row.message?.content?.filter((block: any) => block.type === "tool_use") ?? []);
    const answers = rows.filter(row => row?.type === "user").flatMap(row =>
      (row.message?.content ?? []).filter((block: any) => block.type === "tool_result").map((block: any) => ({ row, block })));
    if (init.length !== 1 || results.length !== 1 || calls.length !== 1 || answers.length !== 1) return false;
    if (init[0].session_id !== sessionId || init[0].claude_code_version !== "2.1.302" || init[0].model !== "claude-opus-5-5"
      || init[0].permissionMode !== "default" || JSON.stringify(init[0].tools) !== '["SendMessage"]'
      || !Array.isArray(init[0].mcp_servers) || init[0].mcp_servers.length !== 0
      || assistants.some(row => row.session_id !== sessionId || row.message?.model !== "claude-opus-5-5")) return false;
    const call = calls[0], hook = capture.hooks[0].event, permission = capture.permissions[0];
    const callRow = assistants.find(row => row.message?.content?.includes(call));
    if (!(rows.indexOf(init[0]) < rows.indexOf(callRow) && rows.indexOf(callRow) < rows.indexOf(answers[0].row)
      && rows.indexOf(answers[0].row) < rows.indexOf(results[0]))) return false;
    if (call.name !== "SendMessage" || call.id !== state.callId || !matchesInput(call.input, plan, false)
      || hook.hook_event_name !== "PreToolUse" || hook.tool_name !== "SendMessage" || hook.session_id !== sessionId
      || hook.tool_use_id !== call.id || capture.hooks[0].callbackId !== call.id || !matchesInput(hook.tool_input, plan, true)
      || permission.tool !== "SendMessage" || permission.callId !== call.id || !matchesAskRule(permission.input.matchedAskRule)
      || JSON.stringify(permission.input.input) !== JSON.stringify(hook.tool_input)) return false;
    const { row, block } = answers[0], meta = row.tool_result_meta?.[0];
    if (row.session_id !== sessionId || block.tool_use_id !== call.id || block.is_error !== true
      || !Array.isArray(row.tool_result_meta) || row.tool_result_meta.length !== 1 || meta.id !== call.id
      || meta.non_execution_kind !== "permission-rule" || meta.permission_decision?.decision !== "reject"
      || meta.permission_decision?.source !== "user_reject") return false;
    const result = results[0];
    return result.session_id === sessionId && result.subtype === "success" && result.is_error === false
      && Object.hasOwn(result.modelUsage ?? {}, "claude-opus-5-5") && Array.isArray(result.permission_denials)
      && result.permission_denials.length === 1 && result.permission_denials[0].tool_name === "SendMessage"
      && result.permission_denials[0].tool_use_id === call.id;
  } catch { return false; }
}
