/** @file Registre utilisateur des configurations explicitement approuvées. */
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
    configIdentity(configPath)
  ]);
  return store.configs[identity.path]?.sha256 === identity.sha256;
}

/** Enregistre explicitement l'empreinte actuelle d'une configuration. */
export async function trustConfig(
  configPath: string,
  trustPath = CONFIG_TRUST_PATH
): Promise<void> {
  const [store, identity] = await Promise.all([
    readTrustStore(trustPath),
    configIdentity(configPath)
  ]);
  store.configs[identity.path] = {
    sha256: identity.sha256,
    trustedAt: new Date().toISOString()
  };
  await writeTrustStore(trustPath, store);
}

/** Actualise une approbation existante après une écriture effectuée par Palabre. */
export async function refreshTrustedConfig(
  configPath: string,
  trustPath = CONFIG_TRUST_PATH
): Promise<void> {
  const store = await readTrustStore(trustPath);
  const identity = await configIdentity(configPath);
  if (!store.configs[identity.path]) {
    return;
  }
  store.configs[identity.path] = {
    sha256: identity.sha256,
    trustedAt: new Date().toISOString()
  };
  await writeTrustStore(trustPath, store);
}

async function configIdentity(configPath: string): Promise<{ path: string; sha256: string }> {
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
  await mkdir(path.dirname(trustPath), { recursive: true, mode: 0o700 });
  await writeFile(trustPath, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}

function normalizePathKey(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
