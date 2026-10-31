/** @file `relay recent` : lecture seule des exports du projet, refus d'options avant config, jamais de sélection ou d'envoi. */
import { stat } from "node:fs/promises";
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { loadConfig, resolveOutputDir, DEFAULT_CONFIG_PATH, LEGACY_CONFIG_PATH, GLOBAL_CONFIG_PATH, GLOBAL_LEGACY_CONFIG_PATH } from "../config.js";
import { getConfigIdentity, isConfigTrusted } from "../configTrust.js";
import { resolveLanguage } from "../i18n.js";
import { relayRecentText } from "../messages/relayRecent.js";
import { listRecentRelays, type RecentRelayInventory } from "../relayRecent.js";
import type { Language } from "../types.js";

/** Contrat JSON autonome : aucune réponse, permission, ouverture ni cible implicitement sélectionnée. */
export interface RelayRecentResult extends RecentRelayInventory {
  v: 1;
  type: "relay-recent-result";
  status: "listed" | "invalid-request" | "read-failed";
  exitCode: number;
  error: { reason: "invalid-arguments" | "config-unavailable" | "config-untrusted" | "directory-unreadable"; message: string } | null;
}

/** Parseur strict de cette sous-commande, indépendant des options d'envoi. */
function recentFlags(args: string[]): { limit: number; language?: string; config?: string } | undefined {
  if (args[0] !== "relay" || args[1] !== "recent") return undefined;
  const flags = new Map<string, string>();
  for (let i = 2; i < args.length; i++) {
    const flag = args[i] === "--lang" ? "--language" : args[i]!;
    if (!["--limit", "--language", "--config", "--json"].includes(flag) || flags.has(flag)) return undefined;
    if (flag === "--json") { flags.set(flag, "true"); continue; }
    const value = args[++i];
    if (!value || value.startsWith("-")) return undefined;
    flags.set(flag, value);
  }
  const raw = flags.get("--limit") ?? "10", limit = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return undefined;
  return { limit, language: flags.get("--language"), config: flags.get("--config") };
}

