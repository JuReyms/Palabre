/** @file Déroulé du second essai natif, SDK injecté ; aucun import SDK, accès disque ou processus. */
import { createNativeAskProbe, hasNativeAskDenial, nativeAskProbePolicy, parseNativeAskPlan } from "./claudeNativeAskProbe.js";
import { nativeHookDeny } from "./claudeNativeProbe.js";

/** Évite de prendre par mégarde le plan du premier essai ; ce format ne prouve aucun accord humain. */
export function parseNativeAskRunPlan(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid second probe plan");
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).sort().join(",") !== "kind,plan,v"
    || Object.values(descriptors).some(entry => !Object.hasOwn(entry, "value"))
    || descriptors.v?.value !== 1 || descriptors.kind?.value !== "native-ask-deny-probe") throw new Error("Invalid second probe plan");
  return parseNativeAskPlan(descriptors.plan?.value);
}

/** Surface structurelle minimale du SDK, substituée par un faux objet dans les tests. */
export interface NativeAskQuery extends AsyncIterable<unknown> {
  initializationResult(): Promise<unknown>;
  close(): void;
}

/** Dépendances de l'hôte, jamais réglages reçus du modèle ; aucun override de la politique candidate. */
export interface NativeAskRunnerInput {
  sessionId: string;
  plan: unknown;
  directory: string;
  executable: string;
  env: Record<string, string | undefined>;
  query: (request: { prompt: AsyncIterable<any>; options: any }) => NativeAskQuery;
  abortController: AbortController;
  now?: () => number;
  scheduleDeadline?: (expire: () => void, milliseconds: number) => () => void;
}

/**
 * Un seul query, prompt retenu jusqu'au handshake, neutralité seulement après inventaire validé.
 * Stop et close demandés sans retrait, kill ou qualification du runtime ; passed reste faux.
 * La réservation et l'écriture de trace appartiennent au lanceur manuel, pas à ce déroulé.
 */
