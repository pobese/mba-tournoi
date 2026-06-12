'use client'

import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { useClassicPoolRealtime } from '@/hooks/useClassicPoolRealtime'
import { useThrottledRefresh } from '@/hooks/useThrottledRefresh'
import { BracketMatchCard } from './BracketMatchCard'
import { BracketView } from './BracketView'
import { BracketScoreDialog } from './BracketScoreDialog'
import type { BracketMatchView } from './bracket-types'
import type { TeamLite } from './pool-types'

interface ClassicBracketDashboardProps {
  tournamentId: string
  matches: BracketMatchView[]
  teams: Record<string, TeamLite>
  setsToWin: 1 | 2
  targetScore: number
}

export function ClassicBracketDashboard({
  tournamentId,
  matches,
  teams,
  setsToWin,
  targetScore,
}: ClassicBracketDashboardProps) {
  const refresh = useThrottledRefresh()
  // Réutilise le canal classique : l'écoute matches/UPDATE couvre les scores
  // du tableau et le placement automatique des équipes qualifiées.
  useClassicPoolRealtime(tournamentId, refresh)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // selected re-dérivé des props : reste à jour après chaque refresh serveur.
  const selected = matches.find((m) => m.id === selectedId) ?? null

  const barrages = matches.filter((m) => m.phase === 'barrage')
  const playIns = matches.filter((m) => m.phase === 'bracket_consolante' && m.bracketPosition === 0)
  const main = matches.filter((m) => m.phase === 'bracket_main')
  const consolante = matches.filter((m) => m.phase === 'bracket_consolante' && m.bracketPosition >= 1)

  const finale = main.find((m) => m.bracketPosition === 1)
  const championId = finale?.status === 'done' ? finale.winnerTeamId : null
  const champion = championId ? teams[championId]?.name ?? null : null

  const consoFinale = consolante.find((m) => m.bracketPosition === 1)
  const consoWinnerId = consoFinale?.status === 'done' ? consoFinale.winnerTeamId : null
  const consoWinner = consoWinnerId ? teams[consoWinnerId]?.name ?? null : null

  const openMatch = (m: BracketMatchView) => setSelectedId(m.id)

  if (matches.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        Aucun match de tableau. Régénérez le tableau depuis la phase de poules.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {champion && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <Trophy className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-white">
            Vainqueur du tournoi : <span className="font-display font-extrabold text-primary">{champion}</span>
            {consoWinner && (
              <span className="text-muted"> · Vainqueur consolante : <span className="text-white">{consoWinner}</span></span>
            )}
          </p>
        </div>
      )}

      {barrages.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-white">Barrages</h2>
          <p className="text-xs text-muted">
            Le vainqueur rejoint le tableau principal ; le perdant est repêché en consolante.
          </p>
          <div className="flex flex-wrap gap-3">
            {barrages.map((m) => (
              <BracketMatchCard key={m.id} match={m} teams={teams} onClick={openMatch} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold text-white">Tableau principal</h2>
        <BracketView matches={main} teams={teams} onMatchClick={openMatch} />
      </section>

      {(consolante.length > 0 || playIns.length > 0) && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-white">Consolante</h2>
          <p className="text-xs text-muted">Perdants du premier tour du tableau principal et des barrages.</p>
          {playIns.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Repêchage</p>
              <div className="flex flex-wrap gap-3">
                {playIns.map((m) => (
                  <BracketMatchCard key={m.id} match={m} teams={teams} onClick={openMatch} />
                ))}
              </div>
            </div>
          )}
          {consolante.length > 0 && (
            <BracketView matches={consolante} teams={teams} finalLabel="Finale consolante" onMatchClick={openMatch} />
          )}
        </section>
      )}

      <p className="text-xs text-muted">
        Cliquez sur un match prêt (surligné) pour saisir le score — le vainqueur avance automatiquement.
      </p>

      <BracketScoreDialog
        match={selected}
        teams={teams}
        setsToWin={setsToWin}
        targetScore={targetScore}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />
    </div>
  )
}
