import type { Language } from "../types.js";

export interface ContextMessages {
  explicitMustBeFile(path: string): string;
  explicitTooLarge(path: string, sizeBytes: number, maxBytes: number): string;
  explicitBinary(path: string): string;
  explicitTotalTooLarge(sizeBytes: number, maxBytes: number): string;
  ignoredNotFileOrDirectory(path: string): string;
  ignoredNonTextExtension(path: string): string;
  ignoredTooLarge(path: string, sizeBytes: number): string;
  ignoredTotalLimit(path: string): string;
  ignoredBinary(path: string): string;
}

export const contextMessages: Record<Language, ContextMessages> = {
  fr: {
    explicitMustBeFile: (path) => `Le contexte fichier doit pointer vers un fichier: ${path}`,
    explicitTooLarge: (path, sizeBytes, maxBytes) => `Fichier trop gros pour le contexte: ${path} (${sizeBytes} bytes, max ${maxBytes})`,
    explicitBinary: (path) => `Fichier binaire ou non texte refuse: ${path}`,
    explicitTotalTooLarge: (sizeBytes, maxBytes) => `Contexte fichiers trop gros (${sizeBytes} bytes, max ${maxBytes})`,
    ignoredNotFileOrDirectory: (path) => `Contexte ignore (ni fichier ni dossier): ${path}`,
    ignoredNonTextExtension: (path) => `Contexte ignore (extension non texte): ${path}`,
    ignoredTooLarge: (path, sizeBytes) => `Contexte ignore (fichier trop gros): ${path} (${sizeBytes} bytes)`,
    ignoredTotalLimit: (path) => `Contexte ignore (limite totale atteinte): ${path}`,
    ignoredBinary: (path) => `Contexte ignore (binaire detecte): ${path}`
  },
  en: {
    explicitMustBeFile: (path) => `File context must point to a file: ${path}`,
    explicitTooLarge: (path, sizeBytes, maxBytes) => `File too large for context: ${path} (${sizeBytes} bytes, max ${maxBytes})`,
    explicitBinary: (path) => `Binary or non-text file rejected: ${path}`,
    explicitTotalTooLarge: (sizeBytes, maxBytes) => `Context files too large (${sizeBytes} bytes, max ${maxBytes})`,
    ignoredNotFileOrDirectory: (path) => `Context ignored (neither file nor directory): ${path}`,
    ignoredNonTextExtension: (path) => `Context ignored (non-text extension): ${path}`,
    ignoredTooLarge: (path, sizeBytes) => `Context ignored (file too large): ${path} (${sizeBytes} bytes)`,
    ignoredTotalLimit: (path) => `Context ignored (total limit reached): ${path}`,
    ignoredBinary: (path) => `Context ignored (binary detected): ${path}`
  }
};
