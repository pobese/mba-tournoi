import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate } from '@/lib/utils'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS } from '@/lib/constants'
import type { Tournament } from '@/types/app'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, type, status, created_at, slug')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20) as {
      data: Pick<Tournament, 'id' | 'name' | 'type' | 'status' | 'created_at' | 'slug'>[] | null
      error: unknown
    }

  if (error) {
    console.error('dashboard tournaments:', error)
  }

  const list = tournaments ?? []

  return (
    <div>
      <PageHeader
        title="Mes tournois"
        description="Tous vos tournois en un coup d'œil"
        action={
          <Link
            href="/tournaments/new"
            className="inline-flex items-center gap-2 bg-primary text-app font-bold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau tournoi
          </Link>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          title="Aucun tournoi"
          description="Créez votre premier tournoi pour commencer."
          action={
            <Link
              href="/tournaments/new"
              className="inline-flex items-center gap-2 bg-primary text-app font-bold px-4 py-2 rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              Créer un tournoi
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="block bg-surface border border-subtle rounded-xl p-5 hover:border-primary/50 hover:bg-surface-alt transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium bg-primary-dim/30 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                  {TOURNAMENT_TYPE_LABELS[t.type] ?? t.type}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.status === 'ongoing'
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'text-muted border border-subtle'
                  }`}
                >
                  {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                </span>
              </div>
              <h3 className="font-display font-bold text-white text-lg group-hover:text-primary transition-colors">
                {t.name}
              </h3>
              <p className="text-muted text-xs mt-2">{formatDate(t.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
