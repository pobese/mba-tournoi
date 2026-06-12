import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Building2 } from 'lucide-react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { InvitationBanner, type PendingInvitation } from '@/components/settings/InvitationBanner'
import { resolveCreateContext } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS } from '@/lib/constants'
import type { Tournament } from '@/types/app'

export const dynamic = 'force-dynamic'

type TournamentRow = Pick<Tournament, 'id' | 'name' | 'type' | 'status' | 'created_at' | 'slug' | 'created_by'>

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Invitations en attente + organisations dont je suis membre accepté + droit de créer.
  const [{ data: pendingRaw }, { data: acceptedRaw }, createCtx] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id, owner_id, role')
      .eq('member_id', user.id)
      .eq('status', 'pending') as unknown as Promise<{ data: { id: string; owner_id: string; role: 'admin' | 'editor' }[] | null }>,
    supabase
      .from('organization_members')
      .select('owner_id')
      .eq('member_id', user.id)
      .eq('status', 'accepted') as unknown as Promise<{ data: { owner_id: string }[] | null }>,
    resolveCreateContext(supabase, user.id),
  ])

  // Emails des owners qui m'ont invité (via service role : auth.users).
  // Service role instancié seulement s'il y a des invitations en attente.
  const pending = pendingRaw ?? []
  let invitations: PendingInvitation[] = []
  if (pending.length > 0) {
    const service = createServiceRoleClient()
    invitations = await Promise.all(
      pending.map(async (inv) => {
        const { data } = await service.auth.admin.getUserById(inv.owner_id)
        return { id: inv.id, role: inv.role, ownerEmail: data.user?.email ?? 'Une organisation' }
      }),
    )
  }

  // Mes tournois + ceux des organisations dont je suis membre accepté.
  const ownerIds = (acceptedRaw ?? []).map((m) => m.owner_id)
  const createdByList = [user.id, ...ownerIds]
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, type, status, created_at, slug, created_by')
    .in('created_by', createdByList)
    .order('created_at', { ascending: false })
    .limit(40) as { data: TournamentRow[] | null; error: { code: string; message: string } | null }
  if (error) console.error('dashboard tournaments:', error.code, error.message)

  const list = tournaments ?? []

  const createButton = createCtx.canCreate ? (
    <Link
      href="/tournaments/new"
      className="inline-flex items-center gap-2 bg-primary text-app font-bold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
    >
      <Plus className="w-4 h-4" />
      Nouveau tournoi
    </Link>
  ) : undefined

  return (
    <div>
      <InvitationBanner invitations={invitations} />

      <PageHeader
        title="Mes tournois"
        description="Tous vos tournois en un coup d'œil"
        action={createButton}
      />

      {list.length === 0 ? (
        <EmptyState
          title="Aucun tournoi"
          description={createCtx.canCreate ? 'Créez votre premier tournoi pour commencer.' : 'Aucun tournoi partagé pour le moment.'}
          action={createButton}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => {
            const isOrg = t.created_by !== user.id
            return (
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
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-muted text-xs">{formatDate(t.created_at)}</p>
                  {isOrg && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-muted">
                      <Building2 className="h-3 w-3" />
                      Organisation
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
