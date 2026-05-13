import type { Language } from "../types.js";

export interface UpdateMessages {
  upToDate: string;
  automaticSourceOnly: string;
  stepFailed(command: string, args: string, exitCode: string): string;
  instructions(options: {
    version: string;
    projectRoot: string;
    sourceCheckout: boolean;
  }): string;
}

export const updateMessages: Record<Language, UpdateMessages> = {
  fr: {
    upToDate: "PALABRE est a jour.",
    automaticSourceOnly: "Mise a jour automatique disponible seulement depuis un checkout git. Utilise pnpm add --global palabre@latest.",
    stepFailed: (command, args, exitCode) => `${command} ${args} a echoue avec le code ${exitCode}.`,
    instructions: (options) => {
      const lines = [
        `PALABRE ${options.version}`,
        "",
        "Mise a jour recommandee:"
      ];

      if (options.sourceCheckout) {
        lines.push(
          "",
          "Installation depuis le repo source detectee.",
          "",
          `  cd "${options.projectRoot}"`,
          "  git pull --ff-only",
          "  pnpm install",
          "  pnpm build",
          "  pnpm link --global",
          "",
          "Pour executer ces etapes automatiquement:",
          "",
          "  palabre update --apply"
        );
      } else {
        lines.push(
          "",
          "Installation package detectee.",
          "",
          "  pnpm add --global palabre@latest",
          "",
          "Si tu utilises npm:",
          "",
          "  npm install --global palabre@latest"
        );
      }

      return lines.join("\n");
    }
  },
  en: {
    upToDate: "PALABRE is up to date.",
    automaticSourceOnly: "Automatic update is only available from a git checkout. Use pnpm add --global palabre@latest.",
    stepFailed: (command, args, exitCode) => `${command} ${args} failed with exit code ${exitCode}.`,
    instructions: (options) => {
      const lines = [
        `PALABRE ${options.version}`,
        "",
        "Recommended update:"
      ];

      if (options.sourceCheckout) {
        lines.push(
          "",
          "Source repository installation detected.",
          "",
          `  cd "${options.projectRoot}"`,
          "  git pull --ff-only",
          "  pnpm install",
          "  pnpm build",
          "  pnpm link --global",
          "",
          "To run these steps automatically:",
          "",
          "  palabre update --apply"
        );
      } else {
        lines.push(
          "",
          "Package installation detected.",
          "",
          "  pnpm add --global palabre@latest",
          "",
          "If you use npm:",
          "",
          "  npm install --global palabre@latest"
        );
      }

      return lines.join("\n");
    }
  }
};
