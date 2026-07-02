import { PLAYER_MATCHES } from './data'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { TOURNAMENT_TYPE_LABELS } from '@/lib/constants'
import { deriveDisplayName } from '@/lib/member-display'
import { getPlayerCareer } from '@/lib/player-career'
import { ClaimProfileSection, type ClaimCandidate } from './ClaimProfileSection'
import { EmptyProfile, RealProfile } from './PlayerProfile'

/**
 * Charge les profils joueurs candidats au « claim » (issus du matching à
 * l'inscription) : nom + tournois joués. Filtre les profils déjà rattachés.
 */
async function loadClaimCandidates(ids: string[]): Promise<ClaimCandidate[]> {
  if (ids.length === 0) return []
  const admin = createServiceRoleClient()

  const { data: players } = await admin
    .from('players')
    .select('id, name')
    .in('id', ids)
    .is('user_id', null) as { data: { id: string; name: string }[] | null }
  if (!players || players.length === 0) return []

  const { data: rows } = await admin
    .from('tournament_players')
    .select('player_id, tournament:tournaments(name, type)')
    .in('player_id', players.map((p) => p.id)) as {
      data: { player_id: string; tournament: { name: string; type: string } | null }[] | null
    }

  const byPlayer = new Map<string, { name: string; typeLabel: string }[]>()
  for (const r of rows ?? []) {
    if (!r.tournament) continue
    const list = byPlayer.get(r.player_id) ?? []
    list.push({ name: r.tournament.name, typeLabel: TOURNAMENT_TYPE_LABELS[r.tournament.type] ?? r.tournament.type })
    byPlayer.set(r.player_id, list)
  }

  return players.map((p) => ({ id: p.id, name: p.name, tournaments: byPlayer.get(p.id) ?? [] }))
}

interface PlayerViewProps {
  claiming?: boolean
  matchIds?: string[]
}

export async function PlayerView({ claiming = false, matchIds = [] }: PlayerViewProps) {
  const candidates = claiming ? await loadClaimCandidates(matchIds) : []

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Visiteur non connecté → démo marketing (vitrine de la page joueur).
  if (!user) {
    return (
      <div className="pt-16">
        {candidates.length > 0 && <ClaimProfileSection candidates={candidates} />}
        <PlayerDemo />
      </div>
    )
  }

  // Compte connecté → profil réel dérivé, ou état vide + relance du matching.
  const career = await getPlayerCareer(createServiceRoleClient(), user.id)
  const displayName = deriveDisplayName(user.user_metadata, user.email)

  return (
    <div className="pt-16">
      {candidates.length > 0 && <ClaimProfileSection candidates={candidates} />}
      {career.linked ? (
        <RealProfile displayName={displayName} career={career} />
      ) : (
        <EmptyProfile displayName={displayName} clubName={career.clubName} isNewMember={career.isNewMember} />
      )}
    </div>
  )
}

// ─── Démo statique (visiteurs non connectés) ─────────────────────────────────

const DEMO_BADGES = ['🏆 Vainqueur BBQ 2026', '🏢 MBA', '⚡ 5 tournois', '🤝 Fair-play']
const DEMO_STATS = [
  { num: '5', label: 'Tournois joués' },
  { num: '4', label: 'Victoires' },
  { num: '+37', label: 'Goal average' },
]

function PlayerDemo() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-subtle bg-gradient-to-br from-surface-alt to-app px-4 py-12 sm:px-8 lg:px-12">
        <div className="rc-hero-bg absolute inset-0" />
        <div className="relative z-10 mx-auto flex max-w-screen-2xl flex-wrap items-end gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-app bg-primary font-bebas text-4xl text-primary-foreground">
            LM
          </div>
          <div className="flex-1">
            <h1 className="font-bebas text-4xl tracking-[2px] text-text sm:text-5xl">LÉO MARTIN</h1>
            <p className="mt-1 text-sm text-muted">🏢 Membre MBA · Depuis 2026 · 5 tournois joués</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_BADGES.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 lg:px-12">
        <div className="grid grid-cols-3 gap-4">
          {DEMO_STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-surface p-5 text-center">
              <div className="font-bebas text-4xl text-primary">{s.num}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-text">
            ⏱ Historique des matchs
            <span className="h-px flex-1 bg-white/[0.06]" />
          </h2>
          <div className="flex flex-col gap-3">
            {PLAYER_MATCHES.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    m.result === 'win' ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'
                  }`}
                >
                  {m.result === 'win' ? 'V' : 'D'}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text">vs {m.opponent}</div>
                  <div className="text-xs text-muted">
                    📅 {m.date} · {m.tournament}
                  </div>
                </div>
                <div className="font-spacemono text-sm text-muted">{m.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
