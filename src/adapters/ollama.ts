/** @file Adapter Ollama HTTP : validation/pull de modèle, déchargement des autres modèles chargés, appel `/api/chat`. */
import { AdapterError, cancelledError } from "../errors.js";
import { createTranslator } from "../i18n.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterErrorMessages } from "../messages/adapter-errors.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, OllamaAgentConfig } from "../types.js";
import { resolveOllamaBaseUrl } from "../ollamaUrl.js";
import type { AgentRuntimeOptions } from "./index.js";

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

interface OllamaRunningModelsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

interface OllamaPullResponse {
  status?: string;
  error?: string;
}

/**
 * Adapter pour Ollama via l'API HTTP locale (`POST /api/chat`).
 * N'accède jamais au filesystem : ne voit que le prompt et le transcript fournis par l'orchestrateur.
 * Garantit : rejection des sorties vides et des timeouts.
 */
export class OllamaAdapter implements AgentAdapter {
  readonly role;
  readonly contract: AdapterContract;

  constructor(
    readonly name: string,
    private readonly config: OllamaAgentConfig,
    private readonly runtime: AgentRuntimeOptions = {}
  ) {
    this.role = config.role;
    this.contract = {
      name,
      kind: "ollama",
      capabilities: {
        mode: "http",
        supportsModelOverride: true,
        supportsFilesystemAccess: false,
        supportsStreaming: false,
        supportsProcessExitCode: false,
        supportsStderr: false
      },
      guarantees: {
        rejectsEmptyOutput: true,
        rejectsNonZeroExit: false,
        rejectsTimeout: true,
        returnsRawOutput: false
      }
    };
  }

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    if (prompt.signal?.aborted) {
      throw cancelledError(this.name);
    }

    const translator = createTranslator(prompt.language ?? "fr");
    const errorMessages = translator.adapterErrors;
    const baseUrl = resolveOllamaBaseUrl({
      cliUrl: this.runtime.ollamaUrl,
      configUrl: this.config.baseUrl
    });

    if (this.config.validateModel !== false) {
      await this.ensureModelAvailable(baseUrl, errorMessages);
    }

    if (this.config.unloadOtherModels !== false) {
      await this.unloadOtherRunningModels(baseUrl, errorMessages);
    }

