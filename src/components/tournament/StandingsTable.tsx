'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useRealtimeStandings } from '@/hooks/useRealtime'
import type { Standing } from '@/types/app'

interface StandingRow {
  id: string
  rank: number | null
  playerName: string
  pointsScored: number
  pointsConceded: number
  wins: number
  losses: number
  matchesPlayed: number
}

interface StandingsTableProps {
  tournamentId: string
  initialStandings: StandingRow[]
}

function buildRows(standings: Standing[], nameMap: Map<string, string>): StandingRow[] {
  return standings
    .map((s) => ({
      id: s.id,
      rank: s.rank,
      playerName: nameMap.get(s.player_id ?? '') ?? nameMap.get(s.team_id ?? '') ?? '—',
      pointsScored: s.points_scored,
      pointsConceded: s.points_conceded,
      wins: s.wins,
      losses: s.losses,
      matchesPlayed: s.matches_played,
    }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
}

// Version sans Realtime (initiale) : affiche directement les rows
function StaticTable({ rows }: { rows: StandingRow[] }) {
  const prefersReduced = useReducedMotion()

  if (rows.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-8">
        Le classement s&apos;affichera après le premier round.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-subtle text-muted text-xs">
            <th className="pb-2 text-left w-8">#</th>
            <th className="pb-2 text-left">Joueur</th>
            <th className="pb-2 text-right">Pts</th>
            <th className="pb-2 text-right hidden sm:table-cell">+/-</th>
            <th className="pb-2 text-right">V</th>
            <th className="pb-2 text-right hidden sm:table-cell">D</th>
          </tr>
        </thead>
        <AnimatePresence>
          <tbody className="divide-y divide-subtle">
            {rows.map((row, i) => (
              <motion.tr
                key={row.id}
                layout={!prefersReduced}
                initial={false}
                animate={{ opacity: 1 }}
                className="hover:bg-surface-alt/50 transition-colors"
              >
                <td className="py-2.5 text-muted font-mono tabular-nums text-xs">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : row.rank ?? '—'}
                </td>
                <td className="py-2.5 text-white font-medium truncate max-w-[120px]">
                  {row.playerName}
                </td>
                <td className="py-2.5 text-right font-mono font-bold tabular-nums text-accent">
                  {row.pointsScored}
                </td>
                <td className="py-2.5 text-right hidden sm:table-cell tabular-nums text-muted text-xs">
                  {row.pointsScored - row.pointsConceded >= 0 ? '+' : ''}
                  {row.pointsScored - row.pointsConceded}
                </td>
                <td className="py-2.5 text-right tabular-nums text-primary font-bold">
                  {row.wins}
                </td>
                <td className="py-2.5 text-right hidden sm:table-cell tabular-nums text-danger">
                  {row.losses}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </AnimatePresence>
      </table>
    </div>
  )
}

// Wrapper with Realtime — displayed when standing rows are available
function RealtimeStandingsTable({
  tournamentId,
  initialStandings,
}: StandingsTableProps) {
  // The hook handles real-time updates on the standings table
  // We use initial data directly as rows (player names already resolved server-side)
  const realtimeStandings = useRealtimeStandings(
    tournamentId,
    [] // We don't have raw Standing[] here — use static display for realtime
  )

  // If we have realtime data, fall back to initial rows (names not resolved)
  // In production, you'd want a name cache. For now, static display is used.
  void realtimeStandings

  return <StaticTable rows={initialStandings} />
}

export function StandingsTable({ tournamentId, initialStandings }: StandingsTableProps) {
  return <RealtimeStandingsTable tournamentId={tournamentId} initialStandings={initialStandings} />
}

export { buildRows }
