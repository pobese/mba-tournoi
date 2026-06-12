import { describe, it, expect } from 'vitest'
import {
  selectBye,
  computeNeededByes,
  formTeams,
  formMatches,
  calculateStandings,
  generateRound,
  type PlayerWithStats,
  type RoundsMatchResult,
} from './rounds-scheduler'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(
  id: string,
  rank: number,
  overrides: Partial<PlayerWithStats> = {},
): PlayerWithStats {
  return {
    playerId: id,
    playerName: `Joueur ${id}`,
    level: 3,
    consecutivePlayed: 0,
    totalWaited: 0,
    lastWaitedRound: null,
    currentRank: rank,
    ...overrides,
  }
}

// 8 joueurs classés 1-8, sans historique
const players8 = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => makePlayer(`p${r}`, r))
// 12 joueurs classés 1-12
const players12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) =>
  makePlayer(`p${r}`, r),
)

// ─── computeNeededByes ──────────────────────────────────────────────────────────

describe('computeNeededByes', () => {
  it('double : sous la capacité, ne renvoie que le reste de parité', () => {
    // 9 terrains → capacité 36. 30 joueurs → 30 % 4 = 2 en attente
    expect(computeNeededByes(30, 'doubles', 9)).toBe(2)
    // 8 joueurs pile → 0
    expect(computeNeededByes(8, 'doubles', 9)).toBe(0)
  })

  it('double : au-delà de 4× terrains, renvoie le surplus', () => {
    // 9 terrains → capacité 36. 40 joueurs → 4 en attente
    expect(computeNeededByes(40, 'doubles', 9)).toBe(4)
    // 50 joueurs → 14 en attente (36 actifs = 1 vague pleine)
    expect(computeNeededByes(50, 'doubles', 9)).toBe(14)
  })

  it('double : pile à la capacité → 0 en attente', () => {
    expect(computeNeededByes(36, 'doubles', 9)).toBe(0)
  })

  it('simple : capacité = 2× terrains', () => {
    // 9 terrains → capacité 18. 25 joueurs → 7 en attente
    expect(computeNeededByes(25, 'singles', 9)).toBe(7)
    // 5 joueurs, capacité large → 1 (reste de parité)
    expect(computeNeededByes(5, 'singles', 9)).toBe(1)
  })

  it("le surplus rend toujours l'effectif actif compatible avec les équipes", () => {
    // Quel que soit le total, total - byes doit être multiple de 4 en double
    for (const total of [37, 41, 43, 60, 99]) {
      const byes = computeNeededByes(total, 'doubles', 9)
      expect((total - byes) % 4).toBe(0)
    }
  })
})

// ─── selectBye ────────────────────────────────────────────────────────────────

describe('selectBye', () => {
  it('retourne un tableau vide si needed === 0', () => {
    expect(selectBye(players8, 0, 1)).toHaveLength(0)
  })

  it('sélectionne le bon nombre de joueurs', () => {
    // 10 joueurs en double → 2 en attente
    const players10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) =>
      makePlayer(`p${r}`, r),
    )
    const byes = selectBye(players10, 2, 1)
    expect(byes).toHaveLength(2)
  })

  it('priorité aux joueurs avec le plus de rounds consécutifs', () => {
    const players = [
      makePlayer('a', 1, { consecutivePlayed: 5 }),
      makePlayer('b', 2, { consecutivePlayed: 2 }),
      makePlayer('c', 3, { consecutivePlayed: 1 }),
    ]
    const byes = selectBye(players, 1, 5)
    expect(byes[0]!.playerId).toBe('a')
  })

  it("en cas d'égalité de consécutifs, le mieux classé attend", () => {
    const players = [
      makePlayer('a', 1, { consecutivePlayed: 3 }),
      makePlayer('b', 2, { consecutivePlayed: 3 }),
      makePlayer('c', 3, { consecutivePlayed: 3 }),
    ]
    const byes = selectBye(players, 1, 2)
    expect(byes[0]!.playerId).toBe('a')
  })

  it("n'assigne pas deux byes consécutifs sauf si impossible", () => {
    const players = [
      makePlayer('a', 1, { consecutivePlayed: 0, lastWaitedRound: 1 }), // vient de passer en bye
      makePlayer('b', 2, { consecutivePlayed: 1 }),
    ]
    const byes = selectBye(players, 1, 2)
    // b doit être sélectionné, pas a
    expect(byes[0]!.playerId).toBe('b')
  })

  it('force un bye consécutif si tous ont attendu le round précédent', () => {
    const players = [
      makePlayer('a', 1, { consecutivePlayed: 0, lastWaitedRound: 2 }),
      makePlayer('b', 2, { consecutivePlayed: 0, lastWaitedRound: 2 }),
    ]
    // Impossible d'éviter — doit quand même retourner 1 joueur
    const byes = selectBye(players, 1, 3)
    expect(byes).toHaveLength(1)
  })
})

