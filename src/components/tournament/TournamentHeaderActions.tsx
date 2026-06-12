'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TournamentEditDialog } from '@/components/tournament/TournamentEditDialog'
import { deleteTournament } from '@/app/(app)/tournaments/actions'
import type { TournamentType, TournamentStatus, AmericanConfig, ClassicConfig, RoundsConfig } from '@/types/app'

type Config = AmericanConfig | ClassicConfig | RoundsConfig

interface Props {
  tournamentId: string
  tournamentName: string
  tournamentStatus: TournamentStatus
  tournamentType: TournamentType
  config: Config
  playerCount?: number
}

export function TournamentHeaderActions({
  tournamentId,
  tournamentName,
  tournamentStatus,
  tournamentType,
  config,
  playerCount = 8,
}: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const isDraft = tournamentStatus === 'draft'
  // Confirmation par saisie du nom requise dès que le tournoi n'est plus en
  // brouillon (en cours OU terminé) — protège contre une suppression accidentelle.
  const requiresNameConfirm = tournamentStatus !== 'draft'
  const nameConfirmed = confirmInput.trim() === tournamentName.trim()

  function handleDeleteOpenChange(v: boolean) {
    setDeleteOpen(v)
    if (!v) {
      setDeleteStep(1)
      setConfirmInput('')
    }
  }

  async function handleDelete() {
    if (requiresNameConfirm && deleteStep === 1) {
      setDeleteStep(2)
      return
    }
    if (requiresNameConfirm && !nameConfirmed) return

    setDeleting(true)
    try {
      const result = await deleteTournament({ tournamentId })
      if (result?.error) {
        toast.error('Erreur', { description: result.error })
        return
      }
      toast.success('Tournoi supprimé')
      router.push('/tournaments')
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setDeleting(false)
      handleDeleteOpenChange(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {isDraft && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            className="text-muted hover:text-white hover:bg-surface-alt h-8 px-3 text-xs gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifier
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDeleteOpen(true)}
          className="text-muted hover:text-danger hover:bg-danger/10 h-8 px-3 text-xs gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer
        </Button>
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
        <AlertDialogContent className="bg-surface border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {deleteStep === 1
                ? `Supprimer « ${tournamentName} » ?`
                : 'Confirmation supplémentaire requise'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {deleteStep === 1 ? (
                requiresNameConfirm
                  ? 'Ce tournoi a démarré. Cette action est irréversible et supprimera tous les matchs, rounds et statistiques.'
                  : 'Tous les matchs, rounds et statistiques seront définitivement supprimés. Cette action est irréversible.'
              ) : (
                'Tapez le nom du tournoi pour confirmer la suppression :'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteStep === 2 && (
            <div className="py-2">
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={tournamentName}
                className="bg-surface-alt border-subtle text-white placeholder:text-muted"
                autoFocus
              />
              {confirmInput.length > 0 && !nameConfirmed && (
                <p className="mt-1.5 text-xs text-danger">Le nom ne correspond pas</p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="border-subtle text-muted hover:text-white hover:bg-surface-alt">
              Annuler
            </AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={deleting || (deleteStep === 2 && !nameConfirmed)}
              className="bg-danger text-white font-bold hover:bg-danger/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {deleteStep === 1 && requiresNameConfirm ? 'Continuer' : 'Supprimer'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog (draft only) */}
      {isDraft && (
        <TournamentEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          tournamentId={tournamentId}
          tournamentType={tournamentType}
          initialName={tournamentName}
          initialConfig={config}
          playerCount={playerCount}
        />
      )}
    </>
  )
}
