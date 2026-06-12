'use client'

import { useState } from 'react'
import { Check, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  submitBracketMatchScore,
  resetBracketMatchScore,
} from '@/app/(app)/tournaments/classic-actions'
import { MAX_BADMINTON_SCORE, CLASSIC_MIN_GAP } from '@/lib/constants'
import { emptySet, parseSet, setWinner, type SetInput } from './score-input'
import { actionError, type TeamLite } from './pool-types'
import type { BracketMatchView } from './bracket-types'

interface BracketScoreDialogProps {
  match: BracketMatchView | null
  teams: Record<string, TeamLite>
  setsToWin: 1 | 2
  targetScore: number
  onClose: () => void
  onChanged: () => void
}

function phaseLabel(match: BracketMatchView): string {
  if (match.phase === 'bracket_main') return 'Tableau principal'
  if (match.phase === 'barrage') return 'Barrage'
  return match.bracketPosition === 0 ? 'Repêchage consolante' : 'Consolante'
}

export function BracketScoreDialog({ match, teams, setsToWin, targetScore, onClose, onChanged }: BracketScoreDialogProps) {
  return (
    <Dialog open={match !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="border-subtle bg-surface">
        {/* key = match.id : réinitialise la saisie quand on change de match */}
        {match && (
          <ScoreForm key={match.id} match={match} teams={teams} setsToWin={setsToWin} targetScore={targetScore} onClose={onClose} onChanged={onChanged} />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ScoreFormProps {
  match: BracketMatchView
  teams: Record<string, TeamLite>
  setsToWin: 1 | 2
  targetScore: number
  onClose: () => void
  onChanged: () => void
}

function ScoreForm({ match, teams, setsToWin, targetScore, onClose, onChanged }: ScoreFormProps) {
  const initSets = (): SetInput[] =>
    match.setScores.length > 0
      ? match.setScores.map(([t1, t2]) => ({ t1: String(t1), t2: String(t2) }))
      : [emptySet()]

  const [sets, setSets] = useState<SetInput[]>(initSets)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const isDone = match.status === 'done'

  const name1 = match.team1Id ? teams[match.team1Id]?.name ?? '—' : '—'
  const name2 = match.team2Id ? teams[match.team2Id]?.name ?? '—' : '—'

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

  // Un match de tableau exige un vainqueur (pas d'égalité possible).
  const isValid = (() => {
    if (setsToWin === 1) {
      const p = parseSet(s1)
      return p !== null && p.t1 !== p.t2
    }
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

      const err = actionError(await submitBracketMatchScore(match.id, toSend))
      if (err) {
        toast.error('Erreur', { description: err })
        return
      }
      toast.success('Score enregistré — le vainqueur avance')
      onChanged()
      onClose()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const err = actionError(await resetBracketMatchScore(match.id))
      if (err) {
        toast.error('Erreur', { description: err })
        return
      }
      toast.success('Score annulé — les équipes avancées ont été retirées')
      onChanged()
      onClose()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setResetting(false)
    }
  }

  const inputCls =
    'w-20 h-14 sm:h-12 text-center text-2xl sm:text-xl font-display font-bold rounded-lg border ' +
    'bg-surface-alt text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary ' +
    'focus:border-primary transition disabled:opacity-70 disabled:cursor-not-allowed border-subtle'

  const scoreRow = (idx: number, label: string, field: 't1' | 't2', focusFirst: boolean) => {
    const setInput = sets[idx] ?? emptySet()
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{label}</span>
        <input
          type="number" inputMode="numeric" pattern="[0-9]*"
          min={0} max={MAX_BADMINTON_SCORE}
          value={field === 't1' ? setInput.t1 : setInput.t2}
          onChange={(e) => updateSet(idx, field, e.target.value)}
          disabled={isDone || loading}
          autoFocus={focusFirst && !isDone}
          aria-label={`Set ${idx + 1} — score ${label}`}
          className={inputCls}
        />
      </div>
    )
  }

  const setBlock = (idx: number) => (
    <div className="space-y-2">
      {setsToWin === 2 && <p className="text-[10px] uppercase tracking-wider text-muted">Set {idx + 1}</p>}
      {scoreRow(idx, name1, 't1', idx === 0)}
      {scoreRow(idx, name2, 't2', false)}
    </div>
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">{name1} vs {name2}</DialogTitle>
        <DialogDescription className="text-muted">{phaseLabel(match)}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {setBlock(0)}
        {showSet2 && setBlock(1)}
        {showSet3 && setBlock(2)}
      </div>

      {setsToWin === 2 && (isDone || setsWon1 + setsWon2 > 0) && (
        <p className="text-center text-xs tabular-nums text-muted">
          Sets : <span className={setsWon1 > setsWon2 ? 'font-bold text-primary' : 'text-white'}>{setsWon1}</span>
          {' — '}
          <span className={setsWon2 > setsWon1 ? 'font-bold text-primary' : 'text-white'}>{setsWon2}</span>
        </p>
      )}

      {!isDone && gapWarning && <p className="text-xs text-accent">⚠️ {gapWarning}</p>}

      {!isDone ? (
        <Button
          onClick={handleSave}
          disabled={!isValid || loading}
          className="h-12 w-full border border-primary/30 bg-primary/20 text-base font-bold text-primary hover:bg-primary hover:text-app disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1.5 h-4 w-4" />Valider</>}
        </Button>
      ) : (
        <Button
          onClick={handleReset}
          disabled={resetting}
          variant="ghost"
          className="h-10 w-full text-muted hover:bg-danger/10 hover:text-danger"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="mr-1.5 h-4 w-4" />Annuler le score</>}
        </Button>
      )}
    </>
  )
}
