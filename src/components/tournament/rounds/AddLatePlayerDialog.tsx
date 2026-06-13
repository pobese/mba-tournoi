'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Check, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getAddablePlayers,
  addLatePlayerToRounds,
  type AddablePlayer,
} from '@/app/(app)/tournaments/[id]/rounds-actions'

interface AddLatePlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
}

export function AddLatePlayerDialog({ open, onOpenChange, tournamentId }: AddLatePlayerDialogProps) {
  const router = useRouter()
  const [players, setPlayers] = useState<AddablePlayer[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setLoading(true)
    getAddablePlayers(tournamentId)
      .then((res) => {
        if (res.error) toast.error('Erreur', { description: res.error })
        else setPlayers(res.players ?? [])
      })
      .finally(() => setLoading(false))
  }, [open, tournamentId])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAdd() {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const ids = [...selected]
      const results = await Promise.all(ids.map((id) => addLatePlayerToRounds(tournamentId, id)))
      const ok = results.filter((r) => r.success).length
      const failed = results.filter((r) => r.error)
      if (ok > 0) {
        toast.success(`${ok} joueur${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}`, {
          description: 'Intégré(s) dès le prochain round.',
        })
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} échec${failed.length > 1 ? 's' : ''}`, {
          description: failed[0]?.error,
        })
      }
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-subtle">
        <DialogHeader>
          <DialogTitle className="text-white">Ajouter un joueur en cours</DialogTitle>
          <DialogDescription className="text-muted">
            Sélectionnez un ou plusieurs joueurs de votre liste. Ils rejoindront le tournoi
            dès le prochain round lancé.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-subtle divide-y divide-subtle">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Tous vos joueurs sont déjà inscrits à ce tournoi.
            </p>
          ) : (
            players.map((p) => {
              const isSelected = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected ? 'bg-primary/10' : 'hover:bg-surface-alt/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      isSelected ? 'bg-primary border-primary text-app' : 'border-subtle text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                  <span className="text-muted text-xs">
                    {'★'.repeat(p.level ?? 3)}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleAdd}
            disabled={submitting || selected.size === 0}
            className="bg-primary text-app font-bold hover:bg-primary/90 gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Ajouter {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
