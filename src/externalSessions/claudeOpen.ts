/**
 * @file Relay B2.2 (`palabre relay --open` vers Claude Code) : préconditions et formats du
 * messager, en fonctions pures ou à lecture bornée (voir `scripts/prototypes/relay/CONTRAT-B2.md`).
 *
 * - version du messager (`claude --version`), registre (`claude agents --json`) et dossier des
 *   transcripts (`claude auth status`), lus sans appel de modèle ;
 * - auto-ciblage, lu dans l'environnement de l'appelant avant son nettoyage ;
 * - localisation bornée du transcript par UUID ;
 * - arguments, réglages et configuration MCP du messager `claude -p`, dont le garde
 *   (`claudeGuard.ts`) est l'hôte de permissions ;
 * - lecture du flux `stream-json` du messager : garde chargé, résultat de l'outil, modèle.
 *
 * Formats relevés avec Claude Code 2.1.292 et 2.1.293 sous Windows ; ce ne sont pas des schémas
 * publics. Toute forme non reconnue est traitée prudemment (refus avant envoi, ou `unknown`).
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isSessionId } from "./envelope.js";
import { readOpenFirstLine, type OpenFile } from "./openRollout.js";

/** Version minimale du messager dans le pilote : celle relevée, au-dessus des minimums documentés. */
export const CLAUDE_OPEN_MIN_VERSION = [2, 1, 292] as const;
/** Modèle du messager : fixe, distinct du modèle de la cible, sans modèle de repli. */
export const MESSENGER_MODEL = "haiku";
/** Nom du serveur MCP du garde et outil de permission correspondant. */
export const GUARD_SERVER_NAME = "palabre_guard";
export const GUARD_TOOL_NAME = "decide";
export const GUARD_PERMISSION_TOOL = `mcp__${GUARD_SERVER_NAME}__${GUARD_TOOL_NAME}`;
/** Texte de remplacement donné au modèle ; le garde lui substitue l'enveloppe exacte. */
export const MESSENGER_PLACEHOLDER = "PALABRE-RELAY-PLACEHOLDER";
/** Bornes des commandes préalables (version, registre, dossier) et du messager. */
export const CLAUDE_OPEN_LIMITS = { probeTimeoutMs: 10_000, probeOutputBytes: 1024 * 1024, messengerTimeoutMs: 120_000, messengerOutputBytes: 1024 * 1024 } as const;
/** Plafond de dépense du messager, en dollars (estimation côté client). */
export const MESSENGER_MAX_BUDGET_USD = "0.25";

const QUEUE_TAGS = ["<cross-session-message", "</cross-session-message>"];

/** Version `X.Y.Z (Claude Code)`, seule forme acceptée ; `undefined` si la sortie diffère. */
export function parseClaudeVersion(stdout: string): [number, number, number] | undefined {
  const match = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6}) \(Claude Code\)\r?\n?$/.exec(stdout);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** Vrai si la version atteint le seuil du pilote. */
export function isSupportedClaudeVersion(version: readonly number[]): boolean {
  for (let index = 0; index < 3; index += 1) {
    if (version[index]! !== CLAUDE_OPEN_MIN_VERSION[index]) return version[index]! > CLAUDE_OPEN_MIN_VERSION[index]!;
  }
  return true;
}

/** Entrée du registre des sessions vivantes, champs utiles seulement. */
export interface ClaudeRegistryEntry {
  sessionId: string;
  pid: number;
  name?: string;
}

/**
 * Registre `claude agents --json` : un tableau d'objets portant chacun un `sessionId` UUID et un
 * `pid` entier positif. Une seule entrée non conforme rend tout le registre invérifiable : elle
 * pourrait désigner la cible.
 */
export function parseClaudeRegistry(stdout: string): ClaudeRegistryEntry[] | undefined {
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { return undefined; }
  if (!Array.isArray(value)) return undefined;
  const entries: ClaudeRegistryEntry[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined;
    const record = item as Record<string, unknown>;
    if (typeof record.sessionId !== "string" || !isSessionId(record.sessionId)) return undefined;
    if (typeof record.pid !== "number" || !Number.isSafeInteger(record.pid) || record.pid <= 0) return undefined;
    entries.push({ sessionId: record.sessionId.toLowerCase(), pid: record.pid, ...(typeof record.name === "string" ? { name: record.name } : {}) });
  }
  return entries;
}

/** Nom adressable sans `[ref]` : une ligne, sans crochets, borné comme le champ `to` de l'outil. */
const PEER_NAME = /^[^\r\n[\]]{1,200}$/;

/** Cible résolue dans le registre, ou refus avant envoi. */
export type RegistryResolution =
  | { status: "found"; name: string; pid: number }
  | { status: "target-not-open" }
  | { status: "target-state-unknown"; diagnostic: string };

