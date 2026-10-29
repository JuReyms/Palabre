/**
 * @file Factory d'adapters : mappe un `AgentConfig` vers l'implémentation `cli`/`cli-pty`/`ollama`
 * correspondante. Le profil du registre (délai connu, sortie qualifiée au défaut exact) et l'identité
 * de configuration sont appliqués ici, en mémoire, sans cas fournisseur dans l'orchestrateur ni
 * écriture de configuration.
 */
import { cliRuntimeProfile } from "../agentRegistry.js";
import { CliAdapter } from "./cli.js";
import { CliPtyAdapter } from "./cli-pty.js";
import { OllamaAdapter } from "./ollama.js";
import type { AgentAdapter, AgentConfig, ConfigIdentity } from "../types.js";

/** Options de session transmises aux adapters à la création, indépendantes de la config agent persistée. */
export interface AgentRuntimeOptions {
  ollamaUrl?: string;
  /** Identité de la configuration chargée, pour une référence de lecture liée à cette config exacte. */
  configIdentity?: ConfigIdentity;
}

/** Factory qui instancie l'adapter approprié selon `config.type`. Exhaustive : tout `AgentConfig` valide produit un adapter. */
export function createAgent(name: string, config: AgentConfig, runtime: AgentRuntimeOptions = {}): AgentAdapter {
  switch (config.type) {
    case "cli": {
      const profile = cliRuntimeProfile(config);
      return new CliAdapter(name, profile?.config ?? config, profile?.runtime, runtime.configIdentity);
    }
    case "cli-pty":
      return new CliPtyAdapter(name, config);
    case "ollama":
      return new OllamaAdapter(name, config, runtime);
  }
}
