'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  AmericanForm,
  ClassicForm,
  RoundsForm,
} from '@/components/tournament/TournamentConfigForm'
import { updateTournament } from '@/app/(app)/tournaments/actions'
import type { TournamentType, AmericanConfig, ClassicConfig, RoundsConfig } from '@/types/app'
import { TOURNAMENT_NAME_MIN, TOURNAMENT_NAME_MAX } from '@/lib/constants'

type Config = AmericanConfig | ClassicConfig | RoundsConfig

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  tournamentType: TournamentType
  initialName: string
  initialConfig: Config
  playerCount?: number
}

export function TournamentEditDialog({
  open,
  onOpenChange,
  tournamentId,
  tournamentType,
  initialName,
  initialConfig,
  playerCount = 8,
}: Props) {
  const [name, setName] = useState(initialName)
  const [config, setConfig] = useState<Config>(initialConfig)
  const [loading, setLoading] = useState(false)

  const nameValid = name.trim().length >= TOURNAMENT_NAME_MIN && name.trim().length <= TOURNAMENT_NAME_MAX

  async function handleSave() {
    if (!nameValid) return
    setLoading(true)
    try {
      const result = await updateTournament({ tournamentId, name: name.trim(), config })
      if (result?.error) {
        const msg = typeof result.error === 'string' ? result.error : 'Configuration invalide'
        toast.error('Erreur', { description: msg })
        return
      }
      toast.success('Tournoi mis à jour')
      onOpenChange(false)
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-subtle max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Modifier le tournoi</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label className="text-white text-sm">Nom</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={TOURNAMENT_NAME_MAX}
              className="bg-surface-alt border-subtle text-white placeholder:text-muted"
            />
          </div>

          <div className="border-t border-subtle pt-4">
            {tournamentType === 'american' && (
              <AmericanForm config={config as AmericanConfig} onChange={setConfig} />
            )}
            {tournamentType === 'classic' && (
              <ClassicForm
                config={config as ClassicConfig}
                teamCount={
                  (config as ClassicConfig).format === 'doubles'
                    ? Math.floor(playerCount / 2)
                    : playerCount
                }
                onChange={setConfig}
              />
            )}
            {tournamentType === 'rounds' && (
              <RoundsForm config={config as RoundsConfig} onChange={setConfig} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-muted hover:text-white"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={!nameValid || loading}
            className="bg-primary text-app font-bold hover:bg-primary/90 min-w-28"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
