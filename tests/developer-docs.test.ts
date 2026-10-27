/** @file Garde le point d’entrée développeur borné et ses références locales accessibles, sans écriture ni réseau. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/** Retire les blocs de code : leurs exemples ne sont pas des routes de documentation. */
function prose(markdown: string): string {
  let fence: { marker: string; length: number } | undefined;
  return markdown.split(/\r?\n/).filter(line => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (match && match[1]![0] === fence.marker && match[1]!.length >= fence.length && !match[2]!.trim()) fence = undefined;
      return false;
    }
    if (match) { fence = { marker: match[1]![0]!, length: match[1]!.length }; return false; }
    return true;
  }).join("\n");
}

/** Ancres usuelles GitHub : accents conservés et doublons numérotés. */
function anchors(markdown: string): Set<string> {
  const used = new Set<string>();
  for (const match of prose(markdown).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1]!.replace(/`/g, "").toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, "").trim().replace(/\s/g, "-");
    let anchor = base;
    let suffix = 0;
    while (used.has(anchor)) anchor = `${base}-${++suffix}`;
    used.add(anchor);
  }
  return used;
}

test("AGENTS : point d’entrée court et références par domaine, sans retour au contrat monolithique", () => {
  const body = readFileSync("AGENTS.md", "utf8").replace(/\r\n/g, "\n");
  assert.ok(body.trimEnd().split("\n").length <= 200, "déplacer les détails dans docs/dev plutôt qu’ajouter des lignes au point d’entrée");
  assert.ok(body.length <= 18_000, "le budget doit aussi compter les paragraphes longs");
  assert.ok(body.split(/\n\s*\n|\n(?=- |\|)/).every(p => p.length <= 1_500), "éviter de cacher un contrat entier dans un paragraphe ou un élément de liste");
  const index = readFileSync("docs/dev/README.md", "utf8");
  for (const file of readdirSync("docs/dev").filter(name => name.endsWith(".md") && name !== "README.md")) {
    assert.ok(body.includes(`docs/dev/${file}`), `route obligatoire depuis AGENTS : ${file}`);
    assert.ok(index.includes(`](${file})`), `référence présente dans l’index : ${file}`);
  }
  assert.match(readFileSync("CLAUDE.md", "utf8"), /@AGENTS\.md/, "Claude garde le même point d’entrée");
});

test("documentation développeur et README : liens locaux et ancres résolus sans réseau", () => {
  const files = ["AGENTS.md", "README.md", "docs/product-vision.md", "docs/archive/development-qualifications.md", "docs/relay-claude-open-research.md",
    "scripts/prototypes/relay/CONTRAT-A0.md", "scripts/prototypes/relay/CONTRAT-B1.md", "scripts/prototypes/relay/RAPPORT.md", "scripts/prototypes/relay/CLAUDE-MESSENGER.md",
    ...readdirSync("docs/dev").filter(name => name.endsWith(".md")).map(name => `docs/dev/${name}`)];
  for (const file of files) {
    const body = prose(readFileSync(file, "utf8"));
    for (const link of body.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      const target = link[1]!;
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("/")) continue;
      const [relative, fragment] = target.split("#");
      const destination = relative ? path.resolve(path.dirname(file), decodeURIComponent(relative)) : path.resolve(file);
      assert.ok(existsSync(destination), `${file} : lien manquant ${target}`);
      if (fragment && statSync(destination).isFile() && destination.endsWith(".md")) {
        assert.ok(anchors(readFileSync(destination, "utf8")).has(decodeURIComponent(fragment)), `${file} : ancre manquante ${target}`);
      }
    }
  }
});
