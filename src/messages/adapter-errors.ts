/** @file Diagnostics localisés des adapters et prochaines actions pour l'utilisateur. */
import type { AdapterFailureKind, Language } from "../types.js";

/** Contrat FR/EN des diagnostics d'adapter et de leurs actions correctives. */
export interface AdapterErrorMessages {
  suggestionPrefix: string;
  hint(kind: AdapterFailureKind): string | undefined;
  /** Message `usage-limit` : quota/rate-limit détecté dans le stderr d'une CLI. */
  usageLimit(adapterName: string, detail: string): string;
  /** Message `unsupported-model` : modèle refusé par la CLI de l'agent. */
  unsupportedModel(adapterName: string, detail: string): string;
  /** OpenCode 2 refuse l'ancien argument `--pure` : migration exacte ou retrait manuel, sans neutralisation promise. */
  openCodePureRemoved(adapterName: string): string;
  /** JSON Antigravity inconnu, erroné ou sans réponse : aucun repli texte. */
  invalidAntigravityJson(adapterName: string): string;
  /**
   * Échéance d'un appel : attente arrêtée, arrêt local confirmé ou non, travail distant inconnu,
   * aucun renvoi ; commande de lecture sûre quand une référence exacte existe.
   */
  waitTimeout(adapterName: string, timeoutMs: number, localExit: "confirmed" | "unconfirmed", recoverable: boolean, command?: string): string;
  /** Sortie `opencode run --format json` non reconnue : aucun repli texte. */
  invalidOpenCodeJson(adapterName: string): string;
  /** Format configuré inconnu : refus avant tout lancement. */
  invalidResponseFormat(adapterName: string): string;
  /** Refus de transmettre un prompt non fiable via un wrapper shell Windows. */
  unsafeWindowsShellPrompt(adapterName: string): string;
  /** Refus d'un identifiant de modèle contenant des métacaractères de shell Windows. */
  unsafeWindowsShellModel(adapterName: string): string;
  /** Réponse Ollama dépassant le budget mémoire configuré. */
  ollamaOutputTooLarge(adapterName: string, maxBytes: number): string;
  /** Repli du résumé d'erreur CLI quand le process n'a rien écrit sur stderr. */
  noStderrCaptured: string;
  /** Diagnostic borné issu de stdout quand un exit non nul n'a produit aucun stderr. */
  stdoutDiagnostic(detail: string): string;
  /** Repli du résumé d'erreur PTY quand le flux fusionné est vide. */
  noPtyOutputCaptured: string;
  /** Message `model-unavailable` : modèle Ollama absent et pull non autorisé. */
  ollamaModelUnavailable(model: string, installedModels: string[]): string;
  /** Message `model-pull-failed` : le modèle manque toujours après un pull réussi. */
  ollamaModelStillUnavailable(model: string): string;
  /** Ligne de progression écrite sur stderr avant un pull automatique. */
  ollamaPullProgress(model: string): string;
  /** Message `model-pull-failed` : le pull lui-même a échoué. */
  ollamaPullFailed(model: string, detail: string): string;
  /** Message `http-error` sur `GET /api/tags`. */
  ollamaTagsHttpError(status: number): string;
  /** Message `http-error` sur `GET /api/ps`. */
  ollamaPsHttpError(status: number): string;
  /** Message `http-error` quand le déchargement d'un modèle tiers échoue. */
  ollamaUnloadFailed(model: string, status: number): string;
}

/** Durée lisible : secondes sous deux minutes, minutes au-delà. */
const frDuration = (ms: number) => ms < 120_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;
const enDuration = (ms: number) => ms < 120_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;

const frHints: Partial<Record<AdapterFailureKind, string>> = {
  "command-not-found": "Verifie que la CLI est installee, authentifiee et disponible dans le PATH.",
  "spawn-failed": "Sur Windows, préfère un exécutable natif. Réserve \"shell\": true aux wrappers qui lisent le prompt sur stdin.",
  timeout: "Ne renvoie pas la demande sans vérifier : la réponse peut encore arriver chez l'outil. Augmente timeoutMs si cet outil répond souvent lentement, ou teste la commande dans le terminal.",
  "idle-timeout": "Desactive idleTimeoutMs pour les CLIs IA qui restent silencieuses pendant la generation.",
  "output-too-large": "Reduis le contexte, le nombre de tours ou configure maxOutputBytes pour cet agent si ce volume est attendu.",
  "empty-output": "Teste la commande en dehors de Palabre et verifie que le prompt est bien lu via stdin ou argument.",
  "usage-limit": "Attends la fenetre indiquee par la CLI, change de modele ou relance avec un autre agent/preset disponible.",
  "non-zero-exit": "Teste la commande directement, puis ajuste args, permissions, modele ou authentification de la CLI.",
  "model-unavailable": "Installe le modele Ollama ou relance avec --pull-models pour autoriser le telechargement.",
  "unsupported-model": "Mets a jour la CLI de l'agent, verifie le nom du modele et ton abonnement, ou retire --model-a/--model-b/--summary-model pour laisser la CLI utiliser son modele par defaut.",
  "model-pull-failed": "Verifie le nom du modele, ta connexion et l'espace disque disponible.",
  "http-error": "Verifie que le service local est lance et que baseUrl est correct."
};

