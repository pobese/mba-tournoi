'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CreatePlayerSchema, UpdatePlayerSchema, DeletePlayersSchema } from '@/lib/validations/schemas'
import { freezeTournament } from '@/lib/tournament-archive'

/** Champ FormData optionnel → texte nettoyé ou null (permet d'effacer en édition). */
function orNull(value: FormDataEntryValue | undefined): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length > 0 ? s : null
}

export async function createPlayer(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const raw = Object.fromEntries(formData)
  const parsed = CreatePlayerSchema.safeParse({
    name: raw['name'],
    level: Number(raw['level']),
    email: raw['email'] ?? undefined,
    club_id: orNull(raw['club_id']),
    club_name_hint: orNull(raw['club_name_hint']),
    city_hint: orNull(raw['city_hint']),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('players')
    .insert({ ...parsed.data, created_by: user.id })

  if (error) {
    return { error: { _form: ['Erreur lors de la création du joueur'] } }
  }

  revalidatePath('/players')
  return { success: true }
}

export async function updatePlayer(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const raw = Object.fromEntries(formData)
  const parsed = UpdatePlayerSchema.safeParse({
    id: raw['id'],
    name: raw['name'],
    level: raw['level'] ? Number(raw['level']) : undefined,
    email: raw['email'] ?? undefined,
    club_id: orNull(raw['club_id']),
    club_name_hint: orNull(raw['club_name_hint']),
    city_hint: orNull(raw['city_hint']),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { id, ...updates } = parsed.data

  const { error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) {
    return { error: { _form: ['Erreur lors de la mise à jour'] } }
  }

  revalidatePath('/players')
  return { success: true }
}

// ─── Suppression de joueurs ─────────────────────────────────────────────────
// Un joueur est référencé en RESTRICT par tournament_players et teams : on ne peut
// pas le supprimer tant qu'un tournoi le référence. Règles appliquées :
//  • tournoi EN COURS → suppression refusée (avertissement) ;
//  • tournoi TERMINÉ (du propriétaire) → archivé/figé en forme statique, ce qui
//    purge ses données vives et libère le joueur (l'historique reste consultable) ;
//  • tournoi BROUILLON (du propriétaire) → le joueur en est simplement détaché ;
//  • tournoi d'un autre organisateur → suppression refusée.

interface Membership {
  tournamentId: string
  status: string
  createdBy: string
  name: string
}

async function getPlayerMemberships(
  supabase: SupabaseClient,
  playerId: string,
): Promise<Membership[]> {
  type Row = {
    tournament_id: string
    tournament: { status: string; created_by: string; name: string } | null
  }
  const { data } = await supabase
    .from('tournament_players')
    .select('tournament_id, tournament:tournaments!inner(status, created_by, name)')
    .eq('player_id', playerId) as { data: Row[] | null; error: unknown }

  return (data ?? [])
    .filter((r): r is Row & { tournament: NonNullable<Row['tournament']> } => r.tournament !== null)
    .map((r) => ({
      tournamentId: r.tournament_id,
      status: r.tournament.status,
      createdBy: r.tournament.created_by,
      name: r.tournament.name,
    }))
}

// Détache un joueur d'un tournoi brouillon : supprime ses équipes (et les matchs
// éventuels qui les référencent) puis sa ligne d'inscription. Le brouillon reste
// utilisable pour les autres joueurs.
async function detachPlayerFromDraft(
  supabase: SupabaseClient,
  tournamentId: string,
  playerId: string,
): Promise<void> {
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`) as { data: { id: string }[] | null; error: unknown }

  const teamIds = (teams ?? []).map((t) => t.id)
  if (teamIds.length > 0) {
    const list = teamIds.join(',')
    await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .or(`team1_id.in.(${list}),team2_id.in.(${list})`)
    await supabase.from('teams').delete().in('id', teamIds)
  }
  await supabase
    .from('tournament_players')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
}

type DeleteOutcome =
  | { ok: true; archived: string[] }
  | { ok: false; reason: string }

// Prépare puis supprime un joueur du propriétaire `userId`. Applique les règles
// ci-dessus tournoi par tournoi avant de supprimer la ligne `players`.
async function deleteOnePlayer(
  supabase: SupabaseClient,
  userId: string,
  playerId: string,
): Promise<DeleteOutcome> {
  const memberships = await getPlayerMemberships(supabase, playerId)

  const ongoing = memberships.filter((m) => m.status === 'ongoing')
  if (ongoing.length > 0) {
    return { ok: false, reason: `participe à un tournoi en cours (${ongoing.map((m) => m.name).join(', ')})` }
  }
  const foreign = memberships.filter((m) => m.createdBy !== userId)
  if (foreign.length > 0) {
    return { ok: false, reason: 'participe à un tournoi géré par un autre organisateur' }
  }

  const archived: string[] = []
  for (const m of memberships) {
    if (m.status === 'finished') {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, type, results_snapshot')
        .eq('id', m.tournamentId)
        .single() as { data: { id: string; type: string; results_snapshot: unknown } | null; error: unknown }
      if (!t) continue
      if (t.results_snapshot) {
        // Déjà archivé : il suffit de retirer l'inscription résiduelle.
        await supabase
          .from('tournament_players')
          .delete()
          .eq('tournament_id', m.tournamentId)
          .eq('player_id', playerId)
      } else {
        try {
          await freezeTournament(supabase, { id: t.id, type: t.type }, new Date().toISOString())
          archived.push(m.name)
        } catch (err) {
          return { ok: false, reason: err instanceof Error ? err.message : 'échec de l\'archivage du tournoi' }
        }
      }
    } else {
      // Brouillon
      await detachPlayerFromDraft(supabase, m.tournamentId, playerId)
    }
  }

  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId)
    .eq('created_by', userId)
  if (error) {
    console.error('deleteOnePlayer:', error.code, error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true, archived }
}

export async function deletePlayer(playerId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const outcome = await deleteOnePlayer(supabase, user.id, playerId)
  if (!outcome.ok) {
    return { error: `Suppression impossible : ce joueur ${outcome.reason}.` }
  }

  revalidatePath('/players')
  revalidatePath('/tournaments')
  return { success: true, archived: outcome.archived }
}

export interface BulkDeleteResult {
  deleted: number
  archived: string[]
  blocked: Array<{ playerId: string; reason: string }>
}

export async function deletePlayers(playerIds: string[]): Promise<{ error?: string } & Partial<BulkDeleteResult>> {
  const parsed = DeletePlayersSchema.safeParse({ playerIds })
  if (!parsed.success) return { error: 'Sélection invalide' }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const unique = [...new Set(parsed.data.playerIds)]
  let deleted = 0
  const archived = new Set<string>()
  const blocked: Array<{ playerId: string; reason: string }> = []

  // Séquentiel : l'archivage d'un tournoi partagé entre plusieurs joueurs
  // sélectionnés ne doit pas s'exécuter en double.
  for (const id of unique) {
    const outcome = await deleteOnePlayer(supabase, user.id, id)
    if (outcome.ok) {
      deleted += 1
      outcome.archived.forEach((a) => archived.add(a))
    } else {
      blocked.push({ playerId: id, reason: outcome.reason })
    }
  }

  revalidatePath('/players')
  revalidatePath('/tournaments')
  return { deleted, archived: [...archived], blocked }
}

export async function bulkImportPlayers(rawText: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // Parse, déduplique, filtre les noms invalides
  const seen = new Set<string>()
  const names: string[] = []
  const skipped: string[] = []

  for (const line of rawText.split('\n')) {
    const name = line.trim()
    if (name.length < 2) continue
    const key = name.toLowerCase()
    if (seen.has(key)) {
      skipped.push(name)
    } else {
      seen.add(key)
      names.push(name)
    }
  }

  if (names.length === 0) {
    return { error: 'Aucun nom valide (minimum 2 caractères)' }
  }

  const { error } = await supabase
    .from('players')
    .insert(names.map((name) => ({ name, created_by: user.id })))

  if (error) {
    console.error('bulkImportPlayers:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath('/players')
  return { success: true, created: names.length, skipped: skipped.length }
}
