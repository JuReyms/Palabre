/**
 * @file Tests de l'affichage du mode Relay (#190, lot A) : libellés fr/en, lien OSC 8 réservé au
 * terminal interactif, suggestion `relay open` liée à la config effective et cas où ce lien
 * est donné, et ouverture Claude liée à son dossier exact sans nouvel envoi. Fonctions pures.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { claudeDesktopOpenCommand, codexDesktopOpenCommand, relayDesktopLink, renderRelayText, terminalHyperlinksEnabled, withTerminalHyperlink, type RelayResultV1 } from "../src/commands/relay.js";
import { relayMessages } from "../src/messages/relay.js";
import { createTranslator } from "../src/i18n.js";

const LINK = "codex://threads/0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";

describe("#190 : libellés du mode", () => {
  test("arrière-plan, écriture, dans l'app desktop et suivi, en fr et en en", () => {
    assert.equal(relayMessages.fr.modeLine("background", "codex", false), "Mode : arrière-plan — sans fenêtre visible ; PALABRE demande la lecture seule.");
    assert.equal(relayMessages.fr.modeLine("background", "codex", true), "Mode : arrière-plan — écriture ponctuelle dans un worktree séparé, après votre accord.");
    assert.match(relayMessages.fr.modeLine("open", "codex", false), /^Mode : dans l'app desktop — la conversation doit être ouverte ; codex y garde les permissions de cette conversation\.$/);
    assert.match(relayMessages.fr.modeLine("follow", "codex", false), /^Mode : dans l'app desktop \(suivi\) — suivi demandé du prochain tour terminé, sans dépôt\.$/);
    assert.equal(relayMessages.en.modeLine("background", "claude", false), "Mode: background — no visible window; PALABRE requests read-only access.");
    assert.match(relayMessages.en.modeLine("open", "codex", false), /^Mode: in the desktop app — the conversation must be open/);
    assert.deepEqual(Object.keys(relayMessages.fr.export.modeNames).sort(), Object.keys(relayMessages.en.export.modeNames).sort());
  });
});

describe("Claude Desktop : commande de consultation, aucun envoi", () => {
  const session = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
  const executable = { command: "C:/Claude O'Brien/claude.exe", prefixArgs: [] };
  /** Cible fictive déjà reçue ; les autres champs sont ceux d'un résultat sans export. */
  const result = (over: Partial<RelayResultV1> = {}): RelayResultV1 => ({
    v: 1, type: "relay-result", status: "replied", exitCode: 0, mode: "background",
    from: null, to: { agent: "claude-reviewer", session, provider: "claude" },
    delivery: { status: "replied", persisted: true, inActiveBranch: true },
    identity: "same-as-target", observedModels: [], error: null, exportPath: null, durationMs: 0,
    cwd: "C:/Projet O'Brien $()/source",
    ...over
  });
  test("même exécutable, UUID exact et seulement --desktop --resume ; chemins quotés", () => {
    assert.equal(claudeDesktopOpenCommand(result(), true, executable, "win32"),
      `& { Push-Location -LiteralPath 'C:/Projet O''Brien $()/source' -ErrorAction Stop; try { & 'C:/Claude O''Brien/claude.exe' '--desktop' '--resume' '${session}' } finally { Pop-Location } }`);
    assert.equal(claudeDesktopOpenCommand(result(), true, executable, "darwin"),
      `(cd -- 'C:/Projet O'\\''Brien $()/source' && 'C:/Claude O'\\''Brien/claude.exe' '--desktop' '--resume' '${session}')`);
    const node = { command: "C:/node.exe", prefixArgs: ["C:/paquet $()/claude.js"] };
    assert.equal(claudeDesktopOpenCommand(result(), true, node, "win32"),
      `& { Push-Location -LiteralPath 'C:/Projet O''Brien $()/source' -ErrorAction Stop; try { & 'C:/node.exe' 'C:/paquet $()/claude.js' '--desktop' '--resume' '${session}' } finally { Pop-Location } }`);
    assert.equal(claudeDesktopOpenCommand(result({ cwd: undefined }), true, executable, "win32"), undefined);
  });
  test("création même en échec ; reprise localisée, jamais cible supposée ni ID libre", () => {
    assert.ok(claudeDesktopOpenCommand(result({ created: true, status: "cli-failure" }), false, executable, "win32"));
    assert.equal(claudeDesktopOpenCommand(result(), false, executable, "win32"), undefined);
    for (const session of [null, "", "latest", "uuid'; whoami"]) {
      assert.equal(claudeDesktopOpenCommand(result({ created: true, to: { agent: "claude", provider: "claude", session } }), true, executable, "win32"), undefined);
    }
    for (const mode of ["copy", "open", "follow"] as const) {
      assert.equal(claudeDesktopOpenCommand(result({ mode }), true, executable, "win32"), undefined);
    }
    assert.equal(claudeDesktopOpenCommand(result({ to: { agent: "codex", provider: "codex", session } }), true, executable, "win32"), undefined);
    assert.equal(claudeDesktopOpenCommand(result(), true, undefined, "win32"), undefined);
    assert.equal(claudeDesktopOpenCommand(result(), true, executable, "linux"), undefined);
  });
  test("contrôles et guillemets typographiques PowerShell refusés, pas assainis en commande différente", () => {
    for (const command of ["claude\n.exe", "claude\u202e.exe", ...Array.from({ length: 7 }, (_, i) => `C:/O${String.fromCharCode(0x2018 + i)}Brien/claude.exe`)]) {
      assert.equal(claudeDesktopOpenCommand(result(), true, { command, prefixArgs: [] }, "win32"), undefined);
    }
    for (const quote of ["\u201a", "\u201b"]) {
      assert.equal(claudeDesktopOpenCommand(result({ cwd: `C:/projet${quote}nom` }), true, executable, "win32"), undefined);
      assert.equal(claudeDesktopOpenCommand(result(), true, { command: "node", prefixArgs: [`C:/projet${quote}nom/claude.js`] }, "win32"), undefined);
    }
    assert.equal(claudeDesktopOpenCommand(result(), true, { command: "node", prefixArgs: ["cli\n.js"] }, "darwin"), undefined);
  });
  test("consignes fr/en : demande humaine, TTY, consultation, pas d'envoi Claude ouverte", () => {
    for (const language of ["fr", "en"] as const) {
      const text = relayMessages[language].claudeDesktop;
      assert.match(text, /TTY/);
      assert.match(text, /2\.1\.285/);
      assert.match(text, language === "fr" ? /demande directe du propriétaire/ : /owner's direct request/);
      assert.match(text, language === "fr" ? /Aucun message envoyé/ : /No message sent/);
      assert.match(text, language === "fr" ? /--open ne prend pas en charge Claude/ : /--open transport does not support Claude/);
      const rendered = renderRelayText(result(), createTranslator(language), { targetLocated: true, desktopExecutable: executable });
      assert.equal(rendered.stderr.includes("'--desktop' '--resume'"), process.platform === "win32" || process.platform === "darwin");
      assert.ok(!rendered.stderr.includes("codex://"));
    }
  });
});

