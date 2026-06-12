'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
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
import { deleteTournament } from '@/app/(app)/tournaments/actions'
import type { TournamentStatus } from '@/types/app'

interface Props {
  tournamentId: string
  tournamentName: string
  tournamentStatus: TournamentStatus
}

export function TournamentDeleteButton({ tournamentId, tournamentName, tournamentStatus }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmInput, setConfirmInput] = useState('')
  const [loading, setLoading] = useState(false)

  const isOngoing = tournamentStatus === 'ongoing'
  const nameConfirmed = confirmInput.trim() === tournamentName.trim()

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      setStep(1)
      setConfirmInput('')
    }
  }

  async function handleDelete() {
    if (isOngoing && step === 1) {
      setStep(2)
      return
    }
    if (isOngoing && !nameConfirmed) return

    setLoading(true)
    try {
      const result = await deleteTournament({ tournamentId })
      if (result?.error) {
        toast.error('Erreur', { description: result.error })
        return
      }
      toast.success('Tournoi supprimé')
      router.refresh()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
      handleOpenChange(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        title={`Supprimer ${tournamentName}`}
        aria-label={`Supprimer ${tournamentName}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="bg-surface border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {step === 1
                ? `Supprimer « ${tournamentName} » ?`
                : 'Confirmation supplémentaire requise'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {step === 1 ? (
                isOngoing
                  ? 'Ce tournoi est en cours. Cette action est irréversible et supprimera tous les matchs et statistiques.'
                  : 'Tous les matchs, rounds et statistiques seront définitivement supprimés. Cette action est irréversible.'
              ) : (
                `Tapez le nom du tournoi pour confirmer la suppression :`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {step === 2 && (
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
              disabled={loading || (step === 2 && !nameConfirmed)}
              className="bg-danger text-white font-bold hover:bg-danger/90"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {step === 1 && isOngoing ? 'Continuer' : 'Supprimer'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
