# SKILL : Data Fetching, Server Actions & State

Consulter ce fichier AVANT d'écrire tout code de fetching, mutation, ou gestion d'état.

---

## Règle fondamentale : qui fait quoi

```
Server Component (RSC)     → lit les données au chargement de la page
Server Action (actions.ts) → mute les données (create/update/delete)
Client Component           → interactivité locale, formulaires, realtime
Hook (hooks/)              → logique réutilisable, subscriptions Realtime
Zustand store              → état partagé entre composants distants
```

Un composant ne fait pas les deux : soit il est serveur (async, fetch),
soit il est client ('use client', hooks React).

---

## Pattern : Server Component avec fetch

```typescript
// app/(app)/tournaments/page.tsx — Server Component
import { createServerClient } from '@/lib/supabase/server'
import { TournamentList } from '@/components/tournament/TournamentList'

export default async function TournamentsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select(`
      id, name, type, status, created_at,
      tournament_players (count)
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // En RSC : logger + afficher un message d'erreur propre
    console.error('getUser tournaments:', error.code, error.message)
    return <ErrorState message="Impossible de charger les tournois" />
  }

  return <TournamentList tournaments={tournaments ?? []} />
}
```

---

## Pattern : Server Action (mutation)

```typescript
// app/(app)/players/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CreatePlayerSchema } from '@/lib/validations/schemas'

export async function createPlayer(formData: FormData) {
  // 1. Auth — toujours vérifier l'utilisateur
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // 2. Validation Zod AVANT tout
  const raw = Object.fromEntries(formData)
  const parsed = CreatePlayerSchema.safeParse({
    name: raw.name,
    level: Number(raw.level),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 3. Mutation DB
  const { error } = await supabase
    .from('players')
    .insert({ ...parsed.data, created_by: user.id })

  if (error) {
    return { error: { _form: ['Erreur lors de la création'] } }
  }

  // 4. Revalidation du cache
  revalidatePath('/players')
  return { success: true }
}
```

---

## Pattern : formulaire avec React Hook Form + Server Action

```typescript
// components/players/CreatePlayerForm.tsx
'use client'

import { useActionState } from 'react'  // React 19 / Next 14
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPlayer } from '@/app/(app)/players/actions'
import { CreatePlayerSchema, type CreatePlayerInput } from '@/lib/validations/schemas'
import { toast } from 'sonner'

export function CreatePlayerForm() {
  const form = useForm<CreatePlayerInput>({
    resolver: zodResolver(CreatePlayerSchema),
    defaultValues: { name: '', level: 3 },
  })

  async function onSubmit(data: CreatePlayerInput) {
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)))

    const result = await createPlayer(formData)
    if (result?.error) {
      toast.error('Erreur', { description: JSON.stringify(result.error) })
    } else {
      toast.success('Joueur créé')
      form.reset()
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* champs... */}
      </form>
    </Form>
  )
}
```

---

## Pattern : Realtime Supabase

```typescript
// hooks/useRealtimeScores.ts
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Match } from '@/types/app'

export function useRealtimeScores(tournamentId: string, initialMatches: Match[]) {
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel(`tournament:${tournamentId}:matches`)  // channel name unique par tournoi
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          setMatches(prev =>
            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
          )
        }
      )
      .subscribe()

    // Cleanup obligatoire
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, supabase])

  return matches
}
```

---

## Pattern : Zustand store

```typescript
// stores/tournament-store.ts
import { create } from 'zustand'
import type { Tournament, Round } from '@/types/app'

interface TournamentState {
  activeTournament: Tournament | null
  currentRound: Round | null
  setActiveTournament: (t: Tournament) => void
  setCurrentRound: (r: Round) => void
  reset: () => void
}

export const useTournamentStore = create<TournamentState>((set) => ({
  activeTournament: null,
  currentRound: null,
  setActiveTournament: (activeTournament) => set({ activeTournament }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  reset: () => set({ activeTournament: null, currentRound: null }),
}))

// Usage dans un Client Component
const { activeTournament, setActiveTournament } = useTournamentStore()
```

---

## Pattern : Suspense + Skeleton

```typescript
// app/(app)/tournaments/[id]/page.tsx
import { Suspense } from 'react'
import { TournamentDashboard } from '@/components/tournament/TournamentDashboard'
import { TournamentDashboardSkeleton } from '@/components/tournament/TournamentDashboardSkeleton'

export default function TournamentPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<TournamentDashboardSkeleton />}>
      <TournamentDashboard id={params.id} />
    </Suspense>
  )
}

// TournamentDashboard est un Server Component async qui peut prendre du temps
// Le Skeleton s'affiche pendant le fetch
```

---

## Pattern : Error handling uniforme

```typescript
// lib/utils.ts — helper pour wrapper les erreurs Supabase
type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<ActionResult<T>> {
  const { data, error } = await queryFn()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'Not found' }
  return { data, error: null }
}
```

---

## Règles de cache Next.js

```typescript
// Désactiver le cache pour les pages dynamiques (données live)
export const dynamic = 'force-dynamic'

// Ou revalider après mutation :
revalidatePath('/tournaments/[id]', 'page')  // page spécifique
revalidatePath('/dashboard')                  // autre page qui liste les tournois
```

---

## À ne JAMAIS faire

```typescript
// ❌ getSession() côté serveur (non sécurisé)
const { data: { session } } = await supabase.auth.getSession()

// ✅ Toujours getUser() côté serveur
const { data: { user } } = await supabase.auth.getUser()

// ❌ Appeler une Server Action depuis un Server Component
// Les Server Actions sont pour les Client Components et les formulaires

// ❌ Mettre du state dans un Server Component
// Les Server Components sont stateless par définition

// ❌ Créer un channel Realtime sans cleanup
useEffect(() => {
  const ch = supabase.channel('...').subscribe()
  // ❌ Pas de return cleanup → memory leak
})
```