import { CliAdapter } from "./cli.js";
import { OllamaAdapter } from "./ollama.js";
import type { AgentAdapter, AgentConfig } from "../types.js";

/** Factory qui instancie l'adapter approprié selon `config.type`. Exhaustive : tout `AgentConfig` valide produit un adapter. */
export function createAgent(name: string, config: AgentConfig): AgentAdapter {
  switch (config.type) {
    case "cli":
      return new CliAdapter(name, config);
    case "ollama":
      return new OllamaAdapter(name, config);
  }
}
