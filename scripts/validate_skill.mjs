import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const skillDir = path.join(root, "skills", "palabre");
const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/cli.md",
  "references/outputs.md"
];

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
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    fail("SKILL.md must start with YAML frontmatter");
  } else {
    const fields = frontmatter[1].trim().split(/\r?\n/).filter(Boolean);
    if (fields.length !== 2 || !fields[0].startsWith("name:") || !fields[1].startsWith("description:")) {
      fail("SKILL.md frontmatter must contain only name and description");
    }
  }

  for (const reference of ["references/cli.md", "references/outputs.md"]) {
    if (!skill.includes(`\`${reference}\``)) fail(`SKILL.md must link to ${reference}`);
  }
}

const combined = [...files.values()].join("\n");
if (/\bgemini\b/i.test(combined)) fail("the retired Gemini agent is still referenced");
for (const requiredTerm of ["`ask`", "--dry-run", "--terminal", "outputDir"]) {
  if (!combined.includes(requiredTerm)) fail(`missing current CLI concept: ${requiredTerm}`);
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