'use client'

import { useState } from 'react'
import { Loader2, Check, RotateCcw, MapPin, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  submitPoolMatchScore,
  resetPoolMatchScore,
  setMatchCourt,
} from '@/app/(app)/tournaments/classic-actions'
import { MAX_BADMINTON_SCORE, CLASSIC_MIN_GAP } from '@/lib/constants'
import { actionError, type TeamLite } from './pool-types'
import { emptySet, parseSet, setWinner, type SetInput } from './score-input'

interface PoolMatchCardProps {
  matchId: string
  team1: TeamLite | null
  team2: TeamLite | null
  courtNumber: number | null
  poolCourts: number[]
  initialScore1: number | null
  initialScore2: number | null
  initialSetScores: Array<[number, number]>
  initialStatus: string
  setsToWin: 1 | 2
  targetScore: number
  autoFocus?: boolean
  onChanged: () => void
}

function teamLabel(team: TeamLite | null): string {
  if (!team) return 'BYE'
  return team.name
}

// Annonce la redistribution des terrains renvoyée par submitPoolMatchScore quand
// la poule vient de terminer ses matchs : quelle poule récupère quels terrains,
// et les terrains restés libres « pour le loisir ».
function announceRedistribution(result: unknown): void {
  if (!result || typeof result !== 'object' || !('redistribution' in result)) return
  const r = (result as { redistribution?: { moves: Array<{ poolName: string; courts: number[] }>; leisure: number[] } }).redistribution
  if (!r) return
  for (const m of r.moves) {
    if (m.courts.length === 0) continue
    toast.success(`${m.poolName} récupère ${m.courts.length > 1 ? 'les terrains' : 'le terrain'} ${m.courts.join(', ')}`)
  }
  if (r.leisure.length > 0) {
    const plural = r.leisure.length > 1
    toast(`${r.leisure.length} terrain${plural ? 's' : ''} libre${plural ? 's' : ''} pour le loisir`, {
      description: `Terrain${plural ? 's' : ''} ${r.leisure.join(', ')} — en attendant le tableau final`,
    })
  }
}

