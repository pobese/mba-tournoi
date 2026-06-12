'use client'

import { useState } from 'react'
import { Loader2, Lock, Plus, X, CheckCircle2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { PoolMatchCard } from './PoolMatchCard'
import { PoolStandingsTable } from './PoolStandingsTable'
import type { PoolMatchInfo, PoolView, TeamLite } from './pool-types'

interface PoolPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pool: PoolView | null
  teams: Record<string, TeamLite>
  freeCourts: number[]
  setsToWin: 1 | 2
  targetScore: number
  onChanged: () => void
  onAssignCourt: (poolId: string, court: number) => Promise<void>
  onReleaseCourt: (court: number) => Promise<void>
  onClosePool: (poolId: string) => Promise<void>
}

// Matchs à jouer triés : terrain assigné d'abord (par n° de terrain), puis sans terrain.
function sortPending(matches: PoolMatchInfo[]): PoolMatchInfo[] {
  return matches
    .filter((m) => m.status !== 'done')
    .sort((a, b) => {
      if (a.courtNumber !== null && b.courtNumber === null) return -1
      if (a.courtNumber === null && b.courtNumber !== null) return 1
      if (a.courtNumber !== null && b.courtNumber !== null) return a.courtNumber - b.courtNumber
      return 0
    })
}

export function PoolPanel({
  open,
  onOpenChange,
  pool,
  teams,
  freeCourts,
  setsToWin,
  targetScore,
  onChanged,
  onAssignCourt,
  onReleaseCourt,
  onClosePool,
}: PoolPanelProps) {
  const [closing, setClosing] = useState(false)

  if (!pool) return null

  const isFinished = pool.status === 'finished'
  const teamCount = pool.standings.length
  const total = pool.matches.length
  const played = pool.matches.filter((m) => m.status === 'done').length
  const allDone = total > 0 && played === total
  const pending = sortPending(pool.matches)

  const renderCard = (m: PoolMatchInfo, autoFocus: boolean) => (
    <PoolMatchCard
      key={m.id}
      matchId={m.id}
      team1={teams[m.team1Id ?? ''] ?? null}
      team2={teams[m.team2Id ?? ''] ?? null}
      courtNumber={m.courtNumber}
      poolCourts={pool.courts}
      initialScore1={m.score1}
      initialScore2={m.score2}
      initialSetScores={m.setScores}
      initialStatus={m.status}
      setsToWin={setsToWin}
      targetScore={targetScore}
      autoFocus={autoFocus}
      onChanged={onChanged}
    />
  )

  async function handleClose() {
    if (!pool) return
    setClosing(true)
    try {
      await onClosePool(pool.id)
    } finally {
      setClosing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{pool.name}</SheetTitle>
            <span className="text-sm text-muted">— {teamCount} équipes</span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              isFinished ? 'border-primary/30 bg-primary/15 text-primary' : 'border-accent/30 bg-accent/15 text-accent'
            }`}>
              {isFinished ? 'Terminée' : 'En cours'}
            </span>
          </div>

          {/* Terrains assignés à la poule + assignation */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <MapPin className="h-4 w-4 text-muted" />
            {pool.courts.length === 0 && <span className="text-xs text-muted">Aucun terrain</span>}
            {pool.courts.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                T{c}
                {!isFinished && (
                  <button
                    onClick={() => onReleaseCourt(c)}
                    aria-label={`Désassigner le terrain ${c}`}
                    className="rounded p-0.5 hover:bg-primary/25"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {!isFinished && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 rounded-lg border border-subtle bg-surface-alt px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-white">
                    <Plus className="h-3 w-3" /> Assigner
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="border-subtle bg-surface text-white">
                  {freeCourts.length === 0 && <DropdownMenuItem disabled className="text-muted">Aucun terrain libre</DropdownMenuItem>}
                  {freeCourts.map((c) => (
                    <DropdownMenuItem key={c} onClick={() => onAssignCourt(pool.id, c)} className="cursor-pointer focus:bg-surface-alt">
                      Terrain {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="todo" className="flex-1">
          <TabsList className="grid w-full grid-cols-3 bg-surface-alt">
            <TabsTrigger value="todo">Matchs à jouer</TabsTrigger>
            <TabsTrigger value="standings">Classement</TabsTrigger>
            <TabsTrigger value="all">Tous les matchs</TabsTrigger>
          </TabsList>

          {/* Onglet : matchs à jouer */}
          <TabsContent value="todo" className="mt-4 space-y-3">
            {isFinished ? (
              <p className="py-8 text-center text-sm text-muted">Poule clôturée.</p>
            ) : allDone ? (
              <div className="space-y-4 py-6 text-center">
                <p className="flex items-center justify-center gap-2 text-sm text-primary">
                  <CheckCircle2 className="h-5 w-5" /> Tous les matchs sont joués
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={closing} className="h-11 bg-primary px-6 font-bold text-app hover:bg-primary/90">
                      {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="mr-1.5 h-4 w-4" />Clôturer la poule</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-subtle bg-surface">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Clôturer {pool.name} ?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted">
                        Le classement sera figé, les scores verrouillés, et les terrains de la poule libérés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-subtle bg-surface-alt text-white hover:bg-surface-alt/80">Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClose} className="bg-primary text-app hover:bg-primary/90">Clôturer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : pending.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Aucun match à jouer.</p>
            ) : (
              pending.map((m, i) => renderCard(m, i === 0))
            )}
          </TabsContent>

          {/* Onglet : classement */}
          <TabsContent value="standings" className="mt-4">
            <PoolStandingsTable rows={pool.standings} />
          </TabsContent>

          {/* Onglet : tous les matchs */}
          <TabsContent value="all" className="mt-4 space-y-3">
            {pool.matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Aucun match.</p>
            ) : (
              pool.matches.map((m) => renderCard(m, false))
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
