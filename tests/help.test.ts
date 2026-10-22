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
// Inventaire fermé : une nouvelle option du parseur exige un classement explicite.
const launchFlags = ["help", "version", "tui", "terminal", "plain", "json", "no-summary", "no-early-stop", "show-prompt", "dry-run", "pull-models", "checkpoint", "trust-config", "agent-a", "agent-b", "config", "language", "model-a", "model-b", "role-a", "role-b", "ask-role", "ollama-url", "mode", "preset", "summary-agent", "summary-model", "topic", "turns", "renderer", "agents", "files", "context"];
const otherCommandFlags = ["check", "yes", "prune-trust", "local", "apply", "clear-defaults", "sync-agents", "sync", "sync-ollama-model", "ollama-models", "interface", "relay-view", "install", "limit", "set-ollama-model", "ask-summary-agent", "ask-agents", "set-defaults"];

test("chaque option du parseur est classée : lancement ou autre commande", () => {
  assert.deepEqual([...launchFlags, ...otherCommandFlags].sort(), [...flags].sort());
});

for (const language of ["fr", "en"] as const) {
  const help = helpMessages[language];
  test(`listes d'options ${language} : descriptions alignées dans chaque aide`, () => {
    let checked = 0;
    for (const [command, text] of [["principale", help.render("")], ...commands.map(c => [c, help.renderCommand(c)!])] as [string, string][]) {
      let column: number | undefined;
      let inList = false;
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]!;
        if (!line.trim() || /^\S.*:$/.test(line)) {
          column = undefined;
          inList = /^(?:Options|Flags|Options de session|Session options|Agents et mode|Agents and mode|Contexte et modèles|Context and models|Synthèse et préparation|Summary and preparation|Affichage et configuration|Display and configuration|Cadre de start|start scope).*:$/.test(line);
          continue;
        }
        if (line.startsWith("  palabre skill ")) inList = true;
        if (!inList) continue;
        if (!/^  (?:-[a-z], )?--/.test(line)) continue; // Explications intercalées.
        const option = line.match(/^  ((?:-[a-z], )?--[a-z-]+(?:(?:, | \/ )--[a-z-]+)?(?: (?:<[^>]+>(?:\[:<[^>]+>\]|:<[^>]+>)?|review))?)(?= {2,}|$)(?: {2,}(\S.*))?$/);
        assert.ok(option, `${command} : séparer option et description par au moins deux espaces : ${line}`);
        // Un libellé long peut placer sa description à la ligne suivante.
        const descriptionLine = option[2] ? line : lines[++index]!;
        assert.ok(descriptionLine?.trim(), `${command} : description manquante : ${line}`);
        const actual = option[2] ? line.length - option[2].length : descriptionLine.search(/\S/);
        column ??= actual;
        assert.equal(actual, column, `${command} : colonne de description différente : ${line}`);
        checked++;
      }
    }
    assert.ok(checked > 120, `inventaire des listes incomplet : ${checked}`);
  });

  if (language === "fr") test("aide française : titres et paramètres homogènes", () => {
    const text = [help.render(""), ...commands.map(c => help.renderCommand(c))].join("\n");
    assert.doesNotMatch(text, /^Usage\b|^Flags:|^Démarrage rapide:/m);
    assert.match(text, /Démarrage rapide :/);
    assert.doesNotMatch(text, /<(?:names\.\.\.|role|model|path|n|m|kind|name|number|session-id)>/);
    for (const command of commands) {
      const commandText = help.renderCommand(command)!;
      assert.doesNotMatch(commandText, /^[A-Za-zÀ-ÿ][^\n]*\S:$/m, `espace avant les deux-points : ${command}`);
    }
  });

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
    const combined = [help.render(""), ...commands.map(c => help.renderCommand(c))].join("\n");
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
    assert.notEqual(text, help.render(""));
    for (const flag of launchFlags) assert.match(text, new RegExp(`--${flag}(?![a-z-])`), `--${flag}`);
    for (const alias of ["subject", "s", "t", "lang", "no-tui"]) assert.match(text, new RegExp(`--${alias}(?![a-z-])`), `--${alias}`);
    for (const mode of ["debate", "ask", "chat"]) assert.match(text, new RegExp(`--mode ${mode}`));
    assert.match(text, /--no-early-stop/); assert.match(text, /--summary-model/);
    assert.match(text, /palabre ask --help/); assert.match(text, /palabre chat --help/);
    assert.match(help.render(""), /palabre run --help/);
    assert.match(text, /64 (?:Kio|KiB).*192 (?:Kio|KiB)/);
    assert.match(text, language === "fr" ? /entier de 1 à 20/ : /integer from 1 to 20/);
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
    const cases: [string[], string | undefined][] = [
      [[], undefined], [["help"], undefined], [["run"], "run"],
      [["--language", language, "run"], "run"], [["run", "--mode", "ask"], "run"],
      [["run", "--mode", "chat"], "run"], [["--mode", "ask"], undefined],
      [["--config", "run"], undefined],
      ...["ask", "chat", "relay", "config", "resume"].map(command => [[command], command] as [string[], string])
    ];
    for (const [args, command] of cases) {
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [entry, ...args, "--help", "--language", language], { cwd: workspace, timeout: 15_000 });
      assert.equal(stdout, command ? help.renderCommand(command)! + "\n" : help.render("") + "\n");
      assert.equal(stderr, ""); assert.deepEqual(await readdir(workspace), []);
    }
  });
}
