/**
 * @file Passation locale #250 : refus d'une conversation Claude déjà utilisée, sur profils
 * fictifs et sondes simulées. Aucune CLI Claude réelle lancée, aucun historique utilisateur lu.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { executeRelay, renderRelayText } from "../src/commands/relay.js";
import { trustConfig } from "../src/configTrust.js";
import { ClaudeSessionAdapter } from "../src/externalSessions/claude.js";
import { createTranslator } from "../src/i18n.js";
import { relayClaudeText } from "../src/messages/relayClaude.js";
import { markdownFence, renderRelayHandoff, saveRelayHandoff, type RelayHandoff } from "../src/relayHandoff.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-relay-handoff-"));
after(() => rmSync(root, { recursive: true, force: true }));
const SESSION = "44444444-4444-4444-8444-444444444444";
const FROM_SESSION = "99999999-9999-4999-8999-999999999999";
const FROM = `codex:${FROM_SESSION}`;
let counter = 0;

/** Profil jetable : config approuvée, CLI Claude fictive jamais lancée, sonde d'attachement simulée. */
async function world(t: import("node:test").TestContext, options: { attachment?: "attached" | "detached" | "unknown"; config?: Record<string, unknown> } = {}) {
  const profile = path.join(root, `profile-${++counter}`);
  const workspace = path.join(profile, "workspace");
  mkdirSync(workspace, { recursive: true });
  t.mock.method(os, "homedir", () => profile);
  const exe = path.join(profile, process.platform === "win32" ? "claude.exe" : "claude");
  writeFileSync(exe, "", { mode: 0o755 });
  const out = path.join(profile, "exports");
  const file = path.join(profile, "palabre.config.json");
  writeFileSync(file, JSON.stringify({ language: "fr", outputDir: out, agents: { claude: { type: "cli", command: exe } }, ...options.config }));
  await trustConfig(file);
  const target = { agent: "claude", provider: "claude" as const, sessionId: SESSION, cwd: workspace };
  t.mock.method(ClaudeSessionAdapter.prototype, "locate", () => ({ status: "found" as const, target, historyPath: path.join(profile, "fictif.jsonl"), evidence: [] }));
  t.mock.method(ClaudeSessionAdapter.prototype, "probe", () => ({ attachment: options.attachment ?? "attached", activity: "idle" as const, processes: [], evidence: [] }));
  const launches: unknown[] = [];
  t.mock.method(ClaudeSessionAdapter.prototype, "resumeArgs", (...args: unknown[]) => { launches.push(args); throw new Error("aucun lancement attendu"); });
  return { profile, file, out, launches };
}

type World = Awaited<ReturnType<typeof world>>;

const send = (w: World, extra: string[], message = "Relis ce plan.") =>
  executeRelay(["relay", "--from", FROM, "--to", `claude:${SESSION}`, "--config", w.file, ...extra, message]);

/** Corps exact du bloc `text` : entre le fence ouvrant et le dernier fence fermant. */
function body(content: string, message: string): string {
  const fence = markdownFence(message);
  const start = content.indexOf(`${fence}text\n`) + fence.length + "text\n".length;
  return content.slice(start, content.lastIndexOf(`\n${fence}\n`));
}

