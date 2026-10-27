/**
 * @file Décisions du smoke réel de `palabre relay` (`smoke_real_relay.ts`), isolées pour être
 * testées hors ligne : arguments des appels, précondition du scénario de refus, verdicts.
 *
 * Le smoke vérifie le transport arrière-plan. Ses appels imposent donc `--background` : depuis la
 * préférence `relay.view: auto` (#190), une conversation Codex attachée serait sinon jointe en mode
 * ouvert, et le scénario de refus déposerait le message qu'il doit voir refusé. Le scénario de refus
 * n'envoie rien tant que l'attachement de la cible n'est pas établi par la sonde. Aucun effet de bord
 * ici, sauf la lecture des historiques jetables par `historyFootprint`.
 */
import { readFileSync } from "node:fs";

/** Arguments d'un appel du smoke : arrière-plan explicite, config temporaire approuvée, JSON. */
export function smokeRelayArgs(input: { from: string; to: string; message: string; configPath: string }): string[] {
  return ["relay", "--background", "--from", input.from, "--to", input.to, input.message, "--json",
    "--config", input.configPath, "--trust-config", "--timeout", "600"];
}

/** État d'attachement rendu par la sonde d'un adapter (`TargetProbe.attachment`). */
export interface ProbeLike {
  attachment?: string;
  activity?: string;
  evidence?: readonly string[];
}

/**
 * Envoyer le message du scénario de refus seulement si, juste avant l'appel, la cible est attachée,
 * le pseudo-terminal qui la tient n'est pas terminé et l'historique a été mesuré sur au moins un
 * fichier. La sonde doit être **refaite au plus près de l'appel** : une sonde ancienne laisserait
 * passer un TUI fermé entre-temps, et `--background` reprendrait alors la conversation. Cela réduit
 * la course sans rendre sonde et appel atomiques.
 */
export function refusalPrecondition(probe: ProbeLike | undefined, context: { ptyExited?: boolean; history?: HistoryFootprint } = {}): { send: true } | { send: false; reason: string } {
  const refuse = (cause: string) => ({ send: false as const, reason: `${cause} : aucun message envoyé` });
  if (probe?.attachment !== "attached") return refuse(`attachement non établi (${probe?.attachment ?? "sonde absente"})`);
  if (context.ptyExited) return refuse("TUI terminé avant l'appel");
  if (context.history && context.history.files === 0) return refuse("historique introuvable");
  return { send: true };
}

/** Empreinte d'un historique : nombre de fichiers et de lignes non vides, tous fichiers confondus. */
export interface HistoryFootprint {
  files: number;
  lines: number;
}

/**
 * Empreinte de tous les fichiers d'une conversation. Pour Codex, passer la racine et ses segments
 * (`findCodexHistoryFiles`) : un nouveau segment change le nombre de fichiers même si l'ancien
 * fichier reste identique. Un fichier illisible fait échouer la mesure.
 */
export function historyFootprint(files: readonly string[]): HistoryFootprint {
  let lines = 0;
  for (const file of files) lines += readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).length;
  return { files: files.length, lines };
}

/** Une vérification du smoke : nom, réussite et détail sans identifiant. */
export interface SmokeCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** Résultat d'un appel `palabre relay --json` : code de sortie et objet JSON v1 éventuel. */
export interface RelayCall {
  code: number | null;
  json?: { status?: string; mode?: string; modeSource?: string; delivery?: { status?: string } };
}

/**
 * Verdicts du scénario « conversation attachée ». Sans envoi (précondition non remplie), le refus
 * et l'historique échouent explicitement : un scénario non joué n'est jamais un succès. Un refus
 * exige `target-busy`, code 3, `not-delivered`, mode arrière-plan explicite ; l'historique, au moins
 * un fichier mesuré, puis le même nombre de fichiers et de lignes avant et après. Une mesure vide
 * n'est jamais un historique inchangé. `reason` explique un scénario non joué.
 */
export function refusalChecks(label: string, input: {
  probe: ProbeLike | undefined;
  call?: RelayCall;
  before?: HistoryFootprint;
  after?: HistoryFootprint;
  reason?: string;
}): SmokeCheck[] {
  const { probe, call, before, after } = input;
  const checks: SmokeCheck[] = [{
    name: `${label} attaché : sonde`,
    ok: probe?.attachment === "attached",
    detail: `attachement ${probe?.attachment ?? "?"}, activité ${probe?.activity ?? "?"} ; ${(probe?.evidence ?? []).join(" | ")}`
  }];
  if (!call) {
    const decision = refusalPrecondition(probe);
    const detail = input.reason ?? (decision.send ? "appel non lancé" : decision.reason);
    checks.push({ name: `${label} attaché : refus`, ok: false, detail });
    checks.push({ name: `${label} attaché : historique inchangé`, ok: false, detail: "non mesuré : scénario non joué" });
    return checks;
  }
  const json = call.json;
  checks.push({
    name: `${label} attaché : refus`,
    ok: call.code === 3 && json?.status === "target-busy" && json.delivery?.status === "not-delivered"
      && json.mode === "background" && json.modeSource === "explicit",
    detail: `code ${call.code}, statut ${json?.status}, délivrance ${json?.delivery?.status}, mode ${json?.mode} (${json?.modeSource})`
  });
  const same = before !== undefined && after !== undefined && before.files > 0 && before.files === after.files && before.lines === after.lines;
  checks.push({
    name: `${label} attaché : historique inchangé`,
    ok: same,
    detail: before && after ? `${before.files} fichier(s), ${before.lines} → ${after.files} fichier(s), ${after.lines} entrée(s)` : "mesure incomplète"
  });
  return checks;
}