/**
 * Résout la cible : exactement une entrée pour l'UUID, un nom adressable, et aucune autre session
 * vivante sous ce nom (l'envoi par `[ref]` n'est pas proposé dans le pilote).
 */
export function resolveRegistryTarget(entries: readonly ClaudeRegistryEntry[], sessionId: string): RegistryResolution {
  const target = sessionId.toLowerCase();
  const matches = entries.filter((entry) => entry.sessionId === target);
  if (matches.length === 0) return { status: "target-not-open" };
  if (matches.length > 1) return { status: "target-state-unknown", diagnostic: "registry-duplicate-session" };
  const { name, pid } = matches[0]!;
  if (name === undefined || !PEER_NAME.test(name) || name.trim() !== name) return { status: "target-state-unknown", diagnostic: "registry-unaddressable-name" };
  if (entries.some((entry) => entry.sessionId !== target && entry.name === name)) return { status: "target-state-unknown", diagnostic: "registry-homonym" };
  return { status: "found", name, pid };
}

/** Même cible qu'à la résolution : même UUID, même nom, même `pid`. */
export function isSameRegistryTarget(entries: readonly ClaudeRegistryEntry[] | undefined, expected: { sessionId: string; name: string; pid: number }): boolean {
  if (!entries) return false;
  const resolved = resolveRegistryTarget(entries, expected.sessionId);
  return resolved.status === "found" && resolved.name === expected.name && resolved.pid === expected.pid;
}

/**
 * Auto-ciblage, d'après l'environnement de l'appelant **avant** nettoyage. `self` : l'appelant est
 * la cible ; `unprovable` : il tourne dans Claude Code sans exposer de quoi conclure (refus prudent).
 */
export function detectSelfTarget(env: NodeJS.ProcessEnv, target: { sessionId: string; pid: number }): "self" | "unprovable" | "distinct" {
  const session = env.CLAUDE_CODE_SESSION_ID?.trim().toLowerCase();
  const pid = env.CLAUDE_PID?.trim();
  if (session && session === target.sessionId.toLowerCase()) return "self";
  if (pid && /^\d+$/.test(pid) && Number(pid) === target.pid) return "self";
  if (env.CLAUDECODE && !session && !pid) return "unprovable";
  return "distinct";
}

/** Dossier des transcripts d'après `claude auth status` (`projectsDirectory`, sinon `configDirectory/projects`). */
export function parseProjectsDirectory(stdout: string): string | undefined {
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { return undefined; }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.projectsDirectory === "string" && path.isAbsolute(record.projectsDirectory)) return record.projectsDirectory;
  if (typeof record.configDirectory === "string" && path.isAbsolute(record.configDirectory)) return path.join(record.configDirectory, "projects");
  return undefined;
}

/** Vrai seulement si `claude auth status` déclare explicitement l'absence de connexion. */
export function isLoggedOut(stdout: string): boolean {
  try {
    const value: unknown = JSON.parse(stdout);
    return value !== null && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).loggedIn === false;
  } catch {
    return false;
  }
}

/** Vrai si l'enveloppe contient la balise de file : la forme de file ne serait plus univoque. */
export function hasQueueTag(envelope: string): boolean {
  return QUEUE_TAGS.some((tag) => envelope.includes(tag));
}

/** Transcript localisé, ou refus avant envoi. */
export type ClaudeTranscriptLocation =
  | { status: "found"; transcriptPath: string }
  | { status: "session-not-found"; detail: string };

/**
 * Localisation bornée : `projects/*\/<uuid>.jsonl`, un seul fichier, première ligne (1 Mio au plus)
 * portant le `sessionId` de la cible. Le transcript n'est jamais chargé en entier.
 */
export async function locateClaudeTranscript(projectsDir: string, sessionId: string, openFile?: OpenFile): Promise<ClaudeTranscriptLocation> {
  if (!isSessionId(sessionId)) return { status: "session-not-found", detail: "identifiant invalide" };
  let folders: string[];
  try { folders = readdirSync(projectsDir); } catch { return { status: "session-not-found", detail: "dossier des transcripts illisible" }; }
  const found = folders.map((folder) => path.join(projectsDir, folder, `${sessionId}.jsonl`)).filter((file) => {
    try { return statSync(file).isFile(); } catch { return false; }
  });
  if (found.length === 0) return { status: "session-not-found", detail: "aucun transcript pour cette session" };
  if (found.length > 1) return { status: "session-not-found", detail: `${found.length} transcripts pour cette session : cible ambiguë` };
  try {
    const first = JSON.parse(await readOpenFirstLine(found[0]!, openFile)) as unknown;
    const record = first !== null && typeof first === "object" && !Array.isArray(first) ? first as Record<string, unknown> : undefined;
    if (record?.sessionId !== sessionId) return { status: "session-not-found", detail: "transcript incohérent : première ligne d'une autre session" };
  } catch {
    return { status: "session-not-found", detail: "première ligne du transcript absente, trop grande ou illisible" };
  }
  return { status: "found", transcriptPath: found[0]! };
}

