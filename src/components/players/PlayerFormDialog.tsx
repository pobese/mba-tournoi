'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Check, Loader2, Search } from 'lucide-react'
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
import { searchClubs, type ClubSuggestion } from '@/app/(auth)/register/actions'
import { CreatePlayerSchema, type CreatePlayerInput } from '@/lib/validations/schemas'
import type { PlayerRow } from './PlayersClient'

interface PlayerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player?: PlayerRow
}

export function PlayerFormDialog({ open, onOpenChange, player }: PlayerFormDialogProps) {
  const isEdit = !!player
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Champs interclub (hors react-hook-form) : club recherché en DB + ville.
  const [clubQuery, setClubQuery] = useState('')
  const [cityValue, setCityValue] = useState('')
  const [selectedClub, setSelectedClub] = useState<ClubSuggestion | null>(null)
  const [suggestions, setSuggestions] = useState<ClubSuggestion[]>([])
  const [searching, setSearching] = useState(false)

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
      // Un club déjà lié (club_id) est réhydraté en « club sélectionné » ; sinon
      // on repart de l'indice texte libre.
      setSelectedClub(
        player?.club_id
          ? { id: player.club_id, name: player.club_name_hint ?? '', full_name: null, city: player.city_hint ?? null }
          : null,
      )
      setClubQuery(player?.club_name_hint ?? '')
      setCityValue(player?.city_hint ?? '')
      setSuggestions([])
    }
  }, [open, player, reset])

  // Debounce 300ms de la recherche de club. Pas de recherche tant qu'un club est
  // sélectionné (le champ affiche alors son nom).
  useEffect(() => {
    if (selectedClub) return
    const q = clubQuery.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        setSuggestions(await searchClubs(q))
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [clubQuery, selectedClub])

  function selectClub(club: ClubSuggestion) {
    setSelectedClub(club)
    setClubQuery(club.name)
    if (club.city) setCityValue(club.city)
    setSuggestions([])
  }

  async function onSubmit(data: CreatePlayerInput) {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('name', data.name)
      fd.append('level', String(data.level))
      // Club lié uniquement s'il vient de la DB ; sinon indice texte libre.
      fd.append('club_id', selectedClub?.id ?? '')
      fd.append('club_name_hint', (selectedClub?.name ?? clubQuery).trim())
      fd.append('city_hint', cityValue.trim())

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

          <div className="space-y-1.5">
            <Label htmlFor="player-club" className="text-white text-sm">
              Club <span className="text-muted">(optionnel)</span>
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="player-club"
                autoComplete="off"
                value={clubQuery}
                onChange={(e) => {
                  if (selectedClub) setSelectedClub(null)
                  setClubQuery(e.target.value)
                }}
                placeholder="Ex: MBA, Club d'Épone..."
                className="bg-surface-alt border-subtle pl-9 pr-9 text-white placeholder:text-muted"
              />
              {selectedClub ? (
                <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              ) : searching ? (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
              ) : null}

              {suggestions.length > 0 && !selectedClub && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-subtle bg-surface shadow-2xl">
                  {suggestions.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectClub(c)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-white transition-colors hover:bg-surface-alt"
                      >
                        <span className="font-semibold">{c.name}</span>
                        {(c.full_name || c.city) && (
                          <span className="text-muted">
                            {c.full_name ? ` — ${c.full_name}` : ''}
                            {c.city ? ` · ${c.city}` : ''}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-muted text-xs">Le club sera lié automatiquement s’il s’inscrit sur RacketClub.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="player-city" className="text-white text-sm">
              Ville <span className="text-muted">(optionnel)</span>
            </Label>
            <Input
              id="player-city"
              autoComplete="off"
              value={cityValue}
              onChange={(e) => setCityValue(e.target.value)}
              placeholder="Ex: Maule, Épone, Flins..."
              className="bg-surface-alt border-subtle text-white placeholder:text-muted"
            />
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
