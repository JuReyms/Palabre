/** @file Contrats GitHub d'un bilan choisi : lecture bornée, identité de cible et POST unique vérifié. */
import { createHash } from "node:crypto";
import { resolveExecutablePath } from "./exec.js";
import { runExternalProcess, type ExternalProcessSpec, type ExternalProcessResult } from "./externalSessions/process.js";
import type { RelayGitHubRef } from "./externalSessions/relayWork.js";
import { relayPublishText } from "./messages/relayPublish.js";
import type { Language } from "./types.js";

/** Cette publication exige une issue ou PR exacte, jamais un dépôt seul. */
export type PublicationTarget = RelayGitHubRef & { kind: "issue" | "pull-request"; number: number };
/** Données relues avant POST ; le titre et le corps distants ne sont pas chargés comme instructions. */
export interface PublicationSnapshot {
  repositoryId: number;
  targetId: number;
  publisherId: number;
  publisher: string;
  public: boolean;
  state: "open" | "closed";
  headSha?: string;
}
/** Appel GitHub injectable ; aucune injection exposée comme option produit. */
export type PublicationGitHubRun = (args: string[], input?: string, signal?: AbortSignal) => Promise<string>;

/** Injection interne de processus inertes ; jamais une option de la CLI ou une autorisation. */
export interface PublicationProcessDeps {
  resolve(): string | undefined;
  execute(spec: ExternalProcessSpec): Promise<ExternalProcessResult>;
}

/** Arguments sans shell, stdin fermé, plafond stdout+stderr cumulé, nettoyage borné, aucun retry. */
export async function runPublicationGitHub(args: string[], input = "", signal?: AbortSignal, deps: PublicationProcessDeps = {
  resolve: () => resolveExecutablePath(process.platform === "win32" ? "gh.exe" : "gh"), execute: runExternalProcess
}): Promise<string> {
  const executable = deps.resolve();
  if (!executable) throw new Error("github-cli-unavailable");
  const result = await deps.execute({ command: executable, args: ["api", "--hostname", "github.com", ...args],
    cwd: process.cwd(), stdin: input, timeoutMs: 60_000, maxOutputBytes: 256 * 1024, killGraceMs: 1000, signal,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_PAGER: "cat" } });
  if (!result.started || result.exitCode !== 0 || result.stopReason || result.forcedReturn) throw new Error("github-command-failed");
  return result.stdout;
}

/** Digest de contenu local, sans nonce ou identifiant de conversation. */
export function publicationHash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** Valide existence, type, destination, compte, visibilité et tête de PR sans suivre une redirection de dépôt. */
export async function readPublicationSnapshot(target: PublicationTarget, run: PublicationGitHubRun, signal?: AbortSignal): Promise<PublicationSnapshot> {
  const repository: unknown = JSON.parse(await run([`repos/${target.repository}`], undefined, signal));
  const account: unknown = JSON.parse(await run(["user"], undefined, signal));
  const item: unknown = JSON.parse(await run([`repos/${target.repository}/${target.kind === "issue" ? "issues" : "pulls"}/${target.number}`], undefined, signal));
  if (!record(repository) || typeof repository.full_name !== "string" || repository.full_name.toLowerCase() !== target.repository.toLowerCase()
    || !identifier(repository.id) || typeof repository.private !== "boolean"
    || repository.visibility !== (repository.private ? "private" : "public")
    || repository.archived !== false || !record(account) || !identifier(account.id) || typeof account.login !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9-]{0,99}(?:\[bot\])?$/.test(account.login)
    || !record(item) || !identifier(item.id) || item.html_url !== target.url || item.number !== target.number || item.locked !== false
    || (item.state !== "open" && item.state !== "closed")) throw new Error("invalid-github-target");
  if (target.kind === "issue") {
    if (item.pull_request !== undefined || item.repository_url !== `https://api.github.com/repos/${target.repository}`) throw new Error("invalid-github-issue");
  } else if (!record(item.base) || !record(item.base.repo) || typeof item.base.repo.full_name !== "string"
    || item.base.repo.full_name.toLowerCase() !== target.repository.toLowerCase() || !record(item.head)
    || typeof item.head.sha !== "string" || !/^[0-9a-f]{40}$/.test(item.head.sha)) throw new Error("invalid-github-pr");
  return { repositoryId: repository.id, targetId: item.id, publisherId: account.id, publisher: account.login, public: !repository.private, state: item.state,
    ...(target.kind === "pull-request" ? { headSha: (item.head as Record<string, string>).sha } : {}) };
}

/** Rendu exact de l'attribution déclarative ; ne prétend ni authentifier l'agent ni certifier ses résultats. */
export function publicationBody(input: { body: string; agent: string; participant: string; commit?: string; language: Language }): string {
  const text = relayPublishText(input.language);
  const inline = (value: string) => value.replace(/[\\`*_\[\]<>]/g, "\\$&");
  return [`**${text.title} · ${inline(input.participant)} (${inline(input.agent)}) · Palabre**`, text.attribution,
    ...(input.commit ? [`${text.commit} : \`${input.commit}\``] : []), "", input.body].join("\n");
}

/** URL de commentaire de conversation liée exactement à la cible ; jamais un commentaire inline/review. */
export function validPublicationUrl(value: unknown, target: PublicationTarget): value is string {
  return typeof value === "string" && value.startsWith(`${target.url}#issuecomment-`)
    && /^[1-9]\d*$/.test(value.slice(`${target.url}#issuecomment-`.length));
}

/** Une réponse API incohérente laisse la publication inconnue ; aucun nouvel envoi pour obtenir un accusé. */
export function verifiedPublication(raw: string, target: PublicationTarget, body: string, publisher: string, publisherId: number): string | undefined {
  const value: unknown = JSON.parse(raw);
  return record(value) && Number.isSafeInteger(value.id) && Number(value.id) > 0
    && value.html_url === `${target.url}#issuecomment-${value.id}` && value.body === body
    && value.issue_url === `https://api.github.com/repos/${target.repository}/issues/${target.number}`
    && record(value.user) && value.user.login === publisher && value.user.id === publisherId ? value.html_url as string : undefined;
}
