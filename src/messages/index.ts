import type { Language } from "../types.js";
import { commonMessages, type CommonMessages } from "./common.js";
import { doctorMessages, type DoctorMessages } from "./doctor.js";
import { helpMessages, type HelpMessages } from "./help.js";

export interface Messages {
  common: CommonMessages;
  doctor: DoctorMessages;
  help: HelpMessages;
}

export function createTranslator(language: Language): Messages {
  return {
    common: commonMessages[language],
    doctor: doctorMessages[language],
    help: helpMessages[language]
  };
}
