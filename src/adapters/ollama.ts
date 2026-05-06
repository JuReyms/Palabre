import { AdapterError } from "../errors.js";
import { formatAgentPrompt } from "../prompt.js";
import type { AdapterContract, AgentAdapter, AgentPrompt, AgentResponse, OllamaAgentConfig } from "../types.js";

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
    private readonly config: OllamaAgentConfig
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
    const baseUrl = normalizeBaseUrl(this.config.baseUrl ?? "http://localhost:11434");

    if (this.config.validateModel !== false) {
      await this.ensureModelAvailable(baseUrl);
    }

    if (this.config.unloadOtherModels !== false) {
      await this.unloadOtherRunningModels(baseUrl);
    }

    const controller = new AbortController();
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
              content:
                this.config.systemPrompt ??
                "Tu participes a un debat technique orchestre. Reste precis, utile et honnete sur tes limites."
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
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Vérifie que le modèle est disponible avant de générer.
   * Si absent et `autoPullModel` est faux, lève `model-unavailable` avec la liste des modèles détectés.
   * Si absent et `autoPullModel` est vrai, déclenche le pull puis re-vérifie.
   */
  private async ensureModelAvailable(baseUrl: string): Promise<void> {
    const available = await this.isModelAvailable(baseUrl);

    if (available) {
      return;
    }

    if (!this.config.autoPullModel) {
      const models = await this.listAvailableModels(baseUrl);
      throw new AdapterError(
        "model-unavailable",
        this.name,
        `Modele Ollama indisponible: ${this.config.model}. Modeles detectes: ${models.join(", ") || "aucun"}. ` +
        "Utilise --pull-models ou autoPullModel: true pour autoriser le telechargement.",
        { model: this.config.model, availableModels: models }
      );
    }

    process.stdout.write(`\n[ollama] Modele absent, telechargement: ${this.config.model}\n`);
    await this.pullModel(baseUrl);

    if (!(await this.isModelAvailable(baseUrl))) {
      throw new AdapterError("model-pull-failed", this.name, `Le modele Ollama ${this.config.model} reste indisponible apres telechargement.`);
    }
  }

  private async isModelAvailable(baseUrl: string): Promise<boolean> {
    const models = await this.listAvailableModels(baseUrl);
    return models.includes(this.config.model);
  }

  private async listAvailableModels(baseUrl: string): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);

    try {
      return await this.fetchAvailableModels(baseUrl, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchAvailableModels(baseUrl: string, signal: AbortSignal): Promise<string[]> {
    const response = await fetch(`${baseUrl}/api/tags`, { signal });

    if (!response.ok) {
      throw new AdapterError("http-error", this.name, `Ollama HTTP ${response.status} pendant la detection des modeles`, {
        status: response.status
      });
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return data.models
      ?.map((model) => model.name ?? model.model)
      .filter((modelName): modelName is string => Boolean(modelName)) ?? [];
  }

  private async pullModel(baseUrl: string): Promise<void> {
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
      throw new AdapterError("model-pull-failed", this.name, `Echec du telechargement Ollama ${this.config.model}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async unloadOtherRunningModels(baseUrl: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);

    try {
      await this.unloadOtherRunningModelsWithSignal(baseUrl, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async unloadOtherRunningModelsWithSignal(baseUrl: string, signal: AbortSignal): Promise<void> {
    const response = await fetch(`${baseUrl}/api/ps`, { signal });

    if (!response.ok) {
      throw new AdapterError("http-error", this.name, `Ollama HTTP ${response.status} pendant la detection des modeles charges`, {
        status: response.status
      });
    }

    const data = (await response.json()) as OllamaRunningModelsResponse;
    const runningModels = data.models
      ?.map((model) => model.name ?? model.model)
      .filter((modelName): modelName is string => Boolean(modelName))
      .filter((modelName) => modelName !== this.config.model) ?? [];

    for (const model of runningModels) {
      await unloadModel(baseUrl, model, signal);
    }
  }
}

/** Décharge un modèle Ollama en mémoire GPU/CPU via `POST /api/generate` avec `keep_alive: 0`. */
async function unloadModel(baseUrl: string, model: string, signal: AbortSignal): Promise<void> {
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
    throw new AdapterError("http-error", "ollama", `Impossible de decharger le modele Ollama ${model}: HTTP ${response.status}`, {
      status: response.status,
      model
    });
  }
}

/** Supprime le slash final de `baseUrl` pour éviter les doubles slashs dans les URLs construites. */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}
