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
      const supabase = createBrowserSupabaseClient()
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.name } },
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
        router.push('/login')
        return
      }

      toast.success('Compte créé !', { description: 'Bienvenue sur RacketClub.' })
      router.push('/')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue'
      toast.error('Inscription échouée', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-extrabold text-white">
            MBA <span className="text-primary">Tournoi</span>
          </h1>
          <p className="text-muted text-sm mt-2">Créez votre compte gratuit</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-surface border border-subtle rounded-xl p-6 space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm text-white mb-1.5">
              Prénom / Pseudo
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register('name')}
              className="w-full bg-surface-alt border border-subtle rounded-md px-3 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="Alex Dupont"
            />
            {errors.name && (
              <p className="text-danger text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-white mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full bg-surface-alt border border-subtle rounded-md px-3 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="vous@exemple.fr"
            />
            {errors.email && (
              <p className="text-danger text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-white mb-1.5">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="w-full bg-surface-alt border border-subtle rounded-md px-3 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="Minimum 8 caractères"
            />
            {errors.password && (
              <p className="text-danger text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-app font-bold py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer mon compte
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
