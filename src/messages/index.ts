/** @file Assemble le dictionnaire `Messages` complet (un domaine par surface CLI) pour une langue donnée. */
import type { Language } from "../types.js";
import { adapterErrorMessages, type AdapterErrorMessages } from "./adapter-errors.js";
import { agentsMessages, type AgentsMessages } from "./agents.js";
import { commonMessages, type CommonMessages } from "./common.js";
import { chatMessages, type ChatMessages } from "./chat.js";
import { configMessages, type ConfigMessages } from "./config.js";
import { contextMessages, type ContextMessages } from "./context.js";
import { doctorMessages, type DoctorMessages } from "./doctor.js";
import { helpMessages, type HelpMessages } from "./help.js";
import { initMessages, type InitMessages } from "./init.js";
import { limitsMessages, type LimitsMessages } from "./limits.js";
import { newMessages, type NewMessages } from "./new.js";
import { orchestratorMessages, type OrchestratorMessages } from "./orchestrator.js";
import { outputMessages, type OutputMessages } from "./output.js";
import { promptMessages, type PromptMessages } from "./prompt.js";
import { presetsMessages, type PresetsMessages } from "./presets.js";
import { previewMessages, type PreviewMessages } from "./preview.js";
import { rendererMessages, type RendererMessages } from "./renderers.js";
import { tuiMessages, type TuiMessages } from "./tui.js";
import { updateMessages, type UpdateMessages } from "./update.js";

/** Dictionnaire complet des messages traduits, un domaine par surface CLI (voir AGENTS.md, section "Internationalisation"). */
export interface Messages {
  adapterErrors: AdapterErrorMessages;
  agents: AgentsMessages;
  common: CommonMessages;
  chat: ChatMessages;
  config: ConfigMessages;
  context: ContextMessages;
  doctor: DoctorMessages;
  help: HelpMessages;
  init: InitMessages;
  limits: LimitsMessages;
  new: NewMessages;
  orchestrator: OrchestratorMessages;
  output: OutputMessages;
  prompt: PromptMessages;
  presets: PresetsMessages;
  preview: PreviewMessages;
  renderers: RendererMessages;
  tui: TuiMessages;
  update: UpdateMessages;
}

/** Construit le dictionnaire `Messages` pour `language`, en assemblant chaque domaine indépendamment. */
export function createTranslator(language: Language): Messages {
  return {
    adapterErrors: adapterErrorMessages[language],
    agents: agentsMessages[language],
    common: commonMessages[language],
    chat: chatMessages[language],
    config: configMessages[language],
    context: contextMessages[language],
    doctor: doctorMessages[language],
    help: helpMessages[language],
    init: initMessages[language],
    limits: limitsMessages[language],
    new: newMessages[language],
    orchestrator: orchestratorMessages[language],
    output: outputMessages[language],
    prompt: promptMessages[language],
    presets: presetsMessages[language],
    preview: previewMessages[language],
    renderers: rendererMessages[language],
    tui: tuiMessages[language],
    update: updateMessages[language]
  };
}
