'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CreatePlayerSchema, UpdatePlayerSchema } from '@/lib/validations/schemas'

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

export async function deletePlayer(playerId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // Refuser la suppression si le joueur est dans un tournoi en cours
  const { data: activeEntry } = await supabase
    .from('tournament_players')
    .select('tournament_id, tournaments!inner(status)')
    .eq('player_id', playerId)
    .eq('tournaments.status', 'ongoing')
    .limit(1)
    .maybeSingle() as {
      data: { tournament_id: string } | null
      error: unknown
    }

  if (activeEntry) {
    return { error: 'Ce joueur participe à un tournoi en cours. Impossible de le supprimer.' }
  }

  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId)
    .eq('created_by', user.id)

  if (error) {
    console.error('deletePlayer:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath('/players')
  return { success: true }
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