describe("#190 : lien cliquable et commande d'ouverture", () => {
  test("OSC 8 seulement en TTY, sans NO_COLOR ni TERM=dumb", () => {
    assert.equal(terminalHyperlinksEnabled(true, {}), true);
    assert.equal(terminalHyperlinksEnabled(false, {}), false);
    assert.equal(terminalHyperlinksEnabled(undefined, {}), false);
    assert.equal(terminalHyperlinksEnabled(true, { NO_COLOR: "1" }), false);
    assert.equal(terminalHyperlinksEnabled(true, { TERM: "dumb" }), false);
  });
  test("seule la première occurrence devient cliquable ; texte inchangé sans le lien", () => {
    const text = `Lien : ${LINK}\nRappel du lien : ${LINK}\n`;
    const linked = withTerminalHyperlink(text, LINK);
    assert.equal(linked, `Lien : \u001b]8;;${LINK}\u001b\\${LINK}\u001b]8;;\u001b\\\nRappel du lien : ${LINK}\n`);
    assert.equal(withTerminalHyperlink("aucun lien", LINK), "aucun lien");
  });
});

describe("Codex Desktop : suggestion unique, config et cible conservées", () => {
  const session = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
  const result = { status: "replied", mode: "background", to: { agent: "codex-reviewer", session, provider: "codex" } } as RelayResultV1;
  const config = path.resolve("projet O'Brien $()`\"", "palabre.config.json");
  test("PowerShell et POSIX : littéral exact, même alias, sans envoi ni approbation", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const quoted = platform === "win32" ? config.replaceAll("'", "''") : config.replaceAll("'", "'\\''");
      assert.equal(codexDesktopOpenCommand(result, true, config, platform),
        `palabre relay open --to codex-reviewer:${session} --config '${quoted}'`);
    }
  });
  test("aucune cible/config supposée ; caractères non représentables refusés", () => {
    assert.equal(codexDesktopOpenCommand(result, false, config), undefined);
    assert.ok(codexDesktopOpenCommand({ ...result, created: true, status: "cli-failure" }, false, config));
    for (const bad of [undefined, "", "./relative.json", config + "\n", config + "\u202e", ...Array.from({ length: 7 }, (_, i) => config + String.fromCharCode(0x2018 + i))]) {
      assert.equal(codexDesktopOpenCommand(result, true, bad, "win32"), undefined);
    }
    for (const mode of ["copy", "open", "follow"] as const) {
      assert.equal(codexDesktopOpenCommand({ ...result, mode }, true, config), undefined);
    }
    for (const to of [
      { ...result.to!, agent: "x;whoami" }, { ...result.to!, session: "latest" },
      { ...result.to!, provider: "claude" as const }
    ]) assert.equal(codexDesktopOpenCommand({ ...result, to }, true, config), undefined);
  });
  test("texte fr/en : consultation distincte d'un futur envoi ; pas de commande altérée", () => {
    for (const language of ["fr", "en"] as const) {
      const rendered = renderRelayText(result, createTranslator(language), { targetLocated: true, desktopConfigPath: config });
      assert.ok(rendered.stderr.includes(codexDesktopOpenCommand(result, true, config)!));
      assert.ok(rendered.stderr.includes(process.platform === "win32" ? "(PowerShell)" : "(POSIX)"));
      assert.match(rendered.stderr, /relay --check --open/);
      assert.match(rendered.stderr, language === "fr" ? /n'autorise aucun envoi/ : /grants no permission to send/);
      assert.doesNotMatch(rendered.stderr, /explorer\.exe|xdg-open/);
      const unsafe = renderRelayText(result, createTranslator(language), { targetLocated: true, desktopConfigPath: config + "\n" });
      assert.ok(unsafe.stderr.includes(LINK));
      assert.ok(!unsafe.stderr.includes("palabre relay open"));
    }
  });
});

