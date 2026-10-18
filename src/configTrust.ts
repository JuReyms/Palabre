/** @file Registre utilisateur des configurations explicitement approuvées. */
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { writeTextFileAtomically } from "./atomicFile.js";

export const CONFIG_TRUST_PATH = path.join(os.homedir(), ".palabre", "trusted-configs.json");

/** Preview bound to the exact registry shown to the human; inaccessible paths are kept. */
export interface TrustPrunePlan {
  sha256: string;
  missing: string[];
  kept: number;
  inaccessible: number;
}

/** Strict maintenance reader: unlike trust lookup, never replaces an unreadable/corrupt registry. */
async function readPruneStore(trustPath: string): Promise<{ raw: string; store: ConfigTrustStore }> {
  let raw: string;
  try {
    if (!(await lstat(trustPath)).isFile()) throw new Error("trust-registry-invalid");
    raw = await readFile(trustPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { raw: "", store: { v: 1, configs: {} } };
    throw error;
  }
  const store = JSON.parse(raw) as ConfigTrustStore;
  if (!store || store.v !== 1 || !store.configs || typeof store.configs !== "object" || Array.isArray(store.configs)
    || Object.entries(store.configs).some(([file, entry]) => !path.isAbsolute(file) || !entry || typeof entry !== "object"
      || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256) || typeof entry.trustedAt !== "string")) throw new Error("trust-registry-invalid");
  return { raw, store };
}

/** A symlink counts as existing, even if broken; access failures never mean absence. */
async function configPresence(file: string): Promise<"exists" | "missing" | "unknown"> {
  try { await lstat(file); return "exists"; }
  catch (error) { return ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "") ? "missing" : "unknown"; }
}

/** Read-only list of approvals whose configuration path no longer exists. */
export async function planTrustPrune(trustPath = CONFIG_TRUST_PATH): Promise<TrustPrunePlan> {
  const { raw, store } = await readPruneStore(trustPath);
  const plan: TrustPrunePlan = { sha256: createHash("sha256").update(raw).digest("hex"), missing: [], kept: 0, inaccessible: 0 };
  for (const file of Object.keys(store.configs).sort()) {
    const presence = await configPresence(file);
    if (presence === "missing") plan.missing.push(file);
    else { plan.kept++; if (presence === "unknown") plan.inaccessible++; }
  }
  return plan;
}

/** Apply only the previewed removals, under the existing trust lock, after an exact backup. */
export async function pruneTrust(plan: TrustPrunePlan, trustPath = CONFIG_TRUST_PATH): Promise<{ removed: number; backup?: string }> {
  if (!plan.missing.length) return { removed: 0 };
  return withTrustStoreLock(trustPath, async () => {
    const { raw, store } = await readPruneStore(trustPath);
    if (createHash("sha256").update(raw).digest("hex") !== plan.sha256) throw new Error("trust-registry-changed");
    const missing: string[] = [];
    for (const file of plan.missing) if (Object.hasOwn(store.configs, file) && await configPresence(file) === "missing") missing.push(file);
    if (!missing.length) return { removed: 0 };
    const backup = `${trustPath}.${new Date().toISOString().replaceAll(/[:.]/g, "-")}.${randomUUID()}.bak`;
    await writeFile(backup, raw, { encoding: "utf8", flag: "wx", mode: 0o600 });
    for (const file of missing) delete store.configs[file];
    await writeTrustStore(trustPath, store);
    return { removed: missing.length, backup };
  });
}

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
  trustPath = CONFIG_TRUST_PATH,
  expectedSha256?: string
): Promise<void> {
  await withTrustStoreLock(trustPath, async () => {
    const [store, identity] = await Promise.all([
      readTrustStore(trustPath),
      getConfigIdentity(configPath)
    ]);
    if (expectedSha256 !== undefined && identity.sha256 !== expectedSha256) throw new Error("Configuration changed before approval");
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
