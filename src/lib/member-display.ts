import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Nom affiché d'un membre — JAMAIS son email (confidentialité : ces listes sont
 * visibles par d'autres membres). Priorité :
 *   1. full_name / display_name / name du compte (métadonnées d'inscription)
 *   2. nom d'un profil joueur lié (même email)
 *   3. partie locale de l'email (avant @), sans jamais exposer le domaine
 */
export function deriveDisplayName(
  meta: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
  playerName: string | null | undefined,
): string {
  const metaName = [meta?.full_name, meta?.display_name, meta?.name].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )
  if (metaName) return metaName.trim()
  if (playerName && playerName.trim()) return playerName.trim()
  const local = (email ?? '').split('@')[0]?.trim()
  if (local) return local.charAt(0).toUpperCase() + local.slice(1)
  return 'Membre'
}

/**
 * Map email → nom de profil joueur (players.email = email du compte), en une seule
 * requête. Sert de repli pour deriveDisplayName. Nécessite un client service-role.
 */
export async function playerNamesByEmail(
  admin: SupabaseClient,
  emails: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(emails.filter((e): e is string => Boolean(e)))]
  if (!unique.length) return map

  const { data } = await admin
    .from('players')
    .select('name, email')
    .in('email', unique) as { data: { name: string; email: string | null }[] | null }
  for (const p of data ?? []) {
    if (p.email && !map.has(p.email)) map.set(p.email, p.name)
  }
  return map
}
