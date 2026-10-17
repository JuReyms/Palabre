/** @file Mission v2.0 : cadre en lecture seule, un appel Relay par étape, état et arrêt durables. */
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeRelay, type RelayResultV1 } from "./commands/relay.js";
import { buildEnvelope, parseSessionRef, validateRelayMessage } from "./externalSessions/envelope.js";
import { relayMessages } from "./messages/relay.js";
import { parsePullRequest } from "./externalSessions/review.js";
import type { Language } from "./types.js";
import { missionMessages } from "./messages/mission.js";

/** Seules tâches du premier lot ; review conserve la politique Relay existante. */
export type MissionTask = "consult" | "review";
/** running sans résultat est une étape incertaine après une coupure : jamais rejouée. */
export type MissionStatus = "ready" | "running" | "paused" | "uncertain" | "stopped";
/** Une tentative réservée consomme une étape, y compris un refus avant envoi. */
export interface MissionStep {
  number: number;
  task: MissionTask;
  message: string;
  pr?: string;
  startedAt: string;
  finishedAt?: string;
  result?: RelayResultV1;
}
/** Cadre fixé par les réponses de l'humain au chef de mission ; aucun droit d'écriture du modèle. */
export interface Mission {
  v: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  deadline: number;
  workspace: string;
  config: string;
  language: Language;
  objective: string;
  criteria: string;
  from: string;
  to: string;
  tasks: MissionTask[];
  maxSteps: number;
  timeoutSeconds: number;
  status: MissionStatus;
  stopReason: string | null;
  steps: MissionStep[];
}
/** Bornes du cadre : secondes, tentatives et taille du stockage local. Aucun plafond monétaire. */
export const MISSION_LIMITS = { maxSteps: 100, minSeconds: 10, maxDuration: 86400, maxTimeout: 3600, maxStateBytes: 32 * 1024 * 1024 } as const;
/** Raisons stables, détaillées et traduites dans la commande. */
export type MissionErrorCode = "invalid-arguments" | "invalid-state" | "not-found" | "busy" | "stopped" | "uncertain" | "budget" | "task-not-allowed" | "storage-error";
/** Refus contrôlé : ne jamais transformer une erreur de stockage en nouveau lancement. */
export class MissionError extends Error {
  constructor(readonly code: MissionErrorCode) { super(code); }
}
/** Transport et horloge injectables ; les tests ordinaires n'appellent aucun modèle. */
export interface MissionDeps {
  relay: typeof executeRelay;
  now: () => number;
}
const defaults: MissionDeps = { relay: executeRelay, now: Date.now };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const integer = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const timestamp = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

/** Chemins uniquement sous le workspace demandé ; un id ne peut pas porter de chemin. */
export function missionPaths(workspace: string, id: string) {
  if (!ID.test(id)) throw new MissionError("invalid-arguments");
  const directory = path.resolve(workspace, ".palabre", "missions", id);
  return { directory, state: path.join(directory, "state.json"), lock: path.join(directory, "operation.lock"),
    stop: path.join(directory, "stop.json"), export: path.join(directory, `${id}.mission.md`) };
}

/** Écriture atomique du dernier état complet, jamais de JSON partiel après interruption. */
async function atomic(file: string, value: string): Promise<void> {
  if (Buffer.byteLength(value) > MISSION_LIMITS.maxStateBytes) throw new MissionError("storage-error");
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, value, { flag: "wx", mode: 0o600 });
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }).catch(() => undefined); }
}

