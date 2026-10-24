/** @file Forme Plan OpenCode 2.0.32 relevée le 23 octobre ; chemin et identifiant fictifs. */

/** Rappel exact dans le préfixe source, pas une instruction de confiance ni un nouveau tour. */
export function planReminder(directory = "C:\\Users\\fictif\\.opencode\\plan"): Record<string, unknown> {
  return {
    id: "msg_plan", type: "synthetic", time: { created: 1 },
    text: "<system-reminder>\nYou are in Plan mode. Discuss the plan with the user directly in the conversation. Do not create or update plan files unless the user explicitly asks you to; when they do, write them only in:\n"
      + directory
      + "\n\nDo not modify any other files or ask a subagent to do so.\n\nYou remain in Plan mode until the user switches agents. If the user asks you to implement changes, do not do so. Tell them they need to switch agents.\n</system-reminder>"
  };
}
