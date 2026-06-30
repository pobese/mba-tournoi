import { PLAYER_MATCHES } from './data'

const BADGES = ['🏆 Vainqueur BBQ 2026', '🏢 MBA', '⚡ 5 tournois', '🤝 Fair-play']

const STATS = [
  { num: '5', label: 'Tournois joués' },
  { num: '4', label: 'Victoires' },
  { num: '+37', label: 'Goal average' },
]

export function PlayerView() {
  return (
    <div className="pt-16">
      {/* Profil */}
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
              {BADGES.map((b) => (
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

      {/* Corps */}
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 lg:px-12">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-surface p-5 text-center">
              <div className="font-bebas text-4xl text-primary">{s.num}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Historique */}
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
    </div>
  )
}
