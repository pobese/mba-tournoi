'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StarRating } from './StarRating'
import { createPlayer, updatePlayer } from '@/app/(app)/players/actions'
import { CreatePlayerSchema, type CreatePlayerInput } from '@/lib/validations/schemas'
import type { Player } from '@/types/app'

interface PlayerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player?: Pick<Player, 'id' | 'name' | 'level'>
}

export function PlayerFormDialog({ open, onOpenChange, player }: PlayerFormDialogProps) {
  const isEdit = !!player
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreatePlayerInput>({
    resolver: zodResolver(CreatePlayerSchema),
    defaultValues: { name: '', level: 3 },
  })

  const level = watch('level')

  useEffect(() => {
    if (open) {
      reset({ name: player?.name ?? '', level: player?.level ?? 3 })
    }
  }, [open, player, reset])

  async function onSubmit(data: CreatePlayerInput) {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('name', data.name)
      fd.append('level', String(data.level))

      let result: { error?: unknown; success?: boolean } | undefined

      if (isEdit) {
        fd.append('id', player.id)
        result = await updatePlayer(fd)
      } else {
        result = await createPlayer(fd)
      }

      if (result?.error) {
        const msg =
          typeof result.error === 'string'
            ? result.error
            : Object.values(result.error as Record<string, string[]>)
                .flat()
                .join(', ')
        toast.error(isEdit ? 'Modification échouée' : 'Création échouée', { description: msg })
        return
      }

      toast.success(isEdit ? 'Joueur modifié' : 'Joueur créé')
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
          <DialogTitle className="font-display text-white">
            {isEdit ? 'Modifier le joueur' : 'Ajouter un joueur'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="player-name" className="text-white text-sm">
              Nom / Pseudo
            </Label>
            <Input
              id="player-name"
              autoFocus
              placeholder="Alex Dupont"
              {...register('name')}
              className="bg-surface-alt border-subtle text-white placeholder:text-muted"
            />
            {errors.name && <p className="text-danger text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-white text-sm">Niveau</Label>
            <StarRating value={level} onChange={(v) => setValue('level', v)} />
            {errors.level && <p className="text-danger text-xs">{errors.level.message}</p>}
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
              type="submit"
              disabled={loading}
              className="bg-primary text-app font-bold hover:bg-primary/90"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
