'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Share2, Flag, Loader2, Play, Trophy } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MatchCard } from './MatchCard'
import { RoundProgress } from './RoundProgress'
import { StandingsTable } from './StandingsTable'
import { closeRound, startNextAmericanRound, finishAmericanTournament } from '@/app/(app)/tournaments/[id]/actions'

interface TeamInfo {
  id: string
  player1: { id: string; name: string }
  player2?: { id: string; name: string } | null
}

interface MatchInfo {
  id: string
  status: string
  score_team1: number | null
  score_team2: number | null
  winner_team_id: string | null
  court: string | null
  team1: TeamInfo | null
  team2: TeamInfo | null
}

interface RoundInfo {
  id: string
  round_number: number
  status: string
}

interface StandingRow {
  id: string
  rank: number | null
  playerName: string
  pointsScored: number
  pointsConceded: number
  wins: number
  losses: number
  matchesPlayed: number
}

interface TournamentDashboardProps {
  tournamentId: string
  tournamentSlug: string
  tournamentType: string
  tournamentStatus: string
  currentRound: RoundInfo | null
  totalRounds: number
  allRounds: RoundInfo[]
  matches: MatchInfo[]
  standings: StandingRow[]
}

export function TournamentDashboard({
  tournamentId,
  tournamentSlug,
  tournamentType,
  tournamentStatus,
  currentRound,
  totalRounds,
  matches,
  standings,
}: TournamentDashboardProps) {
  const router = useRouter()
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [startingNext, setStartingNext] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const isAmerican = tournamentType === 'american'
  const completedMatches = matches.filter(
    (m) => m.status === 'done' || m.status === 'bye'
  ).length
  const allDone = matches.length > 0 && completedMatches === matches.length
  const roundIsClosed = currentRound?.status === 'finished'

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://mba.stellix.fr'}/t/${tournamentSlug}`

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Lien copié !', { description: publicUrl })
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  async function handleCloseRound() {
    if (!currentRound) return
    setClosing(true)
    try {
      const result = await closeRound(tournamentId, currentRound.id)
      if (result?.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
      } else {
        toast.success('Round clôturé !')
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setClosing(false)
      setCloseDialogOpen(false)
    }
  }

  async function handleStartNext() {
    setStartingNext(true)
    try {
      const result = await startNextAmericanRound(tournamentId)
      if (result?.error) {
        toast.error('Erreur', { description: result.error })
      } else {
        toast.success('Round suivant lancé !')
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setStartingNext(false)
    }
  }

  async function handleFinish() {
    setFinishing(true)
    try {
      const result = await finishAmericanTournament(tournamentId)
      if (result?.error) {
        toast.error('Erreur', { description: result.error })
      } else {
        toast.success('Tournoi terminé !')
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setFinishing(false)
      setFinishDialogOpen(false)
    }
  }

  const matchesSection = (
    <div className="space-y-4">
      {currentRound && (
        <div className="bg-surface border border-subtle rounded-xl p-4 space-y-3">
          <RoundProgress
            roundNumber={currentRound.round_number}
            totalRounds={isAmerican ? undefined : (totalRounds || undefined)}
            totalMatches={matches.length}
            completedMatches={completedMatches}
          />

          {/* Clôturer le round (si tous les matchs sont terminés et round non encore clôturé) */}
          {allDone && !roundIsClosed && tournamentStatus === 'ongoing' && (
            <Button
              onClick={() => setCloseDialogOpen(true)}
              className="w-full bg-accent text-app font-bold hover:bg-accent/90 gap-2"
            >
              <Flag className="w-4 h-4" />
              Clôturer le round
            </Button>
          )}

          {/* Boutons contrôle manuel (American uniquement, après clôture du round) */}
          {isAmerican && roundIsClosed && tournamentStatus === 'ongoing' && (
            <div className="flex gap-2">
              <Button
                onClick={handleStartNext}
                disabled={startingNext}
                className="flex-1 bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-app gap-2 font-bold"
              >
                {startingNext ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Round suivant
              </Button>
              <Button
                onClick={() => setFinishDialogOpen(true)}
                disabled={finishing}
                variant="ghost"
                className="flex-1 text-muted hover:text-accent hover:bg-accent/10 border border-subtle gap-2 font-bold"
              >
                <Trophy className="w-4 h-4" />
                Terminer
              </Button>
            </div>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-xl p-8 text-center text-muted text-sm">
          Aucun match pour ce round.
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              matchId={match.id}
              tournamentId={tournamentId}
              team1={match.team1}
              team2={match.team2}
              initialScore1={match.score_team1}
              initialScore2={match.score_team2}
              initialStatus={match.status}
              court={match.court}
            />
          ))}
        </div>
      )}
    </div>
  )

  const standingsSection = (
    <div className="bg-surface border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-white">Classement</h2>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-muted hover:text-primary text-xs transition-colors"
          aria-label="Partager le tournoi"
        >
          <Share2 className="w-3.5 h-3.5" />
          Partager
        </button>
      </div>
      <StandingsTable tournamentId={tournamentId} initialStandings={standings} />
    </div>
  )

  return (
    <>
      {/* Desktop : 2 colonnes */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">{matchesSection}</div>
        <div className="lg:col-span-1">{standingsSection}</div>
      </div>

      {/* Mobile : tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="matches">
          <TabsList className="w-full bg-surface border border-subtle mb-4">
            <TabsTrigger value="matches" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-app">
              Matchs
              {allDone && !roundIsClosed && (
                <span className="ml-1.5 w-2 h-2 rounded-full bg-accent inline-block" />
              )}
            </TabsTrigger>
            <TabsTrigger value="standings" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-app">
              Classement
            </TabsTrigger>
          </TabsList>
          <TabsContent value="matches">{matchesSection}</TabsContent>
          <TabsContent value="standings">{standingsSection}</TabsContent>
        </Tabs>
      </div>

      {/* AlertDialog clôture round */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="bg-surface border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Clôturer le round {currentRound?.round_number} ?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {isAmerican
                ? 'Le classement sera recalculé. Vous pourrez ensuite lancer le round suivant ou terminer le tournoi.'
                : 'Le classement sera recalculé et les matchs du round suivant générés automatiquement. Cette action est irréversible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-subtle text-muted hover:text-white hover:bg-surface-alt">
              Annuler
            </AlertDialogCancel>
            <Button
              onClick={handleCloseRound}
              disabled={closing}
              className="bg-accent text-app font-bold hover:bg-accent/90"
            >
              {closing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Clôturer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog terminer tournoi (American) */}
      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent className="bg-surface border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Terminer le tournoi ?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              Le classement final sera figé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-subtle text-muted hover:text-white hover:bg-surface-alt">
              Annuler
            </AlertDialogCancel>
            <Button
              onClick={handleFinish}
              disabled={finishing}
              className="bg-accent text-app font-bold hover:bg-accent/90"
            >
              {finishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Terminer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
