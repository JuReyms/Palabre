import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Messages } from "./messages/index.js";

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
export function formatUpdateInstructions(info: UpdateInfo, messages: Messages): string {
  return messages.update.instructions(info);
}

/**
 * Exécute `git pull`, `pnpm install`, `pnpm build`, `pnpm link --global` dans le répertoire du projet.
 * @throws {Error} si `info.sourceCheckout` est faux — la mise à jour automatique ne s'applique qu'aux checkouts git.
 */
export async function applySourceUpdate(info: UpdateInfo, messages: Messages): Promise<void> {
  if (!info.sourceCheckout) {
    throw new Error(messages.update.automaticSourceOnly);
  }

  await runStep("git", ["pull", "--ff-only"], info.projectRoot, messages);
  await runStep("pnpm", ["install"], info.projectRoot, messages);
  await runStep("pnpm", ["build"], info.projectRoot, messages);
  await runStep("pnpm", ["link", "--global"], info.projectRoot, messages);
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function runStep(command: string, args: string[], cwd: string, messages: Messages): Promise<void> {
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

      reject(new Error(messages.update.stepFailed(command, args.join(" "), String(exitCode ?? "inconnu"))));
    });
  });
}
