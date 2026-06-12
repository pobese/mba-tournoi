import { describe, it, expect } from 'vitest'
import {
  generateAmericanRound,
  calculateAmericanStandings,
  createEmptyHistory,
  recordMatch,
  type AmericanRoundOptions,
  type MatchResult,
} from './american-scheduler'

const DBL: AmericanRoundOptions = { format: 'doubles', courtsAvailable: 9 }
const SGL: AmericanRoundOptions = { format: 'singles', courtsAvailable: 9 }

describe('american scheduler — doubles', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']

  it('génère le bon nombre de matchs pour N joueurs pairs', () => {
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(players, history, byeHistory, DBL)

    expect(result.matches).toHaveLength(2)
    expect(result.byePlayers).toHaveLength(0)
  })

  it('gère un nombre impair de joueurs (bye)', () => {
    const oddPlayers = ['p1', 'p2', 'p3', 'p4', 'p5']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(oddPlayers, history, byeHistory, DBL)

    expect(result.byePlayers).toHaveLength(1)
    expect(result.matches).toHaveLength(1)

    const allPlayers = result.matches.flatMap((m) => [...m.team1, ...m.team2])
    expect(allPlayers).not.toContain(result.byePlayers[0])
  })

  it.each([
    { n: 6, expectedMatches: 1, expectedByes: 2 },
    { n: 7, expectedMatches: 1, expectedByes: 3 },
    { n: 10, expectedMatches: 2, expectedByes: 2 },
    { n: 11, expectedMatches: 2, expectedByes: 3 },
  ])('gère $n joueurs (non multiple de 4) sans corruption', ({ n, expectedMatches, expectedByes }) => {
    const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`)
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(ids, history, byeHistory, DBL)

    expect(result.matches).toHaveLength(expectedMatches)
    expect(result.byePlayers).toHaveLength(expectedByes)

    const allPlayers = result.matches.flatMap((m) => [...m.team1, ...m.team2])
    expect(allPlayers.every((p) => typeof p === 'string')).toBe(true)
    expect(new Set(allPlayers).size).toBe(allPlayers.length)
    for (const bye of result.byePlayers) {
      expect(allPlayers).not.toContain(bye)
    }
    expect(allPlayers.length + result.byePlayers.length).toBe(n)
    // Chaque équipe de double a exactement 2 joueurs
    for (const m of result.matches) {
      expect(m.team1).toHaveLength(2)
      expect(m.team2).toHaveLength(2)
    }
  })

  it('rejette moins de 4 joueurs', () => {
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    expect(() => generateAmericanRound(['p1', 'p2', 'p3'], history, byeHistory, DBL)).toThrow()
  })

  it('évite les répétitions de paires quand possible (round 2)', () => {
    const fourPlayers = ['p1', 'p2', 'p3', 'p4']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()

    const round1 = generateAmericanRound(fourPlayers, history, byeHistory, DBL)
    expect(round1.matches).toHaveLength(1)
    recordMatch(history, round1.matches[0]!)

    const round2 = generateAmericanRound(fourPlayers, history, byeHistory, DBL)
    expect(round2.matches).toHaveLength(1)

    const r1Pair = [...new Set(round1.matches[0]!.team1)].sort().join('-')
    const r2Pair1 = [...new Set(round2.matches[0]!.team1)].sort().join('-')
    const r2Pair2 = [...new Set(round2.matches[0]!.team2)].sort().join('-')

    expect([r2Pair1, r2Pair2]).not.toContain(r1Pair)
  })

  it('garantit ZÉRO recroisement quand c\'est combinatoirement possible (8 joueurs)', () => {
    // Round 1 CONTRÔLÉ pour lequel un round 2 totalement sans répétition existe
    // (ex. round 2 = (p1,p5)v(p2,p6) + (p3,p7)v(p4,p8)). Le backtracking exact
    // DOIT donc produire un round 2 sans aucun recroisement, quel que soit le tirage.
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()

    recordMatch(history, { team1: ['p1', 'p2'], team2: ['p3', 'p4'] })
    recordMatch(history, { team1: ['p5', 'p6'], team2: ['p7', 'p8'] })

    const round2 = generateAmericanRound(players, history, byeHistory, DBL)

    // history = rounds précédents (avant le round 2) : aucune paire du round 2 ne doit y figurer.
    for (const m of round2.matches) {
      expect(history.partners.get(m.team1[0]!)?.has(m.team1[1]!)).toBeFalsy()
      expect(history.partners.get(m.team2[0]!)?.has(m.team2[1]!)).toBeFalsy()
      for (const a of m.team1) {
        for (const b of m.team2) {
          expect(history.opponents.get(a)?.has(b)).toBeFalsy()
        }
      }
    }
  })

  it('chaque joueur apparaît exactement une fois par match', () => {
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(players, history, byeHistory, DBL)

    const allPlayers = result.matches.flatMap((m) => [...m.team1, ...m.team2])
    const uniquePlayers = new Set(allPlayers)

    expect(uniquePlayers.size).toBe(allPlayers.length)
    expect(uniquePlayers.size).toBe(players.length)
  })

  it('rotation du bye : le joueur qui a eu le moins de byes est choisi', () => {
    const oddPlayers = ['p1', 'p2', 'p3', 'p4', 'p5']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>([['p1', 5], ['p2', 5], ['p3', 5], ['p4', 5]])

    const result = generateAmericanRound(oddPlayers, history, byeHistory, DBL)
    expect(result.byePlayers).toEqual(['p5'])
  })

  it('découpe en vagues selon les terrains disponibles', () => {
    // 8 joueurs → 2 matchs ; 1 terrain → 2 vagues
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(players, history, byeHistory, { format: 'doubles', courtsAvailable: 1 })

    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]!.wave).toBe(1)
    expect(result.matches[1]!.wave).toBe(2)
    expect(result.matches[0]!.courtNumber).toBe(1)
    expect(result.matches[1]!.courtNumber).toBe(1)
  })
})

describe('american scheduler — singles', () => {
  it('génère N/2 matchs 1v1 pour 8 joueurs', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(players, history, byeHistory, SGL)

    expect(result.matches).toHaveLength(4)
    expect(result.byePlayers).toHaveLength(0)
    for (const m of result.matches) {
      expect(m.team1).toHaveLength(1)
      expect(m.team2).toHaveLength(1)
    }
    const allPlayers = result.matches.flatMap((m) => [...m.team1, ...m.team2])
    expect(new Set(allPlayers).size).toBe(8)
  })

  it('cas impair : 7 joueurs → 1 bye, 3 matchs', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()
    const result = generateAmericanRound(players, history, byeHistory, SGL)

    expect(result.byePlayers).toHaveLength(1)
    expect(result.matches).toHaveLength(3)
    const allPlayers = result.matches.flatMap((m) => [...m.team1, ...m.team2])
    expect(allPlayers).not.toContain(result.byePlayers[0])
    expect(allPlayers.length + result.byePlayers.length).toBe(7)
  })

  it('évite de réopposer les mêmes adversaires (round 2)', () => {
    const players = ['p1', 'p2', 'p3', 'p4']
    const history = createEmptyHistory()
    const byeHistory = new Map<string, number>()

    const round1 = generateAmericanRound(players, history, byeHistory, SGL)
    for (const m of round1.matches) recordMatch(history, m)

    const round2 = generateAmericanRound(players, history, byeHistory, SGL)
    // Les confrontations du round 2 ne doivent pas répéter celles du round 1
    const r1Pairs = round1.matches.map((m) => [m.team1[0], m.team2[0]].sort().join('-'))
    const r2Pairs = round2.matches.map((m) => [m.team1[0], m.team2[0]].sort().join('-'))
    for (const pair of r2Pairs) {
      expect(r1Pairs).not.toContain(pair)
    }
  })
})

describe('american scheduler — standings', () => {
  it('calcule le classement final (doubles) correctement', () => {
    const results: MatchResult[] = [
      { team1: ['p1', 'p2'], team2: ['p3', 'p4'], scoreTeam1: 21, scoreTeam2: 15 },
      { team1: ['p1', 'p3'], team2: ['p2', 'p4'], scoreTeam1: 21, scoreTeam2: 10 },
    ]

    const standings = calculateAmericanStandings(results)

    const p1 = standings.find((s) => s.playerId === 'p1')!
    expect(p1.pointsScored).toBe(42)
    expect(p1.matchesPlayed).toBe(2)
    expect(p1.wins).toBe(2)
    expect(p1.rank).toBe(1)

    expect(standings).toHaveLength(4)
    const ranks = standings.map((s) => s.rank).sort((a, b) => a - b)
    expect(ranks).toEqual([1, 2, 3, 4])
  })

  it('calcule le classement individuel (singles)', () => {
    const results: MatchResult[] = [
      { team1: ['p1'], team2: ['p2'], scoreTeam1: 21, scoreTeam2: 18 },
      { team1: ['p1'], team2: ['p3'], scoreTeam1: 21, scoreTeam2: 12 },
    ]
    const standings = calculateAmericanStandings(results)
    const p1 = standings.find((s) => s.playerId === 'p1')!
    expect(p1.pointsScored).toBe(42)
    expect(p1.wins).toBe(2)
    expect(p1.matchesPlayed).toBe(2)
    expect(p1.rank).toBe(1)
  })
})
