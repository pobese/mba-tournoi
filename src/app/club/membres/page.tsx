import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ClubMembersManager, type ClubMemberFullRow } from '@/components/club/ClubMembersManager'

export const dynamic = 'force-dynamic'

export default async function ClubMembersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceRoleClient()
  const { data: club } = await admin
    .from('clubs')
    .select('id, name, owner_id, created_at')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as { data: { id: string; name: string; owner_id: string; created_at: string } | null }

  let members: ClubMemberFullRow[] = []
  if (club) {
    const { data: rows } = await admin
      .from('club_members')
      .select('id, user_id, role, joined_at')
      .eq('club_id', club.id)
      .order('joined_at', { ascending: true }) as {
        data: { id: string; user_id: string; role: ClubMemberFullRow['role']; joined_at: string }[] | null
      }
    members = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        return {
          id: r.id,
          email: data.user?.email ?? '—',
          role: r.role,
          isOwner: r.user_id === club.owner_id,
          isSelf: r.user_id === user.id,
          joinedAt: r.joined_at,
        }
      }),
    )
    // L'owner n'est pas toujours une ligne club_members → on l'affiche explicitement.
    if (!members.some((m) => m.isOwner)) {
      const { data: ownerData } = await admin.auth.admin.getUserById(club.owner_id)
      members.unshift({
        id: '__owner__',
        email: ownerData.user?.email ?? '—',
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
            <p className="mt-4 text-xs text-muted">
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
