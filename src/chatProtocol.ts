/** @file Protocole d'entrée structuré pour piloter une session Chat depuis une intégration. */

export const CHAT_INPUT_VERSION = 1;

export type ChatInputCommand =
  | { v: 1; type: "chat-send"; content: string }
  | { v: 1; type: "chat-consult"; agent: string }
  | { v: 1; type: "chat-use"; agent: string }
  | { v: 1; type: "chat-agents" }
  | { v: 1; type: "chat-end" }
  | { v: 1; type: "chat-close" };

export type ChatInputParseResult =
  | { kind: "command"; command: ChatInputCommand }
  | { kind: "error"; message: string };

/** Parse une ligne stdin structurée ou une commande terminal historique. */
export function parseChatInputLine(line: string): ChatInputParseResult {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "/exit" || trimmed === "/quit" || trimmed === "/home") {
    return { kind: "command", command: { v: 1, type: "chat-close" } };
  }

  if (!trimmed.startsWith("{")) {
    return { kind: "command", command: parseLegacyCommand(trimmed) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { kind: "error", message: `Invalid Chat input JSON: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (!parsed || typeof parsed !== "object") {
    return { kind: "error", message: "Invalid Chat input: root value must be an object." };
  }

  const input = parsed as Record<string, unknown>;
  if (input.v !== CHAT_INPUT_VERSION) {
    return { kind: "error", message: `Unsupported Chat input version: ${String(input.v)}.` };
  }

  switch (input.type) {
    case "chat-send":
      return requiredString(input, "content", (content) => ({ v: 1, type: "chat-send", content }));
    case "chat-consult":
      return requiredString(input, "agent", (agent) => ({ v: 1, type: "chat-consult", agent }));
    case "chat-use":
      return requiredString(input, "agent", (agent) => ({ v: 1, type: "chat-use", agent }));
    case "chat-agents":
      return { kind: "command", command: { v: 1, type: "chat-agents" } };
    case "chat-end":
      return { kind: "command", command: { v: 1, type: "chat-end" } };
    default:
      return { kind: "error", message: `Unknown Chat input type: ${String(input.type)}.` };
  }
}

function requiredString<T extends ChatInputCommand>(
  input: Record<string, unknown>,
  field: "content" | "agent",
  create: (value: string) => T
): ChatInputParseResult {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    return { kind: "error", message: `Invalid Chat input: '${field}' must be a non-empty string.` };
  }
  return { kind: "command", command: create(field === "content" ? value : value.trim()) };
}

function parseLegacyCommand(value: string): ChatInputCommand {
  if (value === "/end") return { v: 1, type: "chat-end" };
  if (value === "/agents") return { v: 1, type: "chat-agents" };

  const [command, agent] = value.split(/\s+/, 2);
  if (command === "/consult" && agent) return { v: 1, type: "chat-consult", agent };
  if (command === "/use" && agent) return { v: 1, type: "chat-use", agent };

  return { v: 1, type: "chat-send", content: value };
}
