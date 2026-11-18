/** @file Qualification Windows de l'argument transmis au processus par l'adapter PTY. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliPtyAdapter } from "../dist/adapters/cli-pty.js";
import { formatAgentPrompt } from "../dist/prompt.js";

assert.equal(process.platform, "win32", "Cette qualification nécessite Windows et ConPTY.");
assert.equal(process.argv.length, 2, "Usage : node scripts/qualify_pty_native.mjs");

const repo = fileURLToPath(new URL("..", import.meta.url));
const outputDir = path.join(repo, ".tmp");
await mkdir(outputDir, { recursive: true });
const dir = await mkdtemp(path.join(outputDir, "qualify-pty-"));
const witness = path.join(dir, "witness.cjs");
const evidence = path.join(dir, "argv.json");
await writeFile(witness, [
  'const { writeFileSync } = require("node:fs");',
  'writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)), { flag: "wx" });',
  'console.log("PTY_OK");',
].join("\n"), { flag: "wx" });

const prompt = {
  topic: 'Café "bleu clair" & note \\"citée\\"',
  turn: 1, totalTurns: 1, selfName: "local", peerName: "peer", selfRole: "reviewer",
  session: { startedAt: "2026-11-18T00:00:00Z", localDate: "2026-11-18", timeZone: "Europe/Paris", cwd: dir },
  files: [], transcript: [], language: "fr",
};
// Le prompt a un pied fixe. Cet argument séparé vérifie l'antislash final après des espaces.
const trailingBackslash = "témoin avec espaces\\";
const adapter = new CliPtyAdapter("local", {
  type: "cli-pty", command: process.execPath, args: [witness, evidence, trailingBackslash],
  promptMode: "argument", role: "reviewer", timeoutMs: 8_000,
});
const cwd = process.cwd();
try {
  process.chdir(dir);
  const reply = await adapter.generate(prompt);
  const received = JSON.parse(await readFile(evidence, "utf8"));
  const expected = formatAgentPrompt(prompt);
  assert.deepEqual(received, [trailingBackslash, expected]);
  assert.match(reply.content, /PTY_OK/);
  console.log(JSON.stringify({
    node: process.version,
    nodePty: JSON.parse(await readFile(path.join(repo, "node_modules", "node-pty", "package.json"), "utf8")).version,
    arguments: received.length,
    promptArguments: 1,
    trailingBackslashPreserved: true,
    exactMatch: true,
    bytes: Buffer.byteLength(expected),
    evidence: path.relative(repo, evidence),
  }));
} finally {
  process.chdir(cwd);
}
