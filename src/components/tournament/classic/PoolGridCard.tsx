'use client'

import { Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PoolView } from './pool-types'

interface PoolGridCardProps {
  pool: PoolView
  freeCourts: number[]
  onOpen: () => void
  onAssignCourt: (poolId: string, court: number) => Promise<void>
}

// Statut visuel : terminée (vert) / en cours (jaune) / en attente (gris, 0 match joué).
function statusBadge(status: string, played: number): { label: string; cls: string } {
  if (status === 'finished') return { label: 'Terminée', cls: 'border-primary/30 bg-primary/15 text-primary' }
  if (played === 0) return { label: 'En attente', cls: 'border-subtle bg-surface-alt text-muted' }
  return { label: 'En cours', cls: 'border-accent/30 bg-accent/15 text-accent' }
}

export function PoolGridCard({ pool, freeCourts, onOpen, onAssignCourt }: PoolGridCardProps) {
  const teamCount = pool.standings.length
  const total = pool.matches.length
  const played = pool.matches.filter((m) => m.status === 'done').length
  const pct = total > 0 ? Math.round((played / total) * 100) : 0
  const badge = statusBadge(pool.status, played)
  const isFinished = pool.status === 'finished'

  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-2xl border border-subtle bg-surface p-4 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-extrabold text-white">🏸 {pool.name}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <p className="mb-2 text-xs text-muted">
        {teamCount} équipes · {total} matchs
      </p>

      {/* Barre de progression */}
      <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className={`h-full rounded-full transition-all ${isFinished ? 'bg-primary' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mb-3 text-right text-[11px] tabular-nums text-muted">{played}/{total} joués</p>

      {/* Terrains assignés + ajout */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted">Terrains :</span>
        {pool.courts.length === 0 && <span className="text-[11px] text-muted">—</span>}
        {pool.courts.map((c) => (
          <span key={c} className="rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary">
            {c}
          </span>
        ))}
        {!isFinished && (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-0.5 rounded-md border border-subtle bg-surface-alt px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors hover:text-white">
                  <Plus className="h-3 w-3" /> Terrain
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="border-subtle bg-surface text-white">
                {freeCourts.length === 0 && <DropdownMenuItem disabled className="text-muted">Aucun terrain libre</DropdownMenuItem>}
                {freeCourts.map((c) => (
                  <DropdownMenuItem key={c} onClick={() => onAssignCourt(pool.id, c)} className="cursor-pointer focus:bg-surface-alt">
                    Terrain {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </button>
  )
}
