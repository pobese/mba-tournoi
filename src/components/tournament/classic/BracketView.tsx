'use client'

import { BracketMatchCard } from './BracketMatchCard'
import { roundLabel, roundsOf, type BracketMatchView } from './bracket-types'
import type { TeamLite } from './pool-types'

interface BracketViewProps {
  matches: BracketMatchView[]
  teams: Record<string, TeamLite>
  finalLabel?: string
  onMatchClick: (match: BracketMatchView) => void
}

// Arbre d'élimination en colonnes (un tour par colonne), scroll horizontal sur
// mobile. `justify-around` centre chaque match entre ses deux pourvoyeurs de la
// colonne précédente — pas besoin de connecteurs dessinés.
export function BracketView({ matches, teams, finalLabel = 'Finale', onMatchClick }: BracketViewProps) {
  const rounds = roundsOf(matches)
  if (rounds.length === 0) return null

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-5">
        {rounds.map((round) => (
          <div key={round.roundSize} className="flex flex-col">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
              {roundLabel(round.roundSize, finalLabel)}
            </p>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.matches.map((m) => (
                <BracketMatchCard key={m.id} match={m} teams={teams} onClick={onMatchClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
