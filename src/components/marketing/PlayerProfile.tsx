import type { PlayerCareer } from '@/lib/player-career'
import { FindHistoryButton } from './FindHistoryButton'
import { BadgesGrid } from './player/BadgesGrid'
import { MatchHistory } from './player/MatchHistory'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function levelInfo(level: number | null): { label: string; emoji: string; percent: number } {
  const lvl = level ?? 3
  const percent = Math.round((lvl / 5) * 100)
  if (lvl <= 1) return { label: 'Débutant', emoji: '🌱', percent }
  if (lvl <= 3) return { label: 'Intermédiaire', emoji: '⭐', percent }
  return { label: 'Avancé', emoji: '🔥', percent }
}

function memberSinceLabel(date: string | null): string | null {
  if (!date) return null
  const formatted = new Date(date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function ProfileHero({
  displayName,
  level,
  subParts,
  clubName,
}: {
  displayName: string
  level: number | null
  subParts: string[]
  clubName: string | null
}) {
  const lvl = levelInfo(level)
  return (
    <div className="relative overflow-hidden border-b border-subtle bg-gradient-to-br from-surface-alt to-app px-4 pb-10 pt-28 sm:px-8 lg:px-12">
      <div className="rc-hero-bg absolute inset-0" />
      <div className="relative z-10 mx-auto flex max-w-screen-xl flex-wrap items-end gap-6">
        <div className="relative">
          <div className="grid h-20 w-20 place-items-center rounded-full border-[3px] border-app bg-gradient-to-br from-primary to-accent font-bebas text-3xl text-primary-foreground">
            {initials(displayName)}
          </div>
          <span className="absolute -right-1 bottom-0 rounded-full border-2 border-app bg-primary px-1.5 py-0.5 text-[0.6rem] font-bold text-primary-foreground">
            {lvl.emoji} {lvl.label}
          </span>
        </div>

        <div className="flex-1">
          <h1 className="font-bebas text-4xl uppercase leading-none tracking-[2px] text-text sm:text-5xl">
            {displayName}
          </h1>
          {subParts.length > 0 && <p className="mt-1.5 text-sm text-muted">{subParts.join(' · ')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              🏸 Badminton
            </span>
            {clubName && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                🏢 {clubName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsCards({ career }: { career: PlayerCareer }) {
  const ga = career.goalAverage
  const stats = [
    { num: String(career.tournamentsPlayed), label: 'Tournois joués' },
    { num: String(career.wins), label: 'Victoires' },
    { num: `${ga > 0 ? '+' : ''}${ga}`, label: 'Goal average' },
  ]
  return (
    <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-surface p-5 text-center">
          <div className="font-bebas text-4xl text-primary tabular-nums">{s.num}</div>
          <div className="mt-1 text-xs text-muted">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function LevelCard({ level }: { level: number | null }) {
  const lvl = levelInfo(level)
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-text">
        📈 Mon niveau
        <span className="h-px flex-1 bg-white/[0.06]" />
      </h2>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-text">
          {lvl.emoji} {lvl.label}
        </span>
        <span className="text-muted tabular-nums">{level ?? 3}/5</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
          style={{ width: `${lvl.percent}%` }}
        />
      </div>
      <p className="mt-4 rounded-lg bg-surface-alt p-3 text-xs leading-relaxed text-muted">
        💡 Votre niveau est défini par le bureau du club et sert à équilibrer les tableaux.
      </p>
    </section>
  )
}

// ─── Profils ─────────────────────────────────────────────────────────────────

/** Profil réel d'un joueur rattaché à un compte (stats dérivées à la volée). */
export function RealProfile({ displayName, career }: { displayName: string; career: PlayerCareer }) {
  const lvl = levelInfo(career.level)
  const subParts = [
    lvl.label,
    memberSinceLabel(career.memberSince) ? `Membre depuis ${memberSinceLabel(career.memberSince)}` : null,
    `${career.matchesPlayed} match${career.matchesPlayed > 1 ? 's' : ''} joué${career.matchesPlayed > 1 ? 's' : ''}`,
  ].filter((x): x is string => Boolean(x))

  return (
    <>
      <ProfileHero displayName={displayName} level={career.level} subParts={subParts} clubName={career.clubName} />

      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[7fr_3fr] lg:px-12">
        {/* Colonne gauche */}
        <div className="flex flex-col gap-6">
          <BadgesGrid career={career} />
          <MatchHistory matches={career.recentMatches} />
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col gap-6">
          <StatsCards career={career} />
          <LevelCard level={career.level} />
        </div>
      </div>
    </>
  )
}

/** Compte connecté sans profil joueur rattaché : profil vide + relance du matching. */
export function EmptyProfile({
  displayName,
  clubName,
  isNewMember,
}: {
  displayName: string
  clubName: string | null
  isNewMember: boolean
}) {
  const subParts = [clubName ? `Membre ${clubName}` : 'Bienvenue sur RacketClub']
  if (isNewMember) subParts.push('Nouveau membre')

  return (
    <>
      <ProfileHero displayName={displayName} level={null} subParts={subParts} clubName={clubName} />

      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-8 lg:px-12">
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
