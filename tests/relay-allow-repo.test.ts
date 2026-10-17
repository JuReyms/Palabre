import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { runRelayAllowRepo, reviewAuthorizationCommand, type AllowRepoIo } from "../src/commands/relayAllowRepo.js";
import { isConfigTrusted, trustConfig } from "../src/configTrust.js";

const root = await mkdtemp(path.join(os.tmpdir(), "palabre-allow-repo-"));
after(() => rm(root, { recursive: true, force: true }));
let count = 0;
async function world(policy?: unknown) {
  const file = path.join(root, `config-${++count}.json`);
  const trust = file + ".trust.json";
  const config = { language: "fr", agents: { claude: { type: "cli", command: "claude", args: ["custom"] } },
    defaults: { turns: 3 }, custom: { preserve: [1, "two"] }, ...(policy === undefined ? {} : { relay: policy }) };
  const before = JSON.stringify(config);
  await writeFile(file, before);
  await trustConfig(file, trust);
  const lines: string[] = [];
  let confirmations = 0;
  const io: AllowRepoIo = { interactive: true, print: line => lines.push(line),
    confirm: async () => { confirmations++; return true; }, isTrusted: file => isConfigTrusted(file, trust),
    trust: (file, sha256) => trustConfig(file, trust, sha256) };
  return { file, trust, before, config, lines, io, confirmations: () => confirmations };
}

test("confirmation : crée la politique, approuve le fichier et préserve les autres champs", async () => {
  const w = await world();
  await runRelayAllowRepo(["JuReyms/Palabre", "--config", w.file], w.io);
  const updated = JSON.parse(await readFile(w.file, "utf8"));
  assert.deepEqual(updated, { ...w.config, relay: { allowedTasks: ["review"], reviewRepositories: ["jureyms/palabre"] } });
  assert.equal(w.confirmations(), 1); assert.equal(await isConfigTrusted(w.file, w.trust), true);
  assert.ok(w.lines.some(line => line.includes(w.file)));
});

test("refus ou confirmation interrompue : aucun octet ni confiance modifié", async () => {
  for (const interrupt of [false, true]) {
    const w = await world(); w.io.confirm = async () => { if (interrupt) throw Error("closed"); return false; };
    const run = () => runRelayAllowRepo(["owner/repo", "--config", w.file], w.io);
    const trustBefore = await readFile(w.trust, "utf8");
    await assert.rejects(run(), interrupt ? /closed/ : /refusée/);
    assert.equal(await readFile(w.file, "utf8"), w.before); assert.equal(await isConfigTrusted(w.file, w.trust), true);
    assert.equal(await readFile(w.trust, "utf8"), trustBefore);
  }
});

test("sans terminal : refus avant lecture de configuration et sans confirmation", async () => {
  const w = await world(); w.io.interactive = false;
  await assert.rejects(runRelayAllowRepo(["owner/repo", "--config", w.file + ".absent"], w.io), /terminal interactif/);
  assert.equal(w.confirmations(), 0); assert.equal(await readFile(w.file, "utf8"), w.before);
});

test("aucune option ne peut contourner la confirmation, arguments stricts", async () => {
  for (const args of [["owner/repo", "--yes"], ["owner/repo", "--trust-config"], ["owner/repo", "--json"],
    ["owner/repo", "--config"], ["owner/repo", "--config", "a", "--config", "b"], [], ["owner/repo", "other/repo"],
    ["*"], ["owner/pre*"], ["*/repo"], ["owner/*/x"], ["owner/repo;echo"]]) {
    const w = await world();
    await assert.rejects(runRelayAllowRepo(args, w.io), /Commande :/);
    assert.equal(w.confirmations(), 0); assert.equal(await readFile(w.file, "utf8"), w.before);
  }
});