const enHints: Partial<Record<AdapterFailureKind, string>> = {
  "command-not-found": "Check that the CLI is installed, authenticated, and available in PATH.",
  "spawn-failed": "On Windows, prefer a native executable. Use \"shell\": true only for wrappers that read the prompt from stdin.",
  timeout: "Do not resend the request without checking: the reply may still arrive in the tool. Increase timeoutMs if this tool often replies slowly, or test the command in the terminal.",
  "idle-timeout": "Disable idleTimeoutMs for AI CLIs that stay silent while generating.",
  "output-too-large": "Reduce context, turn count, or configure maxOutputBytes for this agent if this volume is expected.",
  "empty-output": "Test the command outside Palabre and check that the prompt is read through stdin or an argument.",
  "usage-limit": "Wait for the window indicated by the CLI, change model, or run again with another available agent/preset.",
  "non-zero-exit": "Test the command directly, then adjust args, permissions, model, or CLI authentication.",
  "model-unavailable": "Install the Ollama model or run again with --pull-models to allow downloading.",
  "unsupported-model": "Update the agent CLI, check the model name and your subscription, or remove --model-a/--model-b/--summary-model so the CLI can use its default model.",
  "model-pull-failed": "Check the model name, your connection, and available disk space.",
  "http-error": "Check that the local service is running and baseUrl is correct."
};

