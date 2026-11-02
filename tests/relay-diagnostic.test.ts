/** @file Le diagnostic ne transporte aucune sortie ni valeur externe libre ; indice stderr fermé. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { relayProcessDiagnostic } from "../src/externalSessions/diagnostic.js";
import type { ExternalProcessResult } from "../src/externalSessions/process.js";
import { classifyStderr, type StderrHint } from "../src/externalSessions/stderrHint.js";

test("indice stderr : motifs système précis, reconnus en français et en anglais", () => {
  const cases: Array<[string, StderrHint]> = [
    ["Error: failed to initialize in-process app-server client: Accès refusé. (os error 5)", "access-denied"],
    ["Error: Access is denied. (os error 5)", "access-denied"],
    ["Error: Permission denied (os error 13)", "access-denied"],
    ["Error: spawn EPERM", "access-denied"],
    ["Error: connect ECONNREFUSED 127.0.0.1:443", "network"],
    ["Error: error sending request for url (https://exemple.invalid/)", "network"],
    ["Error: dns error: failed to lookup address", "network"],
    ["thread 'main' panicked at src/main.rs:1:1:\nboom", "panic"]
  ];
  for (const [stderr, hint] of cases) assert.equal(classifyStderr(stderr), hint, stderr);
});

test("indice stderr : mots vagues, texte vide ou fin de flux sans motif ne donnent aucun indice", () => {
  for (const stderr of ["", "Error: authentication required", "Error loading config.toml: simulated",
    "network is slow today", "permission", "accès", "Error: not denied at all", "faux-secret-stderr\u001b[31m"]) {
    assert.equal(classifyStderr(stderr), undefined, stderr);
  }
  // Seule la fin du flux est examinée : un motif repoussé hors de la fenêtre n'est plus reconnu.
  assert.equal(classifyStderr("Accès refusé. (os error 5)\n" + "x".repeat(70 * 1024)), undefined);
});

test("indice stderr : l'erreur terminale l'emporte sur les avertissements ; priorité en cas de conflit", () => {
  const warnings = "WARNING: could not create PATH aliases: Accès refusé. (os error 5)\n";
  assert.equal(classifyStderr(warnings + "Error: error sending request for url (https://x.invalid/)"), "network");
  assert.equal(classifyStderr(warnings + "Error: something unrelated"), undefined);
  assert.equal(classifyStderr(warnings), "access-denied");
  assert.equal(classifyStderr("Error: ECONNRESET\nError: Access is denied. (os error 5)"), "access-denied");
  assert.equal(classifyStderr("fatal: ETIMEDOUT\r\nthread 'main' panicked at x"), "network");
});

test("indice stderr : codes numériques selon la plateforme, formulations explicites partout", () => {
  // 5 = accès refusé sous Windows, EIO sous Linux ; 13 = EACCES sous POSIX, ERROR_INVALID_DATA sous Windows.
  assert.equal(classifyStderr("Error: Input/output error (os error 5)", "linux"), undefined);
  assert.equal(classifyStderr("Error: something (os error 5)", "win32"), "access-denied");
  assert.equal(classifyStderr("Error: La donnée est invalide. (os error 13)", "win32"), undefined);
  assert.equal(classifyStderr("Error: something (os error 13)", "darwin"), "access-denied");
  for (const platform of ["win32", "linux", "darwin"] as const) {
    assert.equal(classifyStderr("Error: Accès refusé. (os error 5)", platform), "access-denied");
    assert.equal(classifyStderr("Error: Permission denied (os error 13)", platform), "access-denied");
  }
});

test("indice stderr : couleurs retirées avant de repérer l'erreur terminale", () => {
  const colored = "WARNING: Permission denied\n\u001b[31mError:\u001b[0m connect ECONNREFUSED 127.0.0.1:443\n";
  assert.equal(classifyStderr(colored), "network");
});

test("indice stderr : lignes de suite d'une erreur terminale (Caused by) examinées, pas les suivantes", () => {
  const anyhow = "Error: failed to initialize client\n\nCaused by:\n    Permission denied (os error 13)\n";
  assert.equal(classifyStderr(anyhow, "linux"), "access-denied");
  assert.equal(classifyStderr("Error: failed\nWARNING: permission denied\n"), undefined);
});

test("diagnostic : un indice hors liste fermée est ignoré", () => {
  const run: ExternalProcessResult = { started: true, exitCode: 1, signal: null, forcedReturn: false, stdout: "", stderr: "", outputBytes: 0, durationMs: 1 };
  assert.equal(relayProcessDiagnostic("execution", run, "access-denied").stderrHint, "access-denied");
  assert.equal("stderrHint" in relayProcessDiagnostic("execution", run, "secret" as StderrHint), false);
  assert.equal("stderrHint" in relayProcessDiagnostic("execution", run), false);
});

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
