import { formatAgentPrompt } from "../prompt.js";
import type { AgentAdapter, AgentPrompt, AgentResponse, OllamaAgentConfig } from "../types.js";

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

export class OllamaAdapter implements AgentAdapter {
  readonly role;

  constructor(
    readonly name: string,
    private readonly config: OllamaAgentConfig
  ) {
    this.role = config.role;
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
        throw new Error(data.error ?? `Ollama HTTP ${response.status}`);
      }

      const content = data.message?.content?.trim() ?? "";

      if (!content) {
        throw new Error(`${this.name} produced empty output.`);
      }

      return {
        content
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async ensureModelAvailable(baseUrl: string): Promise<void> {
    const available = await this.isModelAvailable(baseUrl);

    if (available) {
      return;
    }

    if (!this.config.autoPullModel) {
      const models = await this.listAvailableModels(baseUrl);
      throw new Error(
        `Modele Ollama indisponible: ${this.config.model}. Modeles detectes: ${models.join(", ") || "aucun"}. ` +
        "Utilise --pull-models ou autoPullModel: true pour autoriser le telechargement."
      );
    }

    process.stdout.write(`\n[ollama] Modele absent, telechargement: ${this.config.model}\n`);
    await this.pullModel(baseUrl);

    if (!(await this.isModelAvailable(baseUrl))) {
      throw new Error(`Le modele Ollama ${this.config.model} reste indisponible apres telechargement.`);
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
      throw new Error(`Ollama HTTP ${response.status} pendant la detection des modeles`);
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
        throw new Error(data.error ?? `Ollama HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Echec du telechargement Ollama ${this.config.model}: ${message}`);
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
      throw new Error(`Ollama HTTP ${response.status} pendant la detection des modeles charges`);
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
    throw new Error(`Impossible de decharger le modele Ollama ${model}: HTTP ${response.status}`);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}