export function PoolMatchCard({
  matchId,
  team1,
  team2,
  courtNumber,
  poolCourts,
  initialScore1,
  initialScore2,
  initialSetScores,
  initialStatus,
  setsToWin,
  targetScore,
  autoFocus = false,
  onChanged,
}: PoolMatchCardProps) {
  const initSets = (): SetInput[] => {
    if (initialSetScores.length > 0) return initialSetScores.map(([t1, t2]) => ({ t1: String(t1), t2: String(t2) }))
    if (setsToWin === 1) {
      return [{ t1: initialScore1 !== null ? String(initialScore1) : '', t2: initialScore2 !== null ? String(initialScore2) : '' }]
    }
    return [emptySet()]
  }

  const [sets, setSets] = useState<SetInput[]>(initSets)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [savingCourt, setSavingCourt] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const isDone = initialStatus === 'done'

  const s1 = sets[0] ?? emptySet()
  const s2 = sets[1] ?? emptySet()
  const s3 = sets[2] ?? emptySet()
  const w1 = setWinner(s1)
  const w2 = setWinner(s2)
  const setsWon1 = (w1 === 1 ? 1 : 0) + (w2 === 1 ? 1 : 0) + (setWinner(s3) === 1 ? 1 : 0)
  const setsWon2 = (w1 === 2 ? 1 : 0) + (w2 === 2 ? 1 : 0) + (setWinner(s3) === 2 ? 1 : 0)

  const showSet2 = setsToWin === 2 && (!!parseSet(s1) || isDone)
  const showSet3 = setsToWin === 2 && showSet2 && w1 !== 0 && w2 !== 0 && w1 !== w2

  const gapWarning = (() => {
    if (isDone) return null
    const active: SetInput[] = [s1]
    if (showSet2) active.push(s2)
    if (showSet3) active.push(s3)
    for (const s of active) {
      const p = parseSet(s)
      if (!p) continue
      const gap = Math.abs(p.t1 - p.t2)
      if (p.t1 !== p.t2 && gap < CLASSIC_MIN_GAP && Math.max(p.t1, p.t2) >= targetScore) {
        return `Écart de ${gap} pt — la discipline requiert ${CLASSIC_MIN_GAP} pts minimum`
      }
    }
    return null
  })()

  const isValid = (() => {
    if (!team1 || !team2) return false
    if (setsToWin === 1) return parseSet(s1) !== null
    return setsWon1 === 2 || setsWon2 === 2
  })()

  function updateSet(idx: number, field: 't1' | 't2', val: string) {
    setSets((prev) => {
      const next = [...prev]
      const current = next[idx] ?? emptySet()
      next[idx] = { ...current, [field]: val }
      if (setsToWin === 2 && idx === 0 && next.length === 1) next.push(emptySet())
      if (setsToWin === 2 && idx === 1 && next.length === 2) next.push(emptySet())
      return next
    })
  }

  async function handleSave() {
    if (!isValid) return
    setLoading(true)
    try {
      const toSend: Array<{ t1: number; t2: number }> = []
      const p1 = parseSet(s1)
      if (p1) toSend.push(p1)
      if (showSet2) { const p = parseSet(s2); if (p) toSend.push(p) }
      if (showSet3) { const p = parseSet(s3); if (p) toSend.push(p) }

      const result = await submitPoolMatchScore(matchId, toSend)
      const err = actionError(result)
      if (err) {
        toast.error('Erreur', { description: err })
        return
      }
      // Checkmark de confirmation 500ms, puis refresh (le match quitte la liste).
      setJustSaved(true)
      toast.success('Score enregistré')
      announceRedistribution(result)
      setTimeout(() => onChanged(), 500)
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const err = actionError(await resetPoolMatchScore(matchId))
      if (err) {
        toast.error('Erreur', { description: err })
        return
      }
      toast.success('Score effacé')
      onChanged()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setResetting(false)
    }
  }

  async function handleCourt(next: number | null) {
    setSavingCourt(true)
    try {
      const err = actionError(await setMatchCourt(matchId, next))
      if (err) {
        toast.error('Erreur', { description: err })
        return
      }
      onChanged()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSavingCourt(false)
    }
  }

  const inputCls =
    'w-20 h-14 sm:h-12 text-center text-2xl sm:text-xl font-display font-bold rounded-lg border ' +
    'bg-surface-alt text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary ' +
    'focus:border-primary transition disabled:opacity-70 disabled:cursor-not-allowed border-subtle'

  function scoreRow(idx: number, team: TeamLite | null, side: 1 | 2, focusFirst: boolean) {
    const setInput = sets[idx] ?? emptySet()
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-white">{teamLabel(team)}</span>
        <input
          type="number" inputMode="numeric" pattern="[0-9]*"
          min={0} max={MAX_BADMINTON_SCORE}
          value={side === 1 ? setInput.t1 : setInput.t2}
          onChange={(e) => updateSet(idx, side === 1 ? 't1' : 't2', e.target.value)}
          disabled={isDone || loading}
          autoFocus={focusFirst && autoFocus}
          aria-label={`Set ${idx + 1} — score ${teamLabel(team)}`}
          className={inputCls}
        />
      </div>
    )
  }

  function setBlock(idx: number) {
    return (
      <div className="space-y-2">
        {setsToWin === 2 && <p className="text-[10px] uppercase tracking-wider text-muted">Set {idx + 1}</p>}
        {scoreRow(idx, team1, 1, idx === 0)}
        {scoreRow(idx, team2, 2, false)}
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-all ${
      isDone ? 'border-primary/25 bg-surface' : 'border-subtle bg-gradient-to-br from-surface to-surface-alt/40'
    }`}>
      {justSaved && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface/80 backdrop-blur-sm">
          <Check className="h-10 w-10 text-primary" />
        </div>
      )}

      {/* En-tête : badge terrain (menu) + statut */}
      <div className="mb-3 flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={savingCourt}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                courtNumber !== null
                  ? 'border-primary/30 bg-primary/15 text-primary hover:bg-primary/25'
                  : 'border-subtle bg-surface-alt text-muted hover:text-white'
              }`}
            >
              {savingCourt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              {courtNumber !== null ? `Terrain ${courtNumber}` : 'Sans terrain'}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-subtle bg-surface text-white">
            {poolCourts.length === 0 && (
              <DropdownMenuItem disabled className="text-muted">Aucun terrain sur la poule</DropdownMenuItem>
            )}
            {poolCourts.map((c) => (
              <DropdownMenuItem
                key={c}
                onClick={() => handleCourt(c)}
                className={`cursor-pointer focus:bg-surface-alt ${c === courtNumber ? 'text-primary' : 'text-white'}`}
              >
                Terrain {c}{c === courtNumber ? ' ✓' : ''}
              </DropdownMenuItem>
            ))}
            {courtNumber !== null && (
              <>
                <DropdownMenuSeparator className="bg-subtle" />
                <DropdownMenuItem onClick={() => handleCourt(null)} className="cursor-pointer text-danger focus:bg-danger/10">
                  Retirer le terrain
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
          isDone ? 'border-primary/30 bg-primary/15 text-primary' : 'border-accent/30 bg-accent/15 text-accent'
        }`}>
          {isDone ? 'Terminé' : 'À jouer'}
        </span>
      </div>

      <div className="space-y-3">
        {setBlock(0)}
        {showSet2 && setBlock(1)}
        {showSet3 && setBlock(2)}
      </div>

      {setsToWin === 2 && (isDone || setsWon1 + setsWon2 > 0) && (
        <p className="mt-2 text-center text-xs tabular-nums text-muted">
          Sets : <span className={setsWon1 > setsWon2 ? 'font-bold text-primary' : 'text-white'}>{setsWon1}</span>
          {' — '}
          <span className={setsWon2 > setsWon1 ? 'font-bold text-primary' : 'text-white'}>{setsWon2}</span>
        </p>
      )}

      {!isDone && gapWarning && <p className="mt-2 text-xs text-accent">⚠️ {gapWarning}</p>}

      {!isDone && (
        <div className="mt-3">
          <Button
            onClick={handleSave}
            disabled={!isValid || loading}
            className="h-12 w-full bg-primary/20 text-base font-bold text-primary border border-primary/30 hover:bg-primary hover:text-app disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1.5 h-4 w-4" />Valider</>}
          </Button>
        </div>
      )}

      {isDone && (
        <div className="mt-2 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={resetting} className="h-8 px-3 text-xs text-muted hover:bg-danger/10 hover:text-danger">
                {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-subtle bg-surface">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Supprimer le score ?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted">
                  Le score sera effacé et le classement de la poule recalculé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-subtle bg-surface-alt text-white hover:bg-surface-alt/80">Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-danger/20 text-danger border border-danger/30 hover:bg-danger hover:text-white">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
