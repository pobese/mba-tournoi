'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Check, Loader2, Search, X } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { RegisterSchema, type RegisterInput } from '@/lib/validations/schemas'
import { searchClubs, type ClubSuggestion } from './actions'

/** "MBA — Maule Badminton Association · Maule" (nom — nom complet · ville). */
function formatClub(c: ClubSuggestion): string {
  return [c.name, c.full_name].filter(Boolean).join(' — ') + (c.city ? ` · ${c.city}` : '')
}

/** Lit ?redirect= et n'accepte qu'un chemin interne (anti open-redirect). */
function safeRedirect(): string {
  if (typeof window === 'undefined') return '/'
  const r = new URLSearchParams(window.location.search).get('redirect')
  return r && r.startsWith('/') && !r.startsWith('//') ? r : '/'
}

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Recherche de club (optionnelle) — état local, hors react-hook-form.
  const [clubQuery, setClubQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ClubSuggestion[]>([])
  const [selectedClub, setSelectedClub] = useState<ClubSuggestion | null>(null)
  const [searching, setSearching] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) })

  // Debounce 300ms de la recherche de club. Ne cherche pas tant qu'un club est
  // sélectionné (le champ affiche alors son libellé complet).
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
    setClubQuery(formatClub(club))
    setSuggestions([])
  }

  function clearClub() {
    setSelectedClub(null)
    setClubQuery('')
    setSuggestions([])
  }

  async function onSubmit(data: RegisterInput) {
    setLoading(true)
    try {
      const redirectTo = safeRedirect()
      const fullName = [data.firstName.trim(), data.lastName?.trim()].filter(Boolean).join(' ')
      const supabase = createBrowserSupabaseClient()
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: fullName,
            // Club optionnel → matching des profils joueurs au callback d'inscription.
            ...(selectedClub ? { club_id: selectedClub.id, club_name: selectedClub.name } : {}),
          },
          // Après confirmation d'email → callback qui ramène vers la destination.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) {
        toast.error('Inscription échouée', { description: error.message })
        return
      }

      if (signUpData.session === null) {
        toast.success('Vérifiez votre email !', {
          description: `Un lien de confirmation a été envoyé à ${data.email}.`,
          duration: 8000,
        })
        const loginHref = redirectTo === '/' ? '/login' : `/login?redirect=${encodeURIComponent(redirectTo)}`
        router.push(loginHref)
        return
      }

      toast.success('Compte créé !', { description: 'Bienvenue sur RacketClub.' })
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue'
      toast.error('Inscription échouée', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rc-landing relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4 py-10 font-dmsans">
      <div className="rc-hero-bg absolute inset-0 z-0" />
      <div className="rc-grid absolute inset-0 z-0" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block font-bebas text-4xl tracking-[2px] sm:text-5xl">
            <span className="text-primary">RACKET</span>
            <span className="text-text">CLUB</span>
          </Link>
          <p className="mt-2 text-sm text-muted">Créez votre compte gratuit</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-subtle bg-surface/80 p-6 shadow-2xl backdrop-blur-xl"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1.5 block text-sm text-text">
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                {...register('firstName')}
                className="w-full rounded-md border border-subtle bg-surface-alt px-3 py-2.5 text-sm text-text transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Alex"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="mb-1.5 block text-sm text-text">
                Nom <span className="text-muted">(optionnel)</span>
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                {...register('lastName')}
                className="w-full rounded-md border border-subtle bg-surface-alt px-3 py-2.5 text-sm text-text transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Dupont"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="relative">
            <label htmlFor="club" className="mb-1.5 block text-sm text-text">
              Votre club <span className="text-muted">(optionnel)</span>
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="club"
                type="text"
                autoComplete="off"
                value={clubQuery}
                onChange={(e) => {
                  if (selectedClub) setSelectedClub(null)
                  setClubQuery(e.target.value)
                }}
                className="w-full rounded-md border border-subtle bg-surface-alt px-3 py-2.5 pl-9 pr-9 text-sm text-text transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Rechercher un club…"
              />
              {selectedClub ? (
                <Check className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              ) : searching ? (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
              ) : null}
              {clubQuery && (
                <button
                  type="button"
                  onClick={clearClub}
                  aria-label="Effacer le club"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {suggestions.length > 0 && !selectedClub && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-subtle bg-surface shadow-2xl">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      // onMouseDown : sélectionne avant que le blur de l'input ne ferme la liste.
                      onMouseDown={(e) => {
                        e.preventDefault()
                        selectClub(c)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-alt"
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

            <p className="mt-1 text-xs text-muted">Vous pourrez retrouver vos résultats passés.</p>
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-text">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full rounded-md border border-subtle bg-surface-alt px-3 py-2.5 text-sm text-text transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="vous@exemple.fr"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-text">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="w-full rounded-md border border-subtle bg-surface-alt px-3 py-2.5 text-sm text-text transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Minimum 8 caractères"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer mon compte
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
