#!/usr/bin/env node
/**
 * @file CLI Claude Code simulée pour les tests de l'adapter de session externe.
 *
 * Variables :
 *   FAKE_CLAUDE_MODE        comportement : ok, mismatch, not-found, usage-limit, persisted-fail, no-result, hang,
 *                           et résultats non conformes : blank, is-error-string, is-error-missing, two-results ;
 *   FAKE_CLAUDE_TRANSCRIPT  transcript de la cible, où le message reçu est ajouté (modes qui répondent, et persisted-fail) ;
 *   FAKE_CLAUDE_MARKER      fichier où l'invocation ajoute une ligne JSON { argv, cwd, stdin, envKeys }.
 *
 * Aucun réseau ; aucune écriture hors des chemins fournis.
 */
"use strict";
const fs = require("node:fs");

const argv = process.argv.slice(2);
const mode = process.env.FAKE_CLAUDE_MODE || "ok";
const OTHER = "99999999-9999-4999-8999-999999999999";
const target = argv[argv.indexOf("--resume") + 1];
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");

/** Ajoute une entrée chaînée au transcript, comme le fait Claude Code. */
function append(entry) {
  const file = process.env.FAKE_CLAUDE_TRANSCRIPT;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const parent = [...lines].reverse().find((line) => typeof line.uuid === "string");
  const uuid = `fake-${lines.length + 1}`;
  fs.appendFileSync(file, JSON.stringify({ parentUuid: parent ? parent.uuid : null, isSidechain: false, uuid, sessionId: target, cwd: process.cwd(), ...entry }) + "\n");
}

function answer(sessionId, stdin, result = {}) {
  append({ type: "user", message: { role: "user", content: stdin } });
  append({ type: "assistant", message: { role: "assistant", model: "claude-haiku-4-5", content: [{ type: "text", text: "FAKE-OK" }] } });
  emit({ type: "system", subtype: "init", session_id: sessionId, model: "claude-haiku-4-5" });
  emit({ type: "assistant", session_id: sessionId, message: { model: "claude-haiku-4-5", content: [{ type: "text", text: "FAKE-OK" }] } });
  emit({ type: "result", subtype: "success", is_error: false, session_id: sessionId, result: "FAKE-OK", modelUsage: { "claude-haiku-4-5": {} }, ...result });
}

let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { stdin += chunk; });
process.stdin.on("end", () => {
  if (process.env.FAKE_CLAUDE_MARKER) {
    fs.appendFileSync(process.env.FAKE_CLAUDE_MARKER, JSON.stringify({ argv, cwd: process.cwd(), stdin, envKeys: Object.keys(process.env) }) + "\n");
  }
  switch (mode) {
    case "ok":
      answer(target, stdin);
      return;
    case "mismatch":
      answer(OTHER, stdin);
      return;
    case "blank":
      answer(target, stdin, { result: "  \n\t " });
      return;
    case "is-error-string":
      answer(target, stdin, { is_error: "true" });
      return;
    case "is-error-missing":
      answer(target, stdin, { is_error: undefined });
      return;
    case "two-results":
      answer(target, stdin);
      emit({ type: "result", subtype: "success", is_error: false, session_id: target, result: "SECOND" });
      return;
    case "not-found":
      emit({ type: "result", subtype: "error_during_execution", is_error: true, session_id: OTHER, errors: [`No conversation found with session ID: ${target}`] });
      process.exitCode = 1;
      return;
    case "usage-limit":
      emit({ type: "system", subtype: "init", session_id: target });
      emit({ type: "result", subtype: "success", is_error: true, session_id: target, result: "Claude AI usage limit reached|1767225600" });
      process.exitCode = 1;
      return;
    case "persisted-fail":
      append({ type: "user", message: { role: "user", content: stdin } });
      emit({ type: "system", subtype: "init", session_id: target });
      process.stderr.write("interrompu après persistance\n");
      process.exitCode = 1;
      return;
    case "no-result":
      emit({ type: "system", subtype: "init", session_id: target });
      return;
    case "hang":
      emit({ type: "system", subtype: "init", session_id: target });
      setTimeout(() => {}, 60_000);
      return;
    default:
      throw new Error(`mode inconnu ${mode}`);
  }
});
