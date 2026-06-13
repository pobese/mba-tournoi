import { describe, it, expect } from 'vitest'
import {
  generateClassicBracket,
  advanceBracket,
  calculatePoolDistribution,
  generatePoolMatches,
  calculatePoolStandings,
  calculateGlobalStandings,
  detectBracketSize,
  generateBracket,
  selectMatchesForCourts,
  planPoolCourtRedistribution,
  planBracketCourtDispatch,
  type PoolMatchInput,
  type PoolStanding,
  type CourtDispatchMatch,
  type BracketDispatchMatch,
} from './classic-bracket'

describe('classic bracket', () => {
  it('génère un bracket valide pour 8 équipes (puissance de 2)', () => {
    const { main, consolante } = generateClassicBracket(8)

    // 8 équipes → bracket de 8 → 4 matchs au round 1
    const round1Matches = main.filter((m) => m.round === 1)
    expect(round1Matches).toHaveLength(4)

    // Pas de byes
    expect(round1Matches.every((m) => !m.isBye)).toBe(true)

    // Seeds bien assignées (1 à 8)
    const allSeeds = round1Matches
      .flatMap((m) => [m.team1Seed, m.team2Seed])
      .filter((s): s is number => s !== null)
    expect(allSeeds.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    // Consolante générée
    expect(consolante.length).toBeGreaterThan(0)
  })

  it('génère un bracket valide pour 6 équipes (avec byes)', () => {
    const { main } = generateClassicBracket(6)

    const round1Matches = main.filter((m) => m.round === 1)
    expect(round1Matches).toHaveLength(4) // bracket de 8

    const byeMatches = round1Matches.filter((m) => m.isBye)
    expect(byeMatches).toHaveLength(2) // 2 byes pour 6 équipes dans un bracket de 8

    // Seeds 1 à 6 présentes
    const assignedSeeds = round1Matches
      .flatMap((m) => [m.team1Seed, m.team2Seed])
      .filter((s): s is number => s !== null)
    expect(assignedSeeds.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('génère un bracket pour 4 équipes', () => {
    const { main, thirdPlaceMatch } = generateClassicBracket(4)

    const round1 = main.filter((m) => m.round === 1)
    expect(round1).toHaveLength(2)
    expect(thirdPlaceMatch).not.toBeNull()
  })

  it('identifie le match pour la 3ème place', () => {
    const { thirdPlaceMatch } = generateClassicBracket(8)
    expect(thirdPlaceMatch).not.toBeNull()
    expect(thirdPlaceMatch?.id).toBe('third-place')
  })

  it('les perdants ont un loserGoesTo au round 1', () => {
    const { main } = generateClassicBracket(8, true)

    const round1 = main.filter((m) => m.round === 1 && !m.isBye)
    expect(round1.every((m) => m.loserGoesTo !== null)).toBe(true)
  })

  it('sans consolante : loserGoesTo est null', () => {
    const { main, consolante } = generateClassicBracket(8, false)

    expect(main.every((m) => m.loserGoesTo === null)).toBe(true)
    expect(consolante).toHaveLength(0)
  })

  it('advanceBracket retourne les bons matchs suivants', () => {
    const { main, consolante, thirdPlaceMatch } = generateClassicBracket(8)
    const allMatches = [
      ...main,
      ...consolante,
      ...(thirdPlaceMatch ? [thirdPlaceMatch] : []),
    ]

    const round1First = main.find((m) => m.round === 1 && m.position === 1)!
    const result = advanceBracket(allMatches, round1First.id, 1, 8)

    expect(result.winnersMatch).toBe(round1First.winnerAdvancesTo)
    expect(result.losersMatch).toBe(round1First.loserGoesTo)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// MODE CLASSIQUE — poules + tableau
// ════════════════════════════════════════════════════════════════════════════

describe('calculatePoolDistribution', () => {
  it.each([
    { n: 16, pools: 4, dist: [4, 4, 4, 4] },
    { n: 24, pools: 4, dist: [6, 6, 6, 6] },
    { n: 20, pools: 4, dist: [5, 5, 5, 5] },
    { n: 22, pools: 4, dist: [6, 6, 5, 5] },
    { n: 32, pools: 8, dist: [4, 4, 4, 4, 4, 4, 4, 4] },
    { n: 4, pools: 1, dist: [4] },
    { n: 64, pools: 16, dist: Array(16).fill(4) },
  ])('$n équipes → $pools poules', ({ n, pools, dist }) => {
    const result = calculatePoolDistribution(n, pools)
    expect(result.nbPools).toBe(pools)
    expect(result.distribution).toEqual(dist)
    expect(result.distribution.reduce((a, b) => a + b, 0)).toBe(n)
  })

  it('gère un nombre impair d\'équipes (poules équilibrées)', () => {
    const result = calculatePoolDistribution(19, 4)
    expect(result.distribution).toEqual([5, 5, 5, 4])
    expect(result.distribution.reduce((a, b) => a + b, 0)).toBe(19)
    // Poules les plus équilibrées possible : écart max de 1 entre poules.
    expect(Math.max(...result.distribution) - Math.min(...result.distribution)).toBeLessThanOrEqual(1)
  })

  it('lève une erreur si trop de poules (poule < 2 équipes)', () => {
    expect(() => calculatePoolDistribution(10, 6)).toThrow()
  })
})

describe('generatePoolMatches', () => {
  it('génère n×(n-1)/2 matchs sans doublon (poule de 4)', () => {
    const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const matches = generatePoolMatches('pool1', teams)
    expect(matches).toHaveLength(6) // 4*3/2

    const pairs = matches.map((m) => [m.team1Id, m.team2Id].sort().join('-'))
    expect(new Set(pairs).size).toBe(6) // aucun doublon
    expect(matches.every((m) => m.poolId === 'pool1')).toBe(true)
  })

  // Équité de l'ordre (méthode du cercle) : chaque tour de floor(n/2) matchs ne
  // fait jouer chaque équipe qu'une fois → personne n'enchaîne tous ses matchs.
  it.each([4, 5, 6, 7, 8])('répartit équitablement le rythme (poule de %i)', (n) => {
    const teams = Array.from({ length: n }, (_, i) => ({ id: `t${i}` }))
    const matches = generatePoolMatches('pool1', teams)
    expect(matches).toHaveLength((n * (n - 1)) / 2)
    expect(new Set(matches.map((m) => [m.team1Id, m.team2Id].sort().join('-'))).size).toBe(
      (n * (n - 1)) / 2,
    ) // toutes les confrontations, une seule fois

    const perRound = Math.floor(n / 2)
    for (let start = 0; start + perRound <= matches.length; start += perRound) {
      const round = matches.slice(start, start + perRound)
      const ids = round.flatMap((m) => [m.team1Id, m.team2Id])
      expect(new Set(ids).size).toBe(ids.length) // aucune équipe deux fois dans le tour
    }

    // Toutes les équipes entrent en jeu dès le premier tour (aucune mise à l'écart).
    const firstAppearance = new Map<string, number>()
    matches.forEach((m, i) => {
      for (const id of [m.team1Id, m.team2Id]) {
        if (!firstAppearance.has(id)) firstAppearance.set(id, i)
      }
    })
    expect(firstAppearance.size).toBe(n)
    expect(Math.max(...firstAppearance.values())).toBeLessThan(perRound * 2)
  })
})

describe('calculatePoolStandings', () => {
  const teams = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Bravo' },
    { id: 'c', name: 'Charlie' },
  ]

  it('classe par victoires puis goal-average', () => {
    const matches: PoolMatchInput[] = [
      { team1Id: 'a', team2Id: 'b', sets: [{ team1: 21, team2: 10 }] }, // A bat B
      { team1Id: 'a', team2Id: 'c', sets: [{ team1: 21, team2: 15 }] }, // A bat C
      { team1Id: 'b', team2Id: 'c', sets: [{ team1: 21, team2: 19 }] }, // B bat C
    ]
    const standings = calculatePoolStandings(matches, teams)
    expect(standings.map((s) => s.teamId)).toEqual(['a', 'b', 'c'])
    expect(standings[0]!.wins).toBe(2)
    expect(standings[0]!.rankInPool).toBe(1)
  })

  it('départage une égalité parfaite par confrontation directe', () => {
    // A, B, C : chacun 1 victoire, GA identiques → cycle. La confrontation
    // directe doit néanmoins produire un ordre déterministe.
    const matches: PoolMatchInput[] = [
      { team1Id: 'a', team2Id: 'b', sets: [{ team1: 21, team2: 15 }] }, // A bat B
      { team1Id: 'b', team2Id: 'c', sets: [{ team1: 21, team2: 15 }] }, // B bat C
      { team1Id: 'c', team2Id: 'a', sets: [{ team1: 21, team2: 15 }] }, // C bat A
    ]
    const standings = calculatePoolStandings(matches, teams)
    expect(standings).toHaveLength(3)
    expect(standings.map((s) => s.rankInPool)).toEqual([1, 2, 3])
    // Chacun 1 victoire, GA sets/points nuls → départage stable (alpha en dernier recours)
    expect(standings.every((s) => s.wins === 1)).toBe(true)
  })

  it('départage 2 équipes à égalité par leur confrontation directe', () => {
    const two = [
      { id: 'x', name: 'Xray' },
      { id: 'y', name: 'Yankee' },
    ]
    const matches: PoolMatchInput[] = [
      // Même bilan global, mais Y a battu X en direct → Y devant
      { team1Id: 'y', team2Id: 'x', sets: [{ team1: 21, team2: 19 }] },
    ]
    const standings = calculatePoolStandings(matches, two)
    expect(standings[0]!.teamId).toBe('y')
  })
})

describe('calculateGlobalStandings', () => {
  it('fusionne les poules en classement global ordonné', () => {
    const poolStandings: PoolStanding[] = [
      // Poule A
      { teamId: 'a1', teamName: 'A1', wins: 3, losses: 0, setsWon: 6, setsLost: 1, pointsFor: 63, pointsAgainst: 40, matchesPlayed: 3, rankInPool: 1 },
      { teamId: 'a2', teamName: 'A2', wins: 1, losses: 2, setsWon: 2, setsLost: 5, pointsFor: 45, pointsAgainst: 58, matchesPlayed: 3, rankInPool: 2 },
      // Poule B
      { teamId: 'b1', teamName: 'B1', wins: 2, losses: 1, setsWon: 5, setsLost: 3, pointsFor: 60, pointsAgainst: 50, matchesPlayed: 3, rankInPool: 1 },
      { teamId: 'b2', teamName: 'B2', wins: 0, losses: 3, setsWon: 0, setsLost: 6, pointsFor: 30, pointsAgainst: 63, matchesPlayed: 3, rankInPool: 2 },
    ]
    const global = calculateGlobalStandings(poolStandings)
    expect(global.map((g) => g.teamId)).toEqual(['a1', 'b1', 'a2', 'b2'])
    expect(global.map((g) => g.globalRank)).toEqual([1, 2, 3, 4])
  })
})

describe('detectBracketSize', () => {
  it.each([
    { n: 16, size: 16, barrage: false, excess: 0 },
    { n: 20, size: 16, barrage: true, excess: 4 },
    { n: 24, size: 16, barrage: true, excess: 8 },
    { n: 32, size: 32, barrage: false, excess: 0 },
    { n: 40, size: 32, barrage: true, excess: 8 },
    { n: 48, size: 32, barrage: true, excess: 16 },
    { n: 64, size: 64, barrage: false, excess: 0 },
  ])('$n équipes → tableau $size (barrage=$barrage)', ({ n, size, barrage, excess }) => {
    const r = detectBracketSize(n)
    expect(r.bracketSize).toBe(size)
    expect(r.withBarrage).toBe(barrage)
    expect(r.excess).toBe(excess)
    expect(r.nbQualified).toBe(size)
  })
})

describe('generateBracket', () => {
  const standings = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ teamId: `t${i + 1}` }))

  it('tableau pur (16 équipes) : 15 matchs principaux, pas de barrage', () => {
    const sizing = detectBracketSize(16)
    const { mainBracket, barrages, byes } = generateBracket(standings(16), sizing, 'barrage')
    expect(mainBracket).toHaveLength(15) // 16 slots → 15 matchs
    expect(barrages).toHaveLength(0)
    expect(byes).toHaveLength(0)
    // Tous les slots du 1er tour sont remplis (pas de bye)
    const round1 = mainBracket.filter((m) => m.roundInBracket === 8)
    expect(round1).toHaveLength(8)
    expect(round1.every((m) => m.team1Id && m.team2Id)).toBe(true)
  })

  it('barrage (20 équipes) : perdants repêchés en consolante, destinations distinctes', () => {
    const sizing = detectBracketSize(20) // bracket 16, excess 4
    const { mainBracket, consolante, barrages } = generateBracket(standings(20), sizing, 'barrage')
    expect(barrages).toHaveLength(4)
    // Le gagnant rejoint le tableau principal
    expect(barrages.every((b) => b.winnerAdvancesTo?.startsWith('m-'))).toBe(true)
    expect(barrages.every((b) => b.team1Id && b.team2Id)).toBe(true)
    const main = new Map(mainBracket.map((m) => [m.id, m]))
    expect(barrages.every((b) => main.has(b.winnerAdvancesTo!))).toBe(true)

    // Le perdant est repêché vers un match cp-j DISTINCT (corrige l'ancien bug
    // où tous pointaient vers la même feuille consolante).
    expect(barrages.every((b) => b.loserGoesTo?.startsWith('cp-'))).toBe(true)
    expect(new Set(barrages.map((b) => b.loserGoesTo)).size).toBe(4)

    // 4 matchs de repêchage dans la consolante, gagnant → arbre consolante.
    const playIns = consolante.filter((m) => m.bracketPosition === 0)
    expect(playIns).toHaveLength(4)
    const consoTree = new Set(consolante.filter((m) => m.bracketPosition >= 1).map((m) => m.id))
    expect(playIns.every((p) => p.winnerAdvancesTo !== null && consoTree.has(p.winnerAdvancesTo!))).toBe(true)
    expect(playIns.every((p) => p.loserGoesTo === null)).toBe(true) // perdant du repêchage éliminé
  })

  it('intégrité du routage : aucune référence pendante, 2 pourvoyeurs par repêchage', () => {
    const sizing = detectBracketSize(20)
    const { mainBracket, consolante, barrages } = generateBracket(standings(20), sizing, 'barrage')
    const all = [...mainBracket, ...consolante, ...barrages]
    const ids = new Set(all.map((n) => n.id))
    for (const n of all) {
      if (n.winnerAdvancesTo !== null) expect(ids.has(n.winnerAdvancesTo)).toBe(true)
      if (n.loserGoesTo !== null) expect(ids.has(n.loserGoesTo)).toBe(true)
    }
    // Chaque repêchage est nourri par exactement 2 perdants (1 barrage + 1 principal).
    const feeders = new Map<string, number>()
    for (const n of [...mainBracket, ...barrages]) {
      if (n.loserGoesTo?.startsWith('cp-')) feeders.set(n.loserGoesTo, (feeders.get(n.loserGoesTo) ?? 0) + 1)
    }
    expect(feeders.size).toBe(4)
    expect([...feeders.values()].every((c) => c === 2)).toBe(true)
  })

  it('edge case : 4 équipes', () => {
    const sizing = detectBracketSize(4)
    const { mainBracket, consolante, barrages } = generateBracket(standings(4), sizing, 'barrage')
    expect(mainBracket).toHaveLength(3) // 2 demies + 1 finale
    expect(barrages).toHaveLength(0)
    expect(consolante).toHaveLength(1) // petite finale (perdants des demies)
  })

  it('edge case : 64 équipes', () => {
    const sizing = detectBracketSize(64)
    const { mainBracket, barrages } = generateBracket(standings(64), sizing, 'barrage')
    expect(mainBracket).toHaveLength(63)
    expect(barrages).toHaveLength(0)
    expect(mainBracket.filter((m) => m.roundInBracket === 32)).toHaveLength(32) // 1er tour
  })
})

describe('selectMatchesForCourts (attribution des terrains de poule)', () => {
  // Matchs round-robin de 4 équipes A-D, ordre de génération (i<j).
  const rr4: CourtDispatchMatch[] = [
    { id: 'AB', team1Id: 'A', team2Id: 'B' },
    { id: 'AC', team1Id: 'A', team2Id: 'C' },
    { id: 'AD', team1Id: 'A', team2Id: 'D' },
    { id: 'BC', team1Id: 'B', team2Id: 'C' },
    { id: 'BD', team1Id: 'B', team2Id: 'D' },
    { id: 'CD', team1Id: 'C', team2Id: 'D' },
  ]
  const noPlayed = new Map<string, number>()

  it('assigne au plus un match par terrain libre', () => {
    const result = selectMatchesForCourts([1, 2, 3], rr4, new Set(), noPlayed)
    expect(result.length).toBeLessThanOrEqual(3)
    const courts = result.map((r) => r.courtNumber)
    expect(new Set(courts).size).toBe(courts.length)
  })

  it("n'assigne jamais deux matchs simultanés à une même équipe", () => {
    const result = selectMatchesForCourts([1, 2, 3], rr4, new Set(), noPlayed)
    const teams = result.flatMap((r) => {
      const m = rr4.find((x) => x.id === r.matchId)!
      return [m.team1Id, m.team2Id]
    })
    expect(new Set(teams).size).toBe(teams.length)
    // 4 équipes → 2 matchs simultanés max, même avec 3 terrains libres
    expect(result).toHaveLength(2)
  })

  it('exclut les matchs dont une équipe est déjà sur un terrain', () => {
    const result = selectMatchesForCourts([2], rr4, new Set(['A', 'B']), noPlayed)
    expect(result).toHaveLength(1)
    expect(result[0]!.matchId).toBe('CD')
  })

  it('priorise les équipes ayant le moins joué (équité)', () => {
    // A et B ont déjà joué 2 fois, C et D une seule fois → CD prioritaire
    const played = new Map([['A', 2], ['B', 2], ['C', 1], ['D', 1]])
    const result = selectMatchesForCourts([1], rr4, new Set(), played)
    expect(result[0]!.matchId).toBe('CD')
  })

  it("l'ordre de création départage les égalités (tri stable)", () => {
    const result = selectMatchesForCourts([1], rr4, new Set(), noPlayed)
    expect(result[0]!.matchId).toBe('AB')
  })

  it('aucune équipe ne peut attendre indéfiniment (rotation complète)', () => {
    // Simulation : 1 terrain, on joue les matchs dans l'ordre du dispatch.
    const played = new Map<string, number>()
    const remaining = [...rr4]
    const order: string[] = []
    while (remaining.length > 0) {
      const [next] = selectMatchesForCourts([1], remaining, new Set(), played)
      expect(next).toBeDefined()
      const m = remaining.splice(remaining.findIndex((x) => x.id === next!.matchId), 1)[0]!
      order.push(m.id)
      played.set(m.team1Id, (played.get(m.team1Id) ?? 0) + 1)
      played.set(m.team2Id, (played.get(m.team2Id) ?? 0) + 1)
    }
    // Après AB, les moins servis C et D jouent (pas A qui enchaînerait en ordre brut)
    expect(order[0]).toBe('AB')
    expect(order[1]).toBe('CD')
    // Personne n'atteint 3 matchs joués avant que tout le monde en ait au moins 2
    expect(order).toHaveLength(6)
  })

  it('renvoie vide si aucun candidat compatible', () => {
    expect(selectMatchesForCourts([1, 2], [], new Set(), noPlayed)).toEqual([])
    const allBusy = selectMatchesForCourts([1], rr4, new Set(['A', 'B', 'C', 'D']), noPlayed)
    expect(allBusy).toEqual([])
  })
})

describe('planPoolCourtRedistribution (poule terminée → redistribution)', () => {
  it("redistribue les terrains d'une poule finie aux poules sous-dotées", () => {
    // Poule A finie (0 pending) tient 2 terrains ; B et C en jeu, capacité 3, n'ont que 2.
    const plan = planPoolCourtRedistribution(
      [
        { poolId: 'A', position: 1, teamCount: 6, pendingCount: 0, currentCourts: [1, 2] },
        { poolId: 'B', position: 2, teamCount: 6, pendingCount: 8, currentCourts: [3, 4] },
        { poolId: 'C', position: 3, teamCount: 6, pendingCount: 8, currentCourts: [5, 6] },
      ],
      [],
    )
    // A libère tout, B et C reçoivent 1 terrain chacune (capacité 3).
    const aCourts = plan.assignments.find((a) => a.poolId === 'A')!.courts
    expect(aCourts).toEqual([])
    expect(plan.assignments.find((a) => a.poolId === 'B')!.courts).toHaveLength(3)
    expect(plan.assignments.find((a) => a.poolId === 'C')!.courts).toHaveLength(3)
    expect(plan.gained.map((g) => g.poolId).sort()).toEqual(['B', 'C'])
    expect(plan.leisureCourts).toEqual([])
  })

  it('met en loisir le surplus quand les poules en jeu sont déjà à capacité', () => {
    // 9 terrains, 3 poules de 6 (capacité 3 chacune = 9). A finit → ses 3 terrains
    // ne peuvent aller nulle part (B, C déjà à 3) → 3 terrains loisir.
    const plan = planPoolCourtRedistribution(
      [
        { poolId: 'A', position: 1, teamCount: 6, pendingCount: 0, currentCourts: [1, 2, 3] },
        { poolId: 'B', position: 2, teamCount: 6, pendingCount: 5, currentCourts: [4, 5, 6] },
        { poolId: 'C', position: 3, teamCount: 6, pendingCount: 5, currentCourts: [7, 8, 9] },
      ],
      [],
    )
    expect(plan.assignments.find((a) => a.poolId === 'A')!.courts).toEqual([])
    expect(plan.gained).toEqual([])
    expect(plan.leisureCourts).toEqual([1, 2, 3])
  })

  it('borne la capacité par le nombre de matchs restants', () => {
    // Poule B : 6 équipes (cap équipes 3) mais 1 seul match restant → capacité 1.
    const plan = planPoolCourtRedistribution(
      [
        { poolId: 'A', position: 1, teamCount: 6, pendingCount: 0, currentCourts: [1, 2] },
        { poolId: 'B', position: 2, teamCount: 6, pendingCount: 1, currentCourts: [3] },
      ],
      [],
    )
    expect(plan.assignments.find((a) => a.poolId === 'B')!.courts).toEqual([3]) // pas plus
    expect(plan.leisureCourts).toEqual([1, 2])
  })

  it('borne la capacité par floor(équipes / 2)', () => {
    // Poule de 3 équipes → 1 match simultané max, même avec beaucoup de terrains.
    const plan = planPoolCourtRedistribution(
      [{ poolId: 'A', position: 1, teamCount: 3, pendingCount: 3, currentCourts: [] }],
      [1, 2, 3],
    )
    expect(plan.assignments[0]!.courts).toHaveLength(1)
    expect(plan.leisureCourts).toEqual([2, 3])
  })
})

describe('planBracketCourtDispatch (terrains du tableau)', () => {
  it('priorise les barrages (position 0) avant le tableau principal', () => {
    const result = planBracketCourtDispatch(
      [1, 2],
      [
        { id: 'main-r1', phase: 'bracket_main', bracketPosition: 4 },
        { id: 'barrage-1', phase: 'barrage', bracketPosition: 0 },
      ],
    )
    expect(result[0]!.matchId).toBe('barrage-1')
    expect(result[1]!.matchId).toBe('main-r1')
  })

  it('démarre les matchs principaux prêts en parallèle si terrains restants', () => {
    const result = planBracketCourtDispatch(
      [1, 2, 3],
      [
        { id: 'b1', phase: 'barrage', bracketPosition: 0 },
        { id: 'b2', phase: 'barrage', bracketPosition: 0 },
        { id: 'm', phase: 'bracket_main', bracketPosition: 4 },
      ],
    )
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.matchId)).toContain('m')
  })

  it('au sein d\'un tableau, tours précoces en premier', () => {
    const result = planBracketCourtDispatch(
      [1, 2, 3],
      [
        { id: 'conso', phase: 'bracket_consolante', bracketPosition: 2 },
        { id: 'quart', phase: 'bracket_main', bracketPosition: 4 }, // roundSize 4
        { id: 'demi', phase: 'bracket_main', bracketPosition: 2 },  // roundSize 2
      ],
    )
    // 2 main prêts + 1 conso prêt sur 3 terrains → tout passe, principal d'abord trié.
    expect(result.map((r) => r.matchId)).toEqual(['quart', 'demi', 'conso'])
  })

  it('ne dépasse pas le nombre de terrains libres', () => {
    const result = planBracketCourtDispatch(
      [1],
      [
        { id: 'a', phase: 'barrage', bracketPosition: 0 },
        { id: 'b', phase: 'bracket_main', bracketPosition: 4 },
      ],
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.matchId).toBe('a')
  })

  it('équilibre principal et consolante au prorata du travail restant', () => {
    // 4 terrains, beaucoup de matchs prêts des deux côtés. Restant : 15 principal,
    // 7 consolante → ~3 terrains principal / 1 consolante (pas 4/0).
    const ready: BracketDispatchMatch[] = [
      { id: 'm1', phase: 'bracket_main', bracketPosition: 8 },
      { id: 'm2', phase: 'bracket_main', bracketPosition: 9 },
      { id: 'm3', phase: 'bracket_main', bracketPosition: 10 },
      { id: 'm4', phase: 'bracket_main', bracketPosition: 11 },
      { id: 'c1', phase: 'bracket_consolante', bracketPosition: 4 },
      { id: 'c2', phase: 'bracket_consolante', bracketPosition: 5 },
      { id: 'c3', phase: 'bracket_consolante', bracketPosition: 6 },
    ]
    const result = planBracketCourtDispatch([1, 2, 3, 4], ready, { main: 15, consolante: 7 })
    const ids = result.map((r) => r.matchId)
    expect(result).toHaveLength(4)
    expect(ids.filter((id) => id.startsWith('m'))).toHaveLength(3)
    expect(ids.filter((id) => id.startsWith('c'))).toHaveLength(1)
  })

  it('garantit au moins un terrain à la consolante quand les deux sont prêts', () => {
    const ready: BracketDispatchMatch[] = [
      { id: 'm1', phase: 'bracket_main', bracketPosition: 8 },
      { id: 'm2', phase: 'bracket_main', bracketPosition: 9 },
      { id: 'm3', phase: 'bracket_main', bracketPosition: 10 },
      { id: 'c1', phase: 'bracket_consolante', bracketPosition: 4 },
    ]
    // Restant écrasant côté principal mais la consolante a un match prêt → 1 terrain.
    const result = planBracketCourtDispatch([1, 2], ready, { main: 100, consolante: 3 })
    const ids = result.map((r) => r.matchId)
    expect(ids).toContain('c1')
    expect(ids.filter((id) => id.startsWith('m'))).toHaveLength(1)
  })

  it('reporte les terrains vers le principal si la consolante a peu de matchs prêts', () => {
    const ready: BracketDispatchMatch[] = [
      { id: 'm1', phase: 'bracket_main', bracketPosition: 8 },
      { id: 'm2', phase: 'bracket_main', bracketPosition: 9 },
      { id: 'm3', phase: 'bracket_main', bracketPosition: 10 },
      { id: 'c1', phase: 'bracket_consolante', bracketPosition: 4 },
    ]
    // 4 terrains mais 1 seul conso prêt → 3 principal + 1 conso (aucun gaspillé).
    const result = planBracketCourtDispatch([1, 2, 3, 4], ready, { main: 15, consolante: 7 })
    expect(result).toHaveLength(4)
    expect(result.map((r) => r.matchId).filter((id) => id.startsWith('m'))).toHaveLength(3)
  })
})
