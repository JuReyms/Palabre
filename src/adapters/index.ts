import { CliAdapter } from "./cli.js";
import { OllamaAdapter } from "./ollama.js";
import type { AgentAdapter, AgentConfig } from "../types.js";

export function createAgent(name: string, config: AgentConfig): AgentAdapter {
  switch (config.type) {
    case "cli":
      return new CliAdapter(name, config);
    case "ollama":
      return new OllamaAdapter(name, config);
  }
}
