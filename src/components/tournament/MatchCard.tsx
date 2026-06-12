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
import { updateMatchScore, resetMatchScore } from '@/app/(app)/tournaments/[id]/actions'
import { MAX_BADMINTON_SCORE } from '@/lib/constants'

interface TeamInfo {
  id: string
  player1: { id: string; name: string }
  player2?: { id: string; name: string } | null
}

interface MatchCardProps {
  matchId: string
  tournamentId: string
  team1: TeamInfo | null
  team2: TeamInfo | null
  initialScore1: number | null
  initialScore2: number | null
  initialStatus: string
  court?: string | null
}

function teamLabel(team: TeamInfo | null): string {
  if (!team) return 'BYE'
  if (team.player2) return `${team.player1.name} / ${team.player2.name}`
  return team.player1.name
}

export function MatchCard({
  matchId,
  tournamentId,
  team1,
  team2,
  initialScore1,
  initialScore2,
  initialStatus,
  court,
}: MatchCardProps) {
  const [score1, setScore1] = useState(String(initialScore1 ?? ''))
  const [score2, setScore2] = useState(String(initialScore2 ?? ''))
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [status, setStatus] = useState(initialStatus)

  const isDone = status === 'done'
  const isBye = status === 'bye'

  const s1 = parseInt(score1)
  const s2 = parseInt(score2)
  const scoresValid =
    !isNaN(s1) &&
    !isNaN(s2) &&
    s1 >= 0 &&
    s2 >= 0 &&
    s1 <= MAX_BADMINTON_SCORE &&
    s2 <= MAX_BADMINTON_SCORE &&
    s1 !== s2

  const winner = isDone
    ? initialScore1! > initialScore2!
      ? 1
      : 2
    : scoresValid
      ? s1 > s2
        ? 1
        : 2
      : null

  async function handleSave() {
    if (!scoresValid || !team1 || !team2) return
    setLoading(true)

    const winnerTeamId = s1 > s2 ? team1.id : team2.id

    try {
      const result = await updateMatchScore({
        matchId,
        tournamentId,
        scoreTeam1: s1,
        scoreTeam2: s2,
        winnerTeamId,
      })

      if (result?.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
        toast.error('Erreur', { description: msg })
        return
      }

      setStatus('done')
      toast.success('Score enregistré')
    } catch (err) {
      toast.error('Erreur inattendue', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const result = await resetMatchScore(matchId)
      if (result?.error) {
        toast.error('Erreur', { description: result.error })
        return
      }
      setStatus('pending')
      setScore1('')
      setScore2('')
      toast.success('Score supprimé')
    } catch (err) {
      toast.error('Erreur inattendue', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setResetting(false)
    }
  }

  if (isBye) {
    return (
      <div className="bg-surface border border-subtle rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="flex-1 text-muted text-sm">{teamLabel(team1)}</div>
        <span className="text-xs bg-surface-alt border border-subtle text-muted px-2 py-0.5 rounded-full">
          Exempt
        </span>
      </div>
    )
  }

  return (
    <div
      className={`bg-surface border rounded-xl px-4 py-3 transition-colors ${
        isDone ? 'border-subtle' : 'border-subtle hover:border-primary/40'
      }`}
    >
      {court && (
        <p className="text-muted text-xs mb-2">Court {court}</p>
      )}

      <div className="flex items-center gap-2">
        {/* Team 1 */}
        <div className={`flex-1 min-w-0 text-sm font-medium truncate ${winner === 1 ? 'text-primary' : 'text-white'}`}>
          {teamLabel(team1)}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            max={MAX_BADMINTON_SCORE}
            value={score1}
            onChange={(e) => setScore1(e.target.value)}
            disabled={isDone || loading}
            aria-label={`Score ${teamLabel(team1)}`}
            className={`w-14 h-12 sm:h-10 text-center text-lg sm:text-base font-display font-bold rounded-lg border bg-surface-alt text-white tabular-nums
              focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition
              disabled:opacity-70 disabled:cursor-not-allowed
              ${winner === 1 && isDone ? 'border-primary/50' : 'border-subtle'}`}
          />
          <span className="text-muted font-bold">—</span>
          <input
            type="number"
            min={0}
            max={MAX_BADMINTON_SCORE}
            value={score2}
            onChange={(e) => setScore2(e.target.value)}
            disabled={isDone || loading}
            aria-label={`Score ${teamLabel(team2)}`}
            className={`w-14 h-12 sm:h-10 text-center text-lg sm:text-base font-display font-bold rounded-lg border bg-surface-alt text-white tabular-nums
              focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition
              disabled:opacity-70 disabled:cursor-not-allowed
              ${winner === 2 && isDone ? 'border-primary/50' : 'border-subtle'}`}
          />
        </div>

        {/* Team 2 */}
        <div className={`flex-1 min-w-0 text-sm font-medium truncate text-right ${winner === 2 ? 'text-primary' : 'text-white'}`}>
          {teamLabel(team2)}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex justify-end gap-2">
        {isDone && (
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
        )}

        {!isDone && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!scoresValid || loading}
            className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-app transition-colors h-8 px-3 text-xs font-bold"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1" />
                Valider
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