// ─── formTeams ────────────────────────────────────────────────────────────────

describe('formTeams — doubles', () => {
  it('serpent avec 8 joueurs : paires exactes', () => {
    const teams = formTeams(players8, 'doubles')

    expect(teams).toHaveLength(4)
    // T1 = P1 + P8, T2 = P2 + P7, T3 = P3 + P6, T4 = P4 + P5
    expect(teams[0]!.players.map((p) => p.playerId)).toEqual(['p1', 'p8'])
    expect(teams[1]!.players.map((p) => p.playerId)).toEqual(['p2', 'p7'])
    expect(teams[2]!.players.map((p) => p.playerId)).toEqual(['p3', 'p6'])
    expect(teams[3]!.players.map((p) => p.playerId)).toEqual(['p4', 'p5'])
  })

  it('serpent avec 12 joueurs : 6 équipes correctes', () => {
    const teams = formTeams(players12, 'doubles')

    expect(teams).toHaveLength(6)
    expect(teams[0]!.players.map((p) => p.playerId)).toEqual(['p1', 'p12'])
    expect(teams[1]!.players.map((p) => p.playerId)).toEqual(['p2', 'p11'])
    expect(teams[5]!.players.map((p) => p.playerId)).toEqual(['p6', 'p7'])
  })

  it('lève une erreur si le nombre de joueurs n\'est pas multiple de 4', () => {
    const players6 = [1, 2, 3, 4, 5, 6].map((r) => makePlayer(`p${r}`, r))
    expect(() => formTeams(players6, 'doubles')).toThrow()
  })

  it('chaque joueur apparaît dans exactement une équipe', () => {
    const teams = formTeams(players8, 'doubles')
    const ids = teams.flatMap((t) => t.players.map((p) => p.playerId))
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
  })
})

describe('formTeams — singles', () => {
  it('chaque joueur devient sa propre équipe', () => {
    const players4 = [1, 2, 3, 4].map((r) => makePlayer(`p${r}`, r))
    const teams = formTeams(players4, 'singles')
    expect(teams).toHaveLength(4)
    teams.forEach((t, i) => {
      expect(t.players).toHaveLength(1)
      expect(t.players[0]!.playerId).toBe(`p${i + 1}`)
    })
  })
})

// ─── formMatches ──────────────────────────────────────────────────────────────

