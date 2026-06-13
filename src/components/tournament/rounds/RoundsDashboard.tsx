'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Flag, Loader2, Share2, Clock, PlayCircle, UserPlus } from 'lucide-react'
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
import { RoundProgress } from '@/components/tournament/RoundProgress'
import { RoundsMatchCard } from './RoundsMatchCard'
import { RoundsStandingsTable } from './RoundsStandingsTable'
import { Round1Setup, type TournamentPlayer } from './Round1Setup'
import { AddLatePlayerDialog } from './AddLatePlayerDialog'
import {
  closeRoundsRound,
  startRoundsRound,
  finishRoundsTournament,
} from '@/app/(app)/tournaments/[id]/rounds-actions'
import type { RoundsStatsRow } from '@/hooks/useRealtime'

interface TeamInfo {
  id: string
  player1: { id: string; name: string }
  player2?: { id: string; name: string } | null
}

export interface RoundsMatchInfo {
  id: string
  status: string
  score_team1: number | null
  score_team2: number | null
  set_scores: Array<[number, number]> | null
  wave: number
  court_number: number | null
  team1: TeamInfo | null
  team2: TeamInfo | null
}

export interface ByePlayerInfo {
  playerId: string
  playerName: string
  consecutivePlayed: number
}

interface RoundsDashboardProps {
  tournamentId: string
  tournamentSlug: string
  tournamentStatus: string
  currentRound: { id: string; round_number: number; status: string } | null
  completedRounds: number
  matches: RoundsMatchInfo[]
  byePlayers: ByePlayerInfo[]
  playerStats: RoundsStatsRow[]
  setsToWin: 1 | 2
  targetScore: number
  players: TournamentPlayer[]
  format: 'singles' | 'doubles'
}

function groupByWave(matches: RoundsMatchInfo[]): Map<number, RoundsMatchInfo[]> {
  const map = new Map<number, RoundsMatchInfo[]>()
  for (const m of matches) {
    const wave = m.wave ?? 1
    if (!map.has(wave)) map.set(wave, [])
    map.get(wave)!.push(m)
  }
  return map
}

function isWaveDone(waveMatches: RoundsMatchInfo[]): boolean {
  return waveMatches.every((m) => m.status === 'done' || m.status === 'bye')
}

