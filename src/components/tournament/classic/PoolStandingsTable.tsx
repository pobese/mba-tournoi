'use client'

import { sortStandings, type PoolStandingRow } from './pool-types'

// Classement compact d'une poule : # | Équipe | J | V | Sets | Pts.
// Le top 2 (qualifiés potentiels) est mis en évidence.
export function PoolStandingsTable({
  rows,
  highlightTop = 2,
}: {
  rows: PoolStandingRow[]
  highlightTop?: number
}) {
  const sorted = sortStandings(rows)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-subtle text-xs text-muted">
            <th className="w-6 pb-2 text-left">#</th>
            <th className="pb-2 text-left">Équipe</th>
            <th className="pb-2 text-right">J</th>
            <th className="pb-2 text-right">V</th>
            <th className="pb-2 text-right">Sets</th>
            <th className="pb-2 text-right">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {sorted.map((row, i) => {
            const qualified = i < highlightTop
            return (
              <tr
                key={row.teamId}
                className={`transition-colors ${qualified ? 'bg-primary/5' : 'hover:bg-surface-alt/50'}`}
              >
                <td className="py-2 font-mono text-xs tabular-nums text-muted">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className={`max-w-[160px] truncate py-2 font-medium ${qualified ? 'text-primary' : 'text-white'}`}>
                  {row.teamName}
                </td>
                <td className="py-2 text-right text-xs tabular-nums text-muted">{row.matchesPlayed}</td>
                <td className="py-2 text-right font-bold tabular-nums text-white">{row.wins}</td>
                <td className="py-2 text-right text-xs tabular-nums text-muted">
                  {row.setsWon - row.setsLost >= 0 ? '+' : ''}{row.setsWon - row.setsLost}
                </td>
                <td className="py-2 text-right text-xs tabular-nums text-muted">
                  {row.pointsFor - row.pointsAgainst >= 0 ? '+' : ''}{row.pointsFor - row.pointsAgainst}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
