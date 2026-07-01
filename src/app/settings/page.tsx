import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MembersManager, type MemberRow } from '@/components/settings/MembersManager'
import { ClubManager, type ClubData, type ClubMemberRow } from '@/components/settings/ClubManager'
import { ThemeToggle } from '@/components/ThemeToggle'
import { deriveDisplayName } from '@/lib/member-display'

type JoinedClub = { id: string; name: string; full_name: string | null; city: string | null; sport: string }

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceRoleClient()

  // Club dont l'utilisateur est propriétaire (le « Mon Club » qu'il gère).
  const { data: club } = await admin
    .from('clubs')
    .select('id, name, full_name, city, postal_code, invite_code, invite_token')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as { data: ClubData | null }

  let clubMembers: ClubMemberRow[] = []
  if (club) {
    const { data: rows } = await admin
      .from('club_members')
      .select('id, user_id, role')
      .eq('club_id', club.id)
      .order('joined_at', { ascending: true }) as {
        data: { id: string; user_id: string; role: 'owner' | 'admin' | 'editor' | 'member' }[] | null
      }

    // Résolution des comptes → nom affiché uniquement (jamais l'email dans la liste).
    const resolved = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        return { row: r, account: data.user }
      }),
    )
    const nameFor = (account: { email?: string | null; user_metadata?: Record<string, unknown> } | null) =>
      deriveDisplayName(account?.user_metadata, account?.email)

    clubMembers = resolved.map(({ row, account }) => ({
      id: row.id,
      displayName: nameFor(account),
      role: row.role,
      isOwner: row.user_id === user.id,
    }))
    // L'owner n'est pas stocké dans club_members → on l'affiche explicitement.
    if (!clubMembers.some((m) => m.isOwner)) {
      clubMembers.unshift({ id: '__owner__', displayName: nameFor(user), role: 'owner', isOwner: true })
    }
  }

  // Clubs rejoints (uniquement pertinent si l'utilisateur ne possède pas de club).
  const joinedClubs: JoinedClub[] = []
  if (!club) {
    const { data: memberships } = await admin
      .from('club_members')
      .select('clubs(id, name, full_name, city, sport, is_active)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true }) as {
        data: { clubs: (JoinedClub & { is_active: boolean }) | null }[] | null
      }
    const seen = new Set<string>()
    for (const m of memberships ?? []) {
      const c = m.clubs
      if (c && c.is_active && !seen.has(c.id)) {
        seen.add(c.id)
        joinedClubs.push({ id: c.id, name: c.name, full_name: c.full_name, city: c.city, sport: c.sport })
      }
    }
  }
  const isMemberOnly = !club && joinedClubs.length > 0

  // Membres de l'organisation (système de partage existant — coexiste avec les clubs).
  const { data: membersRaw, error } = await supabase
    .from('organization_members')
    .select('id, member_email, role, status')
    .eq('owner_id', user.id)
    .order('invited_at', { ascending: true }) as {
      data: MemberRow[] | null
      error: { code: string; message: string; hint: string | null } | null
    }
  if (error) console.error('SettingsPage members:', error.code, error.message, error.hint)

  return (
    <main className="min-h-screen bg-app font-dmsans text-text">
      <MarketingNav />

      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-24 sm:px-8">
        <div>
          <h1 className="font-bebas text-4xl tracking-[2px] text-text sm:text-5xl">PARAMÈTRES</h1>
          <p className="mt-1 text-sm text-muted">Gérez votre club et les membres de votre organisation</p>
        </div>

        {isMemberOnly && (
          <section className="relative overflow-hidden rounded-xl border border-subtle bg-surface p-5 sm:p-6">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
            <h2 className="mb-1 font-bebas text-2xl tracking-wide text-text">Mes clubs</h2>
            <p className="mb-5 text-sm text-muted">Les clubs que vous avez rejoints.</p>
            <ul className="flex flex-col gap-2.5">
              {joinedClubs.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-alt px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">🏢</div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text">{c.name}</p>
                      <p className="truncate text-xs text-muted">
                        {[c.full_name, c.city].filter(Boolean).join(' · ') || <span className="capitalize">{c.sport}</span>}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/club/membres"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:border-primary hover:text-primary"
                  >
                    <Users className="h-4 w-4" /> Voir les membres →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="relative overflow-hidden rounded-xl border border-subtle bg-surface p-5 sm:p-6">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
          <h2 className="mb-1 font-bebas text-2xl tracking-wide text-text">
            {club ? 'Mon Club' : isMemberOnly ? 'Créer votre propre club' : 'Mon Club'}
          </h2>
          <p className="mb-5 text-sm text-muted">
            {club
              ? 'Partagez le code ou le lien pour que vos adhérents rejoignent le club.'
              : isMemberOnly
                ? 'Vous pouvez aussi lancer votre propre club, en plus de ceux que vous avez rejoints.'
                : 'Créez votre club pour inviter vos adhérents et organiser vos tournois.'}
          </p>
          <ClubManager club={club} members={clubMembers} />
        </section>

        <section id="membres" className="relative scroll-mt-24 overflow-hidden rounded-xl border border-subtle bg-surface p-5 sm:p-6">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
          <h2 className="mb-1 font-bebas text-2xl tracking-wide text-text">Membres de l&apos;organisation</h2>
          <p className="mb-5 text-sm text-muted">
            Invitez des membres pour partager la gestion de vos tournois. Un <strong className="text-text">admin</strong> peut
            aussi créer des tournois ; un <strong className="text-text">éditeur</strong> gère uniquement les tournois existants.
          </p>
          <MembersManager
            ownerId={user.id}
            ownerEmail={user.email ?? '—'}
            members={membersRaw ?? []}
          />
        </section>

        <section className="relative overflow-hidden rounded-xl border border-subtle bg-surface p-5 sm:p-6">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
          <h2 className="mb-1 font-bebas text-2xl tracking-wide text-text">Apparence</h2>
          <p className="mb-5 text-sm text-muted">Choisissez le thème de l&apos;interface.</p>
          <ThemeToggle variant="cards" />
        </section>
      </div>
    </main>
  )
}
