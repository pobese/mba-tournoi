'use client'

import { useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useClassicPoolRealtime } from '@/hooks/useClassicPoolRealtime'
import { useThrottledRefresh } from '@/hooks/useThrottledRefresh'
import {
  assignCourtToPool,
  releaseCourtFromPool,
  closePool,
  redistributeFreeCourts,
  generateBracketFromStandings,
} from '@/app/(app)/tournaments/classic-actions'
import { PoolGridCard } from './PoolGridCard'
import { PoolPanel } from './PoolPanel'
import { actionError, type PoolView, type TeamLite } from './pool-types'

// Re-export pour les consommateurs existants (page.tsx).
export type { PoolView, TeamLite } from './pool-types'

interface ClassicPoolsDashboardProps {
  tournamentId: string
  pools: PoolView[]
  teams: Record<string, TeamLite>
  setsToWin: 1 | 2
  targetScore: number
  courtsAvailable: number
  freeCourts: number[]
}

export function ClassicPoolsDashboard({
  tournamentId,
  pools,
  teams,
  setsToWin,
  targetScore,
  freeCourts,
}: ClassicPoolsDashboardProps) {
  // Throttlé : le refresh post-action et l'écho Realtime fusionnent en un seul
  // re-fetch serveur au lieu de deux.
  const refresh = useThrottledRefresh()
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Realtime : matches / pool_standings / pool_courts / pools → refresh débouncé.
  useClassicPoolRealtime(tournamentId, refresh)

  const selectedPool = pools.find((p) => p.id === selectedPoolId) ?? null
  const allFinished = pools.length > 0 && pools.every((p) => p.status === 'finished')

  async function onAssignCourt(poolId: string, court: number) {
    const err = actionError(await assignCourtToPool(tournamentId, poolId, court))
    if (err) toast.error('Erreur', { description: err })
    else refresh()
  }

  async function onReleaseCourt(court: number) {
    const err = actionError(await releaseCourtFromPool(tournamentId, court))
    if (err) toast.error('Erreur', { description: err })
    else refresh()
  }

  async function onClosePool(poolId: string) {
    const closed = pools.find((p) => p.id === poolId)
    const err = actionError(await closePool(poolId))
    if (err) {
      toast.error('Erreur', { description: err })
      return
    }
    // La redistribution des terrains est déjà faite automatiquement à la
    // validation du dernier match de la poule (et annoncée à ce moment-là).
    toast.success(`${closed?.name ?? 'Poule'} clôturée`)
    refresh()
  }

  // Redistribution manuelle (bouton sur le bandeau « terrains libres »).
  async function onRedistribute() {
    const result = await redistributeFreeCourts(tournamentId)
    const err = actionError(result)
    if (err) {
      toast.error('Erreur', { description: err })
      return
    }
    const moves = (result as { moves?: Array<{ poolName: string; courts: number[] }> }).moves ?? []
    if (moves.length === 0) toast('Aucune redistribution possible')
    for (const m of moves) {
      if (m.courts.length > 0) toast.success(`${m.poolName} récupère ${m.courts.length > 1 ? 'les terrains' : 'le terrain'} ${m.courts.join(', ')}`)
    }
    refresh()
  }

  async function onGenerateBracket(mode: 'barrage' | 'first_match_decides') {
    setGenerating(true)
    try {
      const err = actionError(await generateBracketFromStandings(tournamentId, mode))
      if (err) toast.error('Erreur', { description: err })
      else {
        toast.success('Tableau généré')
        refresh()
      }
    } finally {
      setGenerating(false)
    }
  }

  if (pools.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        Aucune poule générée. Vérifiez la configuration du tournoi.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pools.map((pool) => (
          <PoolGridCard
            key={pool.id}
            pool={pool}
            freeCourts={freeCourts}
            onOpen={() => setSelectedPoolId(pool.id)}
            onAssignCourt={onAssignCourt}
          />
        ))}
      </div>

      {/* Bandeau terrains libres : terrains redistribuables vs terrains « loisir ».
          Capacité utile d'une poule = min(floor(équipes/2), matchs restants). Si
          aucune poule en jeu ne peut absorber un terrain → terrain loisir. */}
      {freeCourts.length > 0 && (() => {
        const ongoing = pools.filter((p) => p.status === 'ongoing')
        const totalDeficit = ongoing.reduce((sum, p) => {
          const pending = p.matches.filter((m) => m.status !== 'done').length
          const cap = Math.min(Math.floor(p.standings.length / 2), pending)
          return sum + Math.max(0, cap - p.courts.length)
        }, 0)
        const redistributable = freeCourts.slice(0, Math.min(freeCourts.length, totalDeficit))
        const leisure = freeCourts.slice(redistributable.length)
        return (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-subtle bg-surface px-4 py-3">
            {redistributable.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted">Terrains libres :</span>
                {redistributable.map((c) => (
                  <span key={c} className="rounded-md border border-subtle bg-surface-alt px-2 py-0.5 text-xs font-bold tabular-nums text-muted">{c}</span>
                ))}
                <button
                  onClick={onRedistribute}
                  className="rounded-md border border-primary/30 bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-app"
                >
                  Redistribuer
                </button>
              </div>
            )}
            {leisure.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Loisir</span>
                {leisure.map((c) => (
                  <span key={c} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">{c}</span>
                ))}
                <span className="text-[11px] text-muted">jouables librement en attendant le tableau</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Génération du tableau — uniquement si toutes les poules sont terminées.
          Les équipes en trop jouent des barrages (perdants repêchés en consolante). */}
      {allFinished && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-white">Toutes les poules sont clôturées.</p>
          </div>
          <Button onClick={() => onGenerateBracket('barrage')} disabled={generating} className="bg-primary font-bold text-app hover:bg-primary/90">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Générer le tableau →'}
          </Button>
        </div>
      )}

      <PoolPanel
        open={selectedPoolId !== null}
        onOpenChange={(v) => !v && setSelectedPoolId(null)}
        pool={selectedPool}
        teams={teams}
        freeCourts={freeCourts}
        setsToWin={setsToWin}
        targetScore={targetScore}
        onChanged={refresh}
        onAssignCourt={onAssignCourt}
        onReleaseCourt={onReleaseCourt}
        onClosePool={onClosePool}
      />
    </div>
  )
}