/** Validation au chargement, notamment des champs qui deviendront des arguments Relay. */
function validMission(v: unknown): v is Mission {
  if (!object(v) || v.v !== 1 || !text(v.id) || !ID.test(v.id) || !timestamp(v.createdAt) || !timestamp(v.updatedAt)
    || !integer(v.deadline, 0, Number.MAX_SAFE_INTEGER) || !text(v.workspace) || !path.isAbsolute(v.workspace)
    || !text(v.config) || !path.isAbsolute(v.config) || !["fr", "en"].includes(String(v.language))
    || !text(v.objective) || !text(v.criteria) || !text(v.from) || !parseSessionRef(v.from).ok
    || !text(v.to) || !parseSessionRef(v.to).ok || v.from.split(":")[1] === v.to.split(":")[1]
    || !Array.isArray(v.tasks) || !v.tasks.length || v.tasks.some(t => t !== "consult" && t !== "review")
    || new Set(v.tasks).size !== v.tasks.length || !integer(v.maxSteps, 1, MISSION_LIMITS.maxSteps)
    || !integer(v.timeoutSeconds, MISSION_LIMITS.minSeconds, MISSION_LIMITS.maxTimeout)
    || !["ready", "running", "paused", "uncertain", "stopped"].includes(String(v.status))
    || !(v.stopReason === null || text(v.stopReason)) || !Array.isArray(v.steps) || v.steps.length > v.maxSteps) return false;
  return v.steps.every((s, i) => object(s) && s.number === i + 1 && v.tasks instanceof Array && v.tasks.includes(s.task)
    && typeof s.message === "string" && timestamp(s.startedAt)
    && (s.pr === undefined || typeof s.pr === "string" && !!parsePullRequest(s.pr))
    && (s.task === "review" ? !!s.pr : s.pr === undefined)
    && (s.finishedAt === undefined || timestamp(s.finishedAt))
    && (s.result === undefined || object(s.result) && s.result.v === 1 && s.result.type === "relay-result"
      && typeof s.result.status === "string" && integer(s.result.exitCode, 0, 255) && object(s.result.delivery)
      && ["replied", "not-delivered", "persisted-no-reply", "unknown"].includes(String(s.result.delivery.status))));
}

/** Lit l'arrêt indépendant, qui reste disponible si le verrou d'étape est orphelin. */
async function stopReason(file: string): Promise<string | null> {
  try {
    if ((await stat(file)).size > 8192) throw new MissionError("invalid-state");
    const v: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!object(v) || v.v !== 1 || !timestamp(v.at) || !text(v.reason)) throw new MissionError("invalid-state");
    return v.reason;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new MissionError("invalid-state");
  }
}

/** Relit une mission entre deux commandes ; l'arrêt durable prime sur un ancien état ready. */
export async function readMission(workspace: string, id: string): Promise<Mission> {
  const files = missionPaths(workspace, id);
  let v: unknown;
  try {
    if ((await stat(files.state)).size > MISSION_LIMITS.maxStateBytes) throw new MissionError("invalid-state");
    v = JSON.parse(await readFile(files.state, "utf8"));
  } catch (error) {
    if (error instanceof MissionError) throw error;
    throw new MissionError((error as NodeJS.ErrnoException).code === "ENOENT" ? "not-found" : "invalid-state");
  }
  if (!validMission(v) || v.id !== id || path.resolve(v.workspace) !== path.resolve(workspace)) throw new MissionError("invalid-state");
  const reason = await stopReason(files.stop);
  if (reason) { v.status = "stopped"; v.stopReason = reason; }
  else if ((v.status === "ready" || v.status === "paused") && v.steps.some(step => !step.finishedAt || !step.result)) {
    // Une incohérence d'état ne doit jamais masquer une tentative sans résultat.
    v.status = "running";
  }
  else if ((v.status === "ready" || v.status === "paused") && (v.steps.length >= v.maxSteps || Date.now() >= v.deadline)) {
    v.status = "paused"; v.stopReason = "budget";
  }
  return v;
}

/** État d'abord, export ensuite : un export raté ne fait jamais rejouer une étape déjà enregistrée. */
async function save(mission: Mission): Promise<void> {
  const files = missionPaths(mission.workspace, mission.id);
  await atomic(files.state, `${JSON.stringify(mission, null, 2)}\n`);
  await atomic(files.export, renderMissionMarkdown(mission));
}

/** Arguments nécessaires à la création ; la commande fixe les valeurs par défaut visibles dans l'aide. */
export interface StartMission {
  workspace: string; config: string; language: Language; objective: string; criteria: string;
  from: string; to: string; tasks: MissionTask[]; maxSteps: number; maxDurationSeconds: number; timeoutSeconds: number;
}

