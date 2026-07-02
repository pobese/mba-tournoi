import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { PlayersClient, type PlayerRow } from '@/components/players/PlayersClient'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('players')
    .select('id, name, level, created_at, club_id, club_name_hint, city_hint')
    .eq('created_by', user.id)
    .order('name') as {
      data: PlayerRow[] | null
      error: unknown
    }

  if (error) {
    console.error('players fetch:', error)
  }

  const players = data ?? []

  return (
    <div>
      <PageHeader
        title="Mes joueurs"
        description={`${players.length} joueur${players.length > 1 ? 's' : ''}`}
      />
      <PlayersClient initialPlayers={players} />
    </div>
  )
}
