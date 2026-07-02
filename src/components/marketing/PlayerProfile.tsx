import type { PlayerCareer } from '@/lib/player-career'
import { FindHistoryButton } from './FindHistoryButton'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function formatFrDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function rankLabel(rank: number | null): string {
  if (rank == null) return '·'
  return rank === 1 ? '1er' : `${rank}e`
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
      {children}
    </span>
  )
}

function ProfileHeader({ displayName, subtitle, children }: {
  displayName: string
  subtitle: string
  children?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden border-b border-subtle bg-gradient-to-br from-surface-alt to-app px-4 py-12 sm:px-8 lg:px-12">
      <div className="rc-hero-bg absolute inset-0" />
      <div className="relative z-10 mx-auto flex max-w-screen-2xl flex-wrap items-end gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-app bg-primary font-bebas text-4xl text-primary-foreground">
          {initials(displayName)}
        </div>
        <div className="flex-1">
          <h1 className="font-bebas text-4xl uppercase tracking-[2px] text-text sm:text-5xl">{displayName}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
        </div>
      </div>
    </div>
  )
}

/** Profil réel d'un joueur rattaché à un compte (stats dérivées à la volée). */
export function RealProfile({ displayName, career }: { displayName: string; career: PlayerCareer }) {
  const played = career.tournamentsPlayed
  const badges: string[] = [
    ...career.championships.map((n) => `🏆 Vainqueur ${n}`),
    `🏸 ${played} tournoi${played > 1 ? 's' : ''} joué${played > 1 ? 's' : ''}`,
  ]
  if (career.clubName) badges.push(`🏢 Membre ${career.clubName}`)
  if (career.isNewMember) badges.push('⭐ Nouveau membre')

  const ga = career.goalAverage
  const stats = [
    { num: String(played), label: 'Tournois joués' },
    { num: String(career.wins), label: 'Victoires' },
    { num: `${ga > 0 ? '+' : ''}${ga}`, label: 'Goal average' },
  ]

  const subtitle = [career.clubName ? `🏢 Membre ${career.clubName}` : null, `${played} tournoi${played > 1 ? 's' : ''} joué${played > 1 ? 's' : ''}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <ProfileHeader displayName={displayName} subtitle={subtitle}>
        {badges.map((b) => (
          <Badge key={b}>{b}</Badge>
        ))}
      </ProfileHeader>

      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 lg:px-12">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-surface p-5 text-center">
              <div className="font-bebas text-4xl text-primary tabular-nums">{s.num}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-text">
            ⏱ Historique des tournois
            <span className="h-px flex-1 bg-white/[0.06]" />
          </h2>

          {career.tournaments.length === 0 ? (
            <p className="text-sm text-muted">Aucun tournoi enregistré pour le moment.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {career.tournaments.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      t.won ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {t.won ? '🥇' : rankLabel(t.rank)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{t.name}</div>
                    <div className="text-xs text-muted">
                      📅 {formatFrDate(t.date)} · {t.typeLabel}
                    </div>
                  </div>
                  {t.rank != null && (
                    <div className="font-spacemono text-sm text-muted">{rankLabel(t.rank)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/** Compte connecté sans profil joueur rattaché : profil vide + relance du matching. */
export function EmptyProfile({ displayName, clubName, isNewMember }: {
  displayName: string
  clubName: string | null
  isNewMember: boolean
}) {
  return (
    <>
      <ProfileHeader displayName={displayName} subtitle={clubName ? `🏢 Membre ${clubName}` : 'Bienvenue sur RacketClub'}>
        {clubName && <Badge>🏢 Membre {clubName}</Badge>}
        {isNewMember && <Badge>⭐ Nouveau membre</Badge>}
      </ProfileHeader>

      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 lg:px-12">
        <div className="rounded-2xl border border-white/[0.06] bg-surface p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-2xl">🏸</div>
          <h2 className="font-bebas text-2xl tracking-wide text-text">Aucune statistique pour l’instant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Participez à votre premier tournoi pour voir vos stats. Vous avez déjà joué&nbsp;? Retrouvez votre
            historique.
          </p>
          <div className="mt-5 flex justify-center">
            <FindHistoryButton />
          </div>
        </div>
      </div>
    </>
  )
}
