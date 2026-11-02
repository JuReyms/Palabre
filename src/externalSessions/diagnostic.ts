/**
 * @file Diagnostic Relay limité à des faits de processus à vocabulaire fermé.
 * Aucun flux, argument, chemin ou message externe n'est conservé ici.
 */
import type { ExternalProcessResult, LaunchFailure, StopReason } from "./process.js";

/** Faits facultatifs v1 ; la préparation ne prouve pas l'envoi du message. */
export interface RelayProcessDiagnostic {
  phase: "preparation" | "execution";
  started: boolean;
  launchFailure?: LaunchFailure;
  launchErrorCode?: "ENOENT" | "EACCES" | "EPERM" | "EINVAL" | "UNKNOWN";
  exitCode: number | null;
  signal: string | null;
  stopReason?: StopReason;
  forcedReturn: boolean;
}

/** Copie uniquement les valeurs autorisées, sans sortie brute du processus. */
export function relayProcessDiagnostic(phase: RelayProcessDiagnostic["phase"], run: ExternalProcessResult): RelayProcessDiagnostic {
  const code = run.launchErrorCode;
  const launchErrorCode = code === "ENOENT" || code === "EACCES" || code === "EPERM" || code === "EINVAL" ? code : code ? "UNKNOWN" : undefined;
  const signal = run.signal ? (["SIGTERM", "SIGKILL", "SIGINT", "SIGHUP", "SIGQUIT", "SIGABRT", "SIGSEGV"].includes(run.signal) ? run.signal : "UNKNOWN") : null;
  return { phase, started: run.started, ...(run.launchFailure ? { launchFailure: run.launchFailure } : {}),
    ...(launchErrorCode ? { launchErrorCode } : {}), exitCode: run.exitCode, signal,
    ...(run.stopReason ? { stopReason: run.stopReason } : {}), forcedReturn: run.forcedReturn };
}
