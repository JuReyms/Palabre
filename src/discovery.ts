/** @file Détection locale des CLIs agents et d'Ollama, utilisée par `init`, `doctor`, `presets` et l'accueil TUI. */
import { access } from "node:fs/promises";
import path from "node:path";
import { executableExtensions } from "./exec.js";
import { configuredOllamaTargets, resolveOllamaBaseUrl } from "./ollamaUrl.js";
import { cleanTerminalOutput } from "./adapters/terminal.js";
import type { PalabreConfig } from "./types.js";

export interface DiscoveryOptions {
  ollamaUrl?: string;
  ollamaConfigUrl?: string;
  ollamaTargets?: Record<string, string | undefined>;
}

/** Résultat de la détection d'une commande dans le PATH. */
export interface CommandDetection {
  available: boolean;
  command: string;
  path?: string;
}

/**
 * Résultat de la détection Ollama.
 * `available` reflète l'accessibilité de l'API locale ; `commandAvailable` reflète la présence de la CLI `ollama` dans le PATH.
 */
export interface OllamaDetection {
  available: boolean;
  baseUrl: string;
  commandAvailable: boolean;
  models: string[];
  error?: string;
}

/** Résultat agrégé de toutes les détections locales. Construit par `discoverLocalTools`. */
export interface ToolDiscovery {
  codex: CommandDetection;
  claude: CommandDetection;
  antigravity: CommandDetection;
  opencode: CommandDetection;
  vibe: CommandDetection;
  ollama: OllamaDetection;
  ollamaAgents?: Record<string, OllamaDetection>;
}

/**
 * Détecte en parallèle toutes les CLIs supportées et le serveur Ollama local.
 * Sur Windows, tente `claude.exe` avant `claude`.
 * Antigravity est exposé selon les installations sous `agy` ou `antigravity`.
 */
export async function discoverLocalTools(options: DiscoveryOptions = {}): Promise<ToolDiscovery> {
  const [codex, claude, antigravity, opencode, vibe, ollamaCommand] = await Promise.all([
    detectCommand("codex"),
    detectFirstCommand(process.platform === "win32" ? ["claude.exe", "claude"] : ["claude"]),
    detectFirstCommand(["agy", "antigravity"]),
    detectCommand("opencode"),
    detectCommand("vibe"),
    detectCommand("ollama")
  ]);

  const configuredTargets = Object.entries(options.ollamaTargets ?? {});
  const targets = configuredTargets.length > 0
    ? configuredTargets
    : [["ollama-local", options.ollamaConfigUrl] as const];
  const resolvedTargets = targets.map(([name, configUrl]) => ({
    name,
    baseUrl: resolveOllamaBaseUrl({
      cliUrl: options.ollamaUrl,
      configUrl
    })
  }));
  const uniqueUrls = resolvedTargets
    .map((target) => target.baseUrl)
    .filter((baseUrl, index, urls) => urls.indexOf(baseUrl) === index);
  const servers = await Promise.all(uniqueUrls.map(async (baseUrl) => [
    baseUrl,
    await detectOllamaServer(baseUrl)
  ] as const));
  const serversByUrl = new Map(servers);
  const ollamaAgents = Object.fromEntries(resolvedTargets.map(({ name, baseUrl }) => [name, {
    ...serversByUrl.get(baseUrl)!,
    commandAvailable: ollamaCommand.available
  }])) as Record<string, OllamaDetection>;
  const primaryName = ollamaAgents["ollama-local"] ? "ollama-local" : resolvedTargets[0]!.name;
  const ollamaServer = ollamaAgents[primaryName]!;

  return {
    codex,
    claude,
    antigravity,
    opencode,
    vibe,
    ollama: ollamaServer,
    ollamaAgents
  };
}

async function detectFirstCommand(commands: string[]): Promise<CommandDetection> {
  for (const command of commands) {
    const detection = await detectCommand(command);

    if (detection.available) {
      return detection;
    }
  }

  return {
    available: false,
    command: commands[0] ?? ""
  };
}

async function detectCommand(command: string): Promise<CommandDetection> {
  const executablePath = await findExecutable(command);

  return {
    available: Boolean(executablePath),
    command,
    ...(executablePath ? { path: executablePath } : {})
  };
}

async function detectOllamaServer(baseUrl = "http://localhost:11434"): Promise<Omit<OllamaDetection, "commandAvailable">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        available: false,
        baseUrl,
        models: [],
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json() as { models?: Array<{ name?: string; model?: string }> };
    const models = data.models
      ?.map((model) => model.name ?? model.model)
      .filter((model): model is string => typeof model === "string" && model.length > 0)
      .map((model) => cleanTerminalOutput(model))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)) ?? [];

    return {
      available: true,
      baseUrl,
      models
    };
  } catch (error) {
    return {
      available: false,
      baseUrl,
      models: [],
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function findExecutable(command: string): Promise<string | undefined> {
  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const extensions = executableExtensions(command);

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);

      if (await isAccessible(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

async function isAccessible(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
/** Détecte les outils en tenant compte de tous les serveurs Ollama configurés. */
export function discoverLocalToolsForConfig(
  config: PalabreConfig,
  ollamaUrl?: string
): ReturnType<typeof discoverLocalTools> {
  return discoverLocalTools({
    ollamaUrl,
    ollamaTargets: configuredOllamaTargets(config)
  });
}
