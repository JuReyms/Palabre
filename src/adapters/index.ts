import { CliAdapter } from "./cli.js";
import { CliPtyAdapter } from "./cli-pty.js";
import { OllamaAdapter } from "./ollama.js";
import type { AgentAdapter, AgentConfig } from "../types.js";

export interface AgentRuntimeOptions {
  ollamaUrl?: string;
}

/** Factory qui instancie l'adapter approprié selon `config.type`. Exhaustive : tout `AgentConfig` valide produit un adapter. */
export function createAgent(name: string, config: AgentConfig, runtime: AgentRuntimeOptions = {}): AgentAdapter {
  switch (config.type) {
    case "cli":
      return new CliAdapter(name, config);
    case "cli-pty":
      return new CliPtyAdapter(name, config);
    case "ollama":
      return new OllamaAdapter(name, config, runtime);
  }
}
