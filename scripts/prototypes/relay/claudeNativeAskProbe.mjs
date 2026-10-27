/** Lanceur MANUEL du second contrôle, hors produit. --help et arguments invalides sans SDK.
 * Préparer n'autorise pas --run : accord humain distinct sur message, destinataire et envoi possible.
 */
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { readFileSync, statSync, openSync, writeFileSync, closeSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log("Second contrôle natif MANUEL, non qualifié. Le callback refuse toujours mais une règle ignorée pourrait laisser partir le message.\nUsage après pnpm build:test : node scripts/prototypes/relay/claudeNativeAskProbe.mjs --run <SDK-absolu> <claude.exe-absolu> <plan-second-absolu.json> <trace-nouvelle-absolue.json>\nAccord humain distinct requis : conversation jetable, dossier, destinataire, nouveau texte bénin exact, Opus5.5 et possibilité de livraison. Un accord de quota ne suffit pas. Aucun retry, aucune ouverture ou fermeture Desktop. --run et le plan ne prouvent pas cet accord.");
} else if (args.length !== 5 || args[0] !== "--run" || args.slice(1).some(path => !isAbsolute(path))) {
  console.error("Arguments refusés. Utiliser --help ; aucun lancement ni installation implicite.");
  process.exitCode = 2;
} else {
  // Les tests n'exécutent jamais ce chemin avec des arguments valides.
  const [, sdkDirectory, executable, planFile, evidencePath] = args;
  const { parseNativeAskRunPlan, runNativeAskProbe } = await import("../../../.tmp/test-dist/scripts/prototypes/relay/claudeNativeAskRunner.js");
  if (process.platform !== "win32" || !/\.exe$/i.test(executable) || !statSync(executable).isFile()) throw new Error("Windows et CLI native .exe explicite requis");
  if (!statSync(planFile).isFile() || statSync(planFile).size > 16_384) throw new Error("Plan privé invalide ou trop grand");
  const plan = parseNativeAskRunPlan(JSON.parse(readFileSync(planFile, "utf8")));
  if (!statSync(plan.target.directory).isDirectory()) throw new Error("Dossier de la conversation jetable introuvable");
  const requireSdk = createRequire(join(sdkDirectory, "package.json"));
  const sdkEntry = requireSdk.resolve("@anthropic-ai/claude-agent-sdk");
  if (JSON.parse(readFileSync(join(dirname(sdkEntry), "package.json"), "utf8")).version !== "0.3.302") throw new Error("SDK0.3.302 requis ; aucun repli ni installation");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|TEMP|TMP|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|USERNAME)$/i.test(key)));
  if (execFileSync(executable, ["--version"], { env, encoding: "utf8", timeout: 3000, maxBuffer: 32_768, windowsHide: true }).trim() !== "2.1.302 (Claude Code)") {
    throw new Error("CLI2.1.302 requise ; aucune autre installation choisie");
  }
  // Création exclusive avant chargement runtime/query. Ne jamais supprimer, remplacer ou renommer pour rejouer.
  const evidence = openSync(evidencePath, "wx", 0o600), abortController = new AbortController();
  let report = { kind: "native-ask-deny-probe", error: { kind: "setup-incomplete" }, passed: false, delivery: "unverified" };
  const onInterrupt = () => abortController.abort();
  process.once("SIGINT", onInterrupt);
  try {
    const cwd = mkdtempSync(join(sdkDirectory, "native-ask-project-")); // Conservé, jamais le dossier destinataire.
    const { query } = await import(pathToFileURL(sdkEntry).href);
    report = { ...await runNativeAskProbe({ sessionId: randomUUID(), plan, directory: cwd,
      executable, env, abortController, query }), messengerDirectory: cwd };
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    try { writeFileSync(evidence, JSON.stringify(report, null, 2)); } finally { closeSync(evidence); }
    // Pas de contenu, identifiant, chemin ou compte sur stdout ; aucune qualification automatique.
    console.log(JSON.stringify({ kind: report.kind, initializationVerified: report.initializationVerified ?? false,
      promptReleased: report.promptReleased ?? false, inventoryValidated: report.inventoryValidated ?? false,
      hookCalls: report.probe?.capture.hookCalls ?? 0, permissionCalls: report.probe?.capture.permissionCalls ?? 0,
      correlatedCallbackDenial: report.correlatedCallbackDenial ?? false, possibleSend: report.possibleSend ?? "unknown",
      attention: report.attention ?? "setup-incomplete", closeRequested: report.closeRequested ?? false,
      passed: false, delivery: "unverified", truncated: report.truncated ?? false,
      outerTimedOut: report.outerTimedOut ?? false, error: report.error?.kind ?? null }));
    process.exitCode = 1;
  }
}