/** Même précédence que la CLI ; un chemin inaccessible ou non fichier ne déclenche jamais de repli. */
async function recentConfigPath(explicit?: string): Promise<string | undefined> {
  for (const candidate of explicit ? [explicit] : [DEFAULT_CONFIG_PATH, LEGACY_CONFIG_PATH, GLOBAL_CONFIG_PATH, GLOBAL_LEGACY_CONFIG_PATH]) {
    try { if (!(await stat(candidate)).isFile()) throw new Error("invalid-config"); return candidate; }
    catch (error) { if (explicit || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return undefined;
}

/** Suggestion de confiance réservée au propriétaire, jamais exécutée ; quoting PowerShell/POSIX sans interpolation. */
export function relayRecentApprovalCommand(configPath: string, platform: NodeJS.Platform = process.platform): string | undefined {
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(configPath)
    || (platform === "win32" && /[\u2018-\u201b\u201c-\u201e]/u.test(configPath))) return undefined;
  const absolute = platform === "win32" ? path.win32.resolve(configPath) : path.posix.resolve(configPath);
  const quoted = absolute.replaceAll("'", platform === "win32" ? "''" : "'\\''");
  return `palabre config --config '${quoted}' --trust-config`;
}

/**
 * Résout la config sans l'approuver ni écrire, puis inventorie son outputDir relatif au cwd.
 * Une config explicitement absente/inaccessible n'est jamais remplacée par le défaut. Sans
 * config découverte, `.palabre/` suffit. Les erreurs ne diffusent aucun chemin absolu en JSON.
 */
export async function executeRelayRecent(args: string[], initialLanguage: Language = "fr"): Promise<{ result: RelayRecentResult; language: Language; approvalCommand?: string }> {
  let language = initialLanguage;
  let approvalCommand: string | undefined;
  const result: RelayRecentResult = { v: 1, type: "relay-recent-result", status: "listed", exitCode: 0,
    entries: [], warnings: [], truncated: false, scanTruncated: false, error: null };
  const fail = (reason: NonNullable<RelayRecentResult["error"]>["reason"], message: string, exitCode = 8) => {
    result.status = exitCode === 2 ? "read-failed" : "invalid-request"; result.exitCode = exitCode;
    result.error = { reason, message }; return { result, language, ...(reason === "config-untrusted" && approvalCommand ? { approvalCommand } : {}) };
  };
  const flags = recentFlags(args);
  if (!flags) return fail("invalid-arguments", relayRecentText(language).invalid);
  try { language = resolveLanguage({ explicitLanguage: flags.language }); }
  catch { return fail("invalid-arguments", relayRecentText(language).invalid); }
  let outputDir: string;
  try {
    const configPath = await recentConfigPath(flags.config);
    if (configPath !== undefined) {
      approvalCommand = relayRecentApprovalCommand(configPath);
      if (!(await isConfigTrusted(configPath))) return fail("config-untrusted", relayRecentText(language).untrusted);
      const before = await getConfigIdentity(configPath);
      const config = await loadConfig(configPath);
      const after = await getConfigIdentity(configPath);
      if (before.path !== after.path || before.sha256 !== after.sha256 || !(await isConfigTrusted(configPath))) return fail("config-untrusted", relayRecentText(language).untrusted);
      if (!config || typeof config !== "object" || Array.isArray(config) || (config.outputDir !== undefined && typeof config.outputDir !== "string")) throw new Error("invalid-config");
      language = resolveLanguage({ explicitLanguage: flags.language, configLanguage: config.language });
      outputDir = resolveOutputDir(config.outputDir);
    } else outputDir = resolveOutputDir(undefined);
  } catch { return fail("config-unavailable", relayRecentText(language).config); }
  try { Object.assign(result, await listRecentRelays(outputDir, flags.limit)); }
  catch { return fail("directory-unreadable", relayRecentText(language).directory, 2); }
  return { result, language };
}

/** Sortie humaine assainie ; aucune commande de reprise/ouverture n'est générée à partir d'un export. */
export function renderRelayRecent(result: RelayRecentResult, language: Language, approvalCommand?: string): string {
  const text = relayRecentText(language), lines = [text.title, "", text.notice];
  if (result.error) lines.push("", result.error.message);
  if (result.error?.reason === "config-untrusted" && approvalCommand) lines.push(text.approvalOwner, `${process.platform === "win32" ? "PowerShell" : "POSIX"}: ${approvalCommand}`);
  if (!result.error && !result.entries.length) lines.push("", text.empty);
  for (const entry of result.entries) {
    const date = new Date(entry.date).toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { timeZoneName: "short" });
    lines.push("", `${date} | ${entry.provider} (${entry.agent}) | ${entry.mode ?? text.unknownMode} | ${entry.status} / ${entry.delivery}`,
      entry.subject ?? text.noSubject, entry.fileName);
    if (entry.work?.github) lines.push(entry.work.github.url);
    if (entry.work?.participant) lines.push(entry.work.participant);
    if (entry.copy) lines.push(text.copy, `source: ${entry.copy.source} | copy: ${entry.copy.session ?? text.unknownSession}`);
    else lines.push(entry.to?.session ? `${entry.agent}:${entry.to.session}` : text.unknownSession);
  }
  for (const warning of result.warnings) lines.push(`${text.warning}: ${warning.fileName} (${warning.reason})`);
  if (result.truncated) lines.push(text.truncated);
  if (result.scanTruncated) lines.push(text.scanTruncated);
  return sanitizeTerminalText(lines.join("\n"));
}

/** Dispatch CLI : un objet JSON unique, même sur erreur ; sortie texte sans séquence de contrôle. */
export async function runRelayRecentCommand(args: string[]): Promise<void> {
  let initialLanguage: Language = "fr";
  const index = args.findIndex(arg => arg === "--language" || arg === "--lang");
  try { initialLanguage = resolveLanguage({ explicitLanguage: index < 0 ? undefined : args[index + 1] }); } catch { /* Diagnostic par défaut. */ }
  const { result, language, approvalCommand } = await executeRelayRecent(args, initialLanguage);
  process.stdout.write(args.includes("--json") ? `${JSON.stringify(result)}\n` : `${renderRelayRecent(result, language, approvalCommand)}\n`);
  process.exitCode = result.exitCode;
}
