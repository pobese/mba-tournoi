'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { deletePlayers } from '@/app/(app)/players/actions'

interface BulkDeletePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerIds: string[]
  playerNames: Record<string, string>
  onDone: () => void
}

export function BulkDeletePlayersDialog({
  open,
  onOpenChange,
  playerIds,
  playerNames,
  onDone,
}: BulkDeletePlayersDialogProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const count = playerIds.length

  async function handleDelete() {
    setLoading(true)
    try {
      const result = await deletePlayers(playerIds)
      if (result?.error) {
        toast.error('Suppression impossible', { description: result.error, duration: 6000 })
        return
      }

      const deleted = result.deleted ?? 0
      const blocked = result.blocked ?? []
      const archived = result.archived ?? []

      if (deleted > 0) {
        toast.success(`${deleted} joueur${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}`, {
          description: archived.length > 0 ? `Tournoi(s) archivé(s) : ${archived.join(', ')}` : undefined,
        })
      }
      if (blocked.length > 0) {
        const lines = blocked
          .map((b) => `• ${playerNames[b.playerId] ?? 'Joueur'} — ${b.reason}`)
          .join('\n')
        toast.error(`${blocked.length} non supprimé${blocked.length > 1 ? 's' : ''}`, {
          description: lines,
          duration: 9000,
        })
      }

      onDone()
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error('Erreur inattendue', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-surface border-subtle">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            Supprimer {count} joueur{count > 1 ? 's' : ''} ?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted">
            Action irréversible. Les joueurs participant à un tournoi en cours seront
            ignorés. Ceux présents dans des tournois terminés entraîneront l&apos;archivage
            de ces tournois (résultats figés en lecture seule).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-subtle text-muted hover:text-white hover:bg-surface-alt">
            Annuler
          </AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90 border-0"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Supprimer la sélection
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
