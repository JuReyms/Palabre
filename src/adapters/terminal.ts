/** Retire les séquences de contrôle ANSI/OSC et normalise les retours ligne d'une sortie terminal. */
export function cleanTerminalOutput(output: string): string {
  return output
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b[()][A-Za-z0-9]/g, "")
    .replace(/\u001b[=>]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0007/g, "")
    .replace(/\u0000/g, "")
    .trim();
}
