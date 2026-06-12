'use client'

import { Users, Swords } from 'lucide-react'
import type { EncounterPair } from '@/lib/algorithms/american-analytics'

export interface EncounterIndicatorProps {
  pairs: EncounterPair[]
  repeatedPairs: number
  maxRepeat: number
  nameOf: Record<string, string>
}

export function EncounterIndicator({ pairs, repeatedPairs, maxRepeat, nameOf }: EncounterIndicatorProps) {
  if (pairs.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-8">
        Les rencontres s&apos;afficheront après le premier round.
      </p>
    )
  }

  // On met en avant les paires qui se sont recroisées (total ≥ 2).
  const repeats = pairs.filter((p) => p.partner + p.opponent > 1)

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="flex gap-3">
        <div className="flex-1 bg-surface-alt rounded-lg p-3 text-center">
          <p className="font-display font-extrabold text-2xl text-white tabular-nums">{repeatedPairs}</p>
          <p className="text-xs text-muted">paire{repeatedPairs > 1 ? 's' : ''} recroisée{repeatedPairs > 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 bg-surface-alt rounded-lg p-3 text-center">
          <p className={`font-display font-extrabold text-2xl tabular-nums ${maxRepeat > 1 ? 'text-accent' : 'text-primary'}`}>
            {maxRepeat}
          </p>
          <p className="text-xs text-muted">rencontres max (même paire)</p>
        </div>
      </div>

      {repeatedPairs === 0 ? (
        <p className="text-sm text-primary text-center py-2">
          ✓ Aucun joueur ne s&apos;est encore recroisé.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-muted text-xs font-medium uppercase tracking-wide">Recroisements</p>
          {repeats.map((p) => (
            <div
              key={`${p.a}|${p.b}`}
              className="flex items-center justify-between bg-surface-alt/50 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-white truncate">
                {nameOf[p.a] ?? '—'} <span className="text-muted">·</span> {nameOf[p.b] ?? '—'}
              </span>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                {p.partner > 0 && (
                  <span className="flex items-center gap-1 text-muted" title="Fois équipiers">
                    <Users className="w-3.5 h-3.5" /> {p.partner}
                  </span>
                )}
                {p.opponent > 0 && (
                  <span className="flex items-center gap-1 text-muted" title="Fois adversaires">
                    <Swords className="w-3.5 h-3.5" /> {p.opponent}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-1 border-t border-subtle">
        <span className="flex items-center gap-1 text-xs text-muted">
          <Users className="w-3.5 h-3.5" /> équipiers
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Swords className="w-3.5 h-3.5" /> adversaires
        </span>
      </div>
    </div>
  )
}
