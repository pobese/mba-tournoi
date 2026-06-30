import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { MembersManager, type MemberRow } from '@/components/settings/MembersManager'
import { ClubManager, type ClubData, type ClubMemberRow } from '@/components/settings/ClubManager'
import { ThemeToggle } from '@/components/ThemeToggle'

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
    clubMembers = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        return {
          id: r.id,
          email: data.user?.email ?? '—',
          role: r.role,
          isOwner: r.user_id === user.id,
        }
      }),
    )
    // L'owner n'est pas stocké dans club_members → on l'affiche explicitement.
    if (!clubMembers.some((m) => m.isOwner)) {
      clubMembers.unshift({ id: '__owner__', email: user.email ?? '—', role: 'owner', isOwner: true })
    }
  }

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
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Gérez votre club et les membres de votre organisation"
      />

      <section className="rounded-xl border border-subtle bg-surface p-5 sm:p-6">
        <h2 className="mb-1 font-display text-lg font-extrabold text-white">Mon Club</h2>
        <p className="mb-5 text-sm text-muted">
          {club
            ? 'Partagez le code ou le lien pour que vos adhérents rejoignent le club.'
            : 'Créez votre club pour inviter vos adhérents et organiser vos tournois.'}
        </p>
        <ClubManager club={club} members={clubMembers} />
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-5 sm:p-6">
        <h2 className="mb-1 font-display text-lg font-extrabold text-white">Membres de l&apos;organisation</h2>
        <p className="mb-5 text-sm text-muted">
          Invitez des membres pour partager la gestion de vos tournois. Un <strong className="text-white">admin</strong> peut
          aussi créer des tournois ; un <strong className="text-white">éditeur</strong> gère uniquement les tournois existants.
        </p>
        <MembersManager
          ownerId={user.id}
          ownerEmail={user.email ?? '—'}
          members={membersRaw ?? []}
        />
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-5 sm:p-6">
        <h2 className="mb-1 font-display text-lg font-extrabold text-white">Apparence</h2>
        <p className="mb-5 text-sm text-muted">Choisissez le thème de l&apos;interface.</p>
        <ThemeToggle variant="cards" />
      </section>
    </div>
  )
}
