'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { RegisterSchema, type RegisterInput } from '@/lib/validations/schemas'

/** Lit ?redirect= et n'accepte qu'un chemin interne (anti open-redirect). */
function safeRedirect(): string {
  if (typeof window === 'undefined') return '/'
  const r = new URLSearchParams(window.location.search).get('redirect')
  return r && r.startsWith('/') && !r.startsWith('//') ? r : '/'
}

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) })

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
          data: { full_name: fullName },
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
