import type { PlayerCareer } from '@/lib/player-career'

interface BadgeDef {
  emoji: string
  label: string
  earned: boolean
}

/**
 * Badges du profil. Les 8 premiers ont des conditions réelles ; les 3 derniers
 * sont des jalons futurs (toujours verrouillés pour l'instant).
 */
function buildBadges(c: PlayerCareer): BadgeDef[] {
  return [
    { emoji: '🏆', label: 'Vainqueur', earned: c.championships.length > 0 },
    { emoji: '🥈', label: 'Finaliste', earned: c.finalist },
    { emoji: '🏸', label: 'Premier tournoi', earned: c.tournamentsPlayed >= 1 },
    { emoji: '⚡', label: 'Habitué', earned: c.tournamentsPlayed >= 3 },
    { emoji: '🔥', label: 'Série de 5', earned: c.maxWinStreak >= 5 },
    { emoji: '🎯', label: 'Régulier', earned: c.playedThisMonth },
    { emoji: '🏢', label: 'Membre du club', earned: c.isClubMember },
    { emoji: '⭐', label: 'Nouveau membre', earned: c.isNewMember },
    { emoji: '👑', label: 'Champion local', earned: false },
    { emoji: '🤝', label: 'Fair-play', earned: false },
    { emoji: '🎖️', label: 'Vétéran', earned: false },
  ]
}

export function BadgesGrid({ career }: { career: PlayerCareer }) {
  const badges = buildBadges(career)

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 font-bold text-text">
        🏅 Mes badges
        <span className="h-px flex-1 bg-white/[0.06]" />
      </h2>

      <div className="grid grid-cols-4 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {badges.map((b) => (
          <div key={b.label} className="text-center">
            <div
              className={`mx-auto mb-1.5 grid h-14 w-14 place-items-center rounded-full border-2 text-2xl ${
                b.earned
                  ? 'border-primary bg-primary/10'
                  : 'border-subtle bg-surface-alt opacity-30 grayscale'
              }`}
            >
              {b.earned ? b.emoji : '🔒'}
            </div>
            <div className={`text-[0.7rem] leading-tight ${b.earned ? 'text-text' : 'text-muted'}`}>
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
