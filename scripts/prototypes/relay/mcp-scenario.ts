/**
 * @file Scénario MCP du prototype relay (issue #96) : neutralisation des serveurs MCP pendant une
 * reprise Codex.
 *
 * Un serveur témoin inoffensif (`mcp-witness.cjs`) est déclaré dans la couche de config **projet**
 * d'un dossier jetable (`<ws>/.codex/config.toml`). Chaque cas reprend la session de test avec
 * `codex exec resume` en lecture seule et des options différentes, puis lit le journal du témoin :
 * démarrage, `tools/list` (outils exposés au modèle), `tools/call` (outil appelé).
 *
 * Les cas `user-*` chargent la vraie config utilisateur sans la modifier, et repèrent dans les
 * journaux Codex (`RUST_LOG=info`) les serveurs configurés qui démarrent. Aucun outil utilisateur
 * n'est sollicité : leur message demande seulement « OK ».
 *
 * Usage :
 *   node --experimental-strip-types scripts/prototypes/relay/mcp-scenario.ts <session-codex> [cas...]
 *
 * Trace complète dans `.tmp/relay-probe/traces/<horodatage>-codex-mcp.json`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAdapter, parseMcpServerNames, resolveCodexLauncher, type ExchangeResult } from "./adapters.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const [sessionId, ...only] = process.argv.slice(2);
const base = path.join(os.tmpdir(), "palabre-relay-probe");
const ws = path.join(base, "codex");
const witnessLog = path.join(base, "mcp-witness.log");
const witness = path.join(here, "mcp-witness.cjs").replaceAll("\\", "/");
const trust = `projects={${JSON.stringify(ws)}={trust_level="trusted"}}`;

/** Couche projet jetable : un seul serveur, le témoin. Le fichier `hooks.json` voisin reste coupé par `--disable hooks`. */
function writeProjectConfig(): void {
  mkdirSync(path.join(ws, ".codex"), { recursive: true });
  writeFileSync(path.join(ws, ".codex", "config.toml"), [
    "# Config projet jetable du prototype relay : serveur MCP témoin inoffensif.",
    "[mcp_servers.witness_project]",
    `command = ${JSON.stringify(process.execPath.replaceAll("\\", "/"))}`,
    `args = [${JSON.stringify(witness)}, "--log", ${JSON.stringify(witnessLog.replaceAll("\\", "/"))}, "--name", "project"]`,
    "",
  ].join("\n"));
}

/**
 * Noms des serveurs de la config effective (lecture seule), avec les mêmes flags que la reprise.
 * `codex mcp list` n'indique pas la source (config ou plugin) : on la déduit en relistant avec
 * `--disable plugins`, puisque `enabled=false` sur un serveur fourni par un plugin crée une entrée
 * partielle que Codex refuse au chargement (« invalid transport »).
 */
function listServerNames(extra: string[]): string[] {
  const launcher = resolveCodexLauncher();
  // La couche projet dépend du dossier courant : la liste doit être calculée dans le `cwd` de la cible.
  const out = spawnSync(launcher.command, [...launcher.prefix, "mcp", "list", "--json", ...extra], { encoding: "utf8", cwd: ws });
  if (out.status !== 0) throw new Error(`codex mcp list a échoué (exit ${out.status})`);
  // Même validation stricte que l'adapter : une liste invalide interrompt le scénario.
  return parseMcpServerNames(out.stdout);
}

interface Servers {
  /** Tous les serveurs listés avec la config utilisateur et le projet de confiance. */
  all: string[];
  /** Serveurs restants une fois les plugins désactivés : ceux déclarés dans une couche de config. */
  fromConfig: string[];
}

interface Case {
  name: string;
  description: string;
  userConfig: boolean;
  args: (servers: Servers) => string[];
  prompt: string;
}

const CALL_PROMPT = "Test MCP. Si un outil nommé witness_ping est disponible, appelle-le une fois puis réponds uniquement par son résultat. Sinon réponds uniquement : AUCUN-OUTIL.";
const OK_PROMPT = "Test MCP. N'appelle aucun outil. Réponds uniquement : OK.";

