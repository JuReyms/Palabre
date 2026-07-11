/** @file Nettoyage des séquences ANSI/OSC partagé par les adapters CLI et PTY. */

/**
 * Retire ANSI, OSC, DCS et les contrôles invisibles d'un texte non fiable, sans supprimer ses
 * espaces ni ses retours à la ligne utiles au renderer.
 */
export function sanitizeTerminalText(output: string): string {
  return output
    .replace(/\u001b\][\s\S]*?(?:\u0007|\u001b\\|$)/g, "")
    .replace(/\u001b(?:P|X|\^|_)[\s\S]*?(?:\u001b\\|$)/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b[()][A-Za-z0-9]/g, "")
    .replace(/\u001b[=>]/g, "")
    .replace(/\u001b[@-_]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // NEL (C1, U+0085) est un retour ligne utilisé par certains pseudo-terminaux.
    // Le normaliser avant le filtrage des contrôles C1 pour ne pas coller deux lignes.
    .replace(/\u0085/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "");
}

/** Retire les contrôles terminaux, normalise les retours ligne et nettoie les bords. */
export function cleanTerminalOutput(output: string): string {
  return sanitizeTerminalText(output).trim();
}

/**
 * Nettoie une sortie PTY et restaure les titres Markdown que certains terminaux
 * concatènent directement après une phrase terminée.
 */
export function cleanPtyOutput(output: string): string {
  return cleanTerminalOutput(output).replace(/([.!?])(?=#{1,6}\s)/g, "$1\n\n");
}
