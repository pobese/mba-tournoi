import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ClubMembersManager, type ClubMemberFullRow } from '@/components/club/ClubMembersManager'
import { deriveDisplayName } from '@/lib/member-display'

export const dynamic = 'force-dynamic'

type ClubRow = { id: string; name: string; owner_id: string; created_at: string }

export default async function ClubMembersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceRoleClient()

  // Le club de l'utilisateur : celui qu'il possède, sinon celui qu'il a rejoint.
  const { data: owned } = await admin
    .from('clubs')
    .select('id, name, owner_id, created_at')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as { data: ClubRow | null }

  let club: ClubRow | null = owned
  if (!club) {
    const { data: membership } = await admin
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle() as { data: { club_id: string } | null }
    if (membership) {
      const { data: joined } = await admin
        .from('clubs')
        .select('id, name, owner_id, created_at')
        .eq('id', membership.club_id)
        .eq('is_active', true)
        .maybeSingle() as { data: ClubRow | null }
      club = joined
    }
  }

  let members: ClubMemberFullRow[] = []
  if (club) {
    const { data: rows } = await admin
      .from('club_members')
      .select('id, user_id, role, joined_at')
      .eq('club_id', club.id)
      .order('joined_at', { ascending: true }) as {
        data: { id: string; user_id: string; role: ClubMemberFullRow['role']; joined_at: string }[] | null
      }

    // Dédoublonnage par user_id : sans contrainte UNIQUE en prod, un même compte peut
    // avoir plusieurs lignes (backfill + invitation manuelle) → on garde la plus privilégiée.
    const ROLE_PRIORITY: Record<ClubMemberFullRow['role'], number> = { owner: 3, admin: 2, editor: 1, member: 0 }
    const byUser = new Map<string, { id: string; user_id: string; role: ClubMemberFullRow['role']; joined_at: string }>()
    for (const r of rows ?? []) {
      const prev = byUser.get(r.user_id)
      if (!prev || ROLE_PRIORITY[r.role] > ROLE_PRIORITY[prev.role]) byUser.set(r.user_id, r)
    }
    const uniqueRows = [...byUser.values()]

    // Résolution des comptes — on ne garde que le nom affiché, jamais l'email côté client.
    const resolved = await Promise.all(
      uniqueRows.map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        return { row: r, account: data.user }
      }),
    )

    const nameFor = (account: { email?: string | null; user_metadata?: Record<string, unknown> } | null) =>
      deriveDisplayName(account?.user_metadata, account?.email)

    members = resolved.map(({ row, account }) => {
      const isOwner = row.user_id === club!.owner_id
      return {
        id: row.id,
        displayName: nameFor(account),
        // L'owner apparaît toujours comme propriétaire (jamais aussi en simple adhérent).
        role: isOwner ? ('owner' as const) : row.role,
        isOwner,
        isSelf: row.user_id === user.id,
        joinedAt: row.joined_at,
      }
    })

    // L'owner n'est pas toujours une ligne club_members → on l'affiche explicitement.
    if (!members.some((m) => m.isOwner)) {
      const { data: ownerData } = await admin.auth.admin.getUserById(club.owner_id)
      members.unshift({
        id: '__owner__',
        displayName: nameFor(ownerData.user),
        role: 'owner',
        isOwner: true,
        isSelf: club.owner_id === user.id,
        joinedAt: club.created_at,
      })
    }
  }

  const currentRole = members.find((m) => m.isSelf)?.role
  const canManage = Boolean(club && (club.owner_id === user.id || currentRole === 'admin'))

  return (
    <main className="min-h-screen bg-app font-dmsans text-text">
      <MarketingNav />

      <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-8">
        <div className="mb-6">
          <h1 className="font-bebas text-4xl tracking-[2px] text-text sm:text-5xl">MEMBRES DU CLUB</h1>
          <p className="mt-1 text-sm text-muted">
            {club ? `${club.name} · ${members.length} membre${members.length > 1 ? 's' : ''}` : 'Aucun club'}
          </p>
        </div>

        {!club ? (
          <div className="rounded-xl border border-subtle bg-surface px-5 py-8 text-center text-sm text-muted">
            Vous n&apos;avez pas encore de club.{' '}
            <Link href="/settings" className="font-semibold text-primary hover:underline">Créez-en un →</Link>
          </div>
        ) : (
          <>
            <ClubMembersManager members={members} canManage={canManage} />
            <p className="mt-8 text-xs text-muted">
              Pour inviter de nouveaux membres ou gérer le code d&apos;invitation,{' '}
              <Link href="/settings#membres" className="font-semibold text-primary hover:underline">
                rendez-vous dans les Paramètres →
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
