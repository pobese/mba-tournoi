// Types partagés du dashboard classique (phase poules). Centralisés ici pour
// éviter un cycle d'imports entre le dashboard, les cartes et le panneau.

export interface TeamLite {
  id: string
  name: string
  player1: { id: string; name: string }
  player2?: { id: string; name: string } | null
}

export interface PoolMatchInfo {
  id: string
  status: string
  team1Id: string | null
  team2Id: string | null
  score1: number | null
  score2: number | null
  setScores: Array<[number, number]>
  courtNumber: number | null
}

export interface PoolStandingRow {
  teamId: string
  teamName: string
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
  matchesPlayed: number
}

export interface PoolView {
  id: string
  name: string
  position: number
  status: string
  courts: number[]
  standings: PoolStandingRow[]
  matches: PoolMatchInfo[]
}

// Extrait le message d'erreur d'un résultat de server action (union
// { error: string } | { success: boolean }). Renvoie null si succès.
export function actionError(result: unknown): string | null {
  if (result && typeof result === 'object' && 'error' in result) {
    // Cast restreint justifié par le `'error' in result` ci-dessus.
    const e = (result as { error: unknown }).error
    if (!e) return null
    return typeof e === 'string' ? e : 'Une erreur est survenue'
  }
  return null
}

// Tri d'affichage : victoires > diff. sets > diff. points > nom.
export function sortStandings(rows: PoolStandingRow[]): PoolStandingRow[] {
  return [...rows].sort(
    (a, b) =>
      b.wins - a.wins ||
      (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
      (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) ||
      a.teamName.localeCompare(b.teamName, 'fr'),
  )
}
