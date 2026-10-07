/**
 * @file Contrat d'un adapter de session externe et échange générique (voir AGENTS.md, section
 * "Relay externe").
 *
 * Un adapter fournisseur (Claude, Codex) connaît l'historique, le registre ou le verrou, les
 * arguments de reprise et le format de sortie de sa CLI. Il ne lance aucun processus lui-même :
 * `exchange` exécute l'éventuelle étape préalable de l'adapter (Codex : liste MCP) avec un
 * lanceur déjà lié à l'exécutable et au dossier de la cible, lance la reprise avec
 * `runExternalProcess`, puis délègue l'interprétation à l'adapter. Les issues et la délivrance
 * restent calculées par `outcome.ts`, identiques pour tous les fournisseurs.
 */
import { launchOutcome, refusalOutcome, type PreLaunchRefusal } from "./outcome.js";
import { runExternalProcess, type ExternalProcessResult } from "./process.js";
import type {
  CertainRefusal,
  DeliveryEvidence,
  ExchangeInterpretation,
  ExternalProvider,
  ExternalTarget,
  RelayOutcome,
  SessionRef,
  TargetProbe
} from "./types.js";

/**
 * Exécutable déjà résolu (lot A4). `prefixArgs` précède les arguments de l'adapter. Le relay ne
 * passe jamais par un shim PowerShell : avec Windows PowerShell 5.1, il refuse l'argument `-`,
 * retire les guillemets internes et remplace les caractères non ASCII de stdin par `?`.
 */
export interface ExternalExecutable {
  command: string;
  prefixArgs: readonly string[];
}

/**
 * Localisation de la session :
 * - `found` : historique trouvé et dossier de travail existant ;
 * - `session-not-found` : aucun historique exploitable (absent, illisible, incohérent ou ambigu) ;
 * - `invalid-working-directory` : historique trouvé, mais dossier absent ou non renseigné.
 *   Aucun repli vers le dossier courant.
 */
export type LocateResult =
  | { status: "found"; target: ExternalTarget; historyPath: string; evidence: string[] }
  | { status: "session-not-found" | "invalid-working-directory"; detail: string };

/** Lecture de la sortie d'une CLI par son adapter. */
export interface ProviderVerdict {
  interpretation: ExchangeInterpretation;
  /** Refus documenté de la CLI, observé sans écriture dans l'historique. */
  certainRefusal?: CertainRefusal;
  /** Diagnostic de quota ou de limite d'usage reconnu dans la sortie. */
  usageLimit: boolean;
}

/**
 * Lanceur fourni à l'étape préalable : même exécutable, dossier de la cible, environnement
 * nettoyé, annulation partagée. Seuls les arguments et les bornes changent.
 */
export type PreparationRunner = (
  args: readonly string[],
  limits: { timeoutMs: number; maxOutputBytes: number }
) => Promise<ExternalProcessResult>;

/**
 * Issue de l'étape préalable : arguments à insérer dans la reprise, ou refus avant lancement.
 * Un refus empêche toute reprise : la délivrance est `not-delivered`.
 */
export type PreparationResult =
  | { status: "ready"; args: string[]; evidence: string[] }
  | { status: "refused"; refusal: PreLaunchRefusal; detail: string };

/** Contrat commun des adapters de session externe. */
export interface ExternalSessionAdapter {
  readonly provider: ExternalProvider;
  /** Retrouve l'historique de la session et son dossier de travail. */
  locate(ref: SessionRef): LocateResult;
  /** Sonde l'attachement de la cible ; seul `attachment` fonde la décision (`assessTarget`). */
  probe(target: ExternalTarget): TargetProbe;
  /** Étape préalable facultative, exécutée par `exchange` avant toute reprise. */
  prepare?(target: ExternalTarget, run: PreparationRunner): Promise<PreparationResult>;
  /**
   * Arguments complets de la reprise, hors exécutable ; jamais ceux de l'agent de débat.
   * `preparation` contient les arguments rendus par `prepare` (vide sans étape préalable).
   */
  resumeArgs(target: ExternalTarget, preparation: readonly string[]): string[];
  /** Interprète la sortie d'une CLI effectivement lancée. */
  interpret(run: ExternalProcessResult, target: ExternalTarget): ProviderVerdict;
  /** Cherche le nonce dans l'historique de la cible ; ne lève jamais. */
  findNonce(target: ExternalTarget, nonce: string): DeliveryEvidence;
}

/**
 * Résultat d'un échange :
 * - `refusal` : l'étape préalable a refusé, aucune reprise n'a été lancée ;
 * - sinon `process`, et `verdict` si la reprise a réellement démarré.
 */
export type ExchangeResult =
  | { refusal: PreLaunchRefusal; detail: string; preparation?: undefined; process?: undefined; verdict?: undefined }
  | { refusal?: undefined; preparation: string[]; process: ExternalProcessResult; verdict?: ProviderVerdict };

/** Bornes de l'étape préalable : une liste de configuration, jamais un tour de conversation. */
export const PREPARATION_LIMITS = { timeoutMs: 60_000, maxOutputBytes: 1024 * 1024 } as const;

/**
 * Exécute l'éventuelle étape préalable, puis la reprise : exécutable résolu, arguments de
 * l'adapter, dossier de la cible, enveloppe sur stdin. Ne relance jamais, et ne lève jamais
 * (les échecs sont dans le résultat).
 */
export async function exchange(
  adapter: ExternalSessionAdapter,
  executable: ExternalExecutable,
  target: ExternalTarget,
  envelope: string,
  options: { timeoutMs: number; maxOutputBytes?: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv }
): Promise<ExchangeResult> {
  const launch = (args: readonly string[], stdin: string, limits: { timeoutMs: number; maxOutputBytes?: number }) =>
    runExternalProcess({
      command: executable.command,
      args: [...executable.prefixArgs, ...args],
      cwd: target.cwd,
      stdin,
      timeoutMs: limits.timeoutMs,
      maxOutputBytes: limits.maxOutputBytes,
      signal: options.signal,
      env: options.env
    });

  let preparation: string[] = [];
  if (adapter.prepare) {
    const prepared = await adapter.prepare(target, (args, limits) => launch(args, "", limits));
    if (prepared.status === "refused") return { refusal: prepared.refusal, detail: prepared.detail };
    preparation = prepared.args;
  }
  const run = await launch(adapter.resumeArgs(target, preparation), envelope, options);
  return run.started
    ? { preparation, process: run, verdict: adapter.interpret(run, target) }
    : { preparation, process: run };
}

/**
 * Issue d'un échange et indicateur de lancement de la reprise, pour `classifyDelivery`. Un refus
 * de l'étape préalable n'a lancé aucune reprise : `launched` est faux.
 */
export function exchangeOutcome(result: ExchangeResult): { outcome: RelayOutcome; launched: boolean } {
  if (result.refusal) return { outcome: refusalOutcome(result.refusal), launched: false };
  return {
    outcome: launchOutcome({
      process: result.process,
      interpretation: result.verdict?.interpretation,
      certainRefusal: result.verdict?.certainRefusal,
      usageLimit: result.verdict?.usageLimit
    }),
    launched: result.process.started
  };
}
