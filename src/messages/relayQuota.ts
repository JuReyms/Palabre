/** @file Présentation datée et indicative du quota Codex, jamais une mesure en direct. */
import type { CodexQuota } from "../externalSessions/quota.js";
import type { Language } from "../types.js";

/** Texte localisé ; timeZone injectable en test, sinon fuseau local du processus. */
export function relayQuotaText(language: Language, timeZone?: string): (quota: CodexQuota) => string {
  const date = new Intl.DateTimeFormat(language, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short", ...(timeZone ? { timeZone } : {}) });
  const at = (iso: string) => date.format(new Date(iso));
  const percent = (n: number) => language === "fr" ? String(n).replace(".", ",") : String(n);
  const duration = (minutes: number) => minutes % 1440 === 0 ? `${minutes / 1440} ${language === "fr" ? "j" : "d"}` : minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
  return quota => language === "fr"
    ? `Dernier quota Codex connu (indicatif, relevé le ${at(quota.recordedAt)}) : ${percent(quota.primary.usedPercent)} % utilisé sur ${duration(quota.primary.windowMinutes)}, réinitialisation le ${at(quota.primary.resetsAt)} ; ${percent(quota.secondary.usedPercent)} % utilisé sur ${duration(quota.secondary.windowMinutes)}, réinitialisation le ${at(quota.secondary.resetsAt)}. Pas une mesure en direct : le compte a pu servir ailleurs depuis.`
    : `Last known Codex quota (indicative, recorded ${at(quota.recordedAt)}): ${percent(quota.primary.usedPercent)}% used over ${duration(quota.primary.windowMinutes)}, resets ${at(quota.primary.resetsAt)}; ${percent(quota.secondary.usedPercent)}% used over ${duration(quota.secondary.windowMinutes)}, resets ${at(quota.secondary.resetsAt)}. Not a live measurement: the account may have been used elsewhere since.`;
}
