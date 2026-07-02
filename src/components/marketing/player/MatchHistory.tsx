import type { MatchResult } from '@/lib/player-career'

function formatFrDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MatchHistory({ matches }: { matches: MatchResult[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 font-bold text-text">
        ⏱ Historique des matchs
        <span className="h-px flex-1 bg-white/[0.06]" />
      </h2>

      {matches.length === 0 ? (
        <p className="text-sm text-muted">Aucun match joué pour l’instant</p>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3"
            >
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  m.won ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'
                }`}
              >
                {m.won ? 'W' : 'L'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text">vs {m.opponent}</div>
                <div className="truncate text-xs text-muted">
                  🏸 {formatFrDate(m.date)} · {m.tournamentName}
                  {m.score ? ` · ${m.score}` : ''}
                </div>
              </div>

              {(m.goalAverage !== 0 || m.score) && (
                <div
                  className={`font-spacemono text-sm tabular-nums ${
                    m.goalAverage >= 0 ? 'text-primary' : 'text-danger'
                  }`}
                >
                  {m.goalAverage > 0 ? '+' : ''}
                  {m.goalAverage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
