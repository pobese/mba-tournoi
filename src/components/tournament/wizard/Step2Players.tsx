'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, UserPlus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/players/PlayerAvatar'
import { nextPowerOf2 } from '@/lib/utils'
import type { TournamentType, Player } from '@/types/app'

type PlayerRow = Pick<Player, 'id' | 'name' | 'level'>

interface Step2PlayersProps {
  players: PlayerRow[]
  type: TournamentType
  defaultSelected: string[]
  onBack: () => void
  onNext: (playerIds: string[]) => void
}

function getWarning(type: TournamentType, count: number): string | null {
  if (count < 4) return `Minimum 4 joueurs requis (${count} sélectionné${count > 1 ? 's' : ''})`

  if (type === 'american' && count % 2 !== 0) {
    return `Nombre impair (${count}) — un joueur sera exempté à chaque round`
  }

  if (type === 'classic') {
    if (count > 32) return `Maximum 32 joueurs pour un tournoi classique`
    const next = nextPowerOf2(count)
    if (next !== count) {
      const byes = next - count
      return `${count} joueurs → ${byes} exemption${byes > 1 ? 's' : ''} générée${byes > 1 ? 's' : ''} au round 1`
    }
  }

  return null
}

export function Step2Players({
  players,
  type,
  defaultSelected,
  onBack,
  onNext,
}: Step2PlayersProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const count = selected.size
  const warning = getWarning(type, count)
  const canProceed = count >= 4 && (type !== 'classic' || count <= 32)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted text-sm">
          {count === 0
            ? 'Sélectionnez les joueurs'
            : `${count} joueur${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => {
            if (selected.size === players.length) setSelected(new Set())
            else setSelected(new Set(players.map((p) => p.id)))
          }}
          className="text-xs text-primary hover:underline"
        >
          {selected.size === players.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      {players.length === 0 ? (
        <div className="bg-surface-alt border border-subtle rounded-xl p-8 text-center">
          <UserPlus className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-white font-medium">Aucun joueur disponible</p>
          <p className="text-muted text-sm mt-1">
            Ajoutez des joueurs depuis{' '}
            <a href="/players" className="text-primary hover:underline">
              la page joueurs
            </a>{' '}
            avant de créer un tournoi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
          {players.map((player) => {
            const isSelected = selected.has(player.id)
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => toggle(player.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-subtle bg-surface-alt hover:border-primary/40'
                }`}
              >
                <PlayerAvatar name={player.name} level={player.level ?? 3} size="sm" />
                <span className="text-xs font-medium text-white truncate w-full">
                  {player.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-sm text-accent">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-muted hover:text-white gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button
          onClick={() => onNext([...selected])}
          disabled={!canProceed}
          className="bg-primary text-app font-bold hover:bg-primary/90 gap-2"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
