/** @file Extrait d'erreur privé (#270, lot B) : masquage avant bornes, écriture exclusive, échecs sans effet. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildErrorExcerpt, MASK, maskErrorText, MAX_EXCERPT_BYTES, MAX_EXCERPT_LINES, saveRelayErrorExcerpt } from "../src/externalSessions/errorExcerpt.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-error-excerpt-"));
const labels = { title: "Titre fixe", warning: "Avertissement fixe" };
const facts = { phase: "execution" as const, exitCode: 1 };

test("masquage : dossier personnel, jetons connus, affectations, e-mails, UUID, URL et chaînes opaques", () => {
  const home = String.raw`C:\Users\Faux`;
  const text = [
    String.raw`Error: Accès refusé. (os error 5) at path "C:\Users\Faux\.codex\tmp\arg0"`,
    String.raw`escaped C:\\Users\\faux\\x and c:/users/faux/y but not C:\Users\Fauxbourg`,
    "Authorization: Bearer abcdefghijklmnop.qrstuv",
    "key sk-ant-api03-ABCDEFGHIJKLMNOPQRST and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123",
    "api_key=faux-secret-court password: \"hunter2\" {\"token\": \"abc\"}",
    "contact faux.nom+tag@exemple.invalid",
    "thread 01a19777-bd85-7ce3-b2a5-3a595ff24fcb",
    "GET https://exemple.invalid/v1/x?token=faux&b=2 failed",
    "opaque Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZg== end",
    "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl"
  ].join("\n");
  const masked = maskErrorText(text, home, "win32");
  assert.doesNotMatch(masked.replace(String.raw`C:\Users\Fauxbourg`, ""), /Faux|users|abcdefghijklmnop|sk-ant|ghp_|faux-secret|hunter2|"abc"|token=|@exemple|01a19777|Zm9vYmFy|eyJhbGci/i);
  assert.ok(masked.includes(String.raw`path "~\.codex\tmp\arg0"`));
  assert.ok(masked.includes(String.raw`escaped ~\\x and ~/y`));
  assert.ok(masked.includes(String.raw`not C:\Users\Fauxbourg`), "un autre dossier au préfixe commun reste intact");
  assert.match(masked, /Bearer \[\*\*\*\]/u);
  assert.match(masked, /https:\/\/exemple\.invalid\/v1\/x\?\[\*\*\*\] failed/u);
  assert.match(masked, /Accès refusé\. \(os error 5\)/u, "le diagnostic utile reste lisible");
  // Valeurs entre apostrophes ou guillemets, espaces et échappements compris (relecture Codex).
  for (const [input, expected] of [
    ["password='correct horse battery staple' fin", "password='[***]' fin"],
    ['{"password": "correct horse battery staple", "n": 1}', '{"password": "[***]", "n": 1}'],
    [String.raw`secret="a \"b\" c" fin`, `secret="[***]" fin`],
    ["token = 'x y' ; api_key=nu", "token = '[***]' ; api_key=[***]"]
  ]) assert.equal(maskErrorText(input!, "/nulle-part", "linux"), expected, input);
  // Sous POSIX, la casse du dossier personnel compte.
  assert.equal(maskErrorText("/home/faux/x /home/Faux/y", "/home/faux", "linux"), "~/x /home/Faux/y");
});

test("extrait : contrôles et caractères invisibles retirés, doublons fusionnés, bords vides retirés", () => {
  const excerpt = buildErrorExcerpt("\n\n\u001b[31mError:\u001b[0m un\u202e deux\nmême\nmême\nmême\nfin\n\n", "/nulle-part", "linux");
  assert.equal(excerpt, "Error: un deux\nmême\nfin");
  // Un contrôle bidi (U+061C) ou un caractère invisible dans un nom sensible ne cache pas la valeur.
  for (const hidden of ["؜", "​", "­", "⁦"]) {
    assert.equal(buildErrorExcerpt(`pass${hidden}word=known-secret`, "/nulle-part", "linux"), "password=[***]");
  }
  assert.equal(buildErrorExcerpt("", "/nulle-part", "linux"), undefined);
  assert.equal(buildErrorExcerpt("\u001b[2K\r\n  \n", "/nulle-part", "linux"), undefined);
});

test("extrait : bornes en lignes et en octets UTF-8, sans couper un caractère", () => {
  const many = Array.from({ length: 100 }, (_, index) => `ligne ${index}`).join("\n");
  const lines = buildErrorExcerpt(many, "/nulle-part", "linux")!.split("\n");
  assert.equal(lines.length, MAX_EXCERPT_LINES);
  assert.equal(lines.at(-1), "ligne 99");
  const wide = Array.from({ length: 40 }, (_, index) => `${index} ${"é🙂".repeat(80)}`).join("\n");
  const bounded = buildErrorExcerpt(wide, "/nulle-part", "linux")!;
  assert.ok(Buffer.byteLength(bounded, "utf8") <= MAX_EXCERPT_BYTES);
  assert.ok(bounded.endsWith("é🙂"));
  assert.doesNotMatch(bounded, /\ufffd/u);
  const single = buildErrorExcerpt(`Error: ${"🙂".repeat(5000)}`, "/nulle-part", "linux")!;
  assert.ok(Buffer.byteLength(single, "utf8") <= MAX_EXCERPT_BYTES);
  assert.ok(single.startsWith("…🙂"));
  assert.doesNotMatch(single, /[\ud800-\udfff](?![\udc00-\udfff])/u);
});

test("extrait : un secret coupé aux bornes n'apparaît jamais en clair", () => {
  const secret = "sk-ant-api03-FAUXSECRETFAUXSECRETFAUX";
  // Borne en octets : le masque s'applique avant la troncature, la ligne coupée ne garde que le masque.
  const longLine = `${secret} ${"x ".repeat(5000)}fin`;
  assert.doesNotMatch(buildErrorExcerpt(longLine, "/nulle-part", "linux")!, /FAUXSECRET/u);
  // Fenêtre de 64 Ki caractères : la ligne coupée au début de la fenêtre est retirée entière.
  // La fenêtre commence 10 caractères avant la fin du secret : « SECRETFAUX » seul ne serait pas masqué.
  const end = "Error: fin.";
  const filler = "y\n".repeat((64 * 1024 - 10 - 1 - end.length) / 2);
  const tail = `\n${filler}${end}`;
  assert.equal(tail.length, 64 * 1024 - 10);
  const excerpt = buildErrorExcerpt(`début ${secret}${tail}`, "/nulle-part", "linux")!;
  assert.doesNotMatch(excerpt, /FAUX/u);
  assert.ok(excerpt.endsWith(end));
});

test("écriture : exclusive, 0600, nom daté et aléatoire ; rien d'écrit pour un stderr vide", async () => {
  const dir = path.join(root, "out-ok");
  const saved = await saveRelayErrorExcerpt(dir, "Error: Accès refusé. (os error 5)\n", facts, labels, { home: "/nulle-part", platform: "linux" });
  assert.equal(saved.status, "saved");
  assert.match(path.basename(saved.path!), /^palabre-error-\d{4}-\d\d-\d\dT[\d-]+Z-[0-9a-f-]{36}\.error\.txt$/u);
  assert.equal(readFileSync(saved.path!, "utf8"), "Titre fixe\nAvertissement fixe\nphase=execution exitCode=1\n---\nError: Accès refusé. (os error 5)\n");
  const empty = path.join(root, "out-empty");
  assert.deepEqual(await saveRelayErrorExcerpt(empty, "\n", facts, labels), { status: "empty" });
  assert.throws(() => readdirSync(empty), "aucun dossier créé sans extrait");
});

test("écriture : fichier ou lien déjà présent jamais écrasé ni suivi ; échec de dossier rendu failed", async () => {
  const dir = path.join(root, "out-existing");
  mkdirSync(dir, { recursive: true });
  const now = new Date("2026-11-03T10:00:00.000Z");
  const id = "00000000-0000-4000-8000-000000000000";
  const name = `palabre-error-2026-11-03T10-00-00-000Z-${id}.error.txt`;
  writeFileSync(path.join(dir, name), "existant");
  assert.deepEqual(await saveRelayErrorExcerpt(dir, "Error: x", facts, labels, { now, id }), { status: "failed" });
  assert.equal(readFileSync(path.join(dir, name), "utf8"), "existant");
  const target = path.join(root, "cible-lien.txt");
  writeFileSync(target, "cible");
  const linkId = "11111111-1111-4111-8111-111111111111";
  let linked = true;
  try { symlinkSync(target, path.join(dir, `palabre-error-2026-11-03T10-00-00-000Z-${linkId}.error.txt`)); } catch { linked = false; }
  if (linked) {
    assert.deepEqual(await saveRelayErrorExcerpt(dir, "Error: x", facts, labels, { now, id: linkId }), { status: "failed" });
    assert.equal(readFileSync(target, "utf8"), "cible");
  }
  const blocker = path.join(root, "bloque");
  writeFileSync(blocker, "fichier");
  assert.deepEqual(await saveRelayErrorExcerpt(path.join(blocker, "sous"), "Error: x", facts, labels), { status: "failed" });
  assert.ok(MASK.length > 0);
});
