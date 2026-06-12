'use client'

import { useState } from 'react'

export interface EvolutionSeries {
  playerId: string
  name: string
  points: Array<number | null>
  ranks: Array<number | null>
}

interface AmericanEvolutionChartProps {
  rounds: number[]
  series: EvolutionSeries[]
}

// Palette lisible sur fond sombre (cycle si plus de joueurs que de couleurs).
const PALETTE = [
  '#4ade80', '#facc15', '#60a5fa', '#f87171', '#a78bfa',
  '#34d399', '#fb923c', '#f472b6', '#22d3ee', '#c084fc',
]

type Metric = 'points' | 'rank'

// Dimensions du viewBox (le SVG est responsive via width=100%).
const W = 520
const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 32 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

export function AmericanEvolutionChart({ rounds, series }: AmericanEvolutionChartProps) {
  const [metric, setMetric] = useState<Metric>('points')

  if (rounds.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-8">
        La courbe s&apos;affichera après le premier match terminé.
      </p>
    )
  }

  const xFor = (i: number) =>
    rounds.length === 1
      ? PAD.left + PLOT_W / 2
      : PAD.left + (i / (rounds.length - 1)) * PLOT_W

  // Échelle Y selon la métrique. Points : 0 en bas, max en haut. Rang : 1 en haut.
  const values = series.flatMap((s) => (metric === 'points' ? s.points : s.ranks)).filter((v): v is number => v !== null)
  const maxVal = values.length > 0 ? Math.max(...values, metric === 'points' ? 1 : 2) : 1

  const yFor = (v: number) => {
    if (metric === 'points') {
      return PAD.top + (1 - v / maxVal) * PLOT_H
    }
    // rang : 1 (meilleur) en haut, maxVal (pire) en bas
    return PAD.top + ((v - 1) / Math.max(1, maxVal - 1)) * PLOT_H
  }

  // Découpe une série en segments de points consécutifs non-null.
  function segmentsFor(arr: Array<number | null>): Array<Array<{ x: number; y: number }>> {
    const segments: Array<Array<{ x: number; y: number }>> = []
    let current: Array<{ x: number; y: number }> = []
    arr.forEach((v, i) => {
      if (v === null) {
        if (current.length) segments.push(current)
        current = []
      } else {
        current.push({ x: xFor(i), y: yFor(v) })
      }
    })
    if (current.length) segments.push(current)
    return segments
  }

  // Lignes de grille horizontales (axe Y).
  const yTicks = metric === 'points' ? [0, 0.5, 1] : [0, 0.5, 1]

  return (
    <div className="space-y-3">
      {/* Bascule points / rang */}
      <div className="flex gap-1 bg-surface-alt rounded-lg p-1 w-fit">
        {(['points', 'rank'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              metric === m ? 'bg-primary text-app' : 'text-muted hover:text-white'
            }`}
          >
            {m === 'points' ? 'Points cumulés' : 'Classement'}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Évolution du classement">
        {/* Grille Y */}
        {yTicks.map((t, i) => {
          const y = PAD.top + t * PLOT_H
          return (
            <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgb(var(--border-subtle))" strokeWidth={1} />
          )
        })}

        {/* Axe X : numéros de round */}
        {rounds.map((r, i) => (
          <text key={r} x={xFor(i)} y={H - 8} textAnchor="middle" className="fill-muted" style={{ fontSize: 10 }}>
            R{r}
          </text>
        ))}

        {/* Lignes par joueur */}
        {series.map((s, idx) => {
          const color = PALETTE[idx % PALETTE.length]
          const arr = metric === 'points' ? s.points : s.ranks
          const segments = segmentsFor(arr)
          return (
            <g key={s.playerId}>
              {segments.map((seg, si) => (
                <polyline
                  key={si}
                  points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {segments.flat().map((p, pi) => (
                <circle key={pi} cx={p.x} cy={p.y} r={2.5} fill={color} />
              ))}
            </g>
          )
        })}
      </svg>

      {/* Légende */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {series.map((s, idx) => (
          <div key={s.playerId} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
            <span className="text-xs text-muted truncate max-w-[100px]">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
