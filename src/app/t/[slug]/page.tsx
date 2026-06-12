import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TOURNAMENT_TYPE_LABELS } from '@/lib/constants'
import type { Tournament } from '@/types/app'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createServerSupabaseClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name, type')
    .eq('slug', params.slug)
    .single() as { data: Pick<Tournament, 'name' | 'type'> | null; error: unknown }

  if (!tournament) return { title: 'Tournoi introuvable' }

  return {
    title: `${tournament.name} — MBA Tournoi`,
    description: `Suivez le tournoi ${TOURNAMENT_TYPE_LABELS[tournament.type] ?? tournament.type} en temps réel.`,
  }
}

export default async function PublicTournamentPage({ params }: Props) {
  const supabase = await createServerSupabaseClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .eq('slug', params.slug)
    .single() as {
      data: Pick<Tournament, 'id' | 'name' | 'type' | 'status'> | null
      error: unknown
    }

  if (!tournament) notFound()

  return (
    <div className="min-h-screen bg-app px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <span className="text-xs font-medium text-primary bg-primary-dim/30 border border-primary/30 px-2 py-0.5 rounded-full">
            {TOURNAMENT_TYPE_LABELS[tournament.type] ?? tournament.type}
          </span>
          <h1 className="font-display text-3xl font-extrabold text-white mt-3">
            {tournament.name}
          </h1>
        </div>

        <div className="bg-surface border border-subtle rounded-xl p-8 text-center text-muted">
          Vue publique en temps réel — Phase 3
        </div>
      </div>
    </div>
  )
}
