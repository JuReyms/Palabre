/** @file Valide le skill livré, ses liens et son budget de lecture, sans exécuter les recettes. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const skillDir = path.join(root, "skills", "palabre");
const references = [
  "references/chat.md",
  "references/cli.md",
  "references/relay.md",
  "references/relay-desktop.md",
  "references/relay-opencode.md",
  "references/relay-frozen.md",
  "references/outputs.md"
];
const requiredFiles = ["SKILL.md", "agents/openai.yaml", ...references];
// Limites du standard agentskills.io pour la description, et budget de concision du point d'entrée :
// les détails vont dans les références, chargées à la demande.
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SKILL_LINES = 120;
const MAX_SKILL_CHARACTERS = 10_000;
const MAX_BODY_PARAGRAPH_CHARACTERS = 1_200;

const fail = (message) => {
  console.error(`Skill validation failed: ${message}`);
  process.exitCode = 1;
};

const files = new Map();
for (const file of requiredFiles) {
  try {
    files.set(file, await readFile(path.join(skillDir, file), "utf8"));
  } catch {
    fail(`missing ${path.posix.join("skills/palabre", file)}`);
  }
}

const skill = files.get("SKILL.md");
if (skill) {
  // Même délimitation que skillRuntime.ts ; le budget garde le texte original, BOM compris.
  const normalized = skill.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!frontmatter) {
    fail("SKILL.md must start with YAML frontmatter");
  } else {
    const fields = frontmatter[1].trim().split(/\r?\n/).filter(Boolean);
    if (fields.length !== 4 || !fields[0].startsWith("name:") || !fields[1].startsWith("description:") || fields[2] !== "metadata:" || !/^  revision: "[1-9]\d*"$/.test(fields[3]) || !Number.isSafeInteger(Number(fields[3].match(/"(\d+)"/)?.[1]))) {
      fail("SKILL.md frontmatter requires name, description and a positive safe metadata.revision");
    } else {
      const description = fields[1].slice("description:".length).trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) fail(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
      // La description sert à la découverte : elle doit nommer les quatre parcours.
      for (const route of ["Chat", "Débat", "Ask", "Relay"]) {
        if (!description.includes(route)) fail(`description must mention the ${route} route`);
      }
      const revision = fields[3].match(/"(\d+)"/)?.[1];
      const declarations = [...skill.matchAll(/--skill-revision (\d+)/g)];
      if (!declarations.length || !declarations.every(match => match[1] === revision)) {
        fail("SKILL.md recipes must declare metadata.revision, not a different revision");
      }
    }
  }

  if (skill.split(/\r?\n/).length > MAX_SKILL_LINES) fail(`SKILL.md exceeds ${MAX_SKILL_LINES} lines; move details to references`);
  if (skill.length > MAX_SKILL_CHARACTERS) fail(`SKILL.md exceeds ${MAX_SKILL_CHARACTERS} characters; move conditional detail to references`);
  const body = normalized.slice(frontmatter?.[0].length ?? 0);
  if (body.split(/\r?\n\s*\r?\n|\r?\n(?=- )/).some(paragraph => paragraph.length > MAX_BODY_PARAGRAPH_CHARACTERS)) {
    fail(`SKILL.md has a paragraph exceeding ${MAX_BODY_PARAGRAPH_CHARACTERS} characters`);
  }
  for (const reference of references) {
    if (!skill.includes(`\`${reference}\``)) fail(`SKILL.md must link to ${reference}`);
  }
}

// Les chemins cités doivent rester résolubles depuis le document qui les porte.
for (const [file, content] of files) {
  for (const match of content.matchAll(/`(references\/[a-z0-9/-]+\.md|(?:relay(?:-[a-z0-9-]+)?|chat|cli|outputs)\.md)`/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
    if (!files.has(target)) fail(`unresolved reference ${match[1]} in ${file}`);
  }
}

const combined = [...files.values()].join("\n");
if (/\bgemini\b/i.test(combined)) fail("the retired Gemini agent is still referenced");
for (const requiredTerm of [
  "palabre chat", "palabre ask", "palabre relay", "--renderer ndjson",
  "chat-send", "chat-consult", "chat-use", "chat-agents", "chat-end",
  "--dry-run", "--terminal", "--checkpoint", "persisted-no-reply", "outputDir"
]) {
  if (!combined.includes(requiredTerm)) fail(`missing current CLI concept: ${requiredTerm}`);
}
// `palabre -s`, `palabre run` et les presets suivent `defaults.mode` de l'utilisateur (Débat, Ask
// ou Chat) : un exemple doit fixer son parcours avec `--mode`.
for (const example of combined.matchAll(/palabre (?:run|-s|[a-z]+-[a-z]+) [^`\n]+/g)) {
  if (!example[0].includes("--mode")) fail(`example must set --mode explicitly: ${example[0].trim()}`);
}

const metadata = files.get("agents/openai.yaml");
if (metadata && (!/display_name: "Palabre"/.test(metadata) || !/short_description: ".{25,64}"/.test(metadata) || !/default_prompt: "Use \$palabre /.test(metadata))) {
  fail("agents/openai.yaml must expose valid Palabre UI metadata");
}

try {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  if (!pkg.files?.includes("skills/")) fail("package.json must publish skills/");
} catch {
  fail("package.json is not valid JSON");
}

if (process.exitCode) process.exit(process.exitCode);
console.log("Palabre skill validation passed.");
