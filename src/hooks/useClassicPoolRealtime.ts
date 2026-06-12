'use client'

import { useEffect, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/**
 * Abonne le dashboard classique (phase poules) aux changements live du tournoi.
 *
 * Un seul canal Realtime porte 4 écoutes postgres_changes, toutes filtrées par
 * tournament_id :
 *   - matches        (UPDATE)  → scores / statut des matchs de poule
 *   - pool_standings (*)       → classements de poule
 *   - pool_courts    (*)       → assignation des terrains aux poules
 *   - pools          (UPDATE)  → statut d'une poule (ongoing → finished)
 *
 * Chaque évènement déclenche `onChange` (debouncé). Le dashboard y branche
 * `router.refresh()` : re-fetch autoritatif côté serveur (jointures de noms,
 * tri des classements et payloads DELETE partiels gérés correctement), sans
 * rechargement de page. Le canal est nettoyé au démontage.
 */
export function useClassicPoolRealtime(tournamentId: string, onChange: () => void): void {
  // Garde la dernière callback sans relancer l'abonnement à chaque render.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!tournamentId) return
    const supabase = createBrowserSupabaseClient()

    let timer: ReturnType<typeof setTimeout> | null = null
    const fire = () => {
      if (timer) clearTimeout(timer)
      // Debounce : une rafale d'évènements (score → standings → courts) ne
      // déclenche qu'un seul refresh.
      timer = setTimeout(() => onChangeRef.current(), 250)
    }

    const filter = `tournament_id=eq.${tournamentId}`
    const channel = supabase
      .channel(`classic:${tournamentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_standings', filter }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_courts', filter }, fire)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pools', filter }, fire)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [tournamentId])
}
