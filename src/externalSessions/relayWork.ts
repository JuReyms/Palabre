/** @file Contexte de travail Relay explicite : lien GitHub et participant déclarés, sans réseau ni autorité. */

/** Cible de suivi déclarée ; existence, accès et état ne sont jamais déduits de cette URL. */
export interface RelayGitHubRef {
  url: string;
  repository: string;
  kind: "repository" | "issue" | "pull-request";
  number?: number;
}

/** Métadonnées facultatives d'un travail ; ni identité authentifiée, ni autorisation de publication. */
export interface RelayWorkContext {
  github?: RelayGitHubRef;
  /** Nom public du destinataire pour ce travail, distinct de sa conversation et de son modèle. */
  participant?: string;
}

/**
 * Accepte uniquement un lien HTTPS github.com de dépôt, issue ou PR, sans identifiants, query,
 * fragment ou encodage de chemin. Validation locale seulement ; aucune découverte depuis Git.
 */
export function parseRelayGitHub(value: string): RelayGitHubRef | undefined {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100})(?:\/(issues|pull)\/([1-9]\d{0,9}))?\/?$/.exec(value);
  if (!match || match[0] !== value || match[2] === "." || match[2] === "..") return undefined;
  const repository = `${match[1]}/${match[2]}`;
  const number = match[4] === undefined ? undefined : Number(match[4]);
  const kind = match[3] === "issues" ? "issue" : match[3] === "pull" ? "pull-request" : "repository";
  return { url: `https://github.com/${repository}${match[3] ? `/${match[3]}/${number}` : ""}`, repository, kind,
    ...(number === undefined ? {} : { number }) };
}

/** Nom court sur une ligne ; refuse les contrôles et séparateurs invisibles, sans le normaliser. */
export function validRelayParticipant(value: string): boolean {
  return value.length > 0 && value === value.trim() && [...value].length <= 64 && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value);
}
