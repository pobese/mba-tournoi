'use client'

import { useState } from 'react'
import { Loader2, Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { submitMatchScore, resetMatchScore } from '@/app/(app)/tournaments/[id]/rounds-actions'
import { MAX_BADMINTON_SCORE, ROUNDS_MIN_GAP } from '@/lib/constants'

interface TeamInfo {
  id: string
  player1: { id: string; name: string }
  player2?: { id: string; name: string } | null
}

type ScoreActionResult = { success?: boolean; error?: unknown } | undefined

interface RoundsMatchCardProps {
  matchId: string
  courtNumber: number | null
  team1: TeamInfo | null
  team2: TeamInfo | null
  initialScore1: number | null
  initialScore2: number | null
  initialSetScores: Array<[number, number]> | null
  initialStatus: string
  setsToWin: 1 | 2
  targetScore: number
  waveBlocked?: boolean
  // Actions injectables : rounds par défaut, l'américain passe les siennes.
  submitAction?: (matchId: string, sets: Array<{ t1: number; t2: number }>) => Promise<ScoreActionResult>
  resetAction?: (matchId: string) => Promise<ScoreActionResult>
  minGap?: number
  onSaved?: () => void
}

function teamLabel(team: TeamInfo | null): string {
  if (!team) return 'BYE'
  if (team.player2) return `${team.player1.name} / ${team.player2.name}`
  return team.player1.name
}

type SetInput = { t1: string; t2: string }

function emptySet(): SetInput {
  return { t1: '', t2: '' }
}

function parseSet(s: SetInput): { t1: number; t2: number } | null {
  const t1 = parseInt(s.t1)
  const t2 = parseInt(s.t2)
  if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0 || t1 > MAX_BADMINTON_SCORE || t2 > MAX_BADMINTON_SCORE) return null
  return { t1, t2 }
}

// Renvoie 1 si team1 gagne le set, 2 si team2, 0 si null / inconnu
function setWinner(s: SetInput): 0 | 1 | 2 {
  const p = parseSet(s)
  if (!p) return 0
  return p.t1 > p.t2 ? 1 : p.t2 > p.t1 ? 2 : 0
}

