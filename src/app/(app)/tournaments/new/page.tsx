import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { TournamentWizard } from '@/components/tournament/TournamentWizard'
import type { Player } from '@/types/app'

export const dynamic = 'force-dynamic'

export default async function NewTournamentPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('players')
    .select('id, name, level')
    .eq('created_by', user.id)
    .order('name') as {
      data: Pick<Player, 'id' | 'name' | 'level'>[] | null
      error: unknown
    }

  return (
    <div>
      <PageHeader
        title="Nouveau tournoi"
        description="Configurez votre tournoi en 3 étapes"
      />
      <TournamentWizard players={data ?? []} />
    </div>
  )
}