/** Crée le cadre sans lancer de CLI, de modèle ou de question de confirmation supplémentaire. */
export async function startMission(input: StartMission, deps: Pick<MissionDeps, "now"> = defaults): Promise<Mission> {
  const from = parseSessionRef(input.from), to = parseSessionRef(input.to);
  if (!from.ok || !to.ok || from.value.sessionId === to.value.sessionId
    || !integer(input.maxDurationSeconds, MISSION_LIMITS.minSeconds, MISSION_LIMITS.maxDuration)) throw new MissionError("invalid-arguments");
  const now = deps.now();
  const mission: Mission = { v: 1, id: randomUUID(), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    deadline: now + input.maxDurationSeconds * 1000, workspace: path.resolve(input.workspace), config: path.resolve(input.config),
    language: input.language, objective: input.objective, criteria: input.criteria,
    from: `${from.value.agent}:${from.value.sessionId}`, to: `${to.value.agent}:${to.value.sessionId}`,
    tasks: input.tasks, maxSteps: input.maxSteps, timeoutSeconds: input.timeoutSeconds, status: "ready", stopReason: null, steps: [] };
  if (!validMission(mission) || !missionEnvelopeFits(mission, "", mission.maxSteps)) throw new MissionError("invalid-arguments");
  await mkdir(missionPaths(mission.workspace, mission.id).directory, { recursive: true, mode: 0o700 });
  await save(mission);
  return mission;
}

/** Le cadre est une donnée de coordination, jamais une autorisation d'outils ou d'écriture. */
function missionMessage(mission: Mission, message: string): string {
  return `${missionMessages[mission.language].frame}\n${JSON.stringify({ objective: mission.objective, criteria: mission.criteria })}\n\n${message}`;
}

/** Même budget d'enveloppe que Relay, sans dépendre du transport ni générer de nonce d'envoi. */
function missionEnvelopeFits(mission: Mission, message: string, step: number): boolean {
  const from = parseSessionRef(mission.from), to = parseSessionRef(mission.to);
  return from.ok && to.ok && validateRelayMessage(buildEnvelope({ from: from.value, to: to.value,
    nonce: "PR-0000000000000000", message: missionMessage(mission, message), header: { kind: "mission", id: mission.id, step }
  }, relayMessages[mission.language])).ok;
}

