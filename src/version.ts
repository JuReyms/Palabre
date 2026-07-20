/** @file Version locale courante et dernière version publiée npm, pour `--version` et la notice de mise à jour TUI. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Lit la version depuis `package.json` adjacent au bundle compilé. */
export async function getPackageVersion(): Promise<string> {
  const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  try {
    const raw = await readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(raw) as { name?: string; version?: string };
    if (packageJson.name === "palabre" && packageJson.version) {
      return packageJson.version;
    }
  } catch {
    // Une installation incomplète ne doit pas empêcher l'écriture d'un rapport.
  }

  return "0.0.0";
}

/** Compare deux versions semver simples `major.minor.patch`. */
export function compareSemver(left: string, right: string): number {
  const a = parseSemverParts(left);
  const b = parseSemverParts(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = a[index] - b[index];
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

/** Lit la dernière version publiée sur npm. Retourne `undefined` hors ligne ou si le registre ne répond pas. */
export async function getLatestPackageVersion(timeoutMs = 1_500): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://registry.npmjs.org/palabre/latest", {
      signal: controller.signal,
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json() as { version?: unknown };
    return typeof data.version === "string" ? data.version : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function parseSemverParts(value: string): [number, number, number] {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  return [
    Number(match?.[1] ?? 0),
    Number(match?.[2] ?? 0),
    Number(match?.[3] ?? 0)
  ];
}
