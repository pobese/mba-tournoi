import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { MembersManager, type MemberRow } from '@/components/settings/MembersManager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
        description="Gérez les membres de votre organisation"
      />
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
    </div>
  )
}
