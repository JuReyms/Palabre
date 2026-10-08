/** @file Tests du dépôt B1 (`codex queue`) : arguments, ligne de commande Windows, accusé. Aucun agent réel. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";
import {
  checkQueueCommand,
  codexQueueArgs,
  isQueueUnsupported,
  MAX_OPEN_ENVELOPE_UTF16,
  parseQueueAck,
  quoteWindowsArgument,
  windowsCommandLineLength,
  WINDOWS_COMMAND_LINE_LIMIT
} from "../src/externalSessions/codexQueue.js";

const THREAD = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const OTHER = "99999999-9999-4999-8999-999999999999";

describe("dépôt B1 : arguments et échappement", () => {
  test("arguments structurés, enveloppe en un seul argument", () => {
    assert.deepEqual(codexQueueArgs(THREAD, "a\nb"), ["queue", "--thread", THREAD, "--message", "a\nb"]);
  });
  test("échappement des règles CommandLineToArgvW", () => {
    assert.equal(quoteWindowsArgument(""), "\"\"");
    assert.equal(quoteWindowsArgument("simple"), "simple");
    assert.equal(quoteWindowsArgument("C:\\sans\\espace"), "C:\\sans\\espace");
    assert.equal(quoteWindowsArgument("deux mots"), "\"deux mots\"");
    assert.equal(quoteWindowsArgument("dit \"oui\""), "\"dit \\\"oui\\\"\"");
    assert.equal(quoteWindowsArgument("C:\\dossier avec espace\\"), "\"C:\\dossier avec espace\\\\\"");
    assert.equal(quoteWindowsArgument("a\\\\\"b c"), "\"a\\\\\\\\\\\"b c\"");
  });
  test("longueur comptée en unités UTF-16, NUL final compris", () => {
    assert.equal(windowsCommandLineLength("node", ["a b"]), "node \"a b\"".length + 1);
    assert.equal(windowsCommandLineLength("x", ["🌸"]), 1 + 1 + 2 + 1);
  });
});

describe("dépôt B1 : refus avant toute tentative", () => {
  const fits = (envelope: string) => checkQueueCommand("codex.exe", codexQueueArgs(THREAD, envelope), envelope);
  test("enveloppe : 8 192 unités UTF-16 acceptées, une de plus refusée (pas des octets)", () => {
    assert.deepEqual(fits("é".repeat(MAX_OPEN_ENVELOPE_UTF16)), { ok: true });
    assert.deepEqual(fits("a".repeat(MAX_OPEN_ENVELOPE_UTF16 + 1)), { ok: false, detail: "envelope-too-long" });
    // Un emoji hors BMP compte pour deux unités.
    assert.deepEqual(fits("🌸".repeat(MAX_OPEN_ENVELOPE_UTF16 / 2)), { ok: true });
    assert.deepEqual(fits(`${"🌸".repeat(MAX_OPEN_ENVELOPE_UTF16 / 2)}a`), { ok: false, detail: "envelope-too-long" });
  });
  test("NUL incorporé : refusé, quel que soit l'argument", () => {
    assert.deepEqual(fits("avant\u0000après"), { ok: false, detail: "nul-in-argument" });
    assert.deepEqual(checkQueueCommand("codex\u0000.exe", ["queue"], "x"), { ok: false, detail: "nul-in-argument" });
  });
  test("ligne trop longue avec un chemin d'exécutable et des arguments préfixés longs, sans troncature", () => {
    const longPath = `C:\\${"dossier très long\\".repeat(1400)}node.exe`;
    const envelope = "x".repeat(MAX_OPEN_ENVELOPE_UTF16);
    const result = checkQueueCommand(longPath, [`${longPath}\\codex.js`, ...codexQueueArgs(THREAD, envelope)], envelope);
    assert.deepEqual(result, { ok: false, detail: "command-line-too-long" });
  });
  test("Windows : le calcul coïncide avec la limite réelle de CreateProcessW", { skip: process.platform !== "win32" }, () => {
    // Argument avec guillemets, antislashs et emoji, complété pour atteindre exactement la limite.
    const fixed = ["-e", "process.exitCode = 0", "\"guillemets\" \\antislash\\ 🌸 "];
    const base = windowsCommandLineLength(process.execPath, [...fixed, ""]);
    const fill = (extra: number) => "y".repeat(WINDOWS_COMMAND_LINE_LIMIT - base + 2 + extra);
    assert.equal(windowsCommandLineLength(process.execPath, [...fixed, fill(0)]), WINDOWS_COMMAND_LINE_LIMIT);
    const atLimit = spawnSync(process.execPath, [...fixed, fill(0)]);
    assert.equal(atLimit.error, undefined, "la ligne de 32 767 unités doit être lancée");
    assert.equal(atLimit.status, 0);
    assert.equal(windowsCommandLineLength(process.execPath, [...fixed, fill(1)]), WINDOWS_COMMAND_LINE_LIMIT + 1);
    const beyond = spawnSync(process.execPath, [...fixed, fill(1)]);
    assert.equal((beyond.error as NodeJS.ErrnoException | undefined)?.code, "ENAMETOOLONG");
  });
});

describe("dépôt B1 : accusé de codex queue", () => {
  test("accusé de la cible : accepté, avec l'identifiant d'élément", () => {
    assert.deepEqual(parseQueueAck(`Queued message 01a118fb-8a33 for thread ${THREAD}.\n`, THREAD), { status: "accepted", itemId: "01a118fb-8a33" });
    assert.deepEqual(parseQueueAck(`Queued message abc for thread ${THREAD.toUpperCase()}.\r\n`, THREAD), { status: "accepted", itemId: "abc" });
  });
  test("accusé d'une autre conversation : jamais accepté", () => {
    assert.deepEqual(parseQueueAck(`Queued message abc for thread ${OTHER}.\n`, THREAD), { status: "foreign" });
  });
  test("absent, non conforme ou multiple : absence de preuve", () => {
    assert.deepEqual(parseQueueAck("", THREAD), { status: "absent" });
    assert.deepEqual(parseQueueAck(`Queued for thread ${THREAD}.`, THREAD), { status: "absent" });
    assert.deepEqual(parseQueueAck(`Queued message a for thread ${THREAD}.\nQueued message b for thread ${THREAD}.\n`, THREAD), { status: "absent" });
  });
  test("refus certain de l'analyseur d'arguments seulement", () => {
    assert.equal(isQueueUnsupported("error: unrecognized subcommand 'queue'"), true);
    assert.equal(isQueueUnsupported("Error: queue database unavailable"), false);
  });
});
