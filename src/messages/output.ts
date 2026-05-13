import type { Language } from "../types.js";

export interface OutputMessages {
  title: string;
  contextTitle: string;
  exchangesTitle: string;
  finalSummaryTitle: string;
  tableField: string;
  tableValue: string;
  summaryMissing: string;
  summaryDisabled: string;
  noFileContext: string;
  fileSizeUnit: string;
  yes: string;
  no: string;
  disabled: string;
  fields: {
    subject: string;
    agents: string;
    autoPullOllama: string;
    summary: string;
    requestedTurns: string;
    playedTurns: string;
    earlyStop: string;
    localDate: string;
    timeZone: string;
    cwd: string;
    sessionStartedAt: string;
    agent: string;
    role: string;
    date: string;
  };
}

export const outputMessages: Record<Language, OutputMessages> = {
  fr: {
    title: "# PALABRE Debate",
    contextTitle: "## Contexte",
    exchangesTitle: "## Echanges",
    finalSummaryTitle: "## Synthese finale",
    tableField: "Champ",
    tableValue: "Valeur",
    summaryMissing: "_Synthese finale demandee mais non disponible._",
    summaryDisabled: "_Synthese desactivee._",
    noFileContext: "Aucun contexte fichier injecte.",
    fileSizeUnit: "bytes",
    yes: "oui",
    no: "non",
    disabled: "desactivee",
    fields: {
      subject: "Sujet",
      agents: "Agents",
      autoPullOllama: "Auto-pull Ollama",
      summary: "Synthese",
      requestedTurns: "Tours demandes",
      playedTurns: "Tours joues",
      earlyStop: "Arret anticipe",
      localDate: "Date locale",
      timeZone: "Fuseau horaire",
      cwd: "Dossier courant",
      sessionStartedAt: "Session demarree a",
      agent: "Agent",
      role: "Role",
      date: "Date"
    }
  },
  en: {
    title: "# PALABRE Debate",
    contextTitle: "## Context",
    exchangesTitle: "## Exchanges",
    finalSummaryTitle: "## Final summary",
    tableField: "Field",
    tableValue: "Value",
    summaryMissing: "_Final summary requested but unavailable._",
    summaryDisabled: "_Summary disabled._",
    noFileContext: "No file context injected.",
    fileSizeUnit: "bytes",
    yes: "yes",
    no: "no",
    disabled: "disabled",
    fields: {
      subject: "Subject",
      agents: "Agents",
      autoPullOllama: "Ollama auto-pull",
      summary: "Summary",
      requestedTurns: "Requested turns",
      playedTurns: "Played turns",
      earlyStop: "Early stop",
      localDate: "Local date",
      timeZone: "Time zone",
      cwd: "Current directory",
      sessionStartedAt: "Session started at",
      agent: "Agent",
      role: "Role",
      date: "Date"
    }
  }
};
