/** @file relay open : ouverture unique simulée, séparation lancement/verrou et refus sans envoi. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { desktopLauncher, executeRelayOpen, launchDesktopOnce, renderRelayOpen, type DesktopOpenDeps, type DesktopOpenValidation, type DesktopLauncherReport } from "../src/commands/relayOpen.js";
import { executeRelay, type RelayResultV1 } from "../src/commands/relay.js";
import { createTranslator } from "../src/i18n.js";
import { trustConfig } from "../src/configTrust.js";
import { CodexSessionAdapter } from "../src/externalSessions/codex.js";

const ID = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const args = ["relay", "open", "--to", `codex:${ID}`];
const fr = createTranslator("fr");

/** Horloge et IO simulées ; aucune application, aucun processus fournisseur. */
function lab(sequence: Array<"attached" | "detached" | "unknown"> = ["attached"]) {
  let now = 0, launches = 0, probes = 0, validations = 0;
  let report: DesktopLauncherReport = { attempted: true, status: "succeeded", exitCode: 0 };
  const specs: Parameters<DesktopOpenDeps["launch"]>[0][] = [];
  const deps: DesktopOpenDeps = {
    platform: "win32", now: () => now,
    locate: async () => ({ status: "found", cwd: "C:/source O'Brien", historyPath: "inert.jsonl" }),
    probe: () => ({ attachment: sequence[Math.min(probes++, sequence.length - 1)]!, activity: "unknown", processes: [], evidence: [] }),
    launch: async spec => { launches++; specs.push(spec); return report; },
    wait: async ms => { now += ms; }
  };
  const validate: DesktopOpenValidation = async incoming => {
    validations++;
    assert.deepEqual(incoming.slice(0, 3), ["relay", "--check", "--open"]);
    assert.ok(!incoming.includes("open"), "pas de sous-commande récursive ni message");
    return { messages: fr, result: { status: "target-not-open", exitCode: 3, mode: "open", to: { agent: "codex", session: ID, provider: "codex" }, error: null } as RelayResultV1 };
  };
  return { deps, validate, specs, counts: () => ({ launches, probes, validations }), advance: (ms: number) => { now += ms; }, report: (r: DesktopLauncherReport) => { report = r; } };
}

test("trois lanceurs système : arguments structurés, UUID strict, aucun message", () => {
  for (const platform of ["win32", "darwin", "linux"] as const) {
    const spec = desktopLauncher({ agent: "codex", sessionId: ID }, platform);
    assert.deepEqual(spec.args, [`codex://threads/${ID}`]);
    assert.ok(spec.command.endsWith(platform === "win32" ? "explorer.exe" : platform === "darwin" ? "/usr/bin/open" : "xdg-open"));
  }
  assert.throws(() => desktopLauncher({ agent: "codex", sessionId: "uuid;whoami" }, "win32"));
});

for (const sequence of [["attached"], ["detached", "detached", "attached"]] as const) {
  test(`lancement unique puis verrou : ${sequence.join(" → ")}`, async () => {
    const w = lab([...sequence]);
    const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps });
    assert.equal(result.status, "attached"); assert.equal(result.exitCode, 0);
    assert.equal(result.launcher.status, "succeeded"); assert.equal(result.attachment, "attached");
    assert.equal(result.display, "unverified"); assert.equal(result.messageSent, false);
    assert.equal(w.counts().launches, 1); assert.equal(w.counts().probes, sequence.length);
    assert.equal(w.specs[0]!.cwd, "C:/source O'Brien"); assert.equal(w.specs[0]!.timeoutMs, 15000);
    assert.deepEqual(w.specs[0]!.args, [`codex://threads/${ID}`]);
    for (const language of ["fr", "en"] as const) {
      const text = renderRelayOpen(result, createTranslator(language));
      assert.match(text, /attached/);
      assert.match(text, language === "fr" ? /Affichage : non vérifié/ : /Display: unverified/);
      assert.match(text, language === "fr" ? /Aucun message envoyé/ : /No message sent/);
    }
  });
}

test("échéance avec verrou libre : 15 s, un seul lancement, aucune certitude d'affichage", async () => {
  const w = lab(["detached"]);
  const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps });
  assert.equal(result.status, "target-not-open"); assert.equal(result.exitCode, 3);
  assert.equal(result.durationMs, 15000); assert.equal(result.attachment, "detached");
  assert.equal(w.counts().launches, 1); assert.equal(result.display, "unverified");
});