/** Une étape explicite, aucun renvoi automatique, même après erreur ou interruption. */
export async function stepMission(workspace: string, id: string, input: { message: string; task: MissionTask; pr?: string; timeoutSeconds?: number }, deps: MissionDeps = defaults): Promise<Mission> {
  const files = missionPaths(workspace, id);
  // Lecture préalable : ne pas créer un dossier pour un identifiant inconnu.
  await readMission(workspace, id);
  let lock;
  try { lock = await open(files.lock, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new MissionError("busy");
    throw new MissionError("storage-error");
  }
  let watch: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  try {
    const mission = await readMission(workspace, id);
    if (mission.status === "stopped") throw new MissionError("stopped");
    if (mission.status === "uncertain" || mission.status === "running") throw new MissionError("uncertain");
    if (!mission.tasks.includes(input.task)) throw new MissionError("task-not-allowed");
    if ((input.task === "review" ? !input.pr || !parsePullRequest(input.pr) : input.pr !== undefined)
      || !text(input.message)) throw new MissionError("invalid-arguments");
    const message = missionMessage(mission, input.message);
    if (!missionEnvelopeFits(mission, input.message, mission.steps.length + 1)) throw new MissionError("invalid-arguments");
    const remaining = Math.floor((mission.deadline - deps.now()) / 1000);
    if (mission.steps.length >= mission.maxSteps || remaining < MISSION_LIMITS.minSeconds) throw new MissionError("budget");
    if (input.timeoutSeconds !== undefined && !integer(input.timeoutSeconds, MISSION_LIMITS.minSeconds, MISSION_LIMITS.maxTimeout)) throw new MissionError("invalid-arguments");
    const timeout = Math.min(remaining, input.timeoutSeconds ?? mission.timeoutSeconds);
    const callDeadline = Math.min(mission.deadline, deps.now() + timeout * 1000);
    const step: MissionStep = { number: mission.steps.length + 1, task: input.task, message: input.message,
      ...(input.pr ? { pr: input.pr } : {}), startedAt: new Date(deps.now()).toISOString() };
    mission.steps.push(step); mission.status = "running"; mission.stopReason = null; mission.updatedAt = step.startedAt;
    await save(mission); // Réservation durable avant le seul appel ; crash = running, sans rejeu.
    process.once("SIGINT", onInterrupt);
    // stop n'attend pas le verrou. Une lecture illisible provoque aussi l'annulation.
    watch = setInterval(() => { void stopReason(files.stop).then(reason => { if (reason) controller.abort(); }, () => controller.abort()); }, 200);
    timer = setTimeout(() => controller.abort(), Math.max(0, callDeadline - deps.now()));
    const reason = await stopReason(files.stop);
    if (reason || deps.now() >= callDeadline) controller.abort();
    try {
      if (!controller.signal.aborted) {
        const args = ["relay", "--from", mission.from, "--to", mission.to, "--config", mission.config,
          "--language", mission.language, "--timeout", String(timeout), "--no-export", message];
        if (input.task === "review") args.push("--task", "review", "--pr", input.pr!);
        step.result = await deps.relay(args, { signal: controller.signal, header: { kind: "mission", id: mission.id, step: step.number } });
      }
    } catch {
      // Un transport injecté peut lever après envoi. Ne jamais déduire une absence de délivrance.
    }
    step.finishedAt = new Date(deps.now()).toISOString();
    const stopped = await stopReason(files.stop);
    const result = step.result;
    mission.status = stopped ? "stopped"
      : !result || result.delivery.status === "unknown" || result.delivery.status === "persisted-no-reply"
        || result.task?.publication === "unknown" ? "uncertain"
        : result.status === "replied" ? "ready" : "paused";
    mission.stopReason = stopped ?? (mission.status === "ready" ? null : result?.status ?? "interrupted");
    mission.updatedAt = step.finishedAt;
    await save(mission);
    // Un stop peut arriver pendant l'écriture du résultat : le relire avant de rendre la main.
    const final = await readMission(workspace, id);
    if (final.status !== mission.status) await atomic(files.export, renderMissionMarkdown(final));
    return final;
  } finally {
    if (watch) clearInterval(watch);
    if (timer) clearTimeout(timer);
    process.removeListener("SIGINT", onInterrupt);
    await lock.close();
    await rm(files.lock, { force: true });
  }
}

/** Arrêt terminal sans verrou d'étape ; annulation au mieux, aucun retrait de message promis. */
export async function stopMission(workspace: string, id: string, reason: string, now = Date.now()): Promise<Mission> {
  await readMission(workspace, id);
  if (!text(reason) || Buffer.byteLength(reason) > 4096) throw new MissionError("invalid-arguments");
  const files = missionPaths(workspace, id);
  const record = JSON.stringify({ v: 1, at: new Date(now).toISOString(), reason });
  if (Buffer.byteLength(record) > 8192) throw new MissionError("invalid-arguments");
  try { await writeFile(files.stop, record, { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const mission = await readMission(workspace, id);
  // Ne réécrit pas state.json pendant l'étape : le marqueur terminal est l'autorité pour stop.
  await atomic(files.export, renderMissionMarkdown(mission));
  return mission;
}

/** Export local avec provenance, cadre, requêtes, réponses et résultats Relay, jamais une preuve de correction. */
export function renderMissionMarkdown(mission: Mission): string {
  const m = missionMessages[mission.language];
  const data = (value: string) => value.split(/\r?\n/).map(line => `> ${line}`).join("\n");
  const lines = [`# PALABRE — ${m.title} ${mission.id}`, "", m.localNotice, "", `- ${m.state}: ${mission.status}`,
    `- ${m.missionLead}: ${mission.from}`, `- ${m.teammate}: ${mission.to}`, `- ${m.workspace}: ${mission.workspace}`,
    `- ${m.budget}: ${mission.steps.length}/${mission.maxSteps}; ${new Date(mission.deadline).toISOString()}`,
    `- ${m.timeout}: ${mission.timeoutSeconds}s`, `- ${m.tasks}: ${mission.tasks.join(", ")}`,
    `- ${m.reason}: ${mission.stopReason ?? "—"}`, "", `## ${m.objective}`, "", data(mission.objective), "",
    `## ${m.criteria}`, "", data(mission.criteria), ""];
  for (const step of mission.steps) {
    lines.push(`## ${m.step} ${step.number} — ${step.task}`, "", `${step.startedAt} → ${step.finishedAt ?? "?"}`, "",
      data(step.message), "", `${m.result}: ${step.result?.status ?? "unknown"}; ${m.delivery}: ${step.result?.delivery.status ?? "unknown"}`, "");
    if (step.pr) lines.push(`PR: ${step.pr}`, "");
    if (step.result?.reply) lines.push(data(step.result.reply), "");
    if (step.result?.error) lines.push(data(step.result.error.message), "");
    if (step.result?.remedy) lines.push(data(step.result.remedy), "");
    if (step.result?.task) lines.push(`GitHub: ${step.result.task.publication} ${step.result.task.reviewUrl ?? ""}`, "");
  }
  return `${lines.join("\n")}\n`;
}
