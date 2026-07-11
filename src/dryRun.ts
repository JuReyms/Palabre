/** @file Rendu sans effet de bord d’une session Palabre résolue. */
import path from "node:path";
import type { PalabreConfig, DebateOptions } from "./types.js";
import type { Messages } from "./messages/index.js";

/** Données stables qu’un dry-run expose aux humains et intégrations. */
export interface DryRunPreview {
  v: 1;
  type: "dry-run";
  configPath: string;
  configTrusted: boolean;
  mode: DebateOptions["mode"];
  agents: Array<{ name: string; role: string; type: string }>;
  summary: { enabled: boolean; agent: string };
  context: { files: string[]; warnings: string[] };
  limits: { turns: number; requestedResponses: number };
  outputDir: string;
}

/** Construit un aperçu sans instancier d’adapter ni écrire d’artefact. */
export function buildDryRunPreview(config: PalabreConfig, configPath: string, configTrusted: boolean, options: DebateOptions, warnings: string[], outputDir: string): DryRunPreview {
  const names = options.mode === "ask" ? options.askAgents ?? [options.agentA, options.agentB] : [options.agentA, options.agentB];
  return {
    v: 1,
    type: "dry-run",
    configPath: path.resolve(configPath),
    configTrusted,
    mode: options.mode,
    agents: names.map((name) => ({ name, role: config.agents[name]?.role ?? "unknown", type: config.agents[name]?.type ?? "unknown" })),
    summary: { enabled: options.summaryEnabled, agent: options.summaryAgent },
    context: { files: options.files.map((file) => file.path), warnings },
    limits: { turns: options.turns, requestedResponses: options.mode === "ask" ? names.length : options.turns },
    outputDir: path.resolve(outputDir)
  };
}

/** Écrit l’aperçu dans un format humain ou NDJSON v1, sans lancer de session. */
export function printDryRun(preview: DryRunPreview, ndjson: boolean, messages: Messages): void {
  if (ndjson) {
    process.stdout.write(`${JSON.stringify(preview)}\n`);
    return;
  }
  const agents = preview.agents.map((agent) => `${agent.name} (${agent.role}, ${agent.type})`).join(", ");
  const context = preview.context.files.length > 0 ? preview.context.files.join(", ") : messages.renderers.noInjectedFiles;
  process.stdout.write(messages.preview.dryRun({
    configPath: preview.configPath,
    configTrusted: preview.configTrusted,
    mode: preview.mode,
    agents,
    summary: preview.summary.enabled ? preview.summary.agent : messages.preview.disabled,
    responses: preview.limits.requestedResponses,
    context,
    warnings: preview.context.warnings.length,
    outputDir: preview.outputDir
  }).join("\n") + "\n");
}