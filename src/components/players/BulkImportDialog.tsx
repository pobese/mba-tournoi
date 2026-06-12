'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { bulkImportPlayers } from '@/app/(app)/players/actions'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const preview = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2).length

  async function handleImport() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const result = await bulkImportPlayers(text)
      if (result?.error) {
        toast.error("Import échoué", { description: result.error })
        return
      }
      const { created, skipped } = result as { created: number; skipped: number }
      toast.success(
        `${created} joueur${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''}`,
        {
          description: skipped > 0 ? `${skipped} doublon${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''}` : undefined,
        }
      )
      setText('')
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-subtle sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Import de joueurs</DialogTitle>
          <DialogDescription className="text-muted">
            Un nom par ligne. Niveau par défaut : 3 étoiles. Les doublons sont ignorés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-1">
          <Label htmlFor="bulk-names" className="text-white text-sm">
            Liste des joueurs
          </Label>
          <Textarea
            id="bulk-names"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Alice Martin\nBob Dupont\nCharlie Leroi'}
            rows={8}
            className="bg-surface-alt border-subtle text-white placeholder:text-muted font-mono text-sm resize-none"
          />
          {preview > 0 && (
            <p className="text-muted text-xs">
              {preview} joueur{preview > 1 ? 's' : ''} détecté{preview > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted hover:text-white"
          >
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || preview === 0}
            className="bg-primary text-app font-bold hover:bg-primary/90"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importer {preview > 0 ? `(${preview})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
