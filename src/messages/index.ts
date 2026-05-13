import type { Language } from "../types.js";
import { agentsMessages, type AgentsMessages } from "./agents.js";
import { commonMessages, type CommonMessages } from "./common.js";
import { configMessages, type ConfigMessages } from "./config.js";
import { doctorMessages, type DoctorMessages } from "./doctor.js";
import { helpMessages, type HelpMessages } from "./help.js";
import { initMessages, type InitMessages } from "./init.js";
import { newMessages, type NewMessages } from "./new.js";
import { presetsMessages, type PresetsMessages } from "./presets.js";
import { previewMessages, type PreviewMessages } from "./preview.js";
import { rendererMessages, type RendererMessages } from "./renderers.js";
import { updateMessages, type UpdateMessages } from "./update.js";

export interface Messages {
  agents: AgentsMessages;
  common: CommonMessages;
  config: ConfigMessages;
  doctor: DoctorMessages;
  help: HelpMessages;
  init: InitMessages;
  new: NewMessages;
  presets: PresetsMessages;
  preview: PreviewMessages;
  renderers: RendererMessages;
  update: UpdateMessages;
}

export function createTranslator(language: Language): Messages {
  return {
    agents: agentsMessages[language],
    common: commonMessages[language],
    config: configMessages[language],
    doctor: doctorMessages[language],
    help: helpMessages[language],
    init: initMessages[language],
    new: newMessages[language],
    presets: presetsMessages[language],
    preview: previewMessages[language],
    renderers: rendererMessages[language],
    update: updateMessages[language]
  };
}
