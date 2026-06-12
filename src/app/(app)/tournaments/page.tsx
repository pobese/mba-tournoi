import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { TournamentDeleteButton } from '@/components/tournament/TournamentListActions'
import { resolveCreateContext } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS } from '@/lib/constants'
import type { Tournament } from '@/types/app'

export const dynamic = 'force-dynamic'

type TournamentRow = Pick<Tournament, 'id' | 'name' | 'type' | 'status' | 'created_at' | 'created_by'>

export default async function TournamentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: acceptedRaw }, createCtx] = await Promise.all([
    supabase
      .from('organization_members')
      .select('owner_id')
      .eq('member_id', user.id)
      .eq('status', 'accepted') as unknown as Promise<{ data: { owner_id: string }[] | null }>,
    resolveCreateContext(supabase, user.id),
  ])

  const ownerIds = (acceptedRaw ?? []).map((m) => m.owner_id)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status, created_at, created_by')
    .in('created_by', [user.id, ...ownerIds])
    .order('created_at', { ascending: false }) as { data: TournamentRow[] | null; error: unknown }

  const list = tournaments ?? []

  const createButton = createCtx.canCreate ? (
    <Link
      href="/tournaments/new"
      className="inline-flex items-center gap-2 bg-primary text-app font-bold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
    >
      <Plus className="w-4 h-4" />
      Nouveau
    </Link>
  ) : undefined

  return (
    <div>
      <PageHeader title="Tournois" action={createButton} />

      {list.length === 0 ? (
        <EmptyState
          title="Aucun tournoi"
          description={createCtx.canCreate ? 'Créez votre premier tournoi.' : 'Aucun tournoi partagé pour le moment.'}
          action={createButton}
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-muted text-left">
              <th className="pb-3 font-medium">Nom</th>
              <th className="pb-3 font-medium hidden sm:table-cell">Type</th>
              <th className="pb-3 font-medium">Statut</th>
              <th className="pb-3 font-medium hidden md:table-cell">Créé le</th>
              <th className="pb-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {list.map((t) => {
              const isOwner = t.created_by === user.id
              return (
                <tr key={t.id} className="hover:bg-surface-alt/50 transition-colors group">
                  <td className="py-3">
                    <Link
                      href={`/tournaments/${t.id}`}
                      className="text-white font-medium hover:text-primary transition-colors"
                    >
                      {t.name}
                    </Link>
                    {!isOwner && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-subtle bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-muted align-middle">
                        <Building2 className="h-3 w-3" />
                        Organisation
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-muted hidden sm:table-cell">
                    {TOURNAMENT_TYPE_LABELS[t.type] ?? t.type}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        t.status === 'ongoing'
                          ? 'text-accent border-accent/30 bg-accent/10'
                          : 'text-muted border-subtle'
                      }`}
                    >
                      {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="py-3 text-muted hidden md:table-cell">
                    {formatDate(t.created_at)}
                  </td>
                  <td className="py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Suppression réservée au propriétaire (canDelete). */}
                    {isOwner && (
                      <TournamentDeleteButton tournamentId={t.id} tournamentName={t.name} tournamentStatus={t.status} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
