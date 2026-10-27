/** @file Premier essai natif préparé : refus systématique, sans SDK, processus ou IO. */
import { isAbsolute, win32 } from "node:path";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const control = /[\p{Cc}\p{Cf}]/u;
const bytes = (value: string) => new TextEncoder().encode(value).length;

/** Plan privé déclaré par l'opérateur ; ni preuve d'identité native ni autorisation humaine à lui seul. */
export interface NativeProbePlan {
  v: 1;
  target: { sessionId: string; directory: string; recipient: string };
  message: string;
}

/** Capture JSON bornée, sans accesseur/toJSON, pour journal privé ; une entrée hostile reste refusée. */
function snapshot(value: unknown): any {
  let nodes = 0, size = 0;
  const seen = new Set<object>();
  const copy = (item: unknown, depth: number): any => {
    if (++nodes > 1024 || depth > 10) throw new Error("capture-limit");
    if (typeof item === "string") { size += bytes(item); if (size > 16_384) throw new Error("capture-limit"); return item; }
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) return item;
    if (!item || typeof item !== "object" || seen.has(item)) throw new Error("not-json");
    const array = Array.isArray(item);
    if (Object.getPrototypeOf(item) !== (array ? Array.prototype : Object.prototype) && Object.getPrototypeOf(item) !== null) throw new Error("not-plain");
    seen.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (array && (!Number.isInteger(descriptors.length?.value) || descriptors.length!.value > 1024)) throw new Error("capture-limit");
    const output: any = array ? [] : Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (array && key === "length") continue;
      if (typeof key !== "string" || !Object.hasOwn(descriptors[key]!, "value") || !descriptors[key]!.enumerable) throw new Error("not-data");
      size += bytes(key);
      if (size > 16_384 || (array && !/^(0|[1-9]\d*)$/.test(key))) throw new Error("capture-limit");
      Object.defineProperty(output, key, { value: copy(descriptors[key]!.value, depth + 1), enumerable: true });
    }
    if (array && output.length !== (item as unknown[]).length) throw new Error("sparse-array");
    seen.delete(item);
    return output;
  };
  // Normalise uniquement la représentation du journal JSON, jamais le texte des champs.
  return JSON.parse(JSON.stringify(copy(value, 0)));
}

/** Valide strictement un plan explicite ; aucun choix de conversation implicite, aucune IO. */
export function parseNativeProbePlan(raw: unknown): NativeProbePlan {
  try {
    const plan = snapshot(raw);
    if (!plan || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "message,target,v" || plan.v !== 1
      || !plan.target || Array.isArray(plan.target) || Object.keys(plan.target).sort().join(",") !== "directory,recipient,sessionId") throw new Error();
    const { sessionId, directory, recipient } = plan.target;
    if (typeof sessionId !== "string" || !uuid.test(sessionId) || typeof directory !== "string"
      || !(isAbsolute(directory) || win32.isAbsolute(directory)) || directory.length > 4096 || control.test(directory)
      || typeof recipient !== "string" || !recipient.trim() || recipient !== recipient.trim()
      || bytes(recipient) > 1024 || control.test(recipient) || typeof plan.message !== "string"
      || !plan.message.trim() || bytes(plan.message) > 4096 || plan.message.includes("\0")) throw new Error();
    return Object.freeze({ v: 1, target: Object.freeze({ sessionId, directory, recipient }), message: plan.message });
  } catch { throw new Error("Plan natif invalide : fournir v=1, cible explicite (UUID, dossier absolu, destinataire) et message de 1 à 4096 octets UTF-8."); }
}

/** Options du PREMIER essai seulement : pas de règle ask, neutralité, accord ou MCP. */
export function nativeFirstProbePolicy() {
  return { tools: ["SendMessage"], allowedTools: [] as string[], permissionMode: "default" as const,
    settingSources: [] as [], strictMcpConfig: true, mcpServers: {}, skills: [] as [], plugins: [] as [],
    maxTurns: 2, persistSession: false,
    settings: { hooks: {}, enabledPlugins: {}, syncClaudeAiSkills: false, syncClaudeAiPlugins: false } };
}

/** Refus fixe : ni contenu externe dans le diagnostic, ni modification d'entrée ou de permissions. */
export function nativeHookDeny() {
  return { hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const,
    permissionDecisionReason: "Palabre native probe: all tool calls denied" } };
}