const CASES: Case[] = [
  { name: "M1", description: "projet de confiance, aucune neutralisation", userConfig: false, args: () => ["-c", trust], prompt: CALL_PROMPT },
  { name: "M2", description: "projet de confiance + -c mcp_servers={}", userConfig: false, args: () => ["-c", trust, "-c", "mcp_servers={}"], prompt: CALL_PROMPT },
  { name: "M3", description: "projet de confiance + -c mcp_servers.witness_project.enabled=false", userConfig: false, args: () => ["-c", trust, "-c", "mcp_servers.witness_project.enabled=false"], prompt: CALL_PROMPT },
  { name: "M4", description: "projet non déclaré de confiance", userConfig: false, args: () => [], prompt: CALL_PROMPT },
  {
    name: "M5", description: "projet de confiance + outils pré-approuvés (default_tools_approval_mode=\"approve\")", userConfig: false,
    args: () => ["-c", trust, "-c", 'mcp_servers.witness_project.default_tools_approval_mode="approve"'], prompt: CALL_PROMPT,
  },
  { name: "user-baseline", description: "config utilisateur + projet de confiance, aucune neutralisation", userConfig: true, args: () => ["-c", trust], prompt: OK_PROMPT },
  { name: "user-empty", description: "config utilisateur + projet de confiance + -c mcp_servers={}", userConfig: true, args: () => ["-c", trust, "-c", "mcp_servers={}"], prompt: OK_PROMPT },
  {
    name: "user-naive", description: "enabled=false pour chaque serveur listé, y compris ceux des plugins", userConfig: true,
    args: (servers) => ["-c", trust, ...servers.all.flatMap((name) => ["-c", `mcp_servers.${name}.enabled=false`])], prompt: OK_PROMPT,
  },
  {
    name: "user-neutralized", description: "--disable plugins + --disable apps + enabled=false pour chaque serveur déclaré en config", userConfig: true,
    args: (servers) => ["-c", trust, "--disable", "plugins", "--disable", "apps", ...servers.fromConfig.flatMap((name) => ["-c", `mcp_servers.${name}.enabled=false`])],
    prompt: OK_PROMPT,
  },
];

function readWitness(): Array<Record<string, any>> {
  if (!existsSync(witnessLog)) return [];
  return readFileSync(witnessLog, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

/** Serveurs dont le nom apparaît dans les journaux Codex : indice de démarrage, pas preuve d'exposition. */
function mentioned(stderr: string, names: string[]): string[] {
  return names.filter((name) => new RegExp(`\\b${name}\\b`).test(stderr));
}

async function main(): Promise<void> {
  if (!sessionId) throw new Error("usage : mcp-scenario.ts <session-codex> [cas...]");
  writeProjectConfig();
  const servers: Servers = {
    all: listServerNames(["-c", trust]),
    fromConfig: listServerNames(["-c", trust, "--disable", "plugins"]),
  };
  process.env.RUST_LOG = "info";
  const rows: unknown[] = [];

  for (const testCase of CASES.filter((item) => only.length === 0 || only.includes(item.name))) {
    if (existsSync(witnessLog)) unlinkSync(witnessLog);
    const adapter = new CodexAdapter({
      ignoreUserConfig: !testCase.userConfig,
      model: testCase.userConfig ? "gpt-5.6-sol" : undefined,
      disableHooks: true,
      disableNotify: true,
      extraArgs: testCase.args(servers),
    });
    const result: ExchangeResult = await adapter.send({ agent: "codex", sessionId, cwd: ws }, testCase.prompt, { timeoutMs: 240_000 });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const events = readWitness();
    const row = {
      case: testCase.name,
      description: testCase.description,
      exitCode: result.exitCode,
      reply: result.reply,
      identity: result.identity,
      witnessStarted: events.filter((event) => event.event === "start").length,
      witnessToolsListed: events.some((event) => event.method === "tools/list"),
      witnessToolCalled: events.some((event) => event.method === "tools/call"),
      userServersInLogs: testCase.userConfig ? mentioned(result.stderr, [...servers.all.filter((name) => name !== "witness_project"), "codex_apps"]) : undefined,
      configError: /Error loading config/.test(result.stderr) ? result.stderr.trim().split(/\r?\n/).slice(-2).join(" / ") : undefined,
    };
    console.log(JSON.stringify(row));
    rows.push({ ...row, args: testCase.args(servers), witnessEvents: events, stderr: result.stderr, stdout: result.stdout });
  }

  const traceDir = path.resolve(".tmp", "relay-probe", "traces");
  mkdirSync(traceDir, { recursive: true });
  const file = path.join(traceDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-codex-mcp.json`);
  writeFileSync(file, JSON.stringify({ sessionId, ws, userServers: servers, rows }, null, 2));
  console.log(`trace: ${file}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