export const adapterErrorMessages: Record<Language, AdapterErrorMessages> = {
  fr: {
    waitTimeout: (name, timeoutMs, localExit, recoverable, command) =>
      `${name} n'a pas répondu dans le délai prévu (${frDuration(timeoutMs)}). Palabre a cessé d'attendre et a demandé l'arrêt du programme local (${localExit === "confirmed" ? "arrêt local confirmé" : "arrêt local non confirmé"}). Palabre ne sait pas si le travail continue chez l'outil ; rien n'a été renvoyé, et ce délai ne prouve pas un échec du modèle.`
      + (command ? ` Pour lire plus tard la réponse de cette demande précise, sans la renvoyer : ${command}`
        : recoverable ? " Aucune référence de lecture sûre n'est disponible : la réponse ne peut pas être retrouvée automatiquement ; vérifiez dans l'outil avant tout nouvel envoi." : ""),
    invalidOpenCodeJson: (name) => `${name} : sortie JSON OpenCode non reconnue (attendu : opencode run --format json, version qualifiée 2.0.32). Aucun repli texte ; rien n'a été renvoyé.`,
    invalidAntigravityJson: (name) => `${name} : réponse JSON Antigravity invalide, en erreur ou vide. Vérifie la version avec agy --help et les arguments --output-format json --print ; seul un objet avec status SUCCESS et response non vide est accepté. Aucun repli texte ou PTY.`,
    invalidResponseFormat: (name) => `${name} : responseFormat invalide pour cet adapter. Configure "text" ou "antigravity-json" avec "type": "cli", ou retire responseFormat pour conserver ton transport.`,
    suggestionPrefix: "Suggestion",
    hint: (kind) => frHints[kind],
    usageLimit: (adapterName, detail) => `${adapterName} a atteint une limite d'utilisation: ${detail}`,
    unsupportedModel: (adapterName, detail) => `${adapterName} ne peut pas utiliser ce modèle: ${detail}`,
    openCodePureRemoved: (adapterName) =>
      `${adapterName} : OpenCode 2 n'accepte plus l'option --pure. Retire-la toi-même des arguments ("args") personnalisés de cet agent dans ta configuration : Palabre ne modifie jamais des arguments personnalisés (seul l'ancien défaut exact ["run", "--pure"] est remplacé automatiquement par ["run"]). OpenCode garde alors son environnement habituel : ses plugins, serveurs MCP et permissions configurés restent actifs.`,
    unsafeWindowsShellPrompt: (adapterName) =>
      `${adapterName} ne peut pas transmettre un prompt en sécurité via ce wrapper shell Windows. Configure un exécutable natif, un shim PowerShell .ps1 ou, si la CLI le supporte, promptMode "stdin".`,
    unsafeWindowsShellModel: (adapterName) =>
      `${adapterName} ne peut pas transmettre cet identifiant de modèle en sécurité via un wrapper shell Windows.`,
    ollamaOutputTooLarge: (adapterName, maxBytes) =>
      `${adapterName} a reçu plus de ${maxBytes} octets depuis Ollama.`,
    noStderrCaptured: "aucun stderr capturé.",
    stdoutDiagnostic: (detail) => `stderr vide ; diagnostic stdout : ${detail}`,
    noPtyOutputCaptured: "aucune sortie PTY capturée.",
    ollamaModelUnavailable: (model, installedModels) =>
      `Modèle Ollama indisponible: ${model}. Modèles détectés: ${installedModels.join(", ") || "aucun"}. ` +
      "Utilise --pull-models ou autoPullModel: true pour autoriser le téléchargement.",
    ollamaModelStillUnavailable: (model) => `Le modèle Ollama ${model} reste indisponible après téléchargement.`,
    ollamaPullProgress: (model) => `[ollama] Modèle absent, téléchargement: ${model}`,
    ollamaPullFailed: (model, detail) => `Échec du téléchargement Ollama ${model}: ${detail}`,
    ollamaTagsHttpError: (status) => `Ollama HTTP ${status} pendant la détection des modèles`,
    ollamaPsHttpError: (status) => `Ollama HTTP ${status} pendant la détection des modèles chargés`,
    ollamaUnloadFailed: (model, status) => `Impossible de décharger le modèle Ollama ${model}: HTTP ${status}`
  },
  en: {
    waitTimeout: (name, timeoutMs, localExit, recoverable, command) =>
      `${name} did not reply within the planned time (${enDuration(timeoutMs)}). Palabre stopped waiting and requested that the local program stop (${localExit === "confirmed" ? "local stop confirmed" : "local stop not confirmed"}). Palabre does not know whether the work continues in the tool; nothing was resent, and this delay does not prove the model failed.`
      + (command ? ` To read this exact request's reply later, without resending it: ${command}`
        : recoverable ? " No safe reading reference is available: the reply cannot be found automatically; check in the tool before any new send." : ""),
    invalidOpenCodeJson: (name) => `${name}: unrecognized OpenCode JSON output (expected: opencode run --format json, qualified version 2.0.32). No text fallback; nothing was resent.`,
    invalidAntigravityJson: (name) => `${name}: invalid, failed or empty Antigravity JSON response. Check the version with agy --help and the --output-format json --print arguments; only an object with status SUCCESS and a nonempty response is accepted. No text or PTY fallback.`,
    invalidResponseFormat: (name) => `${name}: invalid responseFormat for this adapter. Configure "text" or "antigravity-json" with "type": "cli", or remove responseFormat to keep your transport.`,
    suggestionPrefix: "Suggestion",
    hint: (kind) => enHints[kind],
    usageLimit: (adapterName, detail) => `${adapterName} hit a usage limit: ${detail}`,
    unsupportedModel: (adapterName, detail) => `${adapterName} cannot use this model: ${detail}`,
    openCodePureRemoved: (adapterName) =>
      `${adapterName}: OpenCode 2 no longer accepts the --pure option. Remove it yourself from this agent's custom arguments ("args") in your configuration: Palabre never changes custom arguments (only the exact old default ["run", "--pure"] is replaced automatically with ["run"]). OpenCode then keeps its usual environment: its configured plugins, MCP servers and permissions stay active.`,
    unsafeWindowsShellPrompt: (adapterName) =>
      `${adapterName} cannot safely pass a prompt through this Windows shell wrapper. Configure a native executable, a PowerShell .ps1 shim, or promptMode "stdin" if the CLI supports it.`,
    unsafeWindowsShellModel: (adapterName) =>
      `${adapterName} cannot safely pass this model identifier through a Windows shell wrapper.`,
    ollamaOutputTooLarge: (adapterName, maxBytes) =>
      `${adapterName} received more than ${maxBytes} bytes from Ollama.`,
    noStderrCaptured: "no stderr captured.",
    stdoutDiagnostic: (detail) => `stderr was empty; stdout diagnostic: ${detail}`,
    noPtyOutputCaptured: "no PTY output captured.",
    ollamaModelUnavailable: (model, installedModels) =>
      `Ollama model unavailable: ${model}. Detected models: ${installedModels.join(", ") || "none"}. ` +
      "Use --pull-models or autoPullModel: true to allow downloading.",
    ollamaModelStillUnavailable: (model) => `Ollama model ${model} is still unavailable after downloading.`,
    ollamaPullProgress: (model) => `[ollama] Model missing, downloading: ${model}`,
    ollamaPullFailed: (model, detail) => `Ollama download failed for ${model}: ${detail}`,
    ollamaTagsHttpError: (status) => `Ollama HTTP ${status} while detecting models`,
    ollamaPsHttpError: (status) => `Ollama HTTP ${status} while detecting loaded models`,
    ollamaUnloadFailed: (model, status) => `Failed to unload Ollama model ${model}: HTTP ${status}`
  }
};