test("motif owner/* annoncé, casse normalisée, aucun doublon", async () => {
  const w = await world({ allowedTasks: [], reviewRepositories: ["Owner/Repo", "owner/repo"] });
  await runRelayAllowRepo(["OWNER/*", "--config", w.file], w.io);
  await runRelayAllowRepo(["owner/*", "--config", w.file], w.io);
  assert.deepEqual(JSON.parse(await readFile(w.file, "utf8")).relay, { allowedTasks: ["review"], reviewRepositories: ["owner/repo", "owner/*"] });
  assert.ok(w.lines.some(line => line.includes("toutes les PR de tous les dépôts de owner")));
  assert.equal(w.confirmations(), 2);
});

test("configuration changée pendant la question : rien écrasé ni approuvé", async () => {
  const w = await world();
  const foreign = JSON.stringify({ ...w.config, custom: "changed" });
  w.io.confirm = async () => { await writeFile(w.file, foreign); return true; };
  await assert.rejects(runRelayAllowRepo(["owner/repo", "--config", w.file], w.io), /modifiée pendant/);
  assert.equal(await readFile(w.file, "utf8"), foreign); assert.equal(await isConfigTrusted(w.file, w.trust), false);
});

test("configuration altérée avant la commande : aucune question, instruction séparée d'approbation", async () => {
  const w = await world(); const altered = JSON.stringify({ ...w.config, agents: { arbitrary: { command: "changed" } } });
  await writeFile(w.file, altered); const store = await readFile(w.trust, "utf8");
  await assert.rejects(runRelayAllowRepo(["owner/repo", "--config", w.file], w.io), error => {
    assert.match(String(error), /Configuration non approuvée/); assert.match(String(error), /palabre config .*--trust-config/);
    return true;
  });
  assert.equal(w.confirmations(), 0); assert.equal(await readFile(w.file, "utf8"), altered);
  assert.equal(await readFile(w.trust, "utf8"), store); assert.equal(await isConfigTrusted(w.file, w.trust), false);
});

test("écriture étrangère juste avant l'approbation : jamais approuvée", async () => {
  const w = await world();
  w.io.trust = async (file, sha256) => { await writeFile(file, JSON.stringify({ ...w.config, foreign: true })); await trustConfig(file, w.trust, sha256); };
  await assert.rejects(runRelayAllowRepo(["owner/repo", "--config", w.file], w.io), /incomplète/);
  assert.equal(await isConfigTrusted(w.file, w.trust), false);
});

test("JSON ou politique invalide : refus sans question ni remplacement silencieux", async () => {
  for (const body of ["{", "null", "[]", JSON.stringify({ agents: {}, relay: { allowedTasks: ["code"], reviewRepositories: ["owner/repo"] } })]) {
    const w = await world(); await writeFile(w.file, body);
    await assert.rejects(runRelayAllowRepo(["owner/repo", "--config", w.file], w.io));
    assert.equal(w.confirmations(), 0); assert.equal(await readFile(w.file, "utf8"), body);
  }
});

test("langue de configuration et échec d'approbation explicitent l'état", async () => {
  const w = await world(); await writeFile(w.file, JSON.stringify({ ...w.config, language: "en" }));
  await trustConfig(w.file, w.trust);
  w.io.trust = async () => { throw Error("EACCES"); };
  await assert.rejects(runRelayAllowRepo(["owner/repo", "--config", w.file], w.io), /Writing or approval incomplete/);
  assert.ok(w.lines.some(line => line.includes("Planned change")));
  assert.equal(JSON.parse(await readFile(w.file, "utf8")).relay.allowedTasks[0], "review");
  assert.equal(await isConfigTrusted(w.file, w.trust), false);
});

test("remedy conserve un chemin de configuration avec espaces et apostrophe", () => {
  const file = path.resolve("folder with space", "owner's.config.json");
  const command = reviewAuthorizationCommand("owner/repo", file);
  assert.ok(command.startsWith("palabre relay allow-repo owner/repo --config '"));
  assert.ok(command.includes(process.platform === "win32" ? "owner''s.config" : "owner'\\''s.config"));
});