/** Capture au plus quatre observations privées ; toute tentative, même mal formée ou répétée, est refusée. */
export function createNativeDenyProbe(sessionId: string) {
  if (!uuid.test(sessionId)) throw new Error("Invalid probe session");
  let hookCalls = 0, permissionCalls = 0, captureFailed = false;
  const hooks: any[] = [], permissions: any[] = [];
  return {
    hook(event: unknown, callbackId?: string) {
      hookCalls++;
      try {
        const captured = snapshot(event);
        if (typeof callbackId !== "string" || bytes(callbackId) > 512) captureFailed = true;
        if (hooks.length < 4) hooks.push({ event: captured, callbackId: typeof callbackId === "string" && bytes(callbackId) <= 512 ? callbackId : null });
      } catch { captureFailed = true; }
      return nativeHookDeny();
    },
    permission(tool: unknown, input: unknown, callId: unknown) {
      permissionCalls++;
      try { if (permissions.length < 4) permissions.push(snapshot({ tool, input, callId })); }
      catch { captureFailed = true; }
      return { behavior: "deny" as const, message: "Palabre native probe: no permission granted" };
    },
    state() { return { hookCalls, permissionCalls, captureFailed,
      hooks: JSON.parse(JSON.stringify(hooks)), permissions: JSON.parse(JSON.stringify(permissions)) }; }
  };
}

/**
 * Constat PARTIEL sur événements injectés : un refus runtime lié au seul appel natif.
 * Ni compteur du gestionnaire natif, ni preuve de non-réception, ni décodeur SendMessage.
 */
export function hasNativeHookDenial(events: readonly unknown[], sessionId: string, state: ReturnType<ReturnType<typeof createNativeDenyProbe>["state"]>): boolean {
  try {
    if (state.captureFailed || state.hookCalls !== 1 || state.permissionCalls !== 0 || state.hooks.length !== 1) return false;
    const rows = events as any[];
    const init = rows.filter(row => row?.type === "system" && row.subtype === "init");
    const results = rows.filter(row => row?.type === "result");
    const assistants = rows.filter(row => row?.type === "assistant");
    const calls = assistants.flatMap(row => row.message?.content?.filter((block: any) => block.type === "tool_use") ?? []);
    const answers = rows.filter(row => row?.type === "user").flatMap(row =>
      (row.message?.content ?? []).filter((block: any) => block.type === "tool_result").map((block: any) => ({ row, block })));
    if (init.length !== 1 || results.length !== 1 || calls.length !== 1 || answers.length !== 1) return false;
    if (init[0].session_id !== sessionId || init[0].claude_code_version !== "2.1.302" || init[0].model !== "claude-opus-5-5"
      || JSON.stringify(init[0].tools) !== '["SendMessage"]' || !Array.isArray(init[0].mcp_servers) || init[0].mcp_servers.length !== 0) return false;
    if (assistants.some(row => row.session_id !== sessionId || row.message?.model !== "claude-opus-5-5")) return false;
    const call = calls[0], observation = state.hooks[0], hook = observation.event;
    if (call.name !== "SendMessage" || typeof call.id !== "string" || !call.id || hook.hook_event_name !== "PreToolUse"
      || hook.session_id !== sessionId || hook.tool_name !== "SendMessage" || hook.tool_use_id !== call.id
      || observation.callbackId !== call.id || JSON.stringify(hook.tool_input) !== JSON.stringify(call.input)) return false;
    const { row, block } = answers[0];
    if (row.session_id !== sessionId || block.tool_use_id !== call.id || block.is_error !== true
      || !Array.isArray(row.tool_result_meta) || row.tool_result_meta.length !== 1 || row.tool_result_meta[0].id !== call.id
      || row.tool_result_meta[0].permission_decision?.decision !== "reject" || row.tool_result_meta[0].permission_decision?.source !== "hook") return false;
    const result = results[0];
    return result.session_id === sessionId && result.subtype === "success" && result.is_error === false
      && Object.hasOwn(result.modelUsage ?? {}, "claude-opus-5-5") && Array.isArray(result.permission_denials)
      && result.permission_denials.length === 1 && result.permission_denials[0].tool_use_id === call.id
      && result.permission_denials[0].tool_name === "SendMessage";
  } catch { return false; }
}
