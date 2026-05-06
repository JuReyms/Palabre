import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Informations sur l'installation courante, utilisées pour adapter les instructions de mise à jour. */
export interface UpdateInfo {
  version: string;
  projectRoot: string;
  /** `true` si le dossier parent contient un `.git` — distingue un checkout source d'une installation via npm/pnpm. */
  sourceCheckout: boolean;
}

/** Détecte le mode d'installation (source ou package) à partir de la présence d'un dossier `.git`. */
export async function getUpdateInfo(version: string): Promise<UpdateInfo> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  return {
    version,
    projectRoot,
    sourceCheckout: await exists(path.join(projectRoot, ".git"))
  };
}

/** Génère les instructions de mise à jour adaptées au mode d'installation détecté dans `info`. */
export function formatUpdateInstructions(info: UpdateInfo): string {
  const lines = [
    `PALABRE ${info.version}`,
    "",
    "Mise a jour recommandee:"
  ];

  if (info.sourceCheckout) {
    lines.push(
      "",
      "Installation depuis le repo source detectee.",
      "",
      `  cd "${info.projectRoot}"`,
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

/**
 * Exécute `git pull`, `pnpm install`, `pnpm build`, `pnpm link --global` dans le répertoire du projet.
 * @throws {Error} si `info.sourceCheckout` est faux — la mise à jour automatique ne s'applique qu'aux checkouts git.
 */
export async function applySourceUpdate(info: UpdateInfo): Promise<void> {
  if (!info.sourceCheckout) {
    throw new Error("Mise a jour automatique disponible seulement depuis un checkout git. Utilise pnpm add --global palabre@latest.");
  }

  await runStep("git", ["pull", "--ff-only"], info.projectRoot);
  await runStep("pnpm", ["install"], info.projectRoot);
  await runStep("pnpm", ["build"], info.projectRoot);
  await runStep("pnpm", ["link", "--global"], info.projectRoot);
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function runStep(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: "inherit",
      windowsHide: true
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} a echoue avec le code ${exitCode ?? "inconnu"}.`));
    });
  });
}

