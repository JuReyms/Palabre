/**
 * @file Tests de l'affichage du mode Relay (#190, lot A) : libellés fr/en, lien OSC 8 réservé au
 * terminal interactif, commande d'ouverture d'un lien `codex://` selon le système et cas où ce lien
 * est donné. Fonctions pures.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { desktopOpenCommand, relayDesktopLink, terminalHyperlinksEnabled, withTerminalHyperlink, type RelayResultV1 } from "../src/commands/relay.js";
import { relayMessages } from "../src/messages/relay.js";

const LINK = "codex://threads/0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";

describe("#190 : libellés du mode", () => {
  test("arrière-plan, écriture, dans l'app desktop et suivi, en fr et en en", () => {
    assert.equal(relayMessages.fr.modeLine("background", "codex", false), "Mode : arrière-plan — codex répond sans fenêtre visible ; PALABRE demande la lecture seule.");
    assert.equal(relayMessages.fr.modeLine("background", "codex", true), "Mode : arrière-plan — écriture ponctuelle dans un worktree séparé, après votre accord.");
    assert.match(relayMessages.fr.modeLine("open", "codex", false), /^Mode : dans l'app desktop — la conversation est visible ; codex y garde les permissions de cette conversation\.$/);
    assert.match(relayMessages.fr.modeLine("follow", "codex", false), /^Mode : dans l'app desktop \(suivi\) — rien n'est déposé/);
    assert.equal(relayMessages.en.modeLine("background", "claude", false), "Mode: background — claude replies with no visible window; PALABRE requests read-only access.");
    assert.match(relayMessages.en.modeLine("open", "codex", false), /^Mode: in the desktop app — the conversation is visible/);
    assert.deepEqual(Object.keys(relayMessages.fr.export.modeNames).sort(), Object.keys(relayMessages.en.export.modeNames).sort());
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
    const text = `Lien : ${LINK}\nPour l'ouvrir vous-même : explorer.exe "${LINK}"\n`;
    const linked = withTerminalHyperlink(text, LINK);
    assert.equal(linked, `Lien : \u001b]8;;${LINK}\u001b\\${LINK}\u001b]8;;\u001b\\\nPour l'ouvrir vous-même : explorer.exe "${LINK}"\n`);
    assert.equal(withTerminalHyperlink("aucun lien", LINK), "aucun lien");
  });
  test("commande selon le système, lien entre guillemets", () => {
    assert.equal(desktopOpenCommand(LINK, "win32"), `explorer.exe "${LINK}"`);
    assert.equal(desktopOpenCommand(LINK, "darwin"), `open "${LINK}"`);
    assert.equal(desktopOpenCommand(LINK, "linux"), `xdg-open "${LINK}"`);
  });
});

describe("#190 : quand le lien Desktop est donné", () => {
  const SESSION = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
  /** Résultat minimal : seuls les champs lus par `relayDesktopLink` comptent. */
  const result = (over: Partial<RelayResultV1>): RelayResultV1 => ({
    status: "replied", mode: "background", to: { agent: "codex", session: SESSION, provider: "codex" }, ...over
  }) as RelayResultV1;
  test("arrière-plan Codex, conversation reprise et localisée : lien", () => {
    for (const status of ["replied", "target-busy", "cli-failure", "timeout"] as const) {
      assert.equal(relayDesktopLink(result({ status })), LINK, status);
    }
  });
  test("conversation créée : lien même si le premier tour échoue", () => {
    assert.equal(relayDesktopLink(result({ status: "cancelled", created: true })), LINK);
  });
  test("jamais pour Claude, open, follow, ni une reprise dont la conversation n'est pas établie", () => {
    assert.equal(relayDesktopLink(result({ to: { agent: "claude", session: SESSION, provider: "claude" } })), undefined);
    assert.equal(relayDesktopLink(result({ mode: "open" })), undefined);
    assert.equal(relayDesktopLink(result({ mode: "follow", status: "followed" })), undefined);
    for (const status of ["session-not-found", "invalid-request", "command-not-found", "cancelled", "internal-error"] as const) {
      assert.equal(relayDesktopLink(result({ status })), undefined, status);
    }
  });
});
