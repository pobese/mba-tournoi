import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ClubMembersManager, type ClubMemberFullRow } from '@/components/club/ClubMembersManager'

export const dynamic = 'force-dynamic'

type ClubRow = { id: string; name: string; owner_id: string; created_at: string }

/**
 * Nom affiché d'un membre — JAMAIS son email (la page est visible par tout adhérent).
 * Priorité : full_name/display_name du compte → nom d'un profil joueur lié (même email)
 * → partie locale de l'email, sans jamais exposer le domaine ni l'email complet.
 */
function deriveDisplayName(
  meta: Record<string, unknown> | undefined,
  email: string | undefined,
  playerName: string | undefined,
): string {
  const metaName = [meta?.full_name, meta?.display_name, meta?.name].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )
  if (metaName) return metaName.trim()
  if (playerName?.trim()) return playerName.trim()
  const local = (email ?? '').split('@')[0]?.trim()
  if (local) return local.charAt(0).toUpperCase() + local.slice(1)
  return 'Membre'
}

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

    // Résolution des comptes — on ne garde que le nom affiché, jamais l'email côté client.
    const resolved = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        return { row: r, account: data.user }
      }),
    )

    // Profils joueurs liés (même email) → fallback de nom, en une seule requête.
    const emails = resolved
      .map((x) => x.account?.email)
      .filter((e): e is string => Boolean(e))
    const playerByEmail = new Map<string, string>()
    if (emails.length) {
      const { data: players } = await admin
        .from('players')
        .select('name, email')
        .in('email', emails) as { data: { name: string; email: string | null }[] | null }
      for (const p of players ?? []) {
        if (p.email && !playerByEmail.has(p.email)) playerByEmail.set(p.email, p.name)
      }
    }

    const nameFor = (account: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      const email = account?.email ?? undefined
      return deriveDisplayName(account?.user_metadata, email, email ? playerByEmail.get(email) : undefined)
    }

    members = resolved.map(({ row, account }) => ({
      id: row.id,
      displayName: nameFor(account),
      role: row.role,
      isOwner: row.user_id === club!.owner_id,
      isSelf: row.user_id === user.id,
      joinedAt: row.joined_at,
    }))

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
