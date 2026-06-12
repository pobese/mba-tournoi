import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { PlayersClient } from '@/components/players/PlayersClient'
import type { Player } from '@/types/app'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('players')
    .select('id, name, level, created_at')
    .eq('created_by', user.id)
    .order('name') as {
      data: Pick<Player, 'id' | 'name' | 'level' | 'created_at'>[] | null
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