export function RoundsDashboard({
  tournamentId,
  tournamentSlug,
  tournamentStatus,
  currentRound,
  completedRounds,
  matches,
  byePlayers,
  playerStats,
  setsToWin,
  targetScore,
  players,
  format,
}: RoundsDashboardProps) {
  const router = useRouter()
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const waves = groupByWave(matches)
  const waveNumbers = Array.from(waves.keys()).sort((a, b) => a - b)
  const hasMultipleWaves = waveNumbers.length > 1

  const totalMatches = matches.length
  const completedMatches = matches.filter((m) => m.status === 'done' || m.status === 'bye').length
  const allDone = totalMatches > 0 && completedMatches === totalMatches

  const isRoundOngoing = currentRound?.status === 'ongoing'
  const isRoundFinished = currentRound?.status === 'finished'
  const tournamentOngoing = tournamentStatus === 'ongoing'
  const tournamentFinished = tournamentStatus === 'finished'

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
      const result = await closeRoundsRound(currentRound.id)
      if (result?.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
      } else {
        toast.success(`Round ${currentRound.round_number} clôturé !`)
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setClosing(false)
      setCloseDialogOpen(false)
    }
  }

  async function handleStartNextRound() {
    setStarting(true)
    try {
      const result = await startRoundsRound(tournamentId)
      if (result?.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
      } else {
        toast.success(`Round ${completedRounds + 1} lancé !`)
        router.refresh()
      }
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setStarting(false)
    }
  }

  async function handleFinishTournament() {
    setFinishing(true)
    try {
      const result = await finishRoundsTournament(tournamentId)
      if (result?.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
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

  // ─── Colonne gauche ──────────────────────────────────────────────────────────

  const matchesSection = (
    <div className="space-y-4">
      {currentRound && (
        <div className="bg-surface border border-subtle rounded-xl p-4 space-y-4">
          <RoundProgress
            roundNumber={currentRound.round_number}
            totalMatches={totalMatches}
            completedMatches={completedMatches}
          />

          {/* Round en cours + tous les matchs terminés → bouton clôturer */}
          {allDone && isRoundOngoing && tournamentOngoing && (
            <Button
              onClick={() => setCloseDialogOpen(true)}
              className="w-full bg-accent text-app font-bold hover:bg-accent/90 gap-2"
            >
              <Flag className="w-4 h-4" />
              Clôturer le round {currentRound.round_number}
            </Button>
          )}

          {/* Round clôturé → lancer le suivant ou terminer */}
          {isRoundFinished && tournamentOngoing && (
            <div className="flex gap-2">
              <Button
                onClick={handleStartNextRound}
                disabled={starting}
                className="flex-1 bg-primary text-app font-bold hover:bg-primary/90 gap-2"
              >
                {starting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <PlayCircle className="w-4 h-4" />
                }
                Lancer le round {completedRounds + 1}
              </Button>
              <Button
                onClick={() => setFinishDialogOpen(true)}
                variant="outline"
                className="border-subtle text-muted hover:text-white hover:border-white gap-2"
              >
                <Flag className="w-4 h-4" />
                Terminer
              </Button>
            </div>
          )}

          {/* Tournoi terminé */}
          {tournamentFinished && (
            <p className="text-center text-sm text-muted">Tournoi terminé — {completedRounds} rounds joués</p>
          )}

          {/* Entrée d'un joueur en retard (en cours de tournoi) */}
          {tournamentOngoing && (
            <Button
              variant="ghost"
              onClick={() => setAddPlayerOpen(true)}
              className="w-full text-muted hover:text-white border border-subtle gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un joueur en cours
            </Button>
          )}
        </div>
      )}

      {/* Premier round — choix du mode */}
      {!currentRound && tournamentOngoing && (
        <Round1Setup
          tournamentId={tournamentId}
          players={players}
          format={format}
        />
      )}

      {/* Matchs : onglets si plusieurs vagues, sinon liste directe */}
      {matches.length === 0 ? (
        currentRound && isRoundFinished ? null : (
          <div className="bg-surface border border-subtle rounded-xl p-8 text-center text-muted text-sm">
            {currentRound ? 'Aucun match pour ce round.' : 'Lancez le premier round pour commencer.'}
          </div>
        )
      ) : hasMultipleWaves ? (
        <Tabs defaultValue={String(waveNumbers[0])}>
          <TabsList className="w-full bg-surface border border-subtle mb-4">
            {waveNumbers.map((wn) => {
              const prevDone = wn === 1 || isWaveDone(waves.get(wn - 1) ?? [])
              const waveDone = isWaveDone(waves.get(wn) ?? [])
              return (
                <TabsTrigger
                  key={wn}
                  value={String(wn)}
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-app gap-1"
                >
                  Vague {wn}
                  {waveDone && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                  {!prevDone && !waveDone && <Clock className="w-3 h-3 text-muted" />}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {waveNumbers.map((wn) => {
            const waveMatches = waves.get(wn) ?? []
            const prevDone = wn === 1 || isWaveDone(waves.get(wn - 1) ?? [])
            return (
              <TabsContent key={wn} value={String(wn)} className="space-y-2">
                {waveMatches.map((match) => (
                  <RoundsMatchCard
                    key={match.id}
                    matchId={match.id}
                    courtNumber={match.court_number}
                    team1={match.team1}
                    team2={match.team2}
                    initialScore1={match.score_team1}
                    initialScore2={match.score_team2}
                    initialSetScores={match.set_scores}
                    initialStatus={match.status}
                    setsToWin={setsToWin}
                    targetScore={targetScore}
                    waveBlocked={!prevDone}
                    onSaved={() => router.refresh()}
                  />
                ))}
              </TabsContent>
            )
          })}
        </Tabs>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => (
            <RoundsMatchCard
              key={match.id}
              matchId={match.id}
              courtNumber={match.court_number}
              team1={match.team1}
              team2={match.team2}
              initialScore1={match.score_team1}
              initialScore2={match.score_team2}
              initialSetScores={match.set_scores}
              initialStatus={match.status}
              setsToWin={setsToWin}
              targetScore={targetScore}
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {/* Joueurs en attente ce round */}
      {byePlayers.length > 0 && (
        <div className="bg-surface border border-subtle rounded-xl p-4 space-y-2">
          <h3 className="text-muted text-xs font-medium uppercase tracking-wide">
            En attente ce round
          </h3>
          {byePlayers.map((p) => (
            <div key={p.playerId} className="flex items-center justify-between">
              <span className="text-white text-sm">{p.playerName}</span>
              <div className="flex items-center gap-2">
                {p.consecutivePlayed > 0 && (
                  <span className="text-muted text-xs">
                    {p.consecutivePlayed} round{p.consecutivePlayed > 1 ? 's' : ''} joués d&apos;affilée
                  </span>
                )}
                <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-medium">
                  Bye
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─── Colonne droite ──────────────────────────────────────────────────────────

  const standingsSection = (
    <div className="bg-surface border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-white">
          Classement
          {completedRounds > 0 && (
            <span className="ml-2 text-xs text-muted font-normal">
              {completedRounds} round{completedRounds > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-muted hover:text-primary text-xs transition-colors"
          aria-label="Partager le tournoi"
        >
          <Share2 className="w-3.5 h-3.5" />
          Partager
        </button>
      </div>
      <RoundsStandingsTable
        tournamentId={tournamentId}
        completedRounds={completedRounds}
        initialStats={playerStats}
      />
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
              {allDone && isRoundOngoing && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="standings" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-app">
              Classement
            </TabsTrigger>
          </TabsList>
          <TabsContent value="matches">{matchesSection}</TabsContent>
          <TabsContent value="standings">{standingsSection}</TabsContent>
        </Tabs>
      </div>

      {/* Dialog : clôturer le round */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="bg-surface border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Clôturer le round {currentRound?.round_number} ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              Le classement sera mis à jour. Tu pourras ensuite lancer le round suivant ou terminer le tournoi.
              Cette action est irréversible.
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

      {/* Dialog : ajouter un joueur en retard */}
      <AddLatePlayerDialog
        open={addPlayerOpen}
        onOpenChange={setAddPlayerOpen}
        tournamentId={tournamentId}
      />

      {/* Dialog : terminer le tournoi */}
      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent className="bg-surface border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Terminer le tournoi ?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              Le tournoi sera marqué comme terminé après {completedRounds} round{completedRounds > 1 ? 's' : ''}.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-subtle text-muted hover:text-white hover:bg-surface-alt">
              Annuler
            </AlertDialogCancel>
            <Button
              onClick={handleFinishTournament}
              disabled={finishing}
              className="bg-danger text-white font-bold hover:bg-danger/90"
            >
              {finishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Terminer le tournoi
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