describe('formMatches', () => {
  const teams4 = formTeams(players8, 'doubles') // 4 équipes

  it('4 équipes, 9 terrains → 1 vague, 2 matchs', () => {
    const waves = formMatches(teams4, 9)
    expect(waves).toHaveLength(1)
    expect(waves[0]).toHaveLength(2)
  })

  it('4 équipes : appariement correct (E1 vs E3, E2 vs E4)', () => {
    const waves = formMatches(teams4, 9)
    const [m1, m2] = waves[0]!
    // Équipe 1 (P1+P8) vs Équipe 3 (P3+P6)
    expect(m1!.team1.players.map((p) => p.playerId)).toEqual(['p1', 'p8'])
    expect(m1!.team2.players.map((p) => p.playerId)).toEqual(['p3', 'p6'])
    // Équipe 2 (P2+P7) vs Équipe 4 (P4+P5)
    expect(m2!.team1.players.map((p) => p.playerId)).toEqual(['p2', 'p7'])
    expect(m2!.team2.players.map((p) => p.playerId)).toEqual(['p4', 'p5'])
  })

  it('8 équipes, 3 terrains → 2 vagues de 3 et 1 match', () => {
    // On a besoin de 8 équipes → 16 joueurs
    const players16 = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`q${i + 1}`, i + 1),
    )
    const teams16 = formTeams(players16, 'doubles') // 8 équipes
    const waves = formMatches(teams16, 3)
    expect(waves).toHaveLength(2)
    expect(waves[0]).toHaveLength(3) // 3 terrains → vague 1 = 3 matchs
    expect(waves[1]).toHaveLength(1) // reste 1 match
  })

  it('8 équipes, 9 terrains → 1 vague, 4 matchs', () => {
    const players16 = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`q${i + 1}`, i + 1),
    )
    const teams16 = formTeams(players16, 'doubles')
    const waves = formMatches(teams16, 9)
    expect(waves).toHaveLength(1)
    expect(waves[0]).toHaveLength(4)
  })

  it('numéros de terrain commencent à 1 par vague', () => {
    const players16 = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`q${i + 1}`, i + 1),
    )
    const teams16 = formTeams(players16, 'doubles')
    const waves = formMatches(teams16, 3)
    expect(waves[0]![0]!.courtNumber).toBe(1)
    expect(waves[0]![2]!.courtNumber).toBe(3)
    expect(waves[1]![0]!.courtNumber).toBe(1)
  })

  it('numéros de vague corrects', () => {
    const players16 = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`q${i + 1}`, i + 1),
    )
    const teams16 = formTeams(players16, 'doubles')
    const waves = formMatches(teams16, 3)
    waves.forEach((wave, wi) => {
      wave.forEach((m) => expect(m.wave).toBe(wi + 1))
    })
  })

  it('lève une erreur si nombre impair d\'équipes', () => {
    const teams3 = [teams4[0]!, teams4[1]!, teams4[2]!]
    expect(() => formMatches(teams3, 9)).toThrow()
  })

  it('edge case : 4 joueurs (minimum), 1 match, 1 vague', () => {
    const players4 = [1, 2, 3, 4].map((r) => makePlayer(`p${r}`, r))
    const teams = formTeams(players4, 'doubles')
    const waves = formMatches(teams, 9)
    expect(waves).toHaveLength(1)
    expect(waves[0]).toHaveLength(1)
    // P1+P4 vs P2+P3
    expect(waves[0]![0]!.team1.players.map((p) => p.playerId)).toEqual(['p1', 'p4'])
    expect(waves[0]![0]!.team2.players.map((p) => p.playerId)).toEqual(['p2', 'p3'])
  })
})

// ─── calculateStandings ───────────────────────────────────────────────────────

describe('calculateStandings', () => {
  it('classement correct après 1 round (doubles)', () => {
    // T1=(A+D) vs T2=(B+C) → T1 gagne 21-15
    const players = [
      makePlayer('a', 1, { playerName: 'Alice' }),
      makePlayer('b', 2, { playerName: 'Bob' }),
      makePlayer('c', 3, { playerName: 'Claire' }),
      makePlayer('d', 4, { playerName: 'David' }),
    ]
    const matches: RoundsMatchResult[] = [
      {
        team1PlayerIds: ['a', 'd'],
        team2PlayerIds: ['b', 'c'],
        scoreTeam1: 21,
        scoreTeam2: 15,
        winnerIsTeam1: true,
      },
    ]
    const standings = calculateStandings(players, matches)

    const alice = standings.find((s) => s.playerId === 'a')!
    const bob = standings.find((s) => s.playerId === 'b')!

    expect(alice.totalWins).toBe(1)
    expect(alice.totalPointsFor).toBe(21)
    expect(alice.totalPointsAgainst).toBe(15)
    expect(alice.goalAverage).toBe(6)
    expect(alice.roundsPlayed).toBe(1)

    expect(bob.totalWins).toBe(0)
    expect(bob.totalPointsFor).toBe(15)

    expect(alice.rank).toBeLessThan(bob.rank)
  })

  it('classement après 3 rounds — tri correct', () => {
    const players = [
      makePlayer('x', 1, { playerName: 'Xavier' }),
      makePlayer('y', 2, { playerName: 'Yann' }),
      makePlayer('z', 3, { playerName: 'Zoé' }),
      makePlayer('w', 4, { playerName: 'Will' }),
    ]
    const matches: RoundsMatchResult[] = [
      // Round 1 : X gagne, Y perd
      { team1PlayerIds: ['x', 'w'], team2PlayerIds: ['y', 'z'], scoreTeam1: 21, scoreTeam2: 10, winnerIsTeam1: true },
      // Round 2 : X gagne encore
      { team1PlayerIds: ['x', 'z'], team2PlayerIds: ['y', 'w'], scoreTeam1: 21, scoreTeam2: 15, winnerIsTeam1: true },
      // Round 3 : Y gagne, X perd
      { team1PlayerIds: ['y', 'w'], team2PlayerIds: ['x', 'z'], scoreTeam1: 21, scoreTeam2: 18, winnerIsTeam1: true },
    ]
    const standings = calculateStandings(players, matches)

    const x = standings.find((s) => s.playerId === 'x')!
    const y = standings.find((s) => s.playerId === 'y')!

    expect(x.totalWins).toBe(2)
    expect(y.totalWins).toBe(1)
    expect(x.rank).toBe(1)
  })

  it('départage par goal average quand wins égaux', () => {
    const players = [
      makePlayer('a', 1, { playerName: 'Anne' }),
      makePlayer('b', 2, { playerName: 'Bruno' }),
    ]
    const matches: RoundsMatchResult[] = [
      { team1PlayerIds: ['a'], team2PlayerIds: ['b'], scoreTeam1: 21, scoreTeam2: 5, winnerIsTeam1: true },
    ]
    const standings = calculateStandings(players, matches)
    const a = standings.find((s) => s.playerId === 'a')!
    expect(a.goalAverage).toBe(16)
    expect(a.rank).toBe(1)
  })

  it("départage alphabétique en dernier recours", () => {
    // Les deux ont le même résultat exact
    const players = [
      makePlayer('z', 1, { playerName: 'Zoé' }),
      makePlayer('a', 2, { playerName: 'Alice' }),
    ]
    // Aucun match joué → tout à zéro
    const standings = calculateStandings(players, [])
    expect(standings[0]!.playerName).toBe('Alice')
    expect(standings[1]!.playerName).toBe('Zoé')
  })

  it('les joueurs en bye conservent leurs stats à zéro', () => {
    const players = [
      makePlayer('a', 1, { playerName: 'Alice' }),
      makePlayer('b', 2, { playerName: 'Bob' }),
      makePlayer('c', 3, { playerName: 'Claire' }), // en bye ce round
    ]
    const matches: RoundsMatchResult[] = [
      { team1PlayerIds: ['a'], team2PlayerIds: ['b'], scoreTeam1: 21, scoreTeam2: 15, winnerIsTeam1: true },
    ]
    const standings = calculateStandings(players, matches)
    const claire = standings.find((s) => s.playerId === 'c')!
    expect(claire.roundsPlayed).toBe(0)
    expect(claire.totalPointsFor).toBe(0)
  })
})

