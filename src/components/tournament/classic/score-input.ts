import { MAX_BADMINTON_SCORE } from '@/lib/constants'

// Helpers de saisie de sets, partagés entre les cartes de match
// (phase poules : PoolMatchCard · phase tableau : BracketScoreDialog).

export type SetInput = { t1: string; t2: string }

export const emptySet = (): SetInput => ({ t1: '', t2: '' })

export function parseSet(s: SetInput): { t1: number; t2: number } | null {
  const t1 = parseInt(s.t1)
  const t2 = parseInt(s.t2)
  if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0 || t1 > MAX_BADMINTON_SCORE || t2 > MAX_BADMINTON_SCORE) return null
  return { t1, t2 }
}

// 1 si team1 gagne le set, 2 si team2, 0 si incomplet / égalité.
export function setWinner(s: SetInput): 0 | 1 | 2 {
  const p = parseSet(s)
  if (!p) return 0
  return p.t1 > p.t2 ? 1 : p.t2 > p.t1 ? 2 : 0
}