test("sonde invérifiable après lancement : refus, aucun retry", async () => {
  const w = lab(["unknown"]);
  const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps });
  assert.equal(result.status, "target-state-unknown"); assert.equal(result.exitCode, 3);
  assert.deepEqual(w.counts(), { launches: 1, probes: 1, validations: 1 });
});

test("lanceur absent, échec, délai, annulation : diagnostic primaire, pas de sonde ni relance", async () => {
  for (const [status, expected, code] of [
    ["not-found", "command-not-found", 7], ["failed", "cli-failure", 2],
    ["timeout", "timeout", 4], ["cancelled", "cancelled", 130]
  ] as const) {
    const w = lab(); w.report({ attempted: status !== "not-found", status });
    const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps });
    assert.equal(result.status, expected); assert.equal(result.exitCode, code);
    assert.equal(w.counts().probes, 0); assert.equal(w.counts().launches, 1);
  }
});

test("Explorer code 1 : résultat du lanceur non vérifié, observation du verrou sans second lancement", async () => {
  for (const sequence of [["attached"], ["detached", "attached"], ["detached"], ["unknown"]] as const) {
    const w = lab([...sequence]); w.report({ attempted: true, status: "failed", exitCode: 1 });
    const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps });
    const last = sequence.at(-1);
    assert.equal(result.status, last === "attached" ? "attached" : last === "unknown" ? "target-state-unknown" : "target-not-open");
    assert.equal(result.exitCode, last === "attached" ? 0 : 3);
    assert.deepEqual(result.launcher, { attempted: true, status: "unverified", exitCode: 1 });
    assert.equal(result.attachment, last); assert.equal(w.counts().launches, 1);
    assert.equal(result.messageSent, false); assert.equal(result.display, "unverified");
    if (last === "detached") assert.equal(result.durationMs, 15000);
    for (const language of ["fr", "en"] as const) {
      const text = renderRelayOpen(result, createTranslator(language));
      assert.match(text, /Explorer.*code 1/);
      assert.match(text, language === "fr" ? /lancement non vérifié/ : /launch outcome unverified/);
      assert.match(text, language === "fr" ? /défilement n'est pas piloté/ : /Scrolling is not controlled/);
    }
  }
});

test("code 1 hors Windows, autres codes et lancement absent : aucun assouplissement", async () => {
  for (const [platform, code, attempted] of [["darwin", 1, true], ["linux", 1, true], ["win32", 2, true], ["win32", null, true], ["win32", 1, false]] as const) {
    const w = lab(); w.deps.platform = platform; w.report({ attempted, status: "failed", exitCode: code });
    const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps });
    assert.equal(result.status, "cli-failure"); assert.equal(result.launcher.status, "failed");
    assert.equal(w.counts().probes, 0); assert.equal(w.counts().launches, 1);
  }
});

test("Explorer code 1 avec verrou préexistant : attachement observé, aucun nouvel affichage déduit", async () => {
  const w = lab(); w.report({ attempted: true, status: "failed", exitCode: 1 });
  const validate: DesktopOpenValidation = async (...v) => {
    const checked = await w.validate(...v); checked.result.status = "checked"; checked.result.exitCode = 0;
    return checked;
  };
  const { result } = await executeRelayOpen(args, validate, fr, { deps: w.deps });
  assert.equal(result.status, "attached"); assert.equal(result.launcher.status, "unverified");
  assert.equal(result.launcher.exitCode, 1); assert.equal(result.display, "unverified");
  assert.deepEqual(w.counts(), { launches: 1, probes: 1, validations: 1 });
  assert.equal(result.messageSent, false);
});

test("Explorer code 1 : annulation et délai gardent priorité sur un verrou tenu", async () => {
  for (const cancel of [false, true]) {
    const controller = new AbortController(); const w = lab();
    w.deps.launch = async () => {
      if (cancel) controller.abort(); else w.advance(15000);
      return { attempted: true, status: "failed", exitCode: 1 };
    };
    const { result } = await executeRelayOpen(args, w.validate, fr, { deps: w.deps, signal: controller.signal });
    assert.equal(result.status, cancel ? "cancelled" : "timeout");
    assert.equal(result.launcher.status, "unverified"); assert.equal(w.counts().probes, 0);
    assert.equal(result.messageSent, false);
  }
});