/** Fichiers du messager, tous dans le dossier temporaire privé de la tentative. */
export interface MessengerFiles {
  settingsPath: string;
  mcpConfigPath: string;
}

/**
 * Réglages propres à l'appel : `SendMessage` passe toujours par l'hôte de permissions (règle `ask`,
 * évaluée avant les autorisations), le messager refuse tout message entrant, et les hooks sont
 * désactivés quand la politique le permet.
 */
export function messengerSettings(): Record<string, unknown> {
  return { permissions: { ask: ["SendMessage"] }, crossSessionInbound: "refuse", disableAllHooks: true };
}

/** Configuration MCP : le garde seul, lancé par l'interpréteur Node courant, sans shell. */
export function guardMcpConfig(input: { nodePath: string; guardScript: string; stateDir: string }): Record<string, unknown> {
  return { mcpServers: { [GUARD_SERVER_NAME]: { type: "stdio", command: input.nodePath, args: [input.guardScript, input.stateDir], env: {} } } };
}

/**
 * Arguments du messager. Le modèle est fixe et aucun modèle de repli n'est passé. Le prompt
 * (stdin) est `messengerPrompt` : l'enveloppe n'entre jamais dans le contexte du modèle.
 */
export function messengerArgs(files: MessengerFiles): string[] {
  return [
    "-p", "--restricted", "--strict-mcp-config", "--mcp-config", files.mcpConfigPath,
    "--permission-mode", "default", "--permission-prompt-tool", GUARD_PERMISSION_TOOL,
    "--tools", "SendMessage", "--settings", files.settingsPath,
    "--model", MESSENGER_MODEL, "--max-turns", "2", "--max-budget-usd", MESSENGER_MAX_BUDGET_USD,
    "--no-session-persistence", "--name", "palabre-relay",
    "--output-format", "stream-json", "--verbose"
  ];
}

/** Consigne neutre : un seul appel, au nom résolu, avec le texte de remplacement. */
export function messengerPrompt(name: string): string {
  return [
    "Tu es un messager local lancé par Palabre.",
    `Appelle une seule fois l'outil SendMessage avec to = ${JSON.stringify(name)} et message = ${JSON.stringify(MESSENGER_PLACEHOLDER)}.`,
    "N'appelle aucun autre outil, puis réponds uniquement FIN."
  ].join("\n");
}

/** Lecture du flux `stream-json` du messager : diagnostics seulement, jamais une preuve. */
export interface MessengerStream {
  /** D'après `system/init` : garde connecté, absent ou en échec, ou flux illisible. */
  guard: "loaded" | "not-loaded" | "unknown";
  /** Modèle annoncé par `system/init`, valeur courte seulement. */
  model?: string;
  /** Un résultat d'outil a été rendu pour un appel `SendMessage`. */
  toolResult: "returned" | "absent";
}

const MODEL_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/** Analyse tolérante du flux : une ligne illisible est ignorée, aucun texte n'est recopié. */
export function readMessengerStream(stdout: string): MessengerStream {
  const events: Array<Record<string, unknown>> = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) events.push(value as Record<string, unknown>);
    } catch { /* ligne tronquée : ignorée */ }
  }
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const servers = Array.isArray(init?.mcp_servers) ? init.mcp_servers as Array<Record<string, unknown>> : undefined;
  const guardEntry = servers?.find((server) => server?.name === GUARD_SERVER_NAME);
  const guard = !init || !servers ? "unknown" : guardEntry?.status === "connected" ? "loaded" : "not-loaded";
  const sendIds = new Set<string>();
  for (const event of events.filter((item) => item.type === "assistant")) {
    const content = (event.message as Record<string, unknown> | undefined)?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block?.type === "tool_use" && block.name === "SendMessage" && typeof block.id === "string") sendIds.add(block.id);
    }
  }
  const toolResult = events.some((event) => {
    const content = (event.message as Record<string, unknown> | undefined)?.content;
    return event.type === "user" && Array.isArray(content)
      && (content as Array<Record<string, unknown>>).some((block) => block?.type === "tool_result" && typeof block.tool_use_id === "string" && sendIds.has(block.tool_use_id));
  });
  const model = typeof init?.model === "string" && MODEL_TOKEN.test(init.model) ? init.model : undefined;
  return { guard, ...(model ? { model } : {}), toolResult: toolResult ? "returned" : "absent" };
}
