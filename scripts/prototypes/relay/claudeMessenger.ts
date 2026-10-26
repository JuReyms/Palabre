/**
 * @file Prototype #193 strictement hors ligne : garde d'un messager, sans transport ni SDK.
 * Aucun processus, réseau, fichier, token ou configuration. Non importé par src/ et non livré.
 * Les liaisons et propositions normalisées sont des fixtures, PAS un schéma SendMessage natif.
 * L'intégration SDK, la liaison UUID/adresse réelle et la corrélation de réponse restent à qualifier.
 */

/** Liaison fictive fournie par le banc ; ne prouve jamais une identité ou une surface réelle. */
export interface FixturePeer {
  kind: "fixture-only";
  sessionId: string;
  recipient: string;
}

/** Plan du banc, figé à la création. Aucun champ ne constitue une autorisation d'envoi réel. */
export interface OfflineMessengerPlan {
  messengerSessionId: string;
  target: FixturePeer;
  envelope: string;
  expiresAt: number;
}

/** Forme interne au banc, délibérément distincte de l'entrée native non qualifiée. */
export interface DecodedFixtureSend { recipient: string; text: string }

/** Causes sans texte libre ni contenu du prompt dans le diagnostic. */
export type MessengerRefusal = "invalid-event" | "wrong-messenger" | "unexpected-tool"
  | "invalid-proposal" | "ambiguous-target" | "target-changed" | "message-changed"
  | "already-reserved" | "cancelled" | "expired" | "guard-failed";

/** Réponse simulée : poursuivre les permissions normales n'est ni un accord ni un envoi. */
export type OfflineGateDecision =
  | { disposition: "continue-permissions"; hook: Record<string, never> }
  | { disposition: "blocked"; reason: MessengerRefusal; hook: {
    hookSpecificOutput: { hookEventName: "PreToolUse"; permissionDecision: "deny"; permissionDecisionReason: string }
  } };

/** État en mémoire seulement ; aucune persistance ou protection multi-processus revendiquée. */
export interface OfflineGateState {
  phase: "ready" | "checking" | "reserved" | "closed";
  reservations: number;
  reason?: MessengerRefusal;
}

/** Interface sans fonction d'envoi, de réinitialisation ou d'approbation. */
export interface OfflineMessengerGuard {
  inspect(event: unknown, currentBindings: readonly FixturePeer[]): OfflineGateDecision;
  cancel(): void;
  state(): Readonly<OfflineGateState>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTROL = /[\p{Cc}\p{Cf}]/u;
const UNPAIRED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

/** Données JSON simples seulement, sans accesseur ni propriété héritée qui changerait à la lecture. */
function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(value, key)!);
}

/** Identifiants opaques bornés : aucune interprétation d'une adresse native. */
function opaque(value: unknown, max = 2048): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max
    && value.trim() === value && !CONTROL.test(value) && !UNPAIRED.test(value);
}

/** Compare les trois champs du relevé fictif, sans accepter de métadonnée d'autorité supplémentaire. */
function fixture(value: unknown): value is FixturePeer {
  return record(value) && Object.keys(value).length === 3 && value.kind === "fixture-only"
    && typeof value.sessionId === "string" && UUID.test(value.sessionId) && opaque(value.recipient);
}

/**
 * Crée un garde synchrone, terminal au premier refus et après une unique réservation.
 * decodeFixture est un parseur de banc injecté, pas un décodeur SDK fourni par Palabre.
 * Il doit être pur ; ses erreurs et réentrées ferment le garde. Les données sont copiées,
 * le délai est revérifié après décodage et la réservation précède tout effet simulé du banc.
 * Une décision neutre laisse TOUJOURS les permissions de l'hôte décider ; aucun allow.
 */
export function createOfflineMessengerGuard(
  plan: OfflineMessengerPlan,
  decodeFixture: (raw: unknown) => DecodedFixtureSend | null,
  now: () => number
): OfflineMessengerGuard {
  if (!record(plan) || !fixture(plan.target) || typeof plan.messengerSessionId !== "string" || !UUID.test(plan.messengerSessionId)
    || plan.messengerSessionId === plan.target.sessionId || typeof decodeFixture !== "function" || typeof now !== "function"
    || typeof plan.envelope !== "string" || !plan.envelope.trim() || plan.envelope.includes("\0") || UNPAIRED.test(plan.envelope)
    || Buffer.byteLength(plan.envelope, "utf8") > 64 * 1024 || !Number.isFinite(plan.expiresAt) || plan.expiresAt <= 0) {
    throw new Error("Invalid offline messenger plan");
  }
  const { messengerSessionId, envelope, expiresAt } = plan;
  const { sessionId, recipient } = plan.target;
  let state: OfflineGateState = { phase: "ready", reservations: 0 };
  const block = (reason: MessengerRefusal): OfflineGateDecision => {
    state = { ...state, phase: "closed", reason };
    return { disposition: "blocked", reason, hook: { hookSpecificOutput: {
      hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `Offline messenger: ${reason}`
    } } };
  };
  const inTime = () => { const time = now(); return Number.isFinite(time) && time < expiresAt; };
  return {
    inspect(event, currentBindings) {
      try {
        if (state.phase !== "ready") return block(state.reason ?? "already-reserved");
        state = { ...state, phase: "checking" };
        if (!inTime()) return block("expired");
        if (!record(event) || event.hook_event_name !== "PreToolUse" || !opaque(event.tool_use_id, 256)) return block("invalid-event");
        if (event.session_id !== messengerSessionId) return block("wrong-messenger");
        if (event.tool_name !== "SendMessage") return block("unexpected-tool");
        if (!Array.isArray(currentBindings) || currentBindings.length !== 1) return block("ambiguous-target");
        const binding = currentBindings[0];
        if (!fixture(binding) || binding.sessionId !== sessionId || binding.recipient !== recipient) return block("target-changed");
        const send = decodeFixture(event.tool_input);
        if (!record(send) || Object.keys(send).length !== 2 || !opaque(send.recipient) || typeof send.text !== "string") return block("invalid-proposal");
        if (send.recipient !== recipient) return block("target-changed");
        if (send.text !== envelope) return block("message-changed");
        if (state.phase !== "checking") return block(state.reason ?? "already-reserved");
        if (!inTime()) return block("expired");
        if (state.phase !== "checking") return block(state.reason ?? "already-reserved");
        state = { phase: "reserved", reservations: 1 };
        return { disposition: "continue-permissions", hook: {} };
      } catch {
        return block("guard-failed");
      }
    },
    cancel() { block("cancelled"); },
    state() { return Object.freeze({ ...state }); }
  };
}
