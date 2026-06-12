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
import { deletePlayer } from '@/app/(app)/players/actions'

interface DeletePlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerId: string
  playerName: string
}

export function DeletePlayerDialog({
  open,
  onOpenChange,
  playerId,
  playerName,
}: DeletePlayerDialogProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const result = await deletePlayer(playerId)
      if (result?.error) {
        toast.error('Suppression impossible', { description: result.error, duration: 6000 })
        return
      }
      toast.success('Joueur supprimé')
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
          <AlertDialogTitle className="text-white">Supprimer {playerName} ?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted">
            Cette action est irréversible. Le joueur sera définitivement supprimé.
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
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
