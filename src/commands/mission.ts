/** @file CLI Mission v2.0 : cadre et étapes explicites, sans boucle de modèles ni écriture déléguée. */
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { resolveDefaultConfigPath } from "../config.js";
import { resolveLanguage } from "../i18n.js";
import { helpMessages } from "../messages/help.js";
import { missionMessages } from "../messages/mission.js";
import { MissionError, MISSION_LIMITS, missionPaths, readMission, startMission, stepMission, stopMission, type Mission, type MissionTask } from "../mission.js";
import type { Language } from "../types.js";

const COMMON = ["json", "language"];
const ALLOWED: Record<string, string[]> = {
  start: [...COMMON, "from", "to", "criteria", "tasks", "max-steps", "max-duration", "timeout", "config"],
  step: [...COMMON, "task", "pr", "timeout"], status: COMMON, stop: [...COMMON, "reason"]
};
/** Parseur propre : aucune option ignorée, répétée ou susceptible d'élargir les droits. */
export function parseMissionTokens(tokens: readonly string[]) {
  const action = tokens[0] ?? "";
  const allowed = ALLOWED[action];
  if (!allowed) throw new MissionError("invalid-arguments");
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.startsWith("-")) { positionals.push(token); continue; }
    const name = token.slice(2);
    if (!token.startsWith("--") || !allowed.includes(name) || name in flags) throw new MissionError("invalid-arguments");
    if (name === "json") { flags[name] = true; continue; }
    const value = tokens[++i];
    if (value === undefined || value.startsWith("-") || !value.trim()) throw new MissionError("invalid-arguments");
    flags[name] = value;
  }
  return { action, flags, positionals };
}
/** Entiers décimaux uniquement : aucune coercition d'un argument manquant ou mal formé. */
function number(value: string | boolean | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new MissionError("invalid-arguments");
  return n;
}
/** Résultat structuré v1 : même état et export que la commande texte, sans sortie Relay parasite. */
export interface MissionCommandResult {
  v: 1; type: "mission-result"; action: string; exitCode: number;
  mission: Mission | null; exportPath: string | null; error: { kind: string; message: string } | null;
}

/** Point d'entrée ; aucune lecture de config, CLI ou modèle pour l'aide et les arguments invalides. */
export async function runMissionCommand(rawArgs: string[]): Promise<void> {
  let language: Language = "fr";
  const index = rawArgs.indexOf("--language");
  try { language = resolveLanguage({ explicitLanguage: index >= 0 ? rawArgs[index + 1] : undefined }); } catch { /* refus ci-dessous */ }
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(helpMessages[language].renderCommand("mission")); return;
  }
  let result: MissionCommandResult;
  let action = rawArgs[1] ?? "";
  try {
    const parsed = parseMissionTokens(rawArgs.slice(1));
    action = parsed.action;
    const { flags, positionals } = parsed;
    resolveLanguage({ explicitLanguage: flags.language as string | undefined });
    const workspace = process.cwd();
    let mission: Mission;
    if (action === "start") {
      if (positionals.length !== 1 || !flags.from || !flags.to || !flags.criteria) throw new MissionError("invalid-arguments");
      const tasks = String(flags.tasks ?? "consult").split(",");
      if (tasks.some(t => t !== "consult" && t !== "review")) throw new MissionError("invalid-arguments");
      mission = await startMission({ workspace, config: path.resolve(typeof flags.config === "string" ? flags.config : await resolveDefaultConfigPath()), language,
        objective: positionals[0]!, criteria: String(flags.criteria), from: String(flags.from), to: String(flags.to), tasks: tasks as MissionTask[],
        maxSteps: number(flags["max-steps"], 10, 1, MISSION_LIMITS.maxSteps),
        maxDurationSeconds: number(flags["max-duration"], 3600, MISSION_LIMITS.minSeconds, MISSION_LIMITS.maxDuration),
        timeoutSeconds: number(flags.timeout, 600, MISSION_LIMITS.minSeconds, MISSION_LIMITS.maxTimeout) });
    } else {
      if (positionals.length !== (action === "step" ? 2 : 1)) throw new MissionError("invalid-arguments");
      const id = positionals[0]!;
      const saved = await readMission(workspace, id);
      if (flags.language === undefined) language = saved.language;
      if (action === "step") {
        const task = flags.task ?? "consult";
        if (task !== "consult" && task !== "review") throw new MissionError("invalid-arguments");
        mission = await stepMission(workspace, id, { message: positionals[1]!, task, pr: flags.pr as string | undefined,
          timeoutSeconds: flags.timeout === undefined ? undefined : number(flags.timeout, 600, MISSION_LIMITS.minSeconds, MISSION_LIMITS.maxTimeout) });
      } else if (action === "stop") {
        mission = await stopMission(workspace, id, String(flags.reason ?? "owner-stop"));
      } else mission = saved;
    }
    const last = mission.steps.at(-1);
    const exitCode = action === "step" ? last?.result?.exitCode ?? 9 : 0;
    result = { v: 1, type: "mission-result", action, exitCode, mission, exportPath: missionPaths(workspace, mission.id).export, error: null };
  } catch (error) {
    const kind = error instanceof MissionError ? error.code : "storage-error";
    result = { v: 1, type: "mission-result", action, exitCode: kind === "busy" ? 3 : 8, mission: null, exportPath: null,
      error: { kind, message: missionMessages[language].errors[kind] } };
  }
  if (rawArgs.includes("--json")) console.log(JSON.stringify(result));
  else if (result.error) console.error(sanitizeTerminalText(`${missionMessages[language].failed} (${result.error.kind}). ${result.error.message}`));
  else console.log(renderMissionText(result.mission!, language));
  process.exitCode = result.exitCode;
}

/** Compte rendu court d'abord ; réponse détaillée et diagnostic disponibles dans l'export. */
export function renderMissionText(mission: Mission, language: Language): string {
  const m = missionMessages[language];
  const last = mission.steps.at(-1);
  const exhausted = mission.stopReason === "budget";
  const lines = [`${m.title} ${mission.id}. ${exhausted ? m.errors.budget : m.description[mission.status]}`,
    `${m.budget}: ${mission.steps.length}/${mission.maxSteps}; ${new Date(mission.deadline).toISOString()}.`,
    mission.status === "ready" ? m.nothing : m.decision,
    `${m.export}: ${missionPaths(mission.workspace, mission.id).export}`];
  if (!exhausted && (mission.status === "ready" || mission.status === "paused")) lines.push(`${m.next}: palabre mission step ${mission.id} "<message>"`);
  if (last?.result?.error) lines.push(last.result.error.message);
  if (last?.result?.remedy) lines.push(last.result.remedy);
  if (last?.result?.reply) lines.push("", last.result.reply);
  return sanitizeTerminalText(lines.join("\n"));
}