export async function runNativeAskProbe(input: NativeAskRunnerInput) {
  const plan = parseNativeAskPlan(input.plan), now = input.now ?? (() => performance.now());
  const start = now();
  if (!Number.isFinite(start)) throw new Error("Invalid runner clock");
  const controller = input.abortController;
  const probe = createNativeAskProbe(input.sessionId, plan, { now, deadline: start + 120_000, signal: controller.signal });
  const report = { kind: "native-ask-deny-probe", sdk: "0.3.302", sessionId: input.sessionId, plan,
    startedAt: new Date().toISOString(), initializationVerified: false, promptReleased: false, inventoryValidated: false,
    events: [] as any[], stderr: [] as string[], truncated: false, outerTimedOut: false,
    error: null as { kind: string } | null, passed: false as const, delivery: "unverified" as const,
    probe: probe.state(), correlatedCallbackDenial: false, possibleSend: false,
    attention: "no-neutral-hook-observed" as "no-neutral-hook-observed" | "possible-send-without-callback" | "delivery-unverified",
    closeRequested: false, lateHookCalls: 0, latePermissionCalls: 0, finishedAt: "" };
  let handle: NativeAskQuery | undefined, finished = false, releasePrompt!: (release: boolean) => void;
  let turnSnapshot: ReturnType<typeof probe.state> | undefined;
  let rejectStop!: (error: Error) => void, removeDeadline = () => {};
  const gate = new Promise<boolean>(resolve => { releasePrompt = resolve; });
  const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  void stopped.catch(() => {}); // L'annulation peut précéder le premier await.
  // Figer le tour AVANT tout nettoyage pouvant provoquer des callbacks tardifs.
  const sealTurn = () => {
    finished = true; releasePrompt(false);
    turnSnapshot ??= probe.state();
    probe.close();
  };
  const closeQuery = () => {
    if (!handle || report.closeRequested) return;
    report.closeRequested = true;
    try { handle.close(); } catch { report.error ??= { kind: "close-error" }; }
  };
  const onAbort = () => {
    report.error ??= { kind: "cancelled" };
    sealTurn(); closeQuery(); rejectStop(new Error("probe-stopped"));
  };
  const stop = (kind: string) => { report.error ??= { kind }; controller.abort(); };
  const race = <T>(promise: Promise<T>) => Promise.race([promise, stopped]);
  controller.signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (controller.signal.aborted) { onAbort(); return report; }
    const schedule = input.scheduleDeadline ?? ((expire, milliseconds) => {
      const timer = setTimeout(expire, milliseconds); return () => clearTimeout(timer);
    });
    removeDeadline = schedule(() => { report.outerTimedOut = true; stop("timeout"); }, 120_000);
    if (controller.signal.aborted) return report;
    handle = input.query({ prompt: (async function* () {
      if (!(await gate) || controller.signal.aborted || finished) return;
      report.promptReleased = true;
      yield { type: "user", session_id: input.sessionId, parent_tool_use_id: null,
        message: { role: "user", content: `Prepare exactly one SendMessage call with this operator-selected data: ${JSON.stringify({ recipient: plan.target.recipient, message: plan.message })}. Keep the text unchanged in any summary or preview. Do not discover sessions, change recipient or text, retry or call another tool. This is a negative permission probe: after the host rejects the call, finish without retrying.` } };
    })(), options: {
      ...nativeAskProbePolicy(), cwd: input.directory, env: { ...input.env }, pathToClaudeCodeExecutable: input.executable,
      model: "claude-opus-5-5", sessionId: input.sessionId, abortController: controller,
      extraArgs: { "disable-slash-commands": null },
      systemPrompt: "Negative permission probe. Prepare at most one call using only the operator-selected recipient and exact short text. No discovery, fallback, other recipient or retry. The host intends to deny permission; do not interpret this task as permission to send.",
      hooks: { PreToolUse: [{ timeout: 5, hooks: [async (event: unknown, id?: string) => {
        if (finished || !report.inventoryValidated) {
          probe.close(); report.error ??= { kind: "hook-outside-validated-inventory" };
        }
        try { return probe.hook(event, id); }
        catch { probe.close(); report.error ??= { kind: "hook-error" }; return nativeHookDeny(); }
      }] }] },
      canUseTool: async (tool: unknown, body: unknown, context: unknown) => {
        if (finished) probe.close();
        try { return probe.permission(tool, body, context); }
        catch { probe.close(); report.error ??= { kind: "permission-error" };
          return { behavior: "deny", message: "Palabre native probe: no permission granted" }; }
      },
      stderr: (chunk: string) => { if (report.stderr.length < 16) report.stderr.push(String(chunk).slice(0, 2048)); }
    } });
    if (controller.signal.aborted) { closeQuery(); return report; }
    report.initializationVerified = probe.arm(await race(handle.initializationResult()));
    if (!report.initializationVerified || report.error) { stop("initialization-unverified"); return report; }
    releasePrompt(true);
    const iterator = handle[Symbol.asyncIterator]();
    let bytes = 0, initCount = 0;
    while (true) {
      const next = await race(iterator.next());
      if (next.done) break;
      const event: any = next.value, encoded = JSON.stringify(event);
      bytes += new TextEncoder().encode(encoded).length;
      if (bytes > 4 * 1024 * 1024 || report.events.length >= 256) { report.truncated = true; stop("capture-limit"); break; }
      report.events.push(event);
      if (event?.type === "system" && event.subtype === "init") {
        initCount++;
        report.inventoryValidated = initCount === 1 && event.session_id === input.sessionId
          && event.model === "claude-opus-5-5" && event.claude_code_version === "2.1.302" && event.permissionMode === "default"
          && JSON.stringify(event.tools) === '["SendMessage"]' && Array.isArray(event.mcp_servers) && event.mcp_servers.length === 0;
        if (!report.inventoryValidated) { stop("inventory-unverified"); break; }
      }
    }
  } catch { report.error ??= { kind: "probe-error" }; stop(report.error.kind); }
  finally {
    sealTurn();
    try { removeDeadline(); } catch { report.error ??= { kind: "timer-cleanup-error" }; }
    closeQuery();
    report.probe = turnSnapshot!;
    const afterClose = probe.state();
    report.lateHookCalls = afterClose.capture.hookCalls - report.probe.capture.hookCalls;
    report.latePermissionCalls = afterClose.capture.permissionCalls - report.probe.capture.permissionCalls;
    if (report.lateHookCalls || report.latePermissionCalls) report.error ??= { kind: "callback-after-turn" };
    controller.signal.removeEventListener("abort", onAbort);
    report.possibleSend = report.probe.possibleSend;
    report.attention = report.possibleSend ? (report.probe.capture.permissionCalls === 0
      ? "possible-send-without-callback" : "delivery-unverified") : "no-neutral-hook-observed";
    report.correlatedCallbackDenial = report.initializationVerified && report.promptReleased && report.inventoryValidated
      && !report.error && !report.outerTimedOut && !report.truncated && hasNativeAskDenial(report.events, input.sessionId, plan, report.probe);
    report.finishedAt = new Date().toISOString();
  }
  return report;
}
