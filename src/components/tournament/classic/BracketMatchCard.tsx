'use client'

import { MapPin } from 'lucide-react'
import type { BracketMatchView } from './bracket-types'
import type { TeamLite } from './pool-types'

interface BracketMatchCardProps {
  match: BracketMatchView
  teams: Record<string, TeamLite>
  onClick: (match: BracketMatchView) => void
}

// Carte compacte d'un match du tableau : deux lignes (équipes + points par set).
// Cliquable si le match est prêt (saisie) ou joué (consultation / annulation).
export function BracketMatchCard({ match, teams, onClick }: BracketMatchCardProps) {
  const done = match.status === 'done'
  const ready = !done && match.team1Id !== null && match.team2Id !== null
  const clickable = done || ready

  const row = (teamId: string | null, side: 1 | 2) => {
    const name = teamId ? teams[teamId]?.name ?? '—' : 'À déterminer'
    const isWinner = done && teamId !== null && match.winnerTeamId === teamId
    return (
      <div className="flex items-center justify-between gap-2">
        <span
          className={`min-w-0 truncate text-xs ${
            teamId === null
              ? 'italic text-muted'
              : isWinner
                ? 'font-bold text-primary'
                : done
                  ? 'text-muted'
                  : 'font-medium text-white'
          }`}
        >
          {name}
        </span>
        <span className="flex shrink-0 gap-1.5 font-mono text-xs tabular-nums">
          {match.setScores.map(([a, b], i) => {
            const won = side === 1 ? a > b : b > a
            return (
              <span key={i} className={won ? 'font-bold text-white' : 'text-muted'}>
                {side === 1 ? a : b}
              </span>
            )
          })}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={() => clickable && onClick(match)}
      disabled={!clickable}
      className={`w-48 space-y-1.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
        done
          ? 'border-primary/25 bg-surface hover:border-primary/50'
          : ready
            ? 'border-accent/30 bg-gradient-to-br from-surface to-surface-alt/40 hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5'
            : 'border-subtle bg-surface opacity-60'
      }`}
    >
      {row(match.team1Id, 1)}
      <div className="border-t border-dashed border-subtle" />
      {row(match.team2Id, 2)}
      {!done && match.courtNumber !== null && (
        <div className="flex items-center gap-1 pt-0.5 text-[10px] font-bold text-primary">
          <MapPin className="h-3 w-3" />
          Terrain {match.courtNumber}
        </div>
      )}
    </button>
  )
}
