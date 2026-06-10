import type { Language } from "../types.js";

export interface UpdateMessages {
  upToDate: string;
  automaticSourceOnly: string;
  stepFailed(command: string, args: string, exitCode: string): string;
  instructions(options: {
    version: string;
    latestVersion?: string;
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
        );

        if (options.latestVersion) {
          lines.push(
            "",
            "Si pnpm garde une ancienne version malgré @latest:",
            "",
            `  pnpm add --global palabre@${options.latestVersion}`
          );
        } else {
          lines.push(
            "",
            "Pour verifier la derniere version disponible:",
            "",
            "  pnpm view palabre version"
          );
        }

        lines.push(
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
        );

        if (options.latestVersion) {
          lines.push(
            "",
            "If pnpm keeps an older version despite @latest:",
            "",
            `  pnpm add --global palabre@${options.latestVersion}`
          );
        } else {
          lines.push(
            "",
            "To check the latest available version:",
            "",
            "  pnpm view palabre version"
          );
        }

        lines.push(
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
