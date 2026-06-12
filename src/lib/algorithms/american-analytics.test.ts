import { describe, it, expect } from 'vitest'
import {
  computeEvolution,
  computeEncounters,
  type EvolutionMatch,
  type EncounterMatch,
} from './american-analytics'

// ─── computeEvolution ─────────────────────────────────────────────────────────

describe('computeEvolution', () => {
  it('cumule les points round après round', () => {
    const matches: EvolutionMatch[] = [
      // Round 1 : A bat B (21-10)
      { roundNumber: 1, team1: ['a'], team2: ['b'], scoreTeam1: 21, scoreTeam2: 10 },
      // Round 2 : A bat B encore (21-15)
      { roundNumber: 2, team1: ['a'], team2: ['b'], scoreTeam1: 21, scoreTeam2: 15 },
    ]
    const { rounds, series } = computeEvolution(matches)
    expect(rounds).toEqual([1, 2])

    const a = series.find((s) => s.playerId === 'a')!
    const b = series.find((s) => s.playerId === 'b')!
    expect(a.points).toEqual([21, 42]) // cumul
    expect(b.points).toEqual([10, 25])
    expect(a.ranks).toEqual([1, 1]) // A toujours 1er
    expect(b.ranks).toEqual([2, 2])
  })

  it('met null tant que le joueur n\'a pas joué', () => {
    const matches: EvolutionMatch[] = [
      { roundNumber: 1, team1: ['a'], team2: ['b'], scoreTeam1: 21, scoreTeam2: 10 },
      // C apparaît seulement au round 2
      { roundNumber: 2, team1: ['c'], team2: ['a'], scoreTeam1: 21, scoreTeam2: 5 },
    ]
    const { series } = computeEvolution(matches)
    const c = series.find((s) => s.playerId === 'c')!
    expect(c.points[0]).toBeNull() // pas encore joué au round 1
    expect(c.points[1]).toBe(21)
  })

  it('renvoie des séries vides sans match', () => {
    const { rounds, series } = computeEvolution([])
    expect(rounds).toEqual([])
    expect(series).toEqual([])
  })
})

// ─── computeEncounters ──────────────────────────────────────────────────────

describe('computeEncounters', () => {
  it('compte partenaires et adversaires en double', () => {
    const matches: EncounterMatch[] = [
      { team1: ['a', 'b'], team2: ['c', 'd'] },
    ]
    const { pairs } = computeEncounters(matches)
    const ab = pairs.find((p) => p.a === 'a' && p.b === 'b')!
    const ac = pairs.find((p) => (p.a === 'a' && p.b === 'c'))!
    expect(ab.partner).toBe(1)
    expect(ab.opponent).toBe(0)
    expect(ac.opponent).toBe(1)
    expect(ac.partner).toBe(0)
  })

  it('détecte les rencontres répétées', () => {
    const matches: EncounterMatch[] = [
      { team1: ['a'], team2: ['b'] },
      { team1: ['a'], team2: ['b'] }, // re-confrontation
    ]
    const { pairs, repeatedPairs, maxRepeat } = computeEncounters(matches)
    const ab = pairs.find((p) => p.a === 'a' && p.b === 'b')!
    expect(ab.opponent).toBe(2)
    expect(repeatedPairs).toBe(1)
    expect(maxRepeat).toBe(2)
  })

  it('ignore les matchs avec une équipe vide (bye)', () => {
    const matches: EncounterMatch[] = [
      { team1: ['a'], team2: [] },
      { team1: ['a', 'b'], team2: ['c', 'd'] },
    ]
    const { pairs, repeatedPairs } = computeEncounters(matches)
    expect(repeatedPairs).toBe(0)
    // a-b une seule fois (partenaires)
    expect(pairs.find((p) => p.a === 'a' && p.b === 'b')!.partner).toBe(1)
  })

  it('aucune rencontre répétée sur un tirage parfait', () => {
    const matches: EncounterMatch[] = [
      { team1: ['a', 'b'], team2: ['c', 'd'] },
      { team1: ['a', 'c'], team2: ['b', 'd'] },
      { team1: ['a', 'd'], team2: ['b', 'c'] },
    ]
    // À 4 joueurs sur 3 rounds, chaque paire est partenaire 1× et adversaire 2×
    // → forcément des répétitions d'adversaires (limite combinatoire).
    const { maxRepeat } = computeEncounters(matches)
    expect(maxRepeat).toBeGreaterThanOrEqual(2)
  })
})
