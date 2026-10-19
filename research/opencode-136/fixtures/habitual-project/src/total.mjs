/** Implémentation volontairement erronée pour l'avis de laboratoire #136. */
export function total(unitPrice, quantity, discountPercent = 0) {
  return unitPrice * quantity - discountPercent;
}