function metadataOf(content: string): Record<string, any> {
  const match = content.match(/(`{3,})json\n([\s\S]*?)\n\1\n/);
  assert.ok(match, "bloc de métadonnées absent");
  return JSON.parse(match[2]!);
}

describe("envoi ordinaire vers une conversation Claude déjà utilisée (#250)", () => {
  test("FR : refus actionnable, corps exact conservé NON ENVOYÉ, export et délivrance inchangés", async (t) => {
    const w = await world(t);
    const message = "Passation ``` piégée\r\n```` encore\r\nAccents : é à ç — 🙂\r\n# Titre imité\r\n";
    const result = await send(w, ["--subject", "Revue `#250`", "--reference", "PR #250", "--exchange", "2"], message);
    assert.equal(result.status, "target-busy");
    assert.equal(result.exitCode, 3);
    assert.deepEqual(result.delivery, { status: "not-delivered", persisted: false, inActiveBranch: false });
    assert.equal(result.exportPath, null);
    assert.equal(w.launches.length, 0, "aucune CLI Claude lancée");
    assert.match(result.error?.message ?? "", /^Cette conversation est déjà utilisée par Claude \(app, terminal ou intégration\)\. Palabre ne peut pas y ajouter un nouveau message pour le moment\./);
    assert.doesNotMatch(result.error?.message ?? "", /Ferme|fermez/);
    assert.match(result.error?.hint ?? "", /même tour/);
    assert.ok(result.error?.hint?.includes(`palabre relay --check --to 'claude:${SESSION}'`));
    assert.ok(result.error?.hint?.includes(`--config '${w.file}'`));
    assert.equal(result.handoff?.status, "saved");
    const file = result.handoff!.path!;
    assert.equal(path.dirname(file), w.out);
    assert.match(path.basename(file), /^palabre-handoff-.+\.handoff\.md$/);
    assert.deepEqual(readdirSync(w.out), [path.basename(file)], "aucun export .relay.md ajouté");
    const content = readFileSync(file, "utf8");
    assert.equal(body(content, message), message);
    assert.match(content, /NON ENVOYÉE, À TRANSMETTRE/);
    assert.doesNotMatch(content, /📧|🤖/, "aucune enveloppe exécutable");
    const metadata = metadataOf(content);
    assert.equal(metadata.sent, false);
    assert.equal(metadata.delivery, "not-delivered");
    assert.deepEqual(metadata.to, { agent: "claude", session: SESSION, provider: "claude" });
    assert.deepEqual(metadata.from, { agent: "codex", session: FROM_SESSION });
    assert.equal(metadata.subject, "Revue `#250`");
    assert.deepEqual(metadata.exchange, { reference: "PR #250", number: 2 });
    if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600);
    const text = renderRelayText(result, createTranslator("fr"));
    assert.equal(text.stdout, "");
    assert.ok(text.stderr.includes(file));
    assert.match(text.stderr, /même tour/);
    assert.match(text.stderr, /NON ENVOYÉE/);
    assert.match(text.stderr, /n'informe pas Claude/);
  });

  test("EN : message, conseil, fichier et rendu traduits", async (t) => {
    const w = await world(t);
    const result = await send(w, ["--language", "en"]);
    assert.match(result.error?.message ?? "", /^This conversation is already in use by Claude/);
    assert.match(result.error?.hint ?? "", /same turn/);
    assert.equal(result.handoff?.status, "saved");
    assert.match(readFileSync(result.handoff!.path!, "utf8"), /NOT SENT, TO PASS ON/);
    const text = renderRelayText(result, createTranslator("en"));
    assert.match(text.stderr, /Handoff kept locally, NOT SENT/);
    assert.match(text.stderr, /does not notify Claude/);
  });

  test("--no-export : ni dossier ni écriture, passation à remettre dans la réponse", async (t) => {
    const w = await world(t);
    const result = await send(w, ["--no-export"]);
    assert.equal(result.status, "target-busy");
    assert.deepEqual(result.handoff, { status: "disabled" });
    assert.equal(result.exportPath, null);
    assert.equal(existsSync(w.out), false);
    assert.match(renderRelayText(result, createTranslator("fr")).stderr, /--no-export : passation non enregistrée/);
  });

  test("échec d'écriture : failed sans chemin, refus, code et délivrance inchangés", async (t) => {
    const blocker = path.join(root, `bloque-${++counter}`);
    writeFileSync(blocker, "fichier, pas dossier");
    const w = await world(t, { config: { outputDir: path.join(blocker, "sorties") } });
    const result = await send(w, []);
    assert.equal(result.status, "target-busy");
    assert.equal(result.exitCode, 3);
    assert.equal(result.delivery.status, "not-delivered");
    assert.deepEqual(result.handoff, { status: "failed" });
    assert.match(renderRelayText(result, createTranslator("fr")).stderr, /n'a pas pu être enregistrée/);
  });
});

