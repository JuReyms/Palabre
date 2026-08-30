/** @file Registre utilisateur des configurations explicitement approuvées. */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeTextFileAtomically } from "./atomicFile.js";

export const CONFIG_TRUST_PATH = path.join(os.homedir(), ".palabre", "trusted-configs.json");

interface ConfigTrustStore {
  v: 1;
  configs: Record<string, {
    sha256: string;
    trustedAt: string;
  }>;
}

/** Indique si le chemin résolu est l'une des configs implicites situées à la racine du projet. */
export function isImplicitProjectConfig(
  configPath: string,
  cwd: string,
  localNames: readonly string[]
): boolean {
  const resolved = normalizePathKey(path.resolve(configPath));
  return localNames.some((name) => normalizePathKey(path.resolve(cwd, name)) === resolved);
}

/** Vérifie que le contenu actuel correspond exactement à l'empreinte approuvée. */
export async function isConfigTrusted(
  configPath: string,
  trustPath = CONFIG_TRUST_PATH
): Promise<boolean> {
  const [store, identity] = await Promise.all([
    readTrustStore(trustPath),
    getConfigIdentity(configPath)
  ]);
  return store.configs[identity.path]?.sha256 === identity.sha256;
}

/** Enregistre explicitement l'empreinte actuelle d'une configuration. */
export async function trustConfig(
  configPath: string,
  trustPath = CONFIG_TRUST_PATH
): Promise<void> {
  await withTrustStoreLock(trustPath, async () => {
    const [store, identity] = await Promise.all([
      readTrustStore(trustPath),
      getConfigIdentity(configPath)
    ]);
    store.configs[identity.path] = {
      sha256: identity.sha256,
      trustedAt: new Date().toISOString()
    };
    await writeTrustStore(trustPath, store);
  });
}

/** Actualise une approbation existante après une écriture effectuée par Palabre. */
export async function refreshTrustedConfig(
  configPath: string,
  trustPath = CONFIG_TRUST_PATH
): Promise<void> {
  await withTrustStoreLock(trustPath, async () => {
    const store = await readTrustStore(trustPath);
    const identity = await getConfigIdentity(configPath);
    if (!store.configs[identity.path]) {
      return;
    }
    store.configs[identity.path] = {
      sha256: identity.sha256,
      trustedAt: new Date().toISOString()
    };
    await writeTrustStore(trustPath, store);
  });
}

/** Retourne le chemin canonique normalisé et l'empreinte utilisés par le registre de confiance. */
export async function getConfigIdentity(configPath: string): Promise<{ path: string; sha256: string }> {
  const resolved = path.resolve(configPath);
  const [canonicalPath, content] = await Promise.all([
    realpath(resolved).catch(() => resolved),
    readFile(resolved)
  ]);
  return {
    path: normalizePathKey(canonicalPath),
    sha256: createHash("sha256").update(content).digest("hex")
  };
}

async function readTrustStore(trustPath: string): Promise<ConfigTrustStore> {
  try {
    const parsed = JSON.parse(await readFile(trustPath, "utf8")) as Partial<ConfigTrustStore>;
    if (parsed.v === 1 && parsed.configs && typeof parsed.configs === "object") {
      return { v: 1, configs: parsed.configs };
    }
  } catch {
    // Un registre absent ou corrompu ne rend jamais une configuration fiable.
  }
  return { v: 1, configs: {} };
}

async function writeTrustStore(trustPath: string, store: ConfigTrustStore): Promise<void> {
  await writeTextFileAtomically(trustPath, `${JSON.stringify(store, null, 2)}\n`, {
    directoryMode: 0o700,
    fileMode: 0o600
  });
}

/** Sérialise les mises à jour read-modify-write du registre entre processus Palabre. */
async function withTrustStoreLock<T>(trustPath: string, operation: () => Promise<T>): Promise<T> {
  const lockPath = `${trustPath}.lock`;
  const deadline = Date.now() + 5_000;
  let lock: Awaited<ReturnType<typeof open>> | undefined;

  await mkdir(path.dirname(trustPath), { recursive: true, mode: 0o700 });

  while (!lock) {
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }

      const lockAge = await stat(lockPath)
        .then((value) => Date.now() - value.mtimeMs)
        .catch(() => 0);
      if (lockAge > 30_000) {
        await rm(lockPath, { force: true }).catch(() => undefined);
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting to update trusted configuration store: ${trustPath}`);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
  }

  try {
    return await operation();
  } finally {
    await lock.close();
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
}

function normalizePathKey(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
