/** @file Validation et normalisation communes des noms de modèles renvoyés par Ollama. */
import { cleanTerminalOutput } from "./adapters/terminal.js";

export function ollamaModelNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !("models" in payload)) return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];

  return models
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const model = entry as { name?: unknown; model?: unknown };
      const value = typeof model.name === "string" ? model.name : model.model;
      return typeof value === "string" ? cleanTerminalOutput(value) : "";
    })
    .filter(Boolean);
}