describe("exclusions de la passation (#250)", () => {
  test("--check : conseil possible, jamais de fichier ; check.target reste open", async (t) => {
    const w = await world(t);
    const result = await executeRelay(["relay", "--check", "--to", `claude:${SESSION}`, "--config", w.file]);
    assert.equal(result.status, "target-busy");
    assert.equal(result.check?.target, "open");
    assert.equal(result.handoff, undefined);
    assert.match(result.error?.hint ?? "", /même tour/);
    assert.equal(existsSync(w.out), false);
  });

  test("--check sans processus attaché : formulation prudente pour Claude", async (t) => {
    const w = await world(t, { attachment: "detached" });
    const result = await executeRelay(["relay", "--check", "--to", `claude:${SESSION}`, "--config", w.file]);
    assert.equal(result.status, "checked");
    assert.equal(result.check?.target, "closed");
    const stderr = renderRelayText(result, createTranslator("fr")).stderr;
    assert.match(stderr, /aucun processus Claude attaché/);
    assert.match(stderr, /ne prouve pas que l'app est fermée/);
    const english = renderRelayText(result, createTranslator("en")).stderr;
    assert.match(english, /no Claude process attached/);
    assert.doesNotMatch(english, /aucun processus/);
    assert.doesNotMatch(stderr, /la conversation claude est fermée/);
    assert.equal(w.launches.length, 0);
  });

  test("Mission (en-tête) : message d'origine, ni conseil ni passation", async (t) => {
    const w = await world(t);
    const result = await executeRelay(["relay", "--from", FROM, "--to", `claude:${SESSION}`, "--config", w.file, "Étape"], {
      header: { kind: "mission", id: "11111111-1111-4111-8111-111111111111", step: 1 }
    });
    assert.equal(result.status, "target-busy");
    assert.equal(result.handoff, undefined);
    assert.equal(result.error?.hint, undefined);
    assert.doesNotMatch(result.error?.message ?? "", /déjà utilisée par Claude/);
    assert.equal(existsSync(w.out), false);
  });

  test("--task review : parcours gelé inchangé, sans passation", async (t) => {
    const w = await world(t, { config: { relay: { allowedTasks: ["review"], reviewRepositories: ["owner/repo"] } } });
    const result = await executeRelay(["relay", "--from", FROM, "--to", `claude:${SESSION}`, "--config", w.file, "--task", "review", "--pr", "https://github.com/owner/repo/pull/1"]);
    assert.equal(result.status, "target-busy");
    assert.equal(result.handoff, undefined);
    assert.equal(result.error?.hint, undefined);
    assert.equal(existsSync(w.out), false);
  });

  test("état invérifiable : aucun fichier ni conseil", async (t) => {
    const w = await world(t, { attachment: "unknown" });
    const result = await send(w, []);
    assert.equal(result.status, "target-state-unknown");
    assert.equal(result.handoff, undefined);
    assert.equal(result.error?.hint, undefined);
    assert.equal(existsSync(w.out), false);
  });

  test("refus avant identité valide : aucun fichier", async (t) => {
    const w = await world(t);
    const result = await executeRelay(["relay", "--to", `inconnu:${SESSION}`, "--config", w.file, "x"]);
    assert.equal(result.status, "invalid-request");
    assert.equal(result.handoff, undefined);
    assert.equal(existsSync(w.out), false);
  });

  test("configuration devenue non approuvée ou message invalide : aucun contenu conservé", async t => {
    const w = await world(t);
    const config = readFileSync(w.file, "utf8");
    writeFileSync(w.file, config + "\n");
    const untrusted = await send(w, []);
    assert.equal(untrusted.error?.reason, "config-untrusted");
    assert.equal(untrusted.handoff, undefined);
    assert.equal(existsSync(w.out), false);
    const oversized = await send(w, [], "x".repeat(70 * 1024));
    assert.equal(oversized.error?.reason, "message-too-large");
    assert.equal(oversized.handoff, undefined);
    assert.equal(existsSync(w.out), false);
  });
});

describe("rendu et écriture de la passation", () => {
  const handoff: RelayHandoff = { createdAt: "2026-10-30T10:00:00.000Z", from: null, to: { agent: "claude", session: SESSION }, message: "x" };
  const labels = relayClaudeText("fr").file;

  test("contenu hostile conservé exactement, bloc non fermable", () => {
    const message = "````` ferme ?\r\n\u001b[31mrouge\u001b[0m\r\n```json\r\n{}\r\n```\r\nfin sans retour";
    const content = renderRelayHandoff({ ...handoff, message }, labels);
    assert.equal(markdownFence(message), "``````");
    assert.equal(body(content, message), message);
    assert.match(content, /^# Passation Palabre — NON ENVOYÉE, À TRANSMETTRE\n/);
    assert.equal(metadataOf(content).from, null);
  });

  test("écriture exclusive : deux passations, deux fichiers ; dossier impossible : failed", async () => {
    const directory = path.join(root, `direct-${++counter}`);
    const first = await saveRelayHandoff(directory, handoff, labels);
    const second = await saveRelayHandoff(directory, handoff, labels);
    assert.equal(first.status, "saved");
    assert.equal(second.status, "saved");
    assert.notEqual(first.path, second.path);
    assert.equal(readdirSync(directory).length, 2);
    const blocker = path.join(root, `bloque-${++counter}`);
    writeFileSync(blocker, "");
    assert.deepEqual(await saveRelayHandoff(path.join(blocker, "x"), handoff, labels), { status: "failed" });
  });
});
