// Types + helpers de lecture du tableau final (mode classique, phase bracket).
// `bracket_position` suit une numérotation en tas binaire : 1 = finale,
// 2-3 = demi-finales, 4-7 = quarts… 0 = barrage / qualification (hors arbre).

export type BracketPhase = 'barrage' | 'bracket_main' | 'bracket_consolante'

export interface BracketMatchView {
  id: string
  phase: BracketPhase
  bracketPosition: number
  status: string
  team1Id: string | null
  team2Id: string | null
  winnerTeamId: string | null
  courtNumber: number | null
  setScores: Array<[number, number]>
}

export interface BracketRound {
  roundSize: number // nb de matchs du tour : 1 = finale, 2 = demies, 4 = quarts…
  matches: BracketMatchView[]
}

// Regroupe les matchs d'un arbre (positions ≥ 1) en tours ordonnés du premier
// tour vers la finale. La taille du tour d'une position de tas p = 2^⌊log2(p)⌋.
export function roundsOf(matches: BracketMatchView[]): BracketRound[] {
  const byRound = new Map<number, BracketMatchView[]>()
  for (const m of matches) {
    if (m.bracketPosition < 1) continue
    const size = 2 ** Math.floor(Math.log2(m.bracketPosition))
    if (!byRound.has(size)) byRound.set(size, [])
    byRound.get(size)!.push(m)
  }
  return [...byRound.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([roundSize, ms]) => ({
      roundSize,
      matches: [...ms].sort((a, b) => a.bracketPosition - b.bracketPosition),
    }))
}

export function roundLabel(roundSize: number, finalLabel = 'Finale'): string {
  if (roundSize === 1) return finalLabel
  if (roundSize === 2) return 'Demi-finales'
  if (roundSize === 4) return 'Quarts de finale'
  return `${roundSize}èmes de finale`
}
