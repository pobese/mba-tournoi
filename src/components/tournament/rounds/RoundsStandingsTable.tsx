'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useRealtimeRoundsStats, type RoundsStatsRow } from '@/hooks/useRealtime'

interface RoundsStandingsTableProps {
  tournamentId: string
  completedRounds: number
  initialStats: RoundsStatsRow[]
}

function ByeHistory({ byeRounds, completedRounds }: { byeRounds: number[]; completedRounds: number }) {
  const set = new Set(byeRounds)
  return (
    <div className="flex gap-0.5 flex-wrap">
      {Array.from({ length: completedRounds }, (_, i) => i + 1).map((r) => (
        <span
          key={r}
          title={set.has(r) ? `Bye R${r}` : `Joué R${r}`}
          className={`w-3 h-3 rounded-full inline-block ${set.has(r) ? 'bg-surface-alt border border-subtle' : 'bg-primary/40'}`}
        />
      ))}
    </div>
  )
}

export function RoundsStandingsTable({
  tournamentId,
  completedRounds,
  initialStats,
}: RoundsStandingsTableProps) {
  const prefersReduced = useReducedMotion()
  const stats = useRealtimeRoundsStats(tournamentId, initialStats)

  if (stats.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-8">
        Le classement s&apos;affichera après le premier round.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-muted text-xs">
              <th className="pb-2 text-left w-8">#</th>
              <th className="pb-2 text-left">Joueur</th>
              <th className="pb-2 text-right">V</th>
              <th className="pb-2 text-right hidden sm:table-cell">GA</th>
              <th className="pb-2 text-right hidden sm:table-cell">Pts+</th>
              <th className="pb-2 text-right">Joués</th>
            </tr>
          </thead>
          <AnimatePresence>
            <tbody className="divide-y divide-subtle">
              {stats.map((row, i) => (
                <motion.tr
                  key={row.playerId}
                  layout={!prefersReduced}
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="hover:bg-surface-alt/50 transition-colors"
                >
                  <td className="py-2.5 text-muted font-mono tabular-nums text-xs">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : row.currentRank ?? '—'}
                  </td>
                  <td className="py-2.5 text-white font-medium truncate max-w-[120px]">
                    {row.playerName}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-primary font-bold">
                    {row.totalWins}
                  </td>
                  <td className="py-2.5 text-right hidden sm:table-cell tabular-nums text-muted text-xs">
                    {row.goalAverage >= 0 ? '+' : ''}{row.goalAverage}
                  </td>
                  <td className="py-2.5 text-right hidden sm:table-cell tabular-nums text-accent font-bold">
                    {row.totalPointsFor}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted text-xs">
                    {row.roundsPlayed}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </AnimatePresence>
        </table>
      </div>

      {/* Historique des byes */}
      <div className="border-t border-subtle pt-3 space-y-1.5">
        <p className="text-muted text-xs font-medium mb-2">Historique des byes</p>
        {stats.map((row) => (
          <div key={row.playerId} className="flex items-center gap-2">
            <span className="text-xs text-muted truncate w-24">{row.playerName}</span>
            <ByeHistory byeRounds={row.byeRounds} completedRounds={completedRounds} />
            {row.totalWaited > 0 && (
              <span className="text-xs text-muted/60 ml-auto shrink-0">
                {row.totalWaited}×
              </span>
            )}
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-primary/40 inline-block" />
            <span className="text-xs text-muted">Joué</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-surface-alt border border-subtle inline-block" />
            <span className="text-xs text-muted">Bye</span>
          </div>
        </div>
      </div>
    </div>
  )
}
