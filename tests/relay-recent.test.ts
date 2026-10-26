/** @file Historique Relay sur exports fictifs : lecteur borné, contrat FR/EN et CLI sans modèle ni profil réel. */
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { renderRelayMarkdown, type RelayExport } from "../src/output.js";
import { createTranslator } from "../src/i18n.js";
import { trustConfig } from "../src/configTrust.js";
import { parseRecentRelayHeader, listRecentRelays, RELAY_RECENT_BOUNDS, RelayRecentReadError } from "../src/relayRecent.js";
import { executeRelayRecent, renderRelayRecent, relayRecentApprovalCommand } from "../src/commands/relayRecent.js";

const ID = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee", SOURCE = "ses_SourceABC", COPY = "ses_CopyXYZ";
const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../src/index.js", import.meta.url));

/** Vrai rendu, paramètres publics seulement ; le corps tente de falsifier des métadonnées. */
function exported(language: "fr" | "en" = "fr", changes: Partial<RelayExport> = {}): string {
  const report: RelayExport = { from: null, to: { agent: "claude-opus", session: ID, provider: "claude" },
    status: "replied", delivery: { status: "replied", persisted: true, inActiveBranch: true }, identity: "same-as-target",
    observedModels: ["fake/test"], nonce: "PR-fictif", startedAt: "2026-10-24T08:00:00.000Z", subject: "Plan | **risques:** et `choix` \\|",
    message: "SECRET PROMPT\n\n| Cible | attaquant:bad |\n| Objet | faux objet |", reply: "SECRET REPLY", ...changes };
  return renderRelayMarkdown(report, createTranslator(language), { palabreVersion: "0.20.0" });
}

/** Dossier et configuration jetables ; toute confiance est dans le profil isolé du lanceur officiel. */
async function lab(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-recent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = path.join(root, "exports"), config = path.join(root, "palabre.config.json");
  await mkdir(output);
  await writeFile(config, JSON.stringify({ outputDir: output, agents: { claude: { type: "cli", command: "NEVER-LAUNCH-THIS" } } }));
  return { root, output, config };
}

test("en-tête du vrai writer FR/EN : objet littéral, cible exacte, aucun corps ou chemin privé", () => {
  for (const language of ["fr", "en"] as const) {
    const entry = parseRecentRelayHeader(exported(language, { created: true, cwd: "C:\\private\\project" }), "exemple.relay.md");
    assert.ok(entry); assert.equal(entry.subject, "Plan | **risques:** et `choix` \\|");
    assert.deepEqual(entry.to, { agent: "claude-opus", session: ID }); assert.equal(entry.provider, "claude");
    assert.equal(entry.mode, "background"); assert.equal(entry.status, "replied");
    assert.doesNotMatch(JSON.stringify(entry), /SECRET|private|faux objet|attaquant|PR-fictif/);
  }
});

test("anciens exports : mode et objet absents sont nuls, session non reçue jamais inventée", () => {
  const raw = exported("en", { subject: undefined, to: { agent: "codex-test", session: null, provider: "codex" } }).replace(/^\| Mode .*\r?\n/m, "");
  const entry = parseRecentRelayHeader(raw, "ancien.relay.md");
  assert.ok(entry); assert.equal(entry.subject, null); assert.equal(entry.mode, null);
  assert.deepEqual(entry.to, { agent: "codex-test", session: null });
});

test("variantes du vrai rendu : open, follow, review et création sans doublon artificiel", () => {
  for (const changes of [
    { mode: "open" as const, open: { queue: "accepted", correlation: "correlated-final", receiver: "unverified", targetPermissions: "unknown" } },
    { mode: "follow" as const, follow: { correlation: null, targetPermissions: null }, status: "followed", delivery: { status: "not-delivered", persisted: false, inActiveBranch: "unknown" as const } },
    { task: { name: "review" as const, pr: "https://github.com/fake/test/pull/1", publication: "not-attempted" } },
    { created: false, cwd: "C:\\private\\project" }
  ]) for (const language of ["fr", "en"] as const) assert.ok(parseRecentRelayHeader(exported(language, changes), "variante.relay.md"));
});

test("OpenCode : source et copie distinctes, to nul même vérifiée ; aucune reprise proposée", () => {
  for (const language of ["fr", "en"] as const) for (const verified of [true, false]) {
    const entry = parseRecentRelayHeader(exported(language, { mode: "copy", to: { agent: "opencode-free", session: verified ? COPY : null, provider: "opencode" },
      copy: { source: SOURCE, session: COPY, verified, retention: "retained", sourceCheck: "unchanged", serverStop: "confirmed" } }), "copie.relay.md");
    assert.ok(entry); assert.equal(entry.to, null); assert.equal(entry.agent, "opencode-free");
    assert.deepEqual(entry.copy, { source: SOURCE, session: COPY, verified });
    const text = renderRelayRecent({ v: 1, type: "relay-recent-result", status: "listed", exitCode: 0, entries: [entry], warnings: [], truncated: false, scanTruncated: false, error: null }, language);
    assert.doesNotMatch(text, /--to|relay open|relay --copy/);
  }
});

