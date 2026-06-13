'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shuffle, Hand, Loader2, PlayCircle, X, UserMinus, RotateCcw, Link2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  previewRound1Draw,
  confirmRound1Draw,
  startRound1Manual,
  type DrawPreview,
  type ManualTeamInput,
} from '@/app/(app)/tournaments/[id]/rounds-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TournamentPlayer {
  id: string
  name: string
  level: number
}

interface Round1SetupProps {
  tournamentId: string
  players: TournamentPlayer[]
  format: 'singles' | 'doubles'
}

type Mode = 'random' | 'manual'

// ─── Sub-component : level stars ──────────────────────────────────────────────

function LevelStars({ level }: { level: number }) {
  return (
    <span className="text-accent/80 text-xs leading-none" aria-label={`Niveau ${level}`}>
      {'★'.repeat(level)}{'☆'.repeat(5 - level)}
    </span>
  )
}

// ─── Mode A : tirage aléatoire ────────────────────────────────────────────────

function RandomDraw({
  tournamentId,
  onBack,
}: {
  tournamentId: string
  onBack: () => void
}) {
  const router = useRouter()
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleDraw() {
    setDrawing(true)
    try {
      const result = await previewRound1Draw(tournamentId)
      if (result.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
      } else if (result.preview) {
        setDrawPreview(result.preview)
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setDrawing(false)
    }
  }

  async function handleConfirm() {
    if (!drawPreview) return
    setConfirming(true)
    try {
      const result = await confirmRound1Draw(tournamentId, drawPreview)
      if (result.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
      } else {
        toast.success('Round 1 lancé !')
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setConfirming(false)
    }
  }

  const hasMultipleWaves = (drawPreview?.matches ?? []).some((m) => m.wave > 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
          <Shuffle className="w-4 h-4 text-primary" />
          Tirage aléatoire — Round 1
        </h3>
        {!drawPreview && (
          <button
            onClick={onBack}
            className="text-muted hover:text-white text-xs transition-colors"
          >
            Changer
          </button>
        )}
      </div>

      {!drawPreview ? (
        <Button
          onClick={handleDraw}
          disabled={drawing}
          className="w-full bg-primary text-app font-bold hover:bg-primary/90 gap-2"
        >
          {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
          Effectuer le tirage
        </Button>
      ) : (
        <div className="space-y-3">
          {/* Matchs tirés */}
          <div className="space-y-2">
            {drawPreview.matches.map((match, i) => (
              <div key={i} className="bg-surface-alt rounded-lg px-3 py-2.5">
                <p className="text-muted text-xs mb-1">
                  {hasMultipleWaves && `Vague ${match.wave} · `}Terrain {match.courtNumber}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium">
                    {match.team1.players.map((p) => p.name).join(' / ')}
                  </span>
                  <span className="text-muted text-xs font-bold">VS</span>
                  <span className="text-white text-sm font-medium">
                    {match.team2.players.map((p) => p.name).join(' / ')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Byes */}
          {drawPreview.byes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap py-1">
              <span className="text-muted text-xs">En attente :</span>
              {drawPreview.byes.map((p) => (
                <span
                  key={p.id}
                  className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full"
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleDraw}
              disabled={drawing || confirming}
              className="flex-1 border-subtle text-muted hover:text-white gap-2"
            >
              {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              Retirer
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || drawing}
              className="flex-1 bg-primary text-app font-bold hover:bg-primary/90 gap-2"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Valider les équipes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mode B : équipes manuelles ───────────────────────────────────────────────

function ManualDraw({
  tournamentId,
  players,
  format,
  onBack,
}: {
  tournamentId: string
  players: TournamentPlayer[]
  format: 'singles' | 'doubles'
  onBack: () => void
}) {
  const router = useRouter()
  const isDoubles = format === 'doubles'

  // Mêmes primitives que la constitution d'équipes du tournoi classique :
  // association par lien (clic-clic en double) + nom d'équipe optionnel.
  const [teams, setTeams] = useState<ManualTeamInput[]>([])
  const [byeIds, setByeIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null) // 1er joueur d'une paire en cours
  const [submitting, setSubmitting] = useState(false)

  const inTeam = new Set(
    teams.flatMap((t) => [t.player1Id, t.player2Id].filter(Boolean) as string[]),
  )
  const available = players.filter((p) => !inTeam.has(p.id) && !byeIds.has(p.id))

  function nameOf(id: string): string {
    return players.find((p) => p.id === id)?.name ?? '?'
  }

  // Clic sur un joueur disponible : simple → équipe solo ; double → lien clic-clic.
  function clickAvailable(id: string) {
    if (!isDoubles) {
      setTeams((ts) => [...ts, { player1Id: id }])
      return
    }
    if (pending === null) {
      setPending(id)
    } else if (pending === id) {
      setPending(null)
    } else {
      setTeams((ts) => [...ts, { player1Id: pending, player2Id: id }])
      setPending(null)
    }
  }

  // Associe automatiquement les joueurs restants (paires en double, solos en simple).
  function autoFill() {
    const pool = available.map((p) => p.id)
    if (!isDoubles) {
      setTeams((ts) => [...ts, ...pool.map((id) => ({ player1Id: id }))])
      return
    }
    const newTeams: ManualTeamInput[] = []
    for (let i = 0; i + 1 < pool.length; i += 2) {
      newTeams.push({ player1Id: pool[i]!, player2Id: pool[i + 1]! })
    }
    setTeams((ts) => [...ts, ...newTeams])
    setPending(null)
  }

  function removeTeam(idx: number) {
    setTeams((ts) => ts.filter((_, i) => i !== idx))
  }

  function setTeamName(idx: number, name: string) {
    setTeams((ts) => ts.map((t, i) => (i === idx ? { ...t, name: name || undefined } : t)))
  }

  function toggleBye(playerId: string) {
    if (pending === playerId) setPending(null)
    setByeIds((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  function reset() {
    setTeams([])
    setByeIds(new Set())
    setPending(null)
  }

  const teamsEven = teams.length >= 2 && teams.length % 2 === 0
  const allPlaced = available.length === 0
  const isValid = teamsEven && allPlaced

  const validationError = !allPlaced
    ? `${available.length} joueur${available.length > 1 ? 's' : ''} non placé${available.length > 1 ? 's' : ''} — ${isDoubles ? 'associez-les' : 'ajoutez-les'} ou mettez-${available.length > 1 ? 'les' : 'le'} en attente`
    : teams.length < 2
      ? 'Formez au moins 2 équipes'
      : !teamsEven
        ? `${teams.length} équipes (nombre impair) — retirez-en une ou mettez une équipe en attente pour équilibrer les matchs`
        : null

  async function handleSubmit() {
    if (!isValid) return
    setSubmitting(true)
    try {
      const result = await startRound1Manual(tournamentId, teams, Array.from(byeIds))
      if (result.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
      } else {
        toast.success('Round 1 lancé !')
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
          <Hand className="w-4 h-4 text-primary" />
          Équipes manuelles — Round 1
        </h3>
        <div className="flex items-center gap-3">
          {(teams.length > 0 || byeIds.size > 0) && (
            <button
              onClick={reset}
              className="text-muted hover:text-white text-xs flex items-center gap-1 transition-colors"
              aria-label="Réinitialiser"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser
            </button>
          )}
          <button onClick={onBack} className="text-muted hover:text-white text-xs transition-colors">
            Changer
          </button>
        </div>
      </div>

      {/* Joueurs disponibles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted text-xs font-medium uppercase tracking-wide">
            Joueurs disponibles ({available.length})
          </p>
          {available.length >= (isDoubles ? 2 : 1) && (
            <button
              type="button"
              onClick={autoFill}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isDoubles ? 'Associer automatiquement' : 'Tout ajouter'}
            </button>
          )}
        </div>

        {available.length === 0 ? (
          <p className="text-muted text-xs italic">Tous les joueurs sont placés ou en attente.</p>
        ) : (
          <>
            {isDoubles && (
              <p className="text-muted text-xs mb-1.5">
                {pending ? `Associer ${nameOf(pending)} à…` : 'Cliquez deux joueurs pour les associer'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {available.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-lg border pl-2.5 pr-1.5 py-1.5 transition-all ${
                    pending === p.id
                      ? 'border-accent bg-accent/10 ring-1 ring-accent'
                      : 'border-subtle bg-surface-alt'
                  }`}
                >
                  <button
                    onClick={() => clickAvailable(p.id)}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      pending === p.id ? 'text-accent' : 'text-white hover:text-primary'
                    }`}
                    title={isDoubles ? `Associer ${p.name}` : `Ajouter ${p.name}`}
                  >
                    {isDoubles && <Link2 className="w-3 h-3" />}
                    {p.name}
                  </button>
                  <LevelStars level={p.level} />
                  <button
                    onClick={() => toggleBye(p.id)}
                    title={`Mettre ${p.name} en liste d'attente`}
                    className="ml-0.5 text-muted hover:text-accent transition-colors p-0.5 rounded"
                    aria-label={`Bye ${p.name}`}
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Équipes formées */}
      {teams.length > 0 && (
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide mb-2">
            Équipes formées ({teams.length})
          </p>
          <div className="space-y-1.5">
            {teams.map((t, idx) => (
              <div
                key={`${t.player1Id}-${t.player2Id ?? 'solo'}`}
                className="flex items-center gap-2 bg-surface-alt rounded-lg px-3 py-2"
              >
                <span className="text-xs font-mono text-muted w-6 shrink-0">#{idx + 1}</span>
                <span className="text-sm text-white shrink-0">
                  {nameOf(t.player1Id)}
                  {isDoubles && (
                    <>
                      {' '}
                      <span className="text-muted">/</span> {t.player2Id ? nameOf(t.player2Id) : '—'}
                    </>
                  )}
                </span>
                <input
                  value={t.name ?? ''}
                  onChange={(e) => setTeamName(idx, e.target.value)}
                  placeholder="Nom (optionnel)"
                  maxLength={60}
                  className="ml-auto min-w-0 flex-1 max-w-[160px] bg-surface border border-subtle rounded-md px-2 py-1 text-xs text-white placeholder:text-muted/60 focus:outline-none focus:border-primary"
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
        </div>
      )}

      {/* Liste d'attente */}
      {byeIds.size > 0 && (
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide mb-2">
            En attente ce round ({byeIds.size})
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from(byeIds).map((pid) => (
              <button
                key={pid}
                onClick={() => toggleBye(pid)}
                title="Remettre disponible"
                className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-1 rounded-full hover:bg-surface-alt transition-colors"
              >
                {nameOf(pid)}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Validation */}
      <div className="pt-1 space-y-2">
        {validationError && (teams.length > 0 || byeIds.size > 0 || pending) && (
          <p className="text-xs text-danger">{validationError}</p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full bg-primary text-app font-bold hover:bg-primary/90 gap-2 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          Confirmer et lancer le Round 1
        </Button>
      </div>
    </div>
  )
}

// ─── Round1Setup ──────────────────────────────────────────────────────────────

export function Round1Setup({ tournamentId, players, format }: Round1SetupProps) {
  const [mode, setMode] = useState<Mode | null>(null)

  if (!mode) {
    return (
      <div className="bg-surface border border-subtle rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display font-bold text-white text-base">
            Comment former les équipes du Round 1 ?
          </h3>
          <p className="text-muted text-xs mt-1">
            {players.length} joueur{players.length !== 1 ? 's' : ''} inscrit{players.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setMode('random')}
            className="flex flex-col items-start gap-2 p-4 bg-surface-alt hover:bg-primary/10 border border-subtle hover:border-primary rounded-xl transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-primary" />
              <span className="text-white font-semibold text-sm">Tirage aléatoire</span>
            </div>
            <p className="text-muted text-xs">Équipes formées automatiquement au sort</p>
          </button>
          <button
            onClick={() => setMode('manual')}
            className="flex flex-col items-start gap-2 p-4 bg-surface-alt hover:bg-primary/10 border border-subtle hover:border-primary rounded-xl transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Hand className="w-5 h-5 text-primary" />
              <span className="text-white font-semibold text-sm">Équipes manuelles</span>
            </div>
            <p className="text-muted text-xs">Je choisis moi-même les équipes</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-subtle rounded-xl p-4">
      {mode === 'random' ? (
        <RandomDraw tournamentId={tournamentId} onBack={() => setMode(null)} />
      ) : (
        <ManualDraw
          tournamentId={tournamentId}
          players={players}
          format={format}
          onBack={() => setMode(null)}
        />
      )}
    </div>
  )
}
