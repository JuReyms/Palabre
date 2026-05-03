import { access } from "node:fs/promises";
import path from "node:path";

export interface CommandDetection {
  available: boolean;
  command: string;
  path?: string;
}

export interface OllamaDetection {
  available: boolean;
  baseUrl: string;
  commandAvailable: boolean;
  models: string[];
  error?: string;
}

export interface ToolDiscovery {
  codex: CommandDetection;
  claude: CommandDetection;
  gemini: CommandDetection;
  ollama: OllamaDetection;
}

export async function discoverLocalTools(): Promise<ToolDiscovery> {
  const [codex, claude, gemini, ollamaCommand] = await Promise.all([
    detectCommand("codex"),
    detectFirstCommand(process.platform === "win32" ? ["claude.exe", "claude"] : ["claude"]),
    detectCommand("gemini"),
    detectCommand("ollama")
  ]);

  const ollamaServer = await detectOllamaServer();

  return {
    codex,
    claude,
    gemini,
    ollama: {
      ...ollamaServer,
      commandAvailable: ollamaCommand.available
    }
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
      .filter((model): model is string => Boolean(model))
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

function executableExtensions(command: string): string[] {
  if (path.extname(command)) {
    return [""];
  }

  if (process.platform !== "win32") {
    return [""];
  }

  return (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((extension) => extension.toLowerCase())
    .concat("");
}

async function isAccessible(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
