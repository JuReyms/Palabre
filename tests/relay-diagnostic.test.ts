/** @file Le diagnostic ne transporte aucune sortie ni valeur externe libre. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { relayProcessDiagnostic } from "../src/externalSessions/diagnostic.js";
import type { ExternalProcessResult } from "../src/externalSessions/process.js";

test("diagnostic : liste fermée, sans secret ni séquence terminal", () => {
  const run: ExternalProcessResult = { started: false, launchFailure: "spawn-failed", launchErrorCode: "secret\u001b[31m",
    exitCode: null, signal: null, forcedReturn: false, stdout: "secret", stderr: "secret", outputBytes: 100, durationMs: 1 };
  assert.deepEqual(relayProcessDiagnostic("execution", run), { phase: "execution", started: false,
    launchFailure: "spawn-failed", launchErrorCode: "UNKNOWN", exitCode: null, signal: null, forcedReturn: false });
});

test("signal inconnu, arrêt et retour forcé : faits conservés sans valeur libre", () => {
  const run: ExternalProcessResult = { started: true, exitCode: null, signal: "secret\u001b[31m" as NodeJS.Signals,
    stopReason: "output-too-large", forcedReturn: true, stdout: "secret", stderr: "secret", outputBytes: 100, durationMs: 1 };
  assert.deepEqual(relayProcessDiagnostic("preparation", run), { phase: "preparation", started: true,
    exitCode: null, signal: "UNKNOWN", stopReason: "output-too-large", forcedReturn: true });
  assert.equal(relayProcessDiagnostic("execution", { ...run, signal: "SIGTERM", launchErrorCode: "EACCES" }).signal, "SIGTERM");
  assert.equal(relayProcessDiagnostic("execution", { ...run, launchErrorCode: "EACCES" }).launchErrorCode, "EACCES");
});
