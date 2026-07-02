'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

const PlayerIdSchema = z.string().uuid()

export interface ClaimResult {
  ok: boolean
  error?: string
}

/**
 * Lie un profil joueur (historique) au compte connecté.
 * 1. Auth requise, 2. le profil doit être non lié (user_id IS NULL — garde
 * anti-course dans le UPDATE), 3. le compte devient membre du club du joueur.
 * Stats dérivées à la volée côté vue joueur (option 1) → rien à écrire ici.
 */
export async function claimPlayerProfile(playerId: string): Promise<ClaimResult> {
  const parsed = PlayerIdSchema.safeParse(playerId)
  if (!parsed.success) return { ok: false, error: 'Identifiant invalide.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Vous devez être connecté.' }

  const admin = createServiceRoleClient()

  const { data: player } = await admin
    .from('players')
    .select('id, club_id, user_id')
    .eq('id', parsed.data)
    .maybeSingle() as { data: { id: string; club_id: string | null; user_id: string | null } | null }

  if (!player) return { ok: false, error: 'Profil introuvable.' }
  if (player.user_id) return { ok: false, error: 'Ce profil est déjà rattaché à un compte.' }

  // Liaison — le filtre .is('user_id', null) garantit qu'on ne vole pas un profil
  // déjà réclamé entre le SELECT et l'UPDATE (course concurrente).
  const { data: linked } = await admin
    .from('players')
    .update({ user_id: user.id })
    .eq('id', parsed.data)
    .is('user_id', null)
    .select('id')
    .maybeSingle() as { data: { id: string } | null }

  if (!linked) return { ok: false, error: 'Ce profil vient d’être rattaché ailleurs.' }

  // Devenir membre du club (si pas déjà) — 23505 = déjà membre, on ignore.
  if (player.club_id) {
    const { error: memberError } = await admin
      .from('club_members')
      .insert({ club_id: player.club_id, user_id: user.id, role: 'member' })
    if (memberError && memberError.code !== '23505') {
      console.error('claimPlayerProfile club_members:', memberError.message)
    }
  }

  revalidatePath('/')
  return { ok: true }
}

/**
 * Relance manuelle du matching (bouton « Chercher mon historique »).
 * Cherche des profils non liés ressemblant au prénom du compte, dans les clubs
 * pertinents (club d'inscription + adhésions + clubs possédés). Renvoie jusqu'à
 * 3 ids candidats — la vue enchaîne alors sur le flux de « claim ».
 */
export async function findMyHistoryMatches(): Promise<string[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const firstName = String(user.user_metadata?.full_name ?? '').trim().split(/\s+/)[0] ?? ''
  if (firstName.length < 2) return []

  const admin = createServiceRoleClient()
  const clubIds = new Set<string>()
  const metaClubId = (user.user_metadata as { club_id?: unknown }).club_id
  if (typeof metaClubId === 'string') clubIds.add(metaClubId)

  const { data: mems } = await admin
    .from('club_members').select('club_id').eq('user_id', user.id) as { data: { club_id: string }[] | null }
  for (const m of mems ?? []) clubIds.add(m.club_id)

  const { data: owned } = await admin
    .from('clubs').select('id').eq('owner_id', user.id) as { data: { id: string }[] | null }
  for (const c of owned ?? []) clubIds.add(c.id)

  if (clubIds.size === 0) return []

  const ids: string[] = []
  for (const clubId of clubIds) {
    const { data } = await admin.rpc('match_club_players', { p_club_id: clubId, p_name: firstName })
    for (const r of (data ?? []) as { id: string }[]) {
      if (!ids.includes(r.id)) ids.push(r.id)
    }
    if (ids.length >= 3) break
  }
  return ids.slice(0, 3)
}