export function RoundsMatchCard({
  matchId,
  courtNumber,
  team1,
  team2,
  initialScore1,
  initialScore2,
  initialSetScores,
  initialStatus,
  setsToWin,
  targetScore,
  waveBlocked = false,
  submitAction = submitMatchScore,
  resetAction = resetMatchScore,
  minGap = ROUNDS_MIN_GAP,
  onSaved,
}: RoundsMatchCardProps) {
  const initSets = (): SetInput[] => {
    if (initialSetScores && initialSetScores.length > 0) {
      return initialSetScores.map(([t1, t2]) => ({ t1: String(t1), t2: String(t2) }))
    }
    if (setsToWin === 1) {
      return [
        { t1: initialScore1 !== null ? String(initialScore1) : '', t2: initialScore2 !== null ? String(initialScore2) : '' },
      ]
    }
    return [emptySet()]
  }

  const [sets, setSets] = useState<SetInput[]>(initSets)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [status, setStatus] = useState(initialStatus)

  const isDone = status === 'done'

  // Calcul de l'état des sets pour le best-of-3
  const s1 = sets[0] ?? emptySet()
  const s2 = sets[1] ?? emptySet()
  const s3 = sets[2] ?? emptySet()

  const w1 = setWinner(s1)
  const w2 = setWinner(s2)
  const setsWon1 = (w1 === 1 ? 1 : 0) + (w2 === 1 ? 1 : 0) + (setWinner(s3) === 1 ? 1 : 0)
  const setsWon2 = (w1 === 2 ? 1 : 0) + (w2 === 2 ? 1 : 0) + (setWinner(s3) === 2 ? 1 : 0)
  const matchWinner = setsWon1 > setsWon2 ? 1 : setsWon2 > setsWon1 ? 2 : null

  // set2 apparaît si set1 est complet (best-of-3)
  const showSet2 = setsToWin === 2 && (!!parseSet(s1) || isDone)
  // set3 apparaît si set2 existe et que c'est 1-1
  const showSet3 = setsToWin === 2 && showSet2 && w1 !== 0 && w2 !== 0 && w1 !== w2

  // Warning écart insuffisant (non bloquant)
  const gapWarning = (() => {
    if (isDone) return null
    const activeSets: SetInput[] = [s1]
    if (showSet2) activeSets.push(s2)
    if (showSet3) activeSets.push(s3)
    for (const s of activeSets) {
      const p = parseSet(s)
      if (!p) continue
      const gap = Math.abs(p.t1 - p.t2)
      if (p.t1 !== p.t2 && gap < minGap && Math.max(p.t1, p.t2) >= targetScore) {
        return `Écart insuffisant — ${minGap} points d'écart minimum requis`
      }
    }
    return null
  })()

  // Vérification de validité pour Valider
  const isValid = (() => {
    if (!team1 || !team2) return false
    if (setsToWin === 1) {
      const p = parseSet(s1)
      return p !== null
    }
    // best-of-3 : besoin d'un gagnant clair (2 sets gagnés)
    if (setsWon1 === 2 || setsWon2 === 2) return true
    return false
  })()

  // Winner pour le style : dérivé de l'état `sets` (source de vérité, initialisé
  // depuis les scores serveur pour les matchs déjà validés) → le surlignage
  // s'affiche immédiatement après validation, sans attendre un refresh.
  const winnerSide = matchWinner

  async function handleSave() {
    if (!isValid) return
    setLoading(true)
    try {
      const setsToSend: Array<{ t1: number; t2: number }> = []
      const p1 = parseSet(s1)
      if (p1) setsToSend.push(p1)
      if (showSet2) {
        const p2 = parseSet(s2)
        if (p2) setsToSend.push(p2)
      }
      if (showSet3) {
        const p3 = parseSet(s3)
        if (p3) setsToSend.push(p3)
      }

      const result = await submitAction(matchId, setsToSend)
      if (result?.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
        toast.error('Erreur', { description: msg })
        return
      }
      setStatus('done')
      toast.success('Score enregistré')
      onSaved?.()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const result = await resetAction(matchId)
      if (result?.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
        toast.error('Erreur', { description: msg })
        return
      }
      setStatus('pending')
      setSets(setsToWin === 1 ? [emptySet()] : [emptySet()])
      toast.success('Score effacé')
      onSaved?.()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setResetting(false)
    }
  }

  function updateSet(idx: number, field: 't1' | 't2', val: string) {
    setSets((prev) => {
      const next = [...prev]
      const current = next[idx] ?? emptySet()
      next[idx] = { ...current, [field]: val }
      // Ajouter set2 si besoin
      if (setsToWin === 2 && idx === 0 && next.length === 1) next.push(emptySet())
      // Ajouter set3 si besoin
      if (setsToWin === 2 && idx === 1 && next.length === 2) next.push(emptySet())
      return next
    })
  }

  const inputCls = (side: 1 | 2, winnerInSet: 0 | 1 | 2, done: boolean) =>
    `w-14 h-12 sm:h-10 text-center text-lg sm:text-base font-display font-bold rounded-lg border
     bg-surface-alt text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary
     focus:border-primary transition disabled:opacity-70 disabled:cursor-not-allowed
     ${winnerInSet === side && done ? 'border-primary/50' : 'border-subtle'}`

  // Fonction de rendu (PAS un composant <SetRow/>) : appelée inline pour que les
  // inputs restent des enfants directs du parent et ne soient pas démontés à
  // chaque frappe — sinon le focus est perdu après chaque caractère.
  function renderSetRow(idx: number, setInput: SetInput, disabled: boolean) {
    const w = isDone ? 0 : setWinner(setInput)
    return (
      <div className="flex items-center gap-2">
        {setsToWin === 2 && (
          <span className="text-muted text-xs w-10 shrink-0">Set {idx + 1}</span>
        )}
        <div className={`flex-1 min-w-0 text-sm font-medium truncate ${isDone && winnerSide === 1 && idx === 0 ? 'text-primary' : 'text-white'}`}>
          {idx === 0 ? teamLabel(team1) : ''}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number" min={0} max={MAX_BADMINTON_SCORE}
            value={setInput.t1}
            onChange={(e) => updateSet(idx, 't1', e.target.value)}
            disabled={isDone || loading || waveBlocked || disabled}
            aria-label={`Set ${idx + 1} score ${teamLabel(team1)}`}
            className={inputCls(1, w, isDone)}
          />
          <span aria-hidden className="h-7 w-px border-l border-dashed border-primary/40" title="filet" />
          <input
            type="number" min={0} max={MAX_BADMINTON_SCORE}
            value={setInput.t2}
            onChange={(e) => updateSet(idx, 't2', e.target.value)}
            disabled={isDone || loading || waveBlocked || disabled}
            aria-label={`Set ${idx + 1} score ${teamLabel(team2)}`}
            className={inputCls(2, w, isDone)}
          />
        </div>
        <div className={`flex-1 min-w-0 text-sm font-medium truncate text-right ${isDone && winnerSide === 2 && idx === 0 ? 'text-primary' : 'text-white'}`}>
          {idx === 0 ? teamLabel(team2) : ''}
        </div>
      </div>
    )
  }

  // Pastille de statut affichée en haut à droite de la carte terrain.
  const statusPill = waveBlocked
    ? { label: 'En attente', cls: 'bg-surface-alt text-muted border-subtle' }
    : isDone
      ? { label: 'Terminé', cls: 'bg-primary/15 text-primary border-primary/30' }
      : { label: 'À jouer', cls: 'bg-accent/15 text-accent border-accent/30' }

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-surface to-surface-alt/40 px-4 py-3.5 transition-all ${
      isDone
        ? 'border-primary/25'
        : waveBlocked
          ? 'border-subtle opacity-60'
          : 'border-subtle hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
    }`}>
      {/* Liseré supérieur facon ligne de terrain */}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-0.5 ${isDone ? 'bg-primary/40' : waveBlocked ? 'bg-subtle' : 'bg-gradient-to-r from-primary/50 via-accent/40 to-primary/50'}`} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {courtNumber !== null ? (
            // Mini-terrain : rectangle vert avec filet central + numéro
            <span className="relative grid place-items-center w-9 h-9 rounded-lg bg-primary-dim/30 border border-primary/30">
              <span aria-hidden className="absolute inset-y-1.5 left-1/2 -translate-x-1/2 w-px bg-primary/40" />
              <span className="relative font-display font-extrabold text-primary text-sm tabular-nums">{courtNumber}</span>
            </span>
          ) : (
            <span className="w-9 h-9 rounded-lg bg-surface-alt border border-subtle" />
          )}
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Terrain</p>
            <p className="font-display font-bold text-white text-sm">
              {courtNumber !== null ? `N°${courtNumber}` : 'Match'}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${statusPill.cls}`}>
          {statusPill.label}
        </span>
      </div>

      <div className="space-y-2">
        {renderSetRow(0, s1, false)}

        {showSet2 && renderSetRow(1, s2, false)}

        {showSet3 && renderSetRow(2, s3, false)}
      </div>

      {/* Score en sets (best-of-3 uniquement) */}
      {setsToWin === 2 && (isDone || setsWon1 + setsWon2 > 0) && (
        <p className="mt-2 text-center text-xs text-muted tabular-nums">
          Sets : <span className={winnerSide === 1 ? 'text-primary font-bold' : 'text-white'}>{setsWon1}</span>
          {' — '}
          <span className={winnerSide === 2 ? 'text-primary font-bold' : 'text-white'}>{setsWon2}</span>
        </p>
      )}

      {!isDone && !waveBlocked && gapWarning && (
        <p className="mt-2 text-xs text-accent">⚠️ {gapWarning}</p>
      )}

      {!isDone && !waveBlocked && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm" onClick={handleSave}
            disabled={!isValid || loading}
            className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-app transition-colors h-8 px-3 text-xs font-bold"
          >
            {loading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <><Check className="w-3.5 h-3.5 mr-1" />Valider</>
            }
          </Button>
        </div>
      )}

      {isDone && !waveBlocked && (
        <div className="mt-2 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={resetting}
                className="text-muted hover:text-danger hover:bg-danger/10 h-8 px-3 text-xs"
              >
                {resetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-surface border-subtle">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Supprimer le score ?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted">
                  Le score de ce match sera supprimé. Le classement sera recalculé au prochain enregistrement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-surface-alt border-subtle text-white hover:bg-surface-alt/80">
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-danger/20 text-danger border border-danger/30 hover:bg-danger hover:text-white"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {waveBlocked && (
        <p className="mt-2 text-xs text-muted text-center">
          En attente de la vague précédente
        </p>
      )}
    </div>
  )
}
