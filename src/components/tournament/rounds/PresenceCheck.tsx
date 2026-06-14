'use client'

import { Check, UserCheck, UserX, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TournamentPlayer } from './Round1Setup'

interface PresenceCheckProps {
  players: TournamentPlayer[]
  presentIds: Set<string>
  busy: boolean
  onToggle: (id: string) => void
  onSetAll: (present: boolean) => void
}

export function PresenceCheck({ players, presentIds, busy, onToggle, onSetAll }: PresenceCheckProps) {
  const presentCount = players.filter((p) => presentIds.has(p.id)).length
  const total = players.length

  return (
    <div className="bg-surface border border-subtle rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Présence
          <span className="text-muted font-normal text-xs">
            {presentCount} / {total} présent{presentCount > 1 ? 's' : ''}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSetAll(true)}
            disabled={busy}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Tous présents
          </button>
          <button
            type="button"
            onClick={() => onSetAll(false)}
            disabled={busy}
            className="flex items-center gap-1 text-xs text-muted hover:text-danger disabled:opacity-50"
          >
            <UserX className="w-3.5 h-3.5" />
            Tous absents
          </button>
        </div>
      </div>

      <p className="text-muted text-xs">
        Cochez les joueurs présents. Seuls les présents seront inclus dans le round 1 ;
        les absents pourront être ajoutés plus tard via « Ajouter un joueur en cours ».
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {players.map((p) => {
          const present = presentIds.has(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              disabled={busy}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-60',
                present ? 'border-primary/40 bg-primary/10' : 'border-subtle bg-surface-alt opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  present ? 'bg-primary border-primary text-app' : 'border-subtle text-transparent',
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className={cn('flex-1 min-w-0 truncate text-sm', present ? 'text-white' : 'text-muted line-through')}>
                {p.name}
              </span>
              {!present && (
                <span className="text-[10px] text-muted uppercase tracking-wide shrink-0">Absent</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
