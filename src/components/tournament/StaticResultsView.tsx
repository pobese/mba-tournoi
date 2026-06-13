import { Trophy, Medal, Archive } from 'lucide-react'
import type { ResultsSnapshot } from '@/lib/tournament-archive'

interface StaticResultsViewProps {
  snapshot: ResultsSnapshot
}

/**
 * Rendu en lecture seule d'un tournoi archivé (figé) depuis son snapshot.
 * Aucune donnée relationnelle vive n'est requise : tous les noms sont déjà
 * dénormalisés dans le snapshot.
 */
export function StaticResultsView({ snapshot }: StaticResultsViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-subtle bg-surface-alt/50 px-4 py-3 text-sm text-muted">
        <Archive className="h-4 w-4 shrink-0" />
        <span>Tournoi archivé — résultats figés en lecture seule.</span>
      </div>

      {(snapshot.champion || snapshot.consolanteWinner) && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          {snapshot.champion && (
            <p className="flex items-center gap-2 text-sm text-white">
              <Trophy className="h-5 w-5 shrink-0 text-primary" />
              Vainqueur : <span className="font-display font-extrabold text-primary">{snapshot.champion}</span>
            </p>
          )}
          {snapshot.consolanteWinner && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Medal className="h-4 w-4 shrink-0 text-accent" />
              Consolante : <span className="text-white">{snapshot.consolanteWinner}</span>
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
        <div className="border-b border-subtle px-4 py-3">
          <h2 className="font-display font-bold text-white">Classement final</h2>
        </div>
        {snapshot.standings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Aucun résultat enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Joueur / Équipe</th>
                <th className="px-4 py-2 text-right font-medium">V</th>
                <th className="px-4 py-2 text-right font-medium">J</th>
                <th className="px-4 py-2 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {snapshot.standings.map((s, i) => (
                <tr key={`${s.rank}-${i}`} className="text-white">
                  <td className="px-4 py-2.5 font-display font-bold tabular-nums text-muted">{s.rank}</td>
                  <td className="px-4 py-2.5">{s.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.wins}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{s.played}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">{s.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
