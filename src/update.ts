import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface UpdateInfo {
  version: string;
  projectRoot: string;
  sourceCheckout: boolean;
}

export async function getUpdateInfo(version: string): Promise<UpdateInfo> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  return {
    version,
    projectRoot,
    sourceCheckout: await exists(path.join(projectRoot, ".git"))
  };
}

export function formatUpdateInstructions(info: UpdateInfo): string {
  const lines = [
    `Chicane ${info.version}`,
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
      "  chicane update --apply"
    );
  } else {
    lines.push(
      "",
      "Installation package detectee.",
      "",
      "  pnpm add --global chicane@latest",
      "",
      "Si tu utilises npm:",
      "",
      "  npm install --global chicane@latest"
    );
  }

  return lines.join("\n");
}

export async function applySourceUpdate(info: UpdateInfo): Promise<void> {
  if (!info.sourceCheckout) {
    throw new Error("Mise a jour automatique disponible seulement depuis un checkout git. Utilise pnpm add --global chicane@latest.");
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
