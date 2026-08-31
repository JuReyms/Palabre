/** @file Messages localisés du diagnostic, de la confirmation et du plan de mise à jour. */
import type { Language } from "../types.js";

export interface UpdateMessages {
  upToDate: string;
  automaticSourceOnly: string;
  automaticUnavailable: string;
  confirmationRequired: string;
  confirmApply: string;
  updateComplete: string;
  stepFailed(command: string, args: string, exitCode: string): string;
  instructions(options: {
    version: string;
    latestVersion?: string;
    projectRoot: string;
    sourceCheckout: boolean;
    channel: string;
    steps: string[];
    hasAvailableUpdate: boolean;
  }): string;
}

export const updateMessages: Record<Language, UpdateMessages> = {
  fr: {
    upToDate: "PALABRE est a jour.",
    automaticSourceOnly: "Mise a jour automatique disponible seulement depuis un checkout Git.",
    automaticUnavailable: "Impossible de mettre a jour automatiquement cette installation. Verifie le canal detecte et utilise la commande proposee.",
    confirmationRequired: "La mise a jour modifie une installation globale. Relance avec --yes en mode non interactif.",
    confirmApply: "Appliquer cette mise a jour ? [o/N] ",
    updateComplete: "Mise a jour terminee. Relance Palabre pour utiliser la nouvelle version.",
    stepFailed: (command, args, exitCode) => `${command} ${args} a echoue avec le code ${exitCode}.`,
    instructions: (options) => formatInstructions("fr", options)
  },
  en: {
    upToDate: "PALABRE is up to date.",
    automaticSourceOnly: "Automatic update is only available from a Git checkout.",
    automaticUnavailable: "This installation cannot be updated automatically. Check the detected channel and use the proposed command.",
    confirmationRequired: "Updating changes a global installation. Re-run with --yes in non-interactive mode.",
    confirmApply: "Apply this update? [y/N] ",
    updateComplete: "Update complete. Restart Palabre to use the new version.",
    stepFailed: (command, args, exitCode) => `${command} ${args} failed with exit code ${exitCode}.`,
    instructions: (options) => formatInstructions("en", options)
  }
};

function formatInstructions(
  language: Language,
  options: Parameters<UpdateMessages["instructions"]>[0]
): string {
  const french = language === "fr";
  const lines = [
    `PALABRE ${options.version}`,
    ...(options.channel === "source" ? [] : [options.latestVersion
      ? french ? `Version npm disponible: ${options.latestVersion}` : `Available npm version: ${options.latestVersion}`
      : french ? "Verification npm indisponible." : "npm check unavailable."]),
    "",
    `${french ? "Canal detecte" : "Detected channel"}: ${formatChannel(language, options.channel)}.`
  ];

  if (options.channel === "source") {
    lines.push(
      "",
      french ? "Installation depuis le repo source detectee : synchronisation optionnelle." : "Source repository installation detected: synchronization is optional.",
      "",
      ...options.steps.map((step) => `  ${step}`)
    );
  } else if (options.channel !== "unknown") {
    const status = !options.latestVersion
      ? french ? "Verification npm indisponible : aucune mise a jour automatique." : "npm check unavailable: no automatic update."
      : options.hasAvailableUpdate
        ? french ? "Mise a jour disponible:" : "Update available:"
        : french ? "Cette installation est deja a jour." : "This installation is already up to date.";
    lines.push(
      "",
      status,
      ...(options.steps.length > 0 ? ["", ...options.steps.map((step) => `  ${step}`)] : [])
    );
  } else {
    lines.push(
      "",
      french ? "Provenance ambigue: aucune modification automatique ne sera lancee." : "Ambiguous origin: no automatic change will run.",
      french ? "Installe Palabre avec le gestionnaire utilise initialement, par exemple:" : "Install Palabre with the package manager used initially, for example:",
      "  pnpm add --global palabre@latest"
    );
  }

  lines.push(
    "",
    french ? "palabre update --check     verifier sans modifier" : "palabre update --check     check without changing anything",
    french ? "palabre update --dry-run   previsualiser les etapes" : "palabre update --dry-run   preview the steps",
    french ? "palabre update --yes       appliquer sans confirmation" : "palabre update --yes       apply without confirmation"
  );
  return lines.join("\n");
}

function formatChannel(language: Language, channel: string): string {
  const labels = language === "fr"
    ? {
        source: "checkout Git", "npm-global": "npm global", "pnpm-global": "pnpm global",
        "yarn-global": "Yarn global", "bun-global": "Bun global", unknown: "inconnu"
      }
    : {
        source: "Git checkout", "npm-global": "global npm", "pnpm-global": "global pnpm",
        "yarn-global": "global Yarn", "bun-global": "global Bun", unknown: "unknown"
      };
  return labels[channel as keyof typeof labels] ?? channel;
}
