'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Check, PauseCircle } from 'lucide-react'
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
  getRoundsPauseState,
  setRoundsPauses,
  type PauseStateRow,
} from '@/app/(app)/tournaments/[id]/rounds-actions'

interface PauseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  nextRoundNumber: number
}

export function PauseDialog({ open, onOpenChange, tournamentId, nextRoundNumber }: PauseDialogProps) {
  const router = useRouter()
  const [players, setPlayers] = useState<PauseStateRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getRoundsPauseState(tournamentId)
      .then((res) => {
        if (res.error) {
          toast.error('Erreur', { description: res.error })
        } else {
          const list = res.players ?? []
          setPlayers(list)
          setSelected(new Set(list.filter((p) => p.paused).map((p) => p.id)))
        }
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

  async function handleSave() {
    setSaving(true)
    try {
      const result = await setRoundsPauses(tournamentId, [...selected])
      if (result?.error) {
        toast.error('Erreur', { description: result.error, duration: 6000 })
        return
      }
      toast.success(
        selected.size > 0
          ? `${selected.size} joueur${selected.size > 1 ? 's' : ''} en pause au round ${nextRoundNumber}`
          : 'Aucune pause au prochain round',
      )
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-subtle">
        <DialogHeader>
          <DialogTitle className="text-white">Pauses du round {nextRoundNumber}</DialogTitle>
          <DialogDescription className="text-muted">
            Cochez les joueurs qui souhaitent être en attente au prochain round. Ils seront
            automatiquement mis de côté lors de son lancement, puis rejoueront ensuite.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-subtle divide-y divide-subtle">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Aucun joueur — lancez d&apos;abord le round 1.
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
                    isSelected ? 'bg-accent/10' : 'hover:bg-surface-alt/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      isSelected ? 'bg-accent border-accent text-app' : 'border-subtle text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                  {isSelected && (
                    <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-medium">
                      Pause
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-accent text-app font-bold hover:bg-accent/90 gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