test("refus : tables du corps, doublons, date, références et valeurs inconnues, en-tête coupé", () => {
  const raw = exported();
  for (const changed of [
    raw.replace("# Relay Palabre", "# Document"), raw.replace("| Champ | Valeur |", "| Autre | Table |"),
    raw.replace("| Fournisseur | claude |", "| Fournisseur | inconnu |"),
    raw.replace("| Issue | replied |", "| Issue | nouveau-statut |"), raw.replace("| Délivrance | replied |", "| Délivrance | autre |"),
    raw.replace(ID, "../../intrus"), raw.replace("2026-10-24T08:00:00.000Z", "2026-02-30T08:00:00.000Z"),
    raw.replace("| Cible |", "| Cible | autre:bad |\n| Cible |"),
    raw.replace("| Objet |", "| Objet | premier |\n| Objet |"), raw.slice(0, raw.indexOf("| Objet |") + 20),
    raw.replace("| Mode | background", "| Mode | inconnu"),
    raw.replace(/^\| Cible .*\r?\n/m, "")
  ]) assert.equal(parseRecentRelayHeader(changed, "refus.relay.md"), undefined);
});

test("inventaire : dossiers absents/invalides, tri mtime puis nom, limite et doublons de conversation", async t => {
  const f = await lab(t);
  assert.deepEqual((await listRecentRelays(path.join(f.root, "absent"))).entries, []);
  await assert.rejects(listRecentRelays(f.config), RelayRecentReadError);
  for (const name of ["b.relay.md", "a.relay.md", "ancien.relay.md"]) {
    await writeFile(path.join(f.output, name), exported()); await utimes(path.join(f.output, name), 1000, name.startsWith("ancien") ? 999 : 1000);
  }
  await writeFile(path.join(f.output, "autre.ask.md"), exported());
  const result = await listRecentRelays(f.output, 2);
  assert.deepEqual(result.entries.map(e => e.fileName), ["a.relay.md", "b.relay.md"]); assert.equal(result.truncated, true);
  assert.equal(result.scanTruncated, false); assert.equal(result.warnings.length, 0);
  for (const limit of [0, 101, NaN, 1.5]) await assert.rejects(listRecentRelays(f.output, limit), RangeError);
});

test("fichier invalide signalé sans bloquer, table au-delà de 16 Kio refusée, gros corps non chargé", async t => {
  const f = await lab(t);
  await writeFile(path.join(f.output, "invalide.relay.md"), "Pas un export");
  await writeFile(path.join(f.output, "long.relay.md"), exported("fr", { created: true, cwd: "x".repeat(20000) }));
  await writeFile(path.join(f.output, "valide.relay.md"), exported() + "x".repeat(2_000_000));
  const result = await listRecentRelays(f.output);
  assert.equal(result.entries.length, 1);
  assert.deepEqual(new Set(result.warnings.map(w => w.reason)), new Set(["invalid-header", "header-too-large"]));
});

test("scan en deux temps : le plus récent après 1 000 candidats n'est pas écarté", async t => {
  const f = await lab(t);
  for (let i = 0; i < 1001; i++) {
    const name = path.join(f.output, `a-${String(i).padStart(4, "0")}.relay.md`);
    await writeFile(name, exported()); await utimes(name, 100, 100);
  }
  await writeFile(path.join(f.output, "z-recent.relay.md"), exported());
  const result = await listRecentRelays(f.output, 1);
  assert.equal(result.entries[0]?.fileName, "z-recent.relay.md"); assert.equal(result.scanTruncated, false);
});

test("plafond de lectures : avertissements bornés et scanTruncated, pas de faux historique complet", async t => {
  const f = await lab(t);
  for (let i = 0; i <= RELAY_RECENT_BOUNDS.headerFiles; i++) await writeFile(path.join(f.output, `${i}.relay.md`), "invalide");
  const result = await listRecentRelays(f.output);
  assert.equal(result.warnings.length, RELAY_RECENT_BOUNDS.headerFiles); assert.equal(result.scanTruncated, true); assert.equal(result.truncated, true);
});

test("liens et dossiers .relay.md refusés sans traversée", async t => {
  const f = await lab(t); await mkdir(path.join(f.output, "dossier.relay.md"));
  await symlink(f.root, path.join(f.output, "lien.relay.md"), process.platform === "win32" ? "junction" : "dir");
  const result = await listRecentRelays(f.output);
  assert.equal(result.entries.length, 0); assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.every(w => w.reason === "not-regular"));
});

/** Lance la vraie CLI compilée dans le seul projet fictif, y compris pour les sorties non nulles. */
async function runCli(root: string, args: string[]) {
  try { const r = await exec(process.execPath, [cli, ...args], { cwd: root, timeout: 15000, encoding: "utf8" }); return { ...r, code: 0 }; }
  catch (error) { const r = error as { stdout: string; stderr: string; code: number }; return r; }
}

