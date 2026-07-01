'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { LoginSchema, type LoginInput } from '@/lib/validations/schemas'

/** Lit ?redirect= et n'accepte qu'un chemin interne (anti open-redirect). */
function safeRedirect(): string {
  if (typeof window === 'undefined') return '/'
  const r = new URLSearchParams(window.location.search).get('redirect')
  return r && r.startsWith('/') && !r.startsWith('//') ? r : '/'
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) })

  async function onSubmit(data: LoginInput) {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        const description =
          error.message === 'Email not confirmed'
            ? 'Confirmez votre email avant de vous connecter. Vérifiez votre boîte mail.'
            : error.message === 'Invalid login credentials'
              ? 'Email ou mot de passe incorrect.'
              : error.message
        toast.error('Connexion échouée', { description, duration: 6000 })
        return
      }

      router.push(safeRedirect())
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue'
      toast.error('Connexion échouée', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rc-landing relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4 font-dmsans">
      <div className="rc-hero-bg absolute inset-0 z-0" />
      <div className="rc-grid absolute inset-0 z-0" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block font-bebas text-4xl tracking-[2px] sm:text-5xl">
            <span className="text-primary">RACKET</span>
            <span className="text-text">CLUB</span>
          </Link>
          <p className="mt-2 text-sm text-muted">Connectez-vous à votre compte</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-subtle bg-surface/80 p-6 shadow-2xl backdrop-blur-xl"
        >
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
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded-md border border-subtle bg-surface-alt px-3 py-2.5 text-sm text-text transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="••••••••"
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
            Se connecter
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}