    const controller = new AbortController();
    const abortListener = () => controller.abort();
    prompt.signal?.addEventListener("abort", abortListener, { once: true });
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          ...(this.config.keepAlive !== undefined ? { keep_alive: this.config.keepAlive } : {}),
          messages: [
            {
              role: "system",
              content: this.config.systemPrompt ?? translator.prompt.ollamaSystemPrompt
            },
            {
              role: "user",
              content: formatAgentPrompt(prompt)
            }
          ],
          options: {
            temperature: this.config.temperature ?? 0.2
          }
        }),
        signal: controller.signal
      });

      const data = (await response.json()) as OllamaChatResponse;

      if (!response.ok || data.error) {
        throw new AdapterError("http-error", this.name, data.error ?? `Ollama HTTP ${response.status}`, {
          status: response.status
        });
      }

      const content = data.message?.content?.trim() ?? "";

      if (!content) {
        throw new AdapterError("empty-output", this.name, `${this.name} produced empty output.`);
      }

      return {
        content
      };
    } catch (error) {
      if (prompt.signal?.aborted) {
        throw cancelledError(this.name);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      prompt.signal?.removeEventListener("abort", abortListener);
    }
  }

  /**
   * Vérifie que le modèle est disponible avant de générer.
   * Si absent et `autoPullModel` est faux, lève `model-unavailable` avec la liste des modèles détectés.
   * Si absent et `autoPullModel` est vrai, déclenche le pull puis re-vérifie.
   */
  private async ensureModelAvailable(baseUrl: string, messages: AdapterErrorMessages): Promise<void> {
    const available = await this.isModelAvailable(baseUrl, messages);

    if (available) {
      return;
    }

    if (!this.config.autoPullModel) {
      const models = await this.listAvailableModels(baseUrl, messages);
      throw new AdapterError(
        "model-unavailable",
        this.name,
        messages.ollamaModelUnavailable(this.config.model, models),
        { model: this.config.model, availableModels: models }
      );
    }

    process.stderr.write(`\n${messages.ollamaPullProgress(this.config.model)}\n`);
    await this.pullModel(baseUrl, messages);

    if (!(await this.isModelAvailable(baseUrl, messages))) {
      throw new AdapterError("model-pull-failed", this.name, messages.ollamaModelStillUnavailable(this.config.model));
    }
  }

  private async isModelAvailable(baseUrl: string, messages: AdapterErrorMessages): Promise<boolean> {
    const models = await this.listAvailableModels(baseUrl, messages);
    return models.includes(this.config.model);
  }

  private async listAvailableModels(baseUrl: string, messages: AdapterErrorMessages): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);

    try {
      return await this.fetchAvailableModels(baseUrl, controller.signal, messages);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchAvailableModels(baseUrl: string, signal: AbortSignal, messages: AdapterErrorMessages): Promise<string[]> {
    const response = await fetch(`${baseUrl}/api/tags`, { signal });

    if (!response.ok) {
      throw new AdapterError("http-error", this.name, messages.ollamaTagsHttpError(response.status), {
        status: response.status
      });
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return data.models
      ?.map((model) => model.name ?? model.model)
      .filter((modelName): modelName is string => Boolean(modelName)) ?? [];
  }

  /** Déclenche `POST /api/pull` et attend sa fin ; timeout dédié `pullTimeoutMs` (30 min par défaut). */
  private async pullModel(baseUrl: string, messages: AdapterErrorMessages): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.pullTimeoutMs ?? 1_800_000);

    try {
      const response = await fetch(`${baseUrl}/api/pull`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          stream: false
        }),
        signal: controller.signal
      });

      const data = (await response.json()) as OllamaPullResponse;

      if (!response.ok || data.error) {
        throw new AdapterError("model-pull-failed", this.name, data.error ?? `Ollama HTTP ${response.status}`, {
          status: response.status
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AdapterError("model-pull-failed", this.name, messages.ollamaPullFailed(this.config.model, message));
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Décharge séquentiellement, via `GET /api/ps`, tout modèle chargé autre que celui de cet agent. */
  private async unloadOtherRunningModels(baseUrl: string, messages: AdapterErrorMessages): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);

    try {
      await this.unloadOtherRunningModelsWithSignal(baseUrl, controller.signal, messages);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async unloadOtherRunningModelsWithSignal(baseUrl: string, signal: AbortSignal, messages: AdapterErrorMessages): Promise<void> {
    const response = await fetch(`${baseUrl}/api/ps`, { signal });

    if (!response.ok) {
      throw new AdapterError("http-error", this.name, messages.ollamaPsHttpError(response.status), {
        status: response.status
      });
    }

    const data = (await response.json()) as OllamaRunningModelsResponse;
    const runningModels = data.models
      ?.map((model) => model.name ?? model.model)
      .filter((modelName): modelName is string => Boolean(modelName))
      .filter((modelName) => modelName !== this.config.model) ?? [];

    for (const model of runningModels) {
      await unloadModel(baseUrl, model, signal, messages);
    }
  }
}

/** Décharge un modèle Ollama en mémoire GPU/CPU via `POST /api/generate` avec `keep_alive: 0`. */
async function unloadModel(baseUrl: string, model: string, signal: AbortSignal, messages: AdapterErrorMessages): Promise<void> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      keep_alive: 0
    }),
    signal
  });

  if (!response.ok) {
    throw new AdapterError("http-error", "ollama", messages.ollamaUnloadFailed(model, response.status), {
      status: response.status,
      model
    });
  }
}
