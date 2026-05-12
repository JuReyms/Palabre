import type { Language } from "../types.js";
import { commonMessages, type CommonMessages } from "./common.js";
import { doctorMessages, type DoctorMessages } from "./doctor.js";

export interface Messages {
  common: CommonMessages;
  doctor: DoctorMessages;
}

export function createTranslator(language: Language): Messages {
  return {
    common: commonMessages[language],
    doctor: doctorMessages[language]
  };
}
