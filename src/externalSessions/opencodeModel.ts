/** @file Sélection explicite sur copie OpenCode 2.0.32, sans modèle de remplacement ni IO. */
import { isDeepStrictEqual as same } from "node:util";
import { CopyFailure, copyObject, type OpenCodeSnapshot } from "./opencodeCopy.js";

/** Référence exacte envoyée à OpenCode ; default est explicite, jamais hérité d'un autre modèle. */
export interface CopyModelRef { providerID: string; id: string; variant: string }

/** Parse provider/model[#variant] ; pas d'alias, d'espaces, de contrôle ou de variante implicite héritée. */
export function parseCopyModel(value: string): CopyModelRef {
  if (value.length > 512 || /[\s\u0000-\u001f\u007f-\u009f]/u.test(value)) throw new CopyFailure("invalid-request", "model-reference");
  const match = /^([^/#]+)\/([^#]+?)(?:#([^#]+))?$/.exec(value);
  if (!match || match[0] !== value) throw new CopyFailure("invalid-request", "model-reference");
  return { providerID: match[1]!, id: match[2]!, variant: match[3] ?? "default" };
}

/** Le catalogue est une annonce locale, pas une preuve d'authentification, de quota ou de génération. */
export function validateCopyModelCatalogue(value: unknown, requested: CopyModelRef): void {
  if (!Array.isArray(value) || !value.every(copyObject)) throw new CopyFailure("no-valid-reply", "model-catalogue-schema");
  const candidates = value.filter(m => m.providerID === requested.providerID && m.id === requested.id);
  if (!candidates.length) throw new CopyFailure("invalid-request", "model-unavailable");
  if (candidates.length !== 1) throw new CopyFailure("no-valid-reply", "model-catalogue-schema");
  const candidate = candidates[0]!;
  if (typeof candidate.enabled !== "boolean" || !Array.isArray(candidate.variants)
    || !candidate.variants.every(v => copyObject(v) && typeof v.id === "string" && !!v.id))
    throw new CopyFailure("no-valid-reply", "model-catalogue-schema");
  if (!candidate.enabled || (requested.variant !== "default"
    && !candidate.variants.some(v => v.id === requested.variant))) throw new CopyFailure("invalid-request", "model-unavailable");
}

/** OpenCode considère absence et default équivalents ; aucune autre normalisation d'identité. */
function equivalent(value: unknown, requested: CopyModelRef): boolean {
  return copyObject(value) && value.providerID === requested.providerID && value.id === requested.id
    && (value.variant === undefined || typeof value.variant === "string")
    && (value.variant ?? "default") === requested.variant
    && Object.keys(value).every(key => ["providerID", "id", "variant"].includes(key));
}

/**
 * Autorise seulement le delta model-switched attendu après le POST unique sur la copie.
 * Le préfixe complet et les garde-fous restent identiques. Un choix équivalent est un no-op.
 * L'état ainsi vérifié devient la référence du tour, jamais la source.
 */
export function validateCopyModelSelection(before: OpenCodeSnapshot, after: OpenCodeSnapshot, requested: CopyModelRef): void {
  if (after.info.id !== before.info.id) throw new CopyFailure("identity-mismatch", "model-selection-identity");
  if (!equivalent(after.info.model, requested)) throw new CopyFailure("no-valid-reply", "model-selection-unverified");
  for (const key of ["fork", "agent", "permissions", "location", "outcome"]) {
    if (!same(before.info[key], after.info[key])) throw new CopyFailure("no-valid-reply", "model-selection-unverified");
  }
  if (!same(before.instructions, after.instructions) || after.inbox.length
    || !same(after.context.slice(0, before.context.length), before.context))
    throw new CopyFailure("no-valid-reply", "model-selection-unverified");
  const fresh = after.context.slice(before.context.length);
  if (equivalent(before.info.model, requested)) {
    if (fresh.length || !same(before.info.model, after.info.model)) throw new CopyFailure("no-valid-reply", "model-selection-unverified");
    return;
  }
  const event = fresh[0];
  if (!same(after.info.model, requested) || fresh.length !== 1 || !event || event.type !== "model-switched"
    || !same(event.model, requested) || !same(event.previous, before.info.model)
    || typeof event.id !== "string" || !event.id.trim() || before.context.some(m => m.id === event.id)
    || !copyObject(event.time) || !Number.isSafeInteger(event.time.created) || (event.time.created as number) < 0
    || Object.keys(event.time).some(key => key !== "created")
    || Object.keys(event).some(key => !["id", "type", "time", "metadata", "model", "previous"].includes(key)))
    throw new CopyFailure("no-valid-reply", "model-selection-unverified");
}