describe("#190 : quand le lien Desktop est donné", () => {
  const SESSION = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
  /** Résultat minimal : seuls les champs lus par `relayDesktopLink` comptent. */
  const result = (over: Partial<RelayResultV1>): RelayResultV1 => ({
    status: "replied", mode: "background", to: { agent: "codex", session: SESSION, provider: "codex" }, ...over
  }) as RelayResultV1;
  const ALL = ["replied", "target-busy", "cli-failure", "timeout", "invalid-request", "cancelled", "internal-error"] as const;
  test("reprise localisée : lien quelle que soit l'issue ensuite, annulation et refus compris", () => {
    for (const status of ALL) assert.equal(relayDesktopLink(result({ status }), true), LINK, status);
  });
  test("reprise arrêtée avant la localisation : jamais de lien, même statut que plus haut", () => {
    for (const status of [...ALL, "session-not-found", "command-not-found"] as const) {
      assert.equal(relayDesktopLink(result({ status }), false), undefined, status);
    }
  });
  test("conversation créée : lien même si le premier tour échoue", () => {
    assert.equal(relayDesktopLink(result({ status: "cancelled", created: true }), false), LINK);
  });
  test("jamais pour Claude, open ni follow, même localisée", () => {
    assert.equal(relayDesktopLink(result({ to: { agent: "claude", session: SESSION, provider: "claude" } }), true), undefined);
    assert.equal(relayDesktopLink(result({ mode: "open" }), true), undefined);
    assert.equal(relayDesktopLink(result({ mode: "follow", status: "followed" }), true), undefined);
  });
});