test("déjà tenue avant l'ouverture : un seul lancement reste requis ; faux succès sans lancement refusé", async () => {
  const w = lab();
  const validate: DesktopOpenValidation = async (...args) => {
    const checked = await w.validate(...args); checked.result.status = "checked"; checked.result.exitCode = 0;
    return checked;
  };
  assert.equal((await executeRelayOpen(args, validate, fr, { deps: w.deps })).result.status, "attached");
  assert.equal(w.counts().launches, 1);
  const phantom = lab(); phantom.report({ status: "succeeded", attempted: false });
  assert.equal((await executeRelayOpen(args, phantom.validate, fr, { deps: phantom.deps })).result.status, "cli-failure");
  assert.equal(phantom.counts().probes, 0);
});

test("arguments interdits/ambigus : ni validation, ni lecture, ni lancement", async () => {
  for (const tail of [["message"], ["--new"], ["--open"], ["--background"], ["--trust-config"], ["--timeout", "10"], ["--to", `codex:${ID}`], ["--json", "--json"], ["--lang", "en", "--language", "fr"], ["--unknown"], ["--model=foo"]]) {
    const w = lab();
    const { result } = await executeRelayOpen([...args, ...tail], w.validate, fr, { deps: w.deps });
    assert.equal(result.status, "invalid-request", tail.join(" "));
    assert.deepEqual(w.counts(), { launches: 0, probes: 0, validations: 0 });
  }
});

test("refus de validation exact conservé : Claude, confiance, cible absente, état inconnu", async () => {
  for (const [status, exitCode, reason] of [["invalid-request", 8, "unsupported-agent"], ["invalid-request", 8, "config-untrusted"], ["session-not-found", 6, undefined], ["target-state-unknown", 3, undefined]] as const) {
    const w = lab();
    const validate: DesktopOpenValidation = async () => ({ messages: fr, result: { status, exitCode, to: null, error: { kind: status, reason, message: "refus avant ouverture" } } as RelayResultV1 });
    const { result } = await executeRelayOpen(args, validate, fr, { deps: w.deps });
    assert.equal(result.status, status); assert.equal(result.exitCode, exitCode); assert.equal(result.error?.reason, reason);
    assert.equal(w.counts().launches, 0);
  }
});

test("Ctrl+C avant et pendant l'observation ; verrou tardif après échéance jamais accepté", async () => {
  const controller = new AbortController(); controller.abort();
  const w = lab();
  assert.equal((await executeRelayOpen(args, w.validate, fr, { deps: w.deps, signal: controller.signal })).result.exitCode, 130);
  assert.equal(w.counts().launches, 0);
  const during = new AbortController(); const busy = lab(["detached"]);
  busy.deps.wait = async () => { during.abort(); };
  assert.equal((await executeRelayOpen(args, busy.validate, fr, { deps: busy.deps, signal: during.signal })).result.exitCode, 130);
  assert.equal(busy.counts().launches, 1);
  const late = lab(); late.deps.probe = () => { late.advance(15001); return { attachment: "attached", activity: "unknown", processes: [], evidence: [] }; };
  const result = (await executeRelayOpen(args, late.validate, fr, { deps: late.deps })).result;
  assert.equal(result.status, "timeout"); assert.equal(result.exitCode, 4);
});

test("le temps de validation et de lancement compte dans le budget global", async () => {
  const w = lab();
  const validate: DesktopOpenValidation = async (...v) => { w.advance(14000); return w.validate(...v); };
  const { result } = await executeRelayOpen(args, validate, fr, { deps: w.deps });
  assert.equal(result.exitCode, 0); assert.equal(w.specs[0]!.timeoutMs, 1000);
  const late = lab(); const tooLate: DesktopOpenValidation = async (...v) => { late.advance(15000); return late.validate(...v); };
  assert.equal((await executeRelayOpen(args, tooLate, fr, { deps: late.deps })).result.status, "timeout");
  assert.equal(late.counts().launches, 0);
});

