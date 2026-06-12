'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, UserPlus, AlertTriangle, X, Link2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/players/PlayerAvatar'
import { SegmentedControl } from '@/components/tournament/TournamentConfigForm'
import type { Player } from '@/types/app'

type PlayerRow = Pick<Player, 'id' | 'name' | 'level'>

export interface ClassicTeamPair {
  player1Id: string
  player2Id?: string
  name?: string
}

interface Step2ClassicPlayersProps {
  players: PlayerRow[]
  defaultSelected: string[]
  defaultFormat: 'singles' | 'doubles'
  defaultTeams: ClassicTeamPair[]
  onBack: () => void
  onNext: (data: {
    playerIds: string[]
    format: 'singles' | 'doubles'
    teams: ClassicTeamPair[]
  }) => void
}

export function Step2ClassicPlayers({
  players,
  defaultSelected,
  defaultFormat,
  defaultTeams,
  onBack,
  onNext,
}: Step2ClassicPlayersProps) {
  const [format, setFormat] = useState<'singles' | 'doubles'>(defaultFormat)
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected))
  const [teams, setTeams] = useState<ClassicTeamPair[]>(defaultTeams)
  const [pending, setPending] = useState<string | null>(null) // 1er joueur d'une paire en cours

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—'
  const pairedIds = new Set(teams.flatMap((t) => [t.player1Id, t.player2Id].filter(Boolean) as string[]))
  const unpaired = [...selected].filter((id) => !pairedIds.has(id))

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        // Retirer aussi la paire éventuelle (le partenaire repasse en non-apparié).
        setTeams((ts) => ts.filter((t) => t.player1Id !== id && t.player2Id !== id))
        if (pending === id) setPending(null)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function clickUnpaired(id: string) {
    if (pending === null) {
      setPending(id)
    } else if (pending === id) {
      setPending(null)
    } else {
      setTeams((ts) => [...ts, { player1Id: pending, player2Id: id }])
      setPending(null)
    }
  }

  function removeTeam(idx: number) {
    setTeams((ts) => ts.filter((_, i) => i !== idx))
  }

  function autoPair() {
    const pool = [...unpaired]
    const newTeams: ClassicTeamPair[] = []
    for (let i = 0; i + 1 < pool.length; i += 2) {
      newTeams.push({ player1Id: pool[i]!, player2Id: pool[i + 1]! })
    }
    setTeams((ts) => [...ts, ...newTeams])
    setPending(null)
  }

  function setTeamName(idx: number, name: string) {
    setTeams((ts) => ts.map((t, i) => (i === idx ? { ...t, name: name || undefined } : t)))
  }

  const teamCount = format === 'singles' ? selected.size : teams.length
  const warning = (() => {
    if (selected.size < 4) return `Minimum 4 joueurs (${selected.size} sélectionné${selected.size > 1 ? 's' : ''})`
    if (format === 'doubles') {
      if (unpaired.length > 0) return `${unpaired.length} joueur${unpaired.length > 1 ? 's' : ''} non apparié${unpaired.length > 1 ? 's' : ''}`
      if (teams.length < 4) return `Minimum 4 équipes`
    }
    return null
  })()

  const canProceed =
    selected.size >= 4 &&
    teamCount >= 4 &&
    (format === 'singles' || unpaired.length === 0)

  return (
    <div className="space-y-5">
      {/* Format */}
      <div className="space-y-1.5">
        <p className="text-white text-sm font-medium">Format des équipes</p>
        <SegmentedControl
          options={['singles', 'doubles'] as const}
          value={format}
          onChange={(v) => {
            setFormat(v)
            setPending(null)
            if (v === 'singles') setTeams([])
          }}
          formatLabel={(v) => (v === 'singles' ? 'Simple (1v1)' : 'Double (2v2)')}
        />
      </div>

      {/* Sélection des joueurs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted text-sm">
            {selected.size === 0
              ? 'Sélectionnez les joueurs'
              : `${selected.size} joueur${selected.size > 1 ? 's' : ''} · ${teamCount} équipe${teamCount > 1 ? 's' : ''}`}
          </p>
          <button
            type="button"
            onClick={() => {
              if (selected.size === players.length) { setSelected(new Set()); setTeams([]) }
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
              <a href="/players" className="text-primary hover:underline">la page joueurs</a>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
            {players.map((player) => {
              const isSelected = selected.has(player.id)
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggleSelect(player.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-subtle bg-surface-alt hover:border-primary/40'
                  }`}
                >
                  <PlayerAvatar name={player.name} level={player.level ?? 3} size="sm" />
                  <span className="text-xs font-medium text-white truncate w-full">{player.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Constitution des paires (double) */}
      {format === 'doubles' && selected.size > 0 && (
        <div className="space-y-3 border-t border-subtle pt-4">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium">Équipes</p>
            {unpaired.length >= 2 && (
              <button
                type="button"
                onClick={autoPair}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Associer automatiquement
              </button>
            )}
          </div>

          {/* Non-appariés : clic pour former une paire */}
          {unpaired.length > 0 && (
            <div>
              <p className="text-muted text-xs mb-1.5">
                {pending ? `Associer ${nameOf(pending)} à…` : 'Cliquez deux joueurs pour les associer'}
              </p>
              <div className="flex flex-wrap gap-2">
                {unpaired.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => clickUnpaired(id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      pending === id
                        ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent'
                        : 'border-subtle bg-surface-alt text-white hover:border-primary/40'
                    }`}
                  >
                    <Link2 className="w-3 h-3" />
                    {nameOf(id)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paires formées */}
          {teams.length > 0 && (
            <div className="space-y-1.5">
              {teams.map((t, idx) => (
                <div key={`${t.player1Id}-${t.player2Id}`} className="flex items-center gap-2 bg-surface-alt rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-muted w-5 shrink-0">#{idx + 1}</span>
                  <span className="text-sm text-white shrink-0">
                    {nameOf(t.player1Id)} <span className="text-muted">/</span> {t.player2Id ? nameOf(t.player2Id) : '—'}
                  </span>
                  <input
                    value={t.name ?? ''}
                    onChange={(e) => setTeamName(idx, e.target.value)}
                    placeholder="Nom (optionnel)"
                    className="ml-auto min-w-0 flex-1 max-w-[140px] bg-surface border border-subtle rounded-md px-2 py-1 text-xs text-white placeholder:text-muted/60 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeTeam(idx)}
                    aria-label="Dissocier l'équipe"
                    className="text-muted hover:text-danger shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-sm text-accent">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} className="text-muted hover:text-white gap-2">
          <ChevronLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button
          onClick={() => onNext({ playerIds: [...selected], format, teams: format === 'singles' ? [] : teams })}
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
