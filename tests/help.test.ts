/** @file Aide CLI : découverte FR/EN, couverture du parseur et parcours sans agent ni écriture. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { helpMessages } from "../src/messages/help.js";
import { parseArgs } from "../src/args.js";
import { createTranslator } from "../src/i18n.js";

const commands = ["skill", "mission", "init", "agent-role", "agents", "presets", "history", "historique", "context", "config", "new", "doctor", "update", "resume", "sessions", "run", "chat", "ask", "relay"];
const source = await readFile(path.resolve("src/args.ts"), "utf8");
// Inventaire de la table privée sans élargir l'API du parseur pour un test documentaire.
const flagTable = source.match(/const FLAG_SPECS:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1];
assert.ok(flagTable, "table d'arité des flags absente ou format changé : adapter le lecteur du test");
const flags = [...flagTable.matchAll(/^\s*(?:"([a-z-]+)"|([a-z]+)):\s*\{ arity:/gm)].map(m => m[1] ?? m[2]!);

for (const language of ["fr", "en"] as const) {
  const help = helpMessages[language];
  test(`aide principale ${language} : quatre modes et options essentielles, sans encyclopédie`, () => {
    const text = help.render("");
    for (const mode of [language === "fr" ? "Débat" : "Debate", "Relay", "Ask", "Chat"]) assert.ok(text.includes(mode));
    assert.match(text, /palabre doctor/); assert.match(text, /palabre relay --new/);
    assert.match(text, /relay\s+.*--open/); assert.match(text, /palabre \[(?:commande|command)\] --help/);
    for (const flag of ["files", "context", "model-a", "model-b", "summary-agent", "summary-model", "no-summary", "no-early-stop", "checkpoint", "show-prompt"]) assert.ok(text.includes(`--${flag}`), flag);
    assert.ok(text.trim().split(/\r?\n/).length <= 65, "garder le détail dans les aides des commandes");
  });

  test(`chaque option publique du parseur apparaît dans une aide ${language}`, () => {
    assert.ok(flags.length > 40, "inventaire incomplet");
    for (const command of commands) assert.ok(help.renderCommand(command), `aide manquante : ${command}`);
    // run --help rend l'aide générale : sa chaîne dédiée n'est pas accessible par la CLI.
    const combined = [help.render(""), ...commands.filter(c => c !== "run").map(c => help.renderCommand(c))].join("\n");
    for (const flag of flags) assert.match(combined, new RegExp(`--${flag}(?![a-z-])`), `--${flag}`);
    // Les alias restent découvrables, sans changer leurs noms techniques.
    for (const alias of ["topic", "plain", "apply"]) assert.ok(combined.includes(`--${alias}`));
    assert.doesNotMatch(combined, /palabre résumé/);
  });

  test(`Ask ${language} : exemples cohérents, portée des modèles et synthèse`, () => {
    const text = help.renderCommand("ask")!;
    assert.doesNotMatch(text, /palabre chat/);
    for (const flag of ["agents", "files", "context", "model-a", "model-b", "summary-agent", "summary-model", "no-summary", "checkpoint"]) assert.ok(text.includes(`--${flag}`));
    assert.match(text, language === "fr" ? /autres participants gardent leur modèle configuré/ : /Other participants keep their configured model/);
    assert.match(text, language === "fr" ? /A et B désignent le même participant/ : /A and B name the same participant/);
  });

  test(`Chat ${language} : mémoire bornée, contexte et limites explicites`, () => {
    const text = help.renderCommand("chat")!;
    assert.doesNotMatch(text, /stateless|accumulated history|historique accumul/);
    assert.match(text, language === "fr" ? /six derniers messages/ : /six most recent messages/);
    for (const flag of ["files", "context", "model-a", "renderer"]) assert.ok(text.includes(`--${flag}`));
    for (const command of ["/consult", "/use", "/end", "/exit", "/home"]) assert.ok(text.includes(command));
    assert.match(text, language === "fr" ? /sans export/ : /without an export/);
    assert.match(text, /--dry-run/);
  });

  test(`Run et configuration ${language} : modes réels et options avancées`, () => {
    const text = help.renderCommand("run")!;
    for (const mode of ["debate", "ask", "chat"]) assert.match(text, new RegExp(`--mode ${mode}`));
    assert.match(text, /--no-early-stop/); assert.match(text, /--summary-model/);
    assert.match(help.renderCommand("config")!, /--mode <chat\|debate\|ask>/);
  });

  test(`Relay ${language} : conserver modes, suivi et gardes sans repli de droits`, () => {
    const text = help.renderCommand("relay")!;
    for (const flag of ["open", "follow", "background", "relay-view"]) assert.ok(text.includes(`--${flag}`));
    assert.match(text, language === "fr" ? /aucun renvoi automatique/i : /no automatic resend/i);
    assert.match(text, language === "fr" ? /sans modification.*--background/s : /must not change files.*--background/s);
  });

  test(`exemples de lancement ${language} : syntaxe reconnue, sans exécution`, () => {
    for (const args of [
      ["run", "--mode", "debate", "--preset", "codex-claude", "-s", "Subject", "-t", "4"],
      ["run", "--mode", "chat", "--agent-a", "codex", "-s", "Initial context"],
      ["ask", "Subject", "--agents", "codex", "claude", "--files", "docs/plan.md", "--no-summary"]
    ]) assert.ok(parseArgs(args, createTranslator(language)).command);
  });

  test(`sortie réelle --help ${language} : sans configuration, appel agent ou export`, async t => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-help-"));
    t.after(() => rm(workspace, { recursive: true, force: true }));
    const entry = path.resolve(".tmp/test-dist/src/index.js");
    for (const command of [undefined, "run", "ask", "chat", "relay", "config", "resume"]) {
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [entry, ...(command ? [command] : []), "--help", "--language", language], { cwd: workspace, timeout: 15_000 });
      assert.equal(stdout, command && command !== "run" ? help.renderCommand(command)! + "\n" : help.render("") + "\n");
      assert.equal(stderr, ""); assert.deepEqual(await readdir(workspace), []);
    }
  });
}