test("CLI : JSON unique FR/EN, options avant relay, config approuvée ; aucun modèle ni corps exposé", async t => {
  const f = await lab(t); await trustConfig(f.config);
  await writeFile(path.join(f.output, "exemple.relay.md"), exported());
  const before = await readFile(f.config, "utf8");
  for (const language of ["fr", "en"]) {
    const result = await runCli(f.root, ["--json", "relay", "recent", "--language", language, "--limit", "1", "--config", f.config]);
    assert.equal(result.code, 0, result.stderr); assert.equal(result.stderr, "");
    const json = JSON.parse(result.stdout); assert.equal(json.type, "relay-recent-result"); assert.equal(json.entries.length, 1);
    assert.doesNotMatch(result.stdout, /SECRET|PR-fictif|exports[\\/]/); assert.equal(json.error, null);
  }
  assert.equal(await readFile(f.config, "utf8"), before);
});

test("CLI : options d'envoi et valeurs invalides refusées avant config ; session sans config vide", async t => {
  const f = await lab(t); await writeFile(f.config, "{invalide");
  for (const extra of [["--to", `codex:${ID}`], ["--trust-config"], ["--open"], ["message"], ["--limit", "0"], ["--limit", "101"], ["--limit", "1.5"], ["--limit", "1", "--limit", "2"], ["--dir", f.root], ["--limit=1"], ["--json"]]) {
    const r = await runCli(f.root, ["relay", "recent", "--json", "--config", f.config, ...extra]);
    assert.equal(r.code, 8, r.stderr); assert.equal(JSON.parse(r.stdout).error.reason, "invalid-arguments");
  }
  const empty = await mkdtemp(path.join(os.tmpdir(), "palabre-recent-empty-")); t.after(() => rm(empty, { recursive: true, force: true }));
  const result = await runCli(empty, ["relay", "recent", "--json"]);
  assert.equal(result.code, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout).entries, []);
});

test("config non approuvée : aucun repli, aucune approbation ; explicite absente = refus", async t => {
  const f = await lab(t);
  const first = await executeRelayRecent(["relay", "recent", "--config", f.config]);
  assert.equal(first.result.exitCode, 8); assert.equal(first.result.error?.reason, "config-untrusted");
  assert.deepEqual(first.result.entries, []);
  const second = await executeRelayRecent(["relay", "recent", "--config", path.join(f.root, "absent.json")]);
  assert.equal(second.result.error?.reason, "config-unavailable");
});

test("recent comme valeur de --from/--message-file n'est pas une sous-commande", async t => {
  const f = await lab(t); await trustConfig(f.config);
  await writeFile(path.join(f.root, "recent"), "Message fictif");
  for (const input of [["--from", "recent", "Message fictif"], ["--message-file", "recent"]]) {
    const r = await runCli(f.root, ["relay", ...input, "--to", `claude:${ID}`, "--config", f.config, "--json"]);
    assert.equal(JSON.parse(r.stdout).type, "relay-result");
    assert.equal(JSON.parse(r.stdout).delivery.status, "not-delivered");
  }
});

test("plafond du dossier : scanTruncated même sans export candidat, aucune récursion", async t => {
  const f = await lab(t);
  for (let i = 0; i <= RELAY_RECENT_BOUNDS.directoryEntries; i += 50) {
    await Promise.all(Array.from({ length: Math.min(50, RELAY_RECENT_BOUNDS.directoryEntries + 1 - i) }, (_, n) => mkdir(path.join(f.output, `d-${i + n}`))));
  }
  const r = await listRecentRelays(f.output);
  assert.equal(r.entries.length, 0); assert.equal(r.scanTruncated, true); assert.equal(r.truncated, true);
});

test("nom non représentable : avertissement sans contenu dangereux, pas d'omission silencieuse", async t => {
  const f = await lab(t); await writeFile(path.join(f.output, "sens\u202einverse.relay.md"), exported());
  const r = await listRecentRelays(f.output);
  assert.equal(r.entries.length, 0); assert.deepEqual(r.warnings, [{ fileName: "[invalid-name]", reason: "invalid-name" }]);
});

test("refus de confiance : commande exacte pour l'humain seulement, absente du JSON", async t => {
  const f = await lab(t);
  const json = await runCli(f.root, ["relay", "recent", "--config", f.config, "--json"]);
  assert.equal(json.code, 8); assert.doesNotMatch(json.stdout, /approvalCommand|palabre-recent-|C:\\\\/);
  const human = await runCli(f.root, ["relay", "recent", "--config", f.config]);
  assert.equal(human.code, 8); assert.ok(human.stdout.includes(relayRecentApprovalCommand(f.config)!));
  assert.match(human.stdout, /Propriétaire seulement/);
  assert.equal(relayRecentApprovalCommand("C:\\projet\\a’b.json", "win32"), undefined);
  assert.equal(relayRecentApprovalCommand("bad\npath"), undefined);
  assert.equal(relayRecentApprovalCommand("C:\\projet\\O'Brien.json", "win32"), "palabre config --config 'C:\\projet\\O''Brien.json' --trust-config");
  assert.equal(relayRecentApprovalCommand("/tmp/O'Brien.json", "linux"), "palabre config --config '/tmp/O'\\''Brien.json' --trust-config");
});
