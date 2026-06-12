// Analytics pour le tournoi américain :
//  - Évolution du classement (points cumulés + rang) round après round.
//  - Statistiques de rencontres (partenaires / adversaires) pour visualiser
//    combien de fois deux joueurs se recroisent (anti-doublon).
// Fonctions pures et testables : aucune dépendance DB.

import { calculateAmericanStandings, type MatchResult } from './american-scheduler'

// ─── Évolution du classement ────────────────────────────────────────────────

export interface EvolutionMatch extends MatchResult {
  roundNumber: number
}

export interface PlayerSeries {
  playerId: string
  // Alignés sur `rounds` : valeur cumulée après chaque round, null tant que le
  // joueur n'a pas encore joué de match terminé.
  points: Array<number | null>
  ranks: Array<number | null>
}

export interface Evolution {
  rounds: number[]
  series: PlayerSeries[]
}

/**
 * Construit l'évolution cumulative du classement à partir des matchs terminés.
 * Pour chaque round R, on recalcule le classement sur tous les matchs des
 * rounds ≤ R (préfixe), ce qui garantit une cohérence stricte avec le
 * classement final affiché.
 */
export function computeEvolution(matches: EvolutionMatch[]): Evolution {
  const rounds = Array.from(new Set(matches.map((m) => m.roundNumber))).sort((a, b) => a - b)

  const playerIds = new Set<string>()
  for (const m of matches) for (const p of [...m.team1, ...m.team2]) playerIds.add(p)

  const seriesMap = new Map<string, PlayerSeries>()
  for (const pid of playerIds) seriesMap.set(pid, { playerId: pid, points: [], ranks: [] })

  for (const r of rounds) {
    const prefix = matches.filter((m) => m.roundNumber <= r)
    const standings = calculateAmericanStandings(prefix)
    const byId = new Map(standings.map((s) => [s.playerId, s]))
    for (const pid of playerIds) {
      const s = byId.get(pid)
      const series = seriesMap.get(pid)!
      series.points.push(s ? s.pointsScored : null)
      series.ranks.push(s ? s.rank : null)
    }
  }

  // Tri des séries par points finaux décroissants (meilleurs en tête de légende).
  const lastValue = (arr: Array<number | null>): number => {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i]!
    return -1
  }
  const series = Array.from(seriesMap.values())
  series.sort((a, b) => lastValue(b.points) - lastValue(a.points))

  return { rounds, series }
}

// ─── Statistiques de rencontres ──────────────────────────────────────────────

export interface EncounterMatch {
  team1: string[]
  team2: string[]
}

export interface EncounterPair {
  a: string
  b: string
  partner: number  // nombre de fois équipiers
  opponent: number // nombre de fois adversaires
}

export interface EncounterStats {
  pairs: EncounterPair[]   // toutes les paires s'étant croisées ≥ 1 fois, repeats en tête
  repeatedPairs: number    // nombre de paires s'étant croisées plus d'une fois
  maxRepeat: number        // pire cas : nb max de rencontres pour une même paire
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/**
 * Compte les rencontres (partenaires + adversaires) pour chaque paire de
 * joueurs sur l'ensemble des matchs (tous statuts hors équipes vides).
 */
export function computeEncounters(matches: EncounterMatch[]): EncounterStats {
  const map = new Map<string, EncounterPair>()

  const bump = (a: string, b: string, kind: 'partner' | 'opponent') => {
    if (a === b) return
    const [x, y] = orderedPair(a, b)
    const key = `${x}|${y}`
    let pair = map.get(key)
    if (!pair) {
      pair = { a: x, b: y, partner: 0, opponent: 0 }
      map.set(key, pair)
    }
    pair[kind] += 1
  }

  for (const m of matches) {
    if (m.team1.length === 0 || m.team2.length === 0) continue
    for (const team of [m.team1, m.team2]) {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) bump(team[i]!, team[j]!, 'partner')
      }
    }
    for (const a of m.team1) for (const b of m.team2) bump(a, b, 'opponent')
  }

  const pairs = Array.from(map.values())
  let repeatedPairs = 0
  let maxRepeat = 0
  for (const p of pairs) {
    const total = p.partner + p.opponent
    if (total > 1) repeatedPairs += 1
    if (total > maxRepeat) maxRepeat = total
  }

  pairs.sort((a, b) => b.partner + b.opponent - (a.partner + a.opponent))

  return { pairs, repeatedPairs, maxRepeat }
}