test("validation réelle sur profil fictif : confiance requise, Claude refusée, aucune écriture ni CLI fournisseur", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-open-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(os, "homedir", () => root);
  const bin = path.join(root, process.platform === "win32" ? "codex.exe" : "codex");
  const claude = path.join(root, process.platform === "win32" ? "claude.exe" : "claude");
  await writeFile(bin, "inert", { mode: 0o755 }); await writeFile(claude, "inert", { mode: 0o755 });
  const config = path.join(root, "palabre.config.json");
  await writeFile(config, JSON.stringify({ agents: { codex: { type: "cli", command: bin }, claude: { type: "cli", command: claude } } }));
  const before = await readFile(config, "utf8");
  const validate: DesktopOpenValidation = async (args, signal) => ({ messages: fr, result: await executeRelay(args, { signal }) });
  const w = lab();
  const run = (to: string) => executeRelayOpen(["relay", "open", "--to", to, "--config", config], validate, fr, { deps: w.deps });
  assert.equal((await run(`codex:${ID}`)).result.error?.reason, "config-untrusted");
  assert.equal(w.counts().launches, 0);
  await trustConfig(config);
  assert.equal((await run(`claude:${ID}`)).result.error?.reason, "unsupported-agent");
  const day = path.join(root, ".codex", "sessions", "2026", "10", "23"); await mkdir(day, { recursive: true });
  await writeFile(path.join(day, `rollout-${ID}.jsonl`), JSON.stringify({ type: "session_meta", payload: { id: ID, cwd: root } }) + "\n");
  t.mock.method(CodexSessionAdapter.prototype, "probe", () => ({ attachment: "detached", activity: "unknown", processes: [], evidence: [] }));
  assert.equal((await run(`codex:${ID}`)).result.status, "attached");
  assert.equal(w.counts().launches, 1); assert.equal(await readFile(config, "utf8"), before);
  // Entrée CLI réelle, cible Claude refusée avant le lanceur : texte et JSON fr/en sans app.
  for (const language of ["fr", "en"]) {
    for (const json of [false, true]) {
      const entry = fileURLToPath(new URL("../src/index.js", import.meta.url));
      let stdout = "";
      try {
        await promisify(execFile)(process.execPath, [entry, "relay", "open", "--to", `claude:${ID}`, "--config", config, "--language", language, ...(json ? ["--json"] : [])]);
        assert.fail("Claude doit rester refusée par relay open");
      } catch (error) {
        assert.equal((error as { code: number }).code, 8);
        stdout = (error as { stdout: string }).stdout;
      }
      if (json) {
        const result = JSON.parse(stdout);
        assert.equal(result.type, "relay-open-result"); assert.equal(result.error.reason, "unsupported-agent");
        assert.equal(result.messageSent, false); assert.equal(result.launcher.attempted, false);
        assert.equal(result.reply, undefined); assert.equal(result.delivery, undefined);
      } else assert.match(stdout, language === "fr" ? /Aucun message envoyé/ : /No message sent/);
    }
  }
});

test("lanceur réel testé avec Node inerte : code 0, erreur et commande absente, jamais Desktop", async () => {
  for (const exit of [0, 1, 2]) {
    const report = await launchDesktopOnce({ command: process.execPath, args: ["-e", `process.exit(${exit})`], cwd: process.cwd(), timeoutMs: 5000 });
    assert.equal(report.status, exit === 0 ? "succeeded" : "failed"); assert.equal(report.exitCode, exit);
  }
  const missing = await launchDesktopOnce({ command: path.join(process.cwd(), "absent-launcher.exe"), args: [], cwd: process.cwd(), timeoutMs: 5000 });
  assert.equal(missing.status, "not-found"); assert.equal(missing.attempted, false);
});

test("annulation/échéance du lanceur : détachement et nettoyage, jamais de kill de Desktop", async () => {
  for (const cancel of [false, true]) {
    const controller = new AbortController();
    let unrefs = 0, kills = 0;
    const child = Object.assign(new EventEmitter(), { pid: 123, unref: () => { unrefs++; }, kill: () => { kills++; } });
    const spawn: NonNullable<Parameters<typeof launchDesktopOnce>[0]["spawn"]> = ((command, args, options) => {
      assert.equal(command, "inert-launcher"); assert.deepEqual(args, ["inert-target"]);
      assert.equal(options?.shell, false); assert.equal(options?.stdio, "ignore");
      assert.equal(options?.detached, true, "groupe isolé : le Ctrl+C du terminal ne doit pas atteindre le lanceur");
      if (cancel) queueMicrotask(() => controller.abort());
      return child;
    }) as NonNullable<Parameters<typeof launchDesktopOnce>[0]["spawn"]>;
    const report = await launchDesktopOnce({ command: "inert-launcher", args: ["inert-target"], cwd: process.cwd(), timeoutMs: 10, signal: controller.signal, spawn });
    assert.equal(report.status, cancel ? "cancelled" : "timeout"); assert.equal(report.attempted, true);
    assert.equal(unrefs, 1); assert.equal(kills, 0); assert.equal(child.listenerCount("exit"), 0);
    child.emit("error", new Error("erreur tardive absorbée"));
  }
});
