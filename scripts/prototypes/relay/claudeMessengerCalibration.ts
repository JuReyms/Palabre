/** @file Adaptateur de banc uniquement : ce nom MCP fictif ne désigne jamais SendMessage. */
import type { OfflineGateDecision, OfflineMessengerGuard } from "./claudeMessenger.js";
import type { FixturePeer } from "./claudeMessenger.js";

/** Nom de l'unique outil factice ; jamais un alias autorisant l'outil natif. */
export const CALIBRATION_TOOL = "mcp__palabre_fixture__fixture_send";
/** Texte attendu par le garde ; le modèle reçoit une variante volontairement altérée. */
export const CALIBRATION_TEXT = "PALABRE FIXTURE\r\nTexte exact : café 🙂";

/** Refus par défaut ; seul le faux outil est normalisé vers le garde hors ligne. */
export function inspectCalibrationTool(
  guard: OfflineMessengerGuard, event: unknown, bindings: readonly FixturePeer[]
): OfflineGateDecision {
  try {
    if (!event || typeof event !== "object" || Array.isArray(event)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(event))) throw new Error();
    const fields = Object.getOwnPropertyDescriptors(event);
    if (Reflect.ownKeys(fields).some(key => typeof key !== "string" || !("value" in fields[key]!))
      || fields.tool_name?.value !== CALIBRATION_TOOL) throw new Error();
    // Transformation EXPLICITE de fixture, pas décodage du vrai outil natif.
    return guard.inspect({ ...event, tool_name: "SendMessage" }, bindings);
  } catch {
    guard.cancel();
    return { disposition: "blocked", reason: "unexpected-tool", hook: { hookSpecificOutput: {
      hookEventName: "PreToolUse", permissionDecision: "deny",
      permissionDecisionReason: "Calibration: unexpected tool or event"
    } } };
  }
}

/**
 * Vérifie la trace JSON locale du SDK, pas la prose du modèle : un seul appel MCP,
 * puis rejet lié au même tool_use_id et attribué au hook par le runtime.
 * Ce relevé du banc n'authentifie aucune réponse de conversation distante.
 */
export function hasCorrelatedCalibrationDenial(events: readonly unknown[], sessionId: string): boolean {
  const records = events.filter((item): item is Record<string, any> => !!item && typeof item === "object" && !Array.isArray(item));
  const init = records.filter(item => item.type === "system" && item.subtype === "init");
  const results = records.filter(item => item.type === "result");
  const calls = records.filter(item => item.type === "assistant").flatMap(item =>
    Array.isArray(item.message?.content) ? item.message.content.filter((block: any) => block?.type === "tool_use") : []);
  if (init.length !== 1 || results.length !== 1 || calls.length !== 1) return false;
  const [start] = init, [result] = results, [call] = calls;
  if (start!.session_id !== sessionId || start!.model !== "claude-opus-5-5"
    || start!.claude_code_version !== "2.1.302" || JSON.stringify(start!.tools) !== JSON.stringify([CALIBRATION_TOOL])
    || result!.session_id !== sessionId || result!.subtype !== "success" || result!.is_error !== false
    || !Object.hasOwn(result!.modelUsage ?? {}, "claude-opus-5-5")
    || call.name !== CALIBRATION_TOOL || typeof call.id !== "string" || !call.id) return false;
  if (records.some(item => item.type === "assistant" && (item.session_id !== sessionId || item.message?.model !== "claude-opus-5-5"))) return false;
  const denials = result!.permission_denials;
  if (!Array.isArray(denials) || denials.length !== 1 || denials[0]?.tool_use_id !== call.id
    || denials[0]?.tool_name !== CALIBRATION_TOOL) return false;
  return records.some(item => item.type === "user" && item.session_id === sessionId
    && item.message?.content?.some?.((block: any) => block.type === "tool_result" && block.tool_use_id === call.id && block.is_error === true)
    && item.tool_result_meta?.some?.((meta: any) => meta.id === call.id
      && meta.permission_decision?.decision === "reject" && meta.permission_decision?.source === "hook"));
}

/** Observations locales requises pour qualifier UNE panne sur le faux outil, pas un envoi natif. */
export interface CalibrationFaultEvidence {
  scenario: string;
  sessionId: string;
  inventoryValidated: boolean;
  handlerCalls: number;
  outerTimedOut: boolean;
  error: unknown;
  faultElapsedMs?: number;
  hookDecisions: readonly { tool: string; toolUseId?: string; sessionMatches: boolean; disposition: string; reason?: string }[];
  events: readonly unknown[];
}

/**
 * Une panne injectée seule et compteur nul ne suffisent pas : exige le rejet corrélé
 * attribué au hook par le runtime. Le timeout global du banc ne qualifie pas le SDK.
 * Pour le scénario timeout, la durée monotone doit être compatible avec les 5 s du hook
 * (tolérance IPC 500 ms) ; ni prose du modèle ni seul signal annulé ne font preuve.
 */
export function hasQualifiedCalibrationFaultBlock(evidence: CalibrationFaultEvidence): boolean {
  try {
    if (!["throw", "timeout"].includes(evidence.scenario) || !evidence.inventoryValidated || evidence.error
      || evidence.outerTimedOut || evidence.handlerCalls !== 0 || evidence.hookDecisions.length !== 1) return false;
    const hook = evidence.hookDecisions[0]!;
    if (hook.tool !== CALIBRATION_TOOL || !hook.sessionMatches || hook.disposition !== "injected-fault"
      || hook.reason !== evidence.scenario || typeof hook.toolUseId !== "string" || !hook.toolUseId) return false;
    if (evidence.scenario === "timeout" && (!Number.isFinite(evidence.faultElapsedMs)
      || evidence.faultElapsedMs! < 4500 || evidence.faultElapsedMs! > 5500)) return false;
    if (!hasCorrelatedCalibrationDenial(evidence.events, evidence.sessionId)) return false;
    return evidence.events.some((item: any) => item?.type === "assistant" && item.message?.content?.some?.(
      (block: any) => block.type === "tool_use" && block.id === hook.toolUseId && block.name === CALIBRATION_TOOL));
  } catch { return false; }
}
