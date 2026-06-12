'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Match, Standing } from '@/types/app'

export function useRealtimeMatches(tournamentId: string, initialMatches: Match[]) {
  const [matches, setMatches] = useState<Match[]>(initialMatches)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel(`tournament:${tournamentId}:matches`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          setMatches((prev) =>
            prev.map((m) =>
              m.id === payload.new['id'] ? { ...m, ...(payload.new as Match) } : m
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])

  return matches
}

// ─── Rounds : player_tournament_stats realtime ────────────────────────────────

export interface RoundsStatsRow {
  playerId: string
  playerName: string
  totalWins: number
  totalPointsFor: number
  totalPointsAgainst: number
  goalAverage: number
  roundsPlayed: number
  currentRank: number | null
  totalWaited: number
  byeRounds: number[]
}

export function useRealtimeRoundsStats(
  tournamentId: string,
  initialStats: RoundsStatsRow[],
): RoundsStatsRow[] {
  const [stats, setStats] = useState<RoundsStatsRow[]>(initialStats)

  // Re-synchronise depuis les données serveur à chaque router.refresh()
  // (saisie d'un score) : useState ignore sinon les nouvelles props. Les mises
  // à jour Realtime entre deux refreshs s'appliquent ensuite par-dessus.
  useEffect(() => {
    setStats(initialStats)
  }, [initialStats])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel(`rounds:${tournamentId}:player_stats`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'player_tournament_stats',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          const u = payload.new as {
            player_id: string
            total_wins: number
            total_points_for: number
            total_points_against: number
            rounds_played: number
            current_rank: number | null
            total_waited: number
          }
          setStats((prev) =>
            prev
              .map((s) =>
                s.playerId === u.player_id
                  ? {
                      ...s,
                      totalWins: u.total_wins,
                      totalPointsFor: u.total_points_for,
                      totalPointsAgainst: u.total_points_against,
                      goalAverage: u.total_points_for - u.total_points_against,
                      roundsPlayed: u.rounds_played,
                      currentRank: u.current_rank,
                      totalWaited: u.total_waited,
                    }
                  : s,
              )
              .sort((a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999)),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])

  return stats
}

// ─── Générique standings ──────────────────────────────────────────────────────

export function useRealtimeStandings(tournamentId: string, initialStandings: Standing[]) {
  const [standings, setStandings] = useState<Standing[]>(initialStandings)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel(`tournament:${tournamentId}:standings`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'standings',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setStandings((prev) => [...prev, payload.new as Standing])
          } else if (payload.eventType === 'UPDATE') {
            setStandings((prev) =>
              prev.map((s) =>
                s.id === payload.new['id'] ? { ...s, ...(payload.new as Standing) } : s
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])

  return standings
}