// ─── generateRound ────────────────────────────────────────────────────────────

describe('generateRound', () => {
  const config = { format: 'doubles' as const, courtsAvailable: 9 }

  it('round 1 avec 8 joueurs → 0 bye, 4 équipes, 1 vague, 2 matchs', () => {
    const result = generateRound(1, players8, config)
    expect(result.byes).toHaveLength(0)
    expect(result.teams).toHaveLength(4)
    expect(result.waves).toHaveLength(1)
    expect(result.waves[0]).toHaveLength(2)
  })

  it('10 joueurs en double → 2 en attente, 8 jouent', () => {
    const players10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) =>
      makePlayer(`p${r}`, r, { consecutivePlayed: r }),
    )
    const result = generateRound(1, players10, config)
    expect(result.byes).toHaveLength(2)
    // Les 2 joueurs avec le plus de rounds consécutifs (p10, p9)
    const byeIds = result.byes.map((p) => p.playerId)
    expect(byeIds).toContain('p10')
    expect(byeIds).toContain('p9')
  })

  it('plafonne les actifs à 4× terrains : le surplus passe en attente (1 seule vague)', () => {
    // 12 joueurs, 2 terrains → capacité = 2×4 = 8 actifs → 4 en attente
    const result = generateRound(1, players12, {
      format: 'doubles',
      courtsAvailable: 2,
    })
    expect(result.byes).toHaveLength(4)
    expect(result.teams).toHaveLength(4) // 8 actifs → 4 équipes
    expect(result.waves).toHaveLength(1) // une seule vague, jamais de débordement
    expect(result.waves[0]).toHaveLength(2) // 2 matchs sur 2 terrains
  })

  it('mode singles avec 5 joueurs → 1 bye, 4 joueurs, 2 matchs', () => {
    const players5 = [1, 2, 3, 4, 5].map((r) =>
      makePlayer(`p${r}`, r, { consecutivePlayed: r }),
    )
    const result = generateRound(1, players5, {
      format: 'singles',
      courtsAvailable: 9,
    })
    expect(result.byes).toHaveLength(1)
    // p5 a le plus de rounds consécutifs (5)
    expect(result.byes[0]!.playerId).toBe('p5')
    expect(result.waves[0]).toHaveLength(2)
  })

  it('lève une erreur si pas assez de joueurs actifs', () => {
    const players3 = [1, 2, 3].map((r) => makePlayer(`p${r}`, r))
    expect(() => generateRound(1, players3, config)).toThrow()
  })
})
