'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface ClubSuggestion {
  id: string
  name: string
  full_name: string | null
  city: string | null
}

const MAX_RESULTS = 5
const MIN_QUERY_LENGTH = 2

/**
 * Recherche publique de clubs pour l'inscription (nom / nom complet / ville).
 * La policy « Lecture publique clubs » (SELECT using true) autorise le client
 * anonyme — pas besoin de service role ici.
 */
export async function searchClubs(query: string): Promise<ClubSuggestion[]> {
  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return []

  // Neutralise les caractères qui casseraient le filtre .or() de PostgREST
  // (virgules, parenthèses) ou les wildcards ILIKE (%, _).
  const safe = q.replace(/[,()%_]/g, ' ').trim()
  if (!safe) return []

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('clubs')
    .select('id, name, full_name, city')
    .eq('is_active', true)
    .or(`name.ilike.%${safe}%,full_name.ilike.%${safe}%,city.ilike.%${safe}%`)
    .limit(MAX_RESULTS)

  return (data ?? []) as ClubSuggestion[]
}
