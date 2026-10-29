/** @file Résolution du mode Relay : priorité explicite, exclusions, préférence, puis verrou. */
import type { ExternalProvider, TargetProbe } from "./types.js";

/** Préférence de l'opérateur ; auto privilégie la conversation ouverte, sans changer ses droits. */
export type RelayView = "auto" | "background";
/** Sans choix enregistré, limiter le parcours à l'arrière-plan ; aucune migration de fichier. */
export const DEFAULT_RELAY_VIEW: RelayView = "background";
/** Origine JSON v1 : default sans préférence ; setting réservé à background enregistré. */
export type RelayModeSource = "explicit" | "auto" | "setting" | "default";
/** Entrées de sélection communes à la préparation de la sonde et à la décision finale. */
export interface RelayViewInput {
  open: boolean;
  background: boolean;
  excluded: boolean;
  provider: ExternalProvider;
  view?: RelayView;
}
/** Seul le choix enregistré auto d'une reprise Codex ordinaire exige une sonde de sélection. */
export function shouldProbeRelayView(input: RelayViewInput): boolean {
  return !input.open && !input.background && !input.excluded && input.provider === "codex"
    && (input.view ?? DEFAULT_RELAY_VIEW) === "auto";
}
/** Décision sans effet de bord ; une sonde inconnue n'autorise aucun transport. */
export interface RelayViewDecision {
  mode: "open" | "background";
  modeSource: RelayModeSource;
  refusal?: "target-state-unknown";
}

/**
 * Ne sonde que les reprises Codex ordinaires en auto. Les transports revérifient ensuite le
 * verrou ; un changement d'état refuse l'envoi, sans basculement ni retry plus permissif.
 * Les conflits d'options explicites sont rejetés par la commande avant cette résolution.
 */
export function resolveRelayView(input: RelayViewInput, probe: () => TargetProbe): RelayViewDecision {
  if (input.open) return { mode: "open", modeSource: "explicit" };
  if (input.background) return { mode: "background", modeSource: "explicit" };
  if (input.excluded || input.provider !== "codex") return { mode: "background", modeSource: "auto" };
  if (!shouldProbeRelayView(input)) return { mode: "background", modeSource: input.view === undefined ? "default" : "setting" };
  const attachment = probe().attachment;
  return {
    mode: attachment === "attached" ? "open" : "background",
    modeSource: "auto",
    ...(attachment === "unknown" ? { refusal: "target-state-unknown" as const } : {})
  };
}
