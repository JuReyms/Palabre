import { setOllamaBaseUrl, setOllamaModel, syncDetectedAgentsDetailed, syncOllamaModel, writeExampleConfig } from "./config.js";
import { discoverLocalToolsForConfig } from "./discovery.js";
import { AdapterError, formatAdapterError } from "./errors.js";
import { createTranslator, DEFAULT_LANGUAGE, parseLanguage } from "./i18n.js";
import { MAX_ASK_AGENTS, validateTurns } from "./limits.js";
import { DEFAULT_OLLAMA_BASE_URL, normalizeOllamaBaseUrl, OllamaUrlError, resolveOllamaBaseUrl } from "./ollamaUrl.js";
import { promptTuiAgentsWizard, promptTuiConfigCommand, promptTuiRolesWizard, renderTuiConfig } from "./renderers/tui.js";
import type { AgentRole, PalabreConfig, PalabreMode } from "./types.js";
import type { Messages } from "./messages/index.js";
export async function runTuiConfigLoop(
  configPath: string,
  config: PalabreConfig,
  messages: Messages,
  initialMode: PalabreMode
): Promise<{ mode: PalabreMode; quit: boolean; changedRunDefaults: boolean }> {
  let mode = initialMode;
  let notice: string | undefined;
  let currentMessages = messages;
  let changedRunDefaults = false;

  for (;;) {
    renderTuiConfig(config, configPath, mode, currentMessages, { message: notice });
    notice = undefined;

    const input = await promptTuiConfigCommand(mode, currentMessages);

    if (input.kind === "quit") {
      return { mode, quit: true, changedRunDefaults };
    }

    if (input.kind === "back") {
      return { mode, quit: false, changedRunDefaults };
    }

    if (input.kind === "unknown") {
      notice = input.message;
      continue;
    }

    if (input.kind === "mode") {
      mode = mode === "ask" ? "debate" : "ask";
      config.defaults = { ...(config.defaults ?? {}), mode };
      await writeExampleConfig(configPath, config);
      changedRunDefaults = true;
      notice = mode === "ask" ? currentMessages.tui.askDefaultMode : currentMessages.tui.debateDefaultMode;
      continue;
    }

    if (input.kind === "default-mode") {
      config.defaults = { ...(config.defaults ?? {}), mode };
      await writeExampleConfig(configPath, config);
      changedRunDefaults = true;
      notice = mode === "ask" ? currentMessages.tui.askDefaultMode : currentMessages.tui.debateDefaultMode;
      continue;
    }

    if (input.kind === "interface") {
      config.defaults = { ...(config.defaults ?? {}), interface: input.interfaceName };
      await writeExampleConfig(configPath, config);
      notice = currentMessages.tui.interfaceDefault(input.interfaceName);
      continue;
    }

    if (input.kind === "language") {
      config.language = parseLanguage(input.language, "--language");
      await writeExampleConfig(configPath, config);
      currentMessages = createTranslator(config.language ?? DEFAULT_LANGUAGE);
      notice = currentMessages.tui.languageUpdated(input.language);
      continue;
    }

    if (input.kind === "agents") {
      try {
        const agentsInput = input.agents.length > 0
          ? { kind: "agents" as const, agents: input.agents }
          : await promptTuiAgentsWizard(config, mode, currentMessages);
        if (agentsInput.kind === "quit") {
          return { mode, quit: true, changedRunDefaults };
        }
        if (agentsInput.kind === "back" || agentsInput.agents.length === 0) {
          notice = currentMessages.tui.agentsUnchanged;
          continue;
        }

        if (mode === "ask") {
          const agents = normalizeTuiAskAgents(config, agentsInput.agents, currentMessages);
          config.defaults = { ...(config.defaults ?? {}), askAgents: agents };
          await writeExampleConfig(configPath, config);
          changedRunDefaults = true;
          notice = currentMessages.tui.askAgentsUpdated(agents.join(", "));
        } else {
          const [agentA, agentB] = normalizeTuiDebateAgents(config, agentsInput.agents, currentMessages);
          config.defaults = { ...(config.defaults ?? {}), agentA, agentB };
          await writeExampleConfig(configPath, config);
          changedRunDefaults = true;
          notice = currentMessages.tui.debateAgentsUpdated(`${agentA} <-> ${agentB}`);
        }
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "roles") {
      try {
        const rolesInput = input.roles.length > 0
          ? { kind: "roles" as const, roles: input.roles }
          : await promptTuiRolesWizard(config, mode, currentMessages);
        if (rolesInput.kind === "quit") {
          return { mode, quit: true, changedRunDefaults };
        }
        if (rolesInput.kind === "back" || rolesInput.roles.length === 0) {
          notice = currentMessages.tui.rolesUnchanged;
          continue;
        }
        notice = applyTuiRoles(config, mode, rolesInput.roles, currentMessages);
        await writeExampleConfig(configPath, config);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "turns") {
      if (mode === "ask") {
        notice = currentMessages.tui.askTurnsNotice;
        continue;
      }

      try {
        validateTurns(input.turns, "--turns", currentMessages);
        config.defaults = { ...(config.defaults ?? {}), turns: input.turns };
        await writeExampleConfig(configPath, config);
        changedRunDefaults = true;
        notice = currentMessages.tui.turnsUpdated(input.turns);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "summary") {
      try {
        const nextDefaults = { ...(config.defaults ?? {}) };
        if (input.agent !== undefined) {
          assertKnownAgent(config, input.agent, mode === "ask" ? "defaults.askSummaryAgent" : "defaults.summaryAgent", currentMessages);
        }

        if (mode === "ask") {
          if (input.agent === undefined) {
            delete nextDefaults.askSummaryAgent;
            notice = currentMessages.tui.askSummaryFallback;
          } else {
            nextDefaults.askSummaryAgent = input.agent;
            notice = currentMessages.tui.askSummaryAgent(input.agent);
          }
        } else if (input.agent === undefined) {
          delete nextDefaults.summaryAgent;
          notice = currentMessages.tui.debateSummaryFallback;
        } else {
          nextDefaults.summaryAgent = input.agent;
          notice = currentMessages.tui.debateSummaryAgent(input.agent);
        }

        config.defaults = nextDefaults;
        await writeExampleConfig(configPath, config);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-info") {
      try {
        notice = await formatTuiOllamaInfo(config, currentMessages);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-url") {
      try {
        notice = await setTuiOllamaUrl(configPath, config, input.url, currentMessages);
        changedRunDefaults = true;
      } catch (error) {
        notice = formatTuiRuntimeError(error, currentMessages);
      }
      continue;
    }

    if (input.kind === "ollama-model") {
      try {
        notice = await setTuiOllamaModel(configPath, config, input.model, currentMessages);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-sync") {
      try {
        notice = await syncTuiOllamaModel(configPath, config, currentMessages);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }
  }
}

async function setTuiOllamaUrl(
  configPath: string,
  config: PalabreConfig,
  value: string,
  messages: Messages
): Promise<string> {
  if (!Object.values(config.agents).some((agent) => agent.type === "ollama")) {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  const normalized = isDefaultOllamaUrl(value)
    ? DEFAULT_OLLAMA_BASE_URL
    : normalizeOllamaBaseUrl(value);
  const effective = resolveOllamaBaseUrl({ configUrl: normalized });
  setOllamaBaseUrl(config, normalized);
  await writeExampleConfig(configPath, config);

  return messages.tui.ollamaUrlUpdated(normalized, effective);
}

function isDefaultOllamaUrl(value: string): boolean {
  return ["default", "defaut", "défaut", "local", "localhost"].includes(value.trim().toLowerCase());
}

async function formatTuiOllamaInfo(config: PalabreConfig, messages: Messages): Promise<string> {
  const discovery = await discoverLocalToolsForConfig(config);
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (!discovery.ollama.available) {
    return messages.tui.ollamaUnavailable(discovery.ollama.baseUrl);
  }

  const installed = discovery.ollama.models.length > 0
    ? discovery.ollama.models.join(", ")
    : messages.config.ollamaModelNoInstalledModels;
  const api = `${discovery.ollama.baseUrl}`;
  return messages.tui.ollamaInfo(agent.model, installed, api);
}

async function setTuiOllamaModel(configPath: string, config: PalabreConfig, model: string, messages: Messages): Promise<string> {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error(messages.tui.ollamaModelUsage);
  }

  const discovery = await discoverLocalToolsForConfig(config);
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (!discovery.ollama.models.includes(trimmed)) {
    throw new Error(messages.config.ollamaModelUnavailable(trimmed));
  }

  const result = setOllamaModel(config, trimmed);
  await writeExampleConfig(configPath, config);
  return result
    ? messages.config.ollamaModelUpdated(configPath, result.previousModel, result.nextModel)
    : messages.config.ollamaModelNoChange(configPath, agent.model);
}

async function syncTuiOllamaModel(configPath: string, config: PalabreConfig, messages: Messages): Promise<string> {
  const discovery = await discoverLocalToolsForConfig(config);
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (discovery.ollama.models.length === 0) {
    throw new Error(messages.config.ollamaModelNoInstalledModels);
  }

  const result = syncOllamaModel(config, discovery);

  if (!result) {
    return messages.config.ollamaModelNoChange(configPath, agent.model);
  }

  await writeExampleConfig(configPath, config);
  return messages.config.ollamaModelUpdated(configPath, result.previousModel, result.nextModel);
}

export async function syncInteractiveDetectedAgents(configPath: string, config: PalabreConfig): Promise<{ addedAgents: string[] }> {
  const discovery = await discoverLocalToolsForConfig(config);
  const result = syncDetectedAgentsDetailed(config, discovery);

  if (result.changed) {
    await writeExampleConfig(configPath, config);
  }

  return {
    addedAgents: result.addedAgents
  };
}

function normalizeTuiDebateAgents(config: PalabreConfig, agents: string[], messages: Messages): [string, string] {
  const unique = agents.map((agent) => agent.trim()).filter((agent, index, list) => agent && list.indexOf(agent) === index);
  if (unique.length !== 2) {
    throw new Error(messages.tui.debateAgentsUsage);
  }

  assertKnownAgent(config, unique[0]!, "defaults.agentA", messages);
  assertKnownAgent(config, unique[1]!, "defaults.agentB", messages);
  return [unique[0]!, unique[1]!];
}

function normalizeTuiAskAgents(config: PalabreConfig, agents: string[], messages: Messages): string[] {
  const unique = agents.map((agent) => agent.trim()).filter((agent, index, list) => agent && list.indexOf(agent) === index);
  if (unique.length === 0) {
    throw new Error(messages.tui.askAgentsUsage);
  }

  if (unique.length > MAX_ASK_AGENTS) {
    throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  }

  unique.forEach((agent) => assertKnownAgent(config, agent, "defaults.askAgents", messages));
  return unique;
}

export async function runTuiAgentsWizard(
  configPath: string,
  config: PalabreConfig,
  messages: Messages,
  mode: PalabreMode,
  inlineAgents: string[] = []
): Promise<{ notice?: string; quit: boolean; changedRunDefaults: boolean }> {
  try {
    const agentsInput = inlineAgents.length > 0
      ? { kind: "agents" as const, agents: inlineAgents }
      : await promptTuiAgentsWizard(config, mode, messages);
    if (agentsInput.kind === "quit") {
      return { quit: true, changedRunDefaults: false };
    }
    if (agentsInput.kind === "back" || agentsInput.agents.length === 0) {
      return { quit: false, changedRunDefaults: false };
    }

    const notice = applyTuiAgents(config, mode, agentsInput.agents, messages);
    await writeExampleConfig(configPath, config);
    return { notice, quit: false, changedRunDefaults: true };
  } catch (error) {
    return { notice: messages.tui.agentsError(error instanceof Error ? error.message : String(error)), quit: false, changedRunDefaults: false };
  }
}

export async function runTuiRolesWizard(
  configPath: string,
  config: PalabreConfig,
  messages: Messages,
  mode: PalabreMode,
  inlineRoles: string[] = []
): Promise<{ notice?: string; quit: boolean }> {
  try {
    const rolesInput = inlineRoles.length > 0
      ? { kind: "roles" as const, roles: inlineRoles }
      : await promptTuiRolesWizard(config, mode, messages);
    if (rolesInput.kind === "quit") {
      return { quit: true };
    }
    if (rolesInput.kind === "back" || rolesInput.roles.length === 0) {
      return { quit: false };
    }
    const notice = applyTuiRoles(config, mode, rolesInput.roles, messages);
    await writeExampleConfig(configPath, config);
    return { notice, quit: false };
  } catch (error) {
    return { notice: messages.tui.rolesError(error instanceof Error ? error.message : String(error)), quit: false };
  }
}

function applyTuiAgents(config: PalabreConfig, mode: PalabreMode, agentNames: string[], messages: Messages): string {
  if (mode === "ask") {
    const agents = normalizeTuiAskAgents(config, agentNames, messages);
    config.defaults = { ...(config.defaults ?? {}), askAgents: agents };
    return messages.tui.askAgentsUpdated(agents.join(", "));
  }

  const [agentA, agentB] = normalizeTuiDebateAgents(config, agentNames, messages);
  config.defaults = { ...(config.defaults ?? {}), agentA, agentB };
  return messages.tui.debateAgentsUpdated(`${agentA} <-> ${agentB}`);
}

function applyTuiRoles(config: PalabreConfig, mode: PalabreMode, roleNames: string[], messages: Messages): string {
  const agents = activeAgentsForMode(config, mode);
  if (agents.length === 0) {
    throw new Error(mode === "ask" ? messages.tui.noAskAgentsConfigured : messages.tui.noDebateAgentsConfigured);
  }

  const roles = normalizeTuiRoles(roleNames, agents, mode, messages);
  agents.forEach((agent, index) => {
    config.agents[agent]!.role = roles[index]!;
  });

  return mode === "ask"
    ? messages.tui.askRolesUpdated(roles.join(", "))
    : messages.tui.debateRolesUpdated(roles.join(" <-> "));
}

function activeAgentsForMode(config: PalabreConfig, mode: PalabreMode): string[] {
  const defaults = config.defaults ?? {};
  if (mode === "ask") {
    if (defaults.askAgents && defaults.askAgents.length > 0) {
      return defaults.askAgents.filter((agent) => Boolean(config.agents[agent]));
    }
    return [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent && config.agents[agent]));
  }

  return [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent && config.agents[agent]));
}

function normalizeTuiRoles(roleNames: string[], agents: string[], mode: PalabreMode, messages: Messages): AgentRole[] {
  const roles = roleNames.map((role) => role.trim().toLowerCase()).filter(Boolean);
  const expectedCount = agents.length;
  if (roles.length < expectedCount) {
    const agentLabel = mode === "ask"
      ? agents.join(", ")
      : agents.join(" <-> ");
    throw new Error(messages.tui.rolesCountError(roles.length, expectedCount, agentLabel));
  }

  return roles.slice(0, expectedCount).map((role) => {
    if (isAgentRole(role)) {
      return role;
    }
    throw new Error(messages.tui.unknownRole(role, VALID_AGENT_ROLES.join(", ")));
  });
}

function isAgentRole(value: string): value is AgentRole {
  return (VALID_AGENT_ROLES as readonly string[]).includes(value);
}

const VALID_AGENT_ROLES: readonly AgentRole[] = ["implementer", "reviewer", "architect", "scout", "critic", "summarizer"];

function assertKnownAgent(config: PalabreConfig, agentName: string, fieldName: string, messages: Messages): void {
  if (!config.agents[agentName]) {
    throw new Error(messages.common.unknownAgentForField(fieldName, agentName, Object.keys(config.agents).join(", ")));
  }
}
function formatTuiRuntimeError(error: unknown, messages: Messages): string {
  if (error instanceof AdapterError) return formatAdapterError(error, messages);
  if (error instanceof OllamaUrlError) {
    if (error.kind === "empty") return messages.common.ollamaUrlEmpty;
    if (error.kind === "protocol") return messages.common.ollamaUrlProtocol(error.protocol ?? "");
    return messages.common.ollamaUrlInvalid(error.value);
  }
  return error instanceof Error ? error.message : String(error);
}
