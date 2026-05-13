import type { Language } from "../types.js";
import { agentsMessages, type AgentsMessages } from "./agents.js";
import { commonMessages, type CommonMessages } from "./common.js";
import { configMessages, type ConfigMessages } from "./config.js";
import { doctorMessages, type DoctorMessages } from "./doctor.js";
import { helpMessages, type HelpMessages } from "./help.js";
import { initMessages, type InitMessages } from "./init.js";

export interface Messages {
  agents: AgentsMessages;
  common: CommonMessages;
  config: ConfigMessages;
  doctor: DoctorMessages;
  help: HelpMessages;
  init: InitMessages;
}

export function createTranslator(language: Language): Messages {
  return {
    agents: agentsMessages[language],
    common: commonMessages[language],
    config: configMessages[language],
    doctor: doctorMessages[language],
    help: helpMessages[language],
    init: initMessages[language]
  };
}
