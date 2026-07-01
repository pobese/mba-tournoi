/**
 * Nom affiché d'un membre — JAMAIS son email (confidentialité : ces listes sont
 * visibles par d'autres membres).
 *   1. full_name / display_name / name du compte (métadonnées d'inscription)
 *   2. À défaut, une simple initiale — on ne dérive jamais un nom lisible depuis l'email.
 */
export function deriveDisplayName(
  meta: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string {
  const metaName = [meta?.full_name, meta?.display_name, meta?.name].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )
  if (metaName) return metaName.trim()

  // Aucun nom renseigné : on n'expose pas l'email → au pire une initiale neutre.
  const initial = (email ?? '').trim().charAt(0).toUpperCase()
  return initial || '?'
}
