// Génération de bracket à élimination directe avec consolante.
// Supporte N équipes (pas nécessairement une puissance de 2) via "byes".

import { nextPowerOf2 } from '@/lib/utils'

export type BracketType = 'main' | 'consolante'

export interface BracketMatch {
  id: string                          // identifiant unique dans le bracket
  round: number                       // round dans son tableau (1 = premier match)
  position: number                    // position visuelle (1-based, top to bottom)
  bracket: BracketType
  team1Seed: number | null            // null si pas encore qualifié ou bye
  team2Seed: number | null
  isBye: boolean                      // true si un des côtés est vide → avancement auto
  winnerAdvancesTo: string | null     // id du match suivant pour le gagnant
  loserGoesTo: string | null          // id du match consolante pour le perdant
}

export interface ClassicBracket {
  main: BracketMatch[]
  consolante: BracketMatch[]
  thirdPlaceMatch: BracketMatch | null
}

function makeId(bracket: BracketType, round: number, position: number): string {
  return `${bracket}-r${round}-p${position}`
}

/**
 * Place les seeds dans le bracket : 1 vs N, 2 vs N-1, etc.
 * Garantit que les meilleures seeds sont espacées dans le bracket.
 */
// Génère l'ordre standard de placement des seeds dans un bracket.
// ex: pour 8 : [1, 8, 4, 5, 3, 6, 2, 7]
function seedPositions(bracketSize: number): number[] {
  const order: number[] = [1]
  for (let round = 1; Math.pow(2, round) <= bracketSize; round++) {
    const nextOrder: number[] = []
    for (const seed of order) {
      nextOrder.push(seed)
      nextOrder.push(Math.pow(2, round) + 1 - seed)
    }
    order.splice(0, order.length, ...nextOrder)
  }
  return order
}

/**
 * Génère le bracket complet (principal + consolante) pour N équipes.
 * Les équipes sont identifiées par leur seed (1 = meilleure).
 */
export function generateClassicBracket(
  teamCount: number,
  hasConsolation: boolean = true
): ClassicBracket {
  if (teamCount < 2) throw new Error('Il faut au moins 2 équipes')

  const bracketSize = nextPowerOf2(teamCount)
  const numRounds = Math.log2(bracketSize)        // nombre de rounds dans le tableau principal
  const byeCount = bracketSize - teamCount        // nombre d'exemptions au round 1

  // Obtenir l'ordre de placement des seeds
  const seedOrder = seedPositions(bracketSize)    // tableau de bracketSize seeds

  const mainMatches: BracketMatch[] = []
  const consolanteMatches: BracketMatch[] = []
  let thirdPlaceMatch: BracketMatch | null = null

  // ─── Round 1 du tableau principal ─────────────────────────────────────────
  const round1Matches = bracketSize / 2

  for (let pos = 1; pos <= round1Matches; pos++) {
    const topSlot = (pos - 1) * 2        // index dans seedOrder
    const botSlot = topSlot + 1

    const seed1Raw = seedOrder[topSlot]
    const seed2Raw = seedOrder[botSlot]

    const seed1: number | null = typeof seed1Raw === 'number' && seed1Raw <= teamCount
      ? seed1Raw
      : null
    const seed2: number | null = typeof seed2Raw === 'number' && seed2Raw <= teamCount
      ? seed2Raw
      : null

    const isBye = seed1 === null || seed2 === null

    const matchId = makeId('main', 1, pos)
    const winnerAdvancesTo = makeId('main', 2, Math.ceil(pos / 2))

    // Le perdant du round 1 entre en consolante seulement si hasConsolation
    let loserGoesTo: string | null = null
    if (hasConsolation && !isBye && numRounds >= 2) {
      loserGoesTo = makeId('consolante', 1, pos)
    }

    mainMatches.push({
      id: matchId,
      round: 1,
      position: pos,
      bracket: 'main',
      team1Seed: seed1,
      team2Seed: seed2,
      isBye,
      winnerAdvancesTo: numRounds > 1 ? winnerAdvancesTo : null,
      loserGoesTo,
    })
  }

  // ─── Rounds suivants du tableau principal ─────────────────────────────────
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round)
    const isFinalRound = round === numRounds

    for (let pos = 1; pos <= matchesInRound; pos++) {
      const matchId = makeId('main', round, pos)
      const winnerAdvancesTo = isFinalRound
        ? null
        : makeId('main', round + 1, Math.ceil(pos / 2))

      // Perdant de la demi-finale → match 3ème place
      let loserGoesTo: string | null = null
      if (hasConsolation && round === numRounds - 1 && numRounds >= 2) {
        loserGoesTo = 'third-place'
      }

      mainMatches.push({
        id: matchId,
        round,
        position: pos,
        bracket: 'main',
        team1Seed: null,
        team2Seed: null,
        isBye: false,
        winnerAdvancesTo,
        loserGoesTo,
      })
    }
  }

  // ─── Tableau consolante ───────────────────────────────────────────────────
  if (hasConsolation && byeCount < bracketSize - 1) {
    // Round 1 consolante : perdants du round 1 principal
    const consolanteR1Count = round1Matches - byeCount
    const consolanteRounds = Math.ceil(Math.log2(consolanteR1Count * 2 || 2))

    for (let round = 1; round <= Math.max(consolanteRounds, 1); round++) {
      const matchesInRound = Math.max(
        1,
        Math.floor(consolanteR1Count / Math.pow(2, round - 1))
      )

      for (let pos = 1; pos <= matchesInRound; pos++) {
        const matchId = makeId('consolante', round, pos)
        const isLastConsoRound = round === consolanteRounds

        consolanteMatches.push({
          id: matchId,
          round,
          position: pos,
          bracket: 'consolante',
          team1Seed: null,
          team2Seed: null,
          isBye: false,
          winnerAdvancesTo: isLastConsoRound
            ? 'third-place'
            : makeId('consolante', round + 1, Math.ceil(pos / 2)),
          loserGoesTo: null,
        })
      }
    }

    // Match pour la 3ème place
    thirdPlaceMatch = {
      id: 'third-place',
      round: numRounds,
      position: 1,
      bracket: 'consolante',
      team1Seed: null,
      team2Seed: null,
      isBye: false,
      winnerAdvancesTo: null,
      loserGoesTo: null,
    }
  }

  return { main: mainMatches, consolante: consolanteMatches, thirdPlaceMatch }
}

/**
 * Avance les équipes dans le bracket après un score saisi.
 * Retourne les IDs des matchs à mettre à jour.
 */
export function advanceBracket(
  allMatches: BracketMatch[],
  completedMatchId: string,
  _winnerSeed: number,
  _loserSeed: number
): { winnersMatch: string | null; losersMatch: string | null } {
  const match = allMatches.find((m) => m.id === completedMatchId)
  if (!match) return { winnersMatch: null, losersMatch: null }

  return {
    winnersMatch: match.winnerAdvancesTo,
    losersMatch: match.loserGoesTo,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODE CLASSIQUE — Phase poules + génération du tableau depuis le classement
// (fonctions pures, testées dans classic-bracket.test.ts)
// ════════════════════════════════════════════════════════════════════════════

// ─── Répartition en poules ────────────────────────────────────────────────────

export interface PoolDistribution {
  nbPools: number
  teamsPerPool: number // taille de la plus grande poule (ceil)
  distribution: number[] // tailles par poule, décroissant — ex: [6,6,5,5]
}

// Borne haute du nombre de poules : chaque poule doit avoir au moins 2 équipes.
export function maxPoolCount(nbTeams: number): number {
  return Math.max(1, Math.floor(nbTeams / 2))
}

// Nombre de poules suggéré par défaut : vise des poules de ~5 équipes.
export function suggestPoolCount(nbTeams: number): number {
  return Math.min(maxPoolCount(nbTeams), Math.max(1, Math.round(nbTeams / 5)))
}

/**
 * Répartit `nbTeams` équipes en `nbPools` poules, le plus équilibré possible :
 * les `rem` premières poules reçoivent une équipe de plus. Le nombre de poules
 * est choisi par l'organisateur (pas d'heuristique).
 */
export function calculatePoolDistribution(
  nbTeams: number,
  nbPools: number,
): PoolDistribution {
  if (nbTeams < 4) {
    throw new Error(`calculatePoolDistribution : ${nbTeams} équipes — minimum 4`)
  }
  if (nbPools < 1 || nbPools > maxPoolCount(nbTeams)) {
    throw new Error(
      `calculatePoolDistribution : ${nbPools} poule(s) invalide pour ${nbTeams} équipes`,
    )
  }

  // Répartition équilibrée : `rem` poules reçoivent une équipe de plus.
  const base = Math.floor(nbTeams / nbPools)
  const rem = nbTeams % nbPools
  const distribution = Array.from({ length: nbPools }, (_, i) => (i < rem ? base + 1 : base))

  return { nbPools, teamsPerPool: Math.ceil(nbTeams / nbPools), distribution }
}

// ─── Génération des matchs de poule (round-robin) ─────────────────────────────

export interface PoolMatchToCreate {
  poolId: string
  team1Id: string
  team2Id: string
}

/**
 * Round-robin complet : chaque équipe affronte toutes les autres une fois.
 * n×(n-1)/2 matchs.
 *
 * Ordre = méthode du cercle (Berger) : on planifie n-1 tours où, à chaque tour,
 * chaque équipe joue AU PLUS une fois. Émettre les matchs tour par tour donne un
 * ordre de création équilibré : aucune équipe n'enchaîne tous ses matchs en tête
 * de file (le cas d'une boucle imbriquée 1-2,1-3,1-4… qui faisait jouer le
 * joueur 1 d'affilée pendant que les autres attendaient). Vaut pour simple comme
 * double — c'est le même générateur.
 *
 * Les matchs sortent dans cet ordre ; l'appelant le persiste dans
 * `matches.position` pour que le dispatch des terrains le respecte.
 */
export function generatePoolMatches(
  poolId: string,
  teams: Array<{ id: string }>,
): PoolMatchToCreate[] {
  if (teams.length < 2) return []

  // Slots tournants : on ajoute une équipe « fantôme » (null) si effectif impair
  // → l'équipe en face d'elle est exemptée ce tour-là.
  const slots: (string | null)[] = teams.map((t) => t.id)
  if (slots.length % 2 === 1) slots.push(null)
  const size = slots.length
  const half = size / 2

  const matches: PoolMatchToCreate[] = []
  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < half; i++) {
      const a = slots[i]
      const b = slots[size - 1 - i]
      if (a != null && b != null) matches.push({ poolId, team1Id: a, team2Id: b })
    }
    // Rotation : la 1re position reste fixe, les autres tournent d'un cran.
    const last = slots.pop()!
    slots.splice(1, 0, last)
  }
  return matches
}

// ─── Classements ──────────────────────────────────────────────────────────────

export interface PoolMatchInput {
  team1Id: string
  team2Id: string
  sets: Array<{ team1: number; team2: number }>
}

export interface PoolStanding {
  teamId: string
  teamName: string
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
  matchesPlayed: number
  rankInPool: number
}

export interface GlobalStanding extends PoolStanding {
  globalRank: number
}

interface MutableStats {
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

// Vainqueur d'un match d'après les sets gagnés (null si match à égalité / vide).
function matchWinner(sets: Array<{ team1: number; team2: number }>): 1 | 2 | null {
  let s1 = 0
  let s2 = 0
  for (const s of sets) {
    if (s.team1 > s.team2) s1++
    else if (s.team2 > s.team1) s2++
  }
  if (s1 === s2) return null
  return s1 > s2 ? 1 : 2
}

function tieKey(s: { wins: number; setsWon: number; setsLost: number; pointsFor: number; pointsAgainst: number }): string {
  return `${s.wins}_${s.setsWon - s.setsLost}_${s.pointsFor - s.pointsAgainst}`
}

// Départage un groupe d'équipes à égalité parfaite par confrontation directe.
function resolveHeadToHead(group: MutableStats[], matches: PoolMatchInput[]): MutableStats[] {
  const ids = new Set(group.map((g) => g.teamId))
  const h2hWins = new Map<string, number>(group.map((g) => [g.teamId, 0]))

  for (const m of matches) {
    if (!ids.has(m.team1Id) || !ids.has(m.team2Id)) continue
    const w = matchWinner(m.sets)
    if (w === null) continue
    const winnerId = w === 1 ? m.team1Id : m.team2Id
    h2hWins.set(winnerId, (h2hWins.get(winnerId) ?? 0) + 1)
  }

  return [...group].sort(
    (a, b) =>
      (h2hWins.get(b.teamId)! - h2hWins.get(a.teamId)!) ||
      a.teamName.localeCompare(b.teamName, 'fr'),
  )
}

function buildStats(
  matches: PoolMatchInput[],
  teams: Array<{ id: string; name: string }>,
): MutableStats[] {
  const stats = new Map<string, MutableStats>(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id, teamName: t.name,
        wins: 0, losses: 0, setsWon: 0, setsLost: 0,
        pointsFor: 0, pointsAgainst: 0, matchesPlayed: 0,
      },
    ]),
  )

  for (const m of matches) {
    const a = stats.get(m.team1Id)
    const b = stats.get(m.team2Id)
    if (!a || !b) continue

    let setsA = 0, setsB = 0, ptsA = 0, ptsB = 0
    for (const s of m.sets) {
      ptsA += s.team1
      ptsB += s.team2
      if (s.team1 > s.team2) setsA++
      else if (s.team2 > s.team1) setsB++
    }
    if (m.sets.length === 0) continue // match non joué

    a.matchesPlayed++; b.matchesPlayed++
    a.setsWon += setsA; a.setsLost += setsB; a.pointsFor += ptsA; a.pointsAgainst += ptsB
    b.setsWon += setsB; b.setsLost += setsA; b.pointsFor += ptsB; b.pointsAgainst += ptsA
    if (setsA > setsB) { a.wins++; b.losses++ }
    else if (setsB > setsA) { b.wins++; a.losses++ }
  }

  return [...stats.values()]
}

// Tri : victoires > goal-average sets > goal-average points > (h2h) > alpha.
function sortWithTies(stats: MutableStats[], matches: PoolMatchInput[]): MutableStats[] {
  const sorted = [...stats].sort(
    (a, b) =>
      b.wins - a.wins ||
      (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
      (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) ||
      a.teamName.localeCompare(b.teamName, 'fr'),
  )

  // Départage les groupes à égalité parfaite par confrontation directe.
  const result: MutableStats[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && tieKey(sorted[j + 1]!) === tieKey(sorted[i]!)) j++
    const group = sorted.slice(i, j + 1)
    result.push(...(group.length > 1 ? resolveHeadToHead(group, matches) : group))
    i = j + 1
  }
  return result
}

export function calculatePoolStandings(
  matches: PoolMatchInput[],
  teams: Array<{ id: string; name: string }>,
): PoolStanding[] {
  const sorted = sortWithTies(buildStats(matches, teams), matches)
  return sorted.map((s, idx) => ({ ...s, rankInPool: idx + 1 }))
}

/**
 * Fusionne les classements de toutes les poules en un classement global.
 * Mêmes critères (la confrontation directe ne s'applique pas entre poules
 * différentes — les équipes ne se sont pas rencontrées).
 */
export function calculateGlobalStandings(poolStandings: PoolStanding[]): GlobalStanding[] {
  const sorted = [...poolStandings].sort(
    (a, b) =>
      b.wins - a.wins ||
      (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
      (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) ||
      a.teamName.localeCompare(b.teamName, 'fr'),
  )
  return sorted.map((s, idx) => ({ ...s, globalRank: idx + 1 }))
}

// ─── Attribution des terrains aux matchs de poule ─────────────────────────────

export interface CourtDispatchMatch {
  id: string
  team1Id: string
  team2Id: string
}

/**
 * Sélectionne les prochains matchs à placer sur les terrains libres d'une poule.
 *
 * Règles :
 * - une équipe déjà sur un terrain (`busyTeams`) n'est jamais reprogrammée ;
 * - équité : priorité au match dont l'équipe la MOINS servie a le moins joué
 *   (critère min, puis somme des matchs joués) → aucune équipe n'attend
 *   indéfiniment, même avec l'ordre de génération round-robin (1,2),(1,3)…
 * - à égalité, l'ordre d'arrivée (`waiting`) départage (tri stable).
 *
 * `waiting` : matchs en attente sans terrain, dans l'ordre de création.
 * Retourne les paires { matchId, courtNumber } à appliquer.
 */
export function selectMatchesForCourts(
  freeCourts: number[],
  waiting: CourtDispatchMatch[],
  busyTeams: ReadonlySet<string>,
  playedCount: ReadonlyMap<string, number>,
): Array<{ matchId: string; courtNumber: number }> {
  const played = (id: string): number => playedCount.get(id) ?? 0

  const candidates = [...waiting].sort((a, b) => {
    const aMin = Math.min(played(a.team1Id), played(a.team2Id))
    const bMin = Math.min(played(b.team1Id), played(b.team2Id))
    const aSum = played(a.team1Id) + played(a.team2Id)
    const bSum = played(b.team1Id) + played(b.team2Id)
    return aMin - bMin || aSum - bSum
  })

  const busy = new Set(busyTeams)
  const assignments: Array<{ matchId: string; courtNumber: number }> = []

  for (const court of freeCourts) {
    const idx = candidates.findIndex((m) => !busy.has(m.team1Id) && !busy.has(m.team2Id))
    if (idx === -1) break
    // safe because: idx vient de findIndex ≥ 0.
    const next = candidates.splice(idx, 1)[0]!
    busy.add(next.team1Id)
    busy.add(next.team2Id)
    assignments.push({ matchId: next.id, courtNumber: court })
  }

  return assignments
}

// ─── Redistribution des terrains entre poules (poule terminée tôt) ────────────

export interface PoolCourtState {
  poolId: string
  position: number          // départage déterministe
  teamCount: number         // équipes de la poule
  pendingCount: number      // matchs non terminés (0 = poule finie)
  currentCourts: number[]   // terrains actuellement assignés à la poule
}

export interface PoolRedistributionPlan {
  // Terrains finaux par poule après redistribution.
  assignments: Array<{ poolId: string; courts: number[] }>
  // Terrains nouvellement reçus par poule (pour l'annonce). Poules sans gain exclues.
  gained: Array<{ poolId: string; courts: number[] }>
  // Terrains restants inutilisables → terrain libre « loisir » en attendant le tableau.
  leisureCourts: number[]
}

/**
 * Capacité utile d'une poule = nombre de terrains qu'elle peut réellement
 * occuper : au plus floor(équipes/2) matchs simultanés, borné par les matchs
 * restant à jouer. Une poule terminée (pendingCount 0) a une capacité nulle.
 */
function poolCourtCapacity(p: PoolCourtState): number {
  if (p.pendingCount <= 0) return 0
  return Math.min(Math.floor(p.teamCount / 2), p.pendingCount)
}

/**
 * Replanifie les terrains quand des poules se terminent : récupère les terrains
 * des poules finies (et le surplus des poules sur-dotées au-delà de leur
 * capacité utile), puis les répartit équitablement entre les poules encore en
 * jeu qui peuvent les utiliser. Le reste devient terrain « loisir ».
 *
 * Fonction pure — testée dans classic-bracket.test.ts.
 */
export function planPoolCourtRedistribution(
  pools: PoolCourtState[],
  freeCourts: number[],
): PoolRedistributionPlan {
  const available: number[] = [...freeCourts]
  const kept = new Map<string, number[]>()

  // Chaque poule garde au plus sa capacité (les plus petits numéros), libère le reste.
  for (const p of pools) {
    const cap = poolCourtCapacity(p)
    const sorted = [...p.currentCourts].sort((a, b) => a - b)
    kept.set(p.poolId, sorted.slice(0, cap))
    available.push(...sorted.slice(cap))
  }
  available.sort((a, b) => a - b)

  const deficit = new Map<string, number>(
    pools.map((p) => [p.poolId, poolCourtCapacity(p) - kept.get(p.poolId)!.length]),
  )
  const gainedMap = new Map<string, number[]>(pools.map((p) => [p.poolId, []]))

  // Attribution un terrain à la fois à la poule la plus en déficit
  // (égalité : moins de terrains actuels, puis position).
  while (available.length > 0) {
    let best: PoolCourtState | null = null
    let bestDef = 0
    for (const p of pools) {
      const d = deficit.get(p.poolId)!
      if (d <= 0) continue
      if (best === null || d > bestDef) {
        best = p; bestDef = d
      } else if (d === bestDef) {
        const bt = kept.get(best.poolId)!.length + gainedMap.get(best.poolId)!.length
        const pt = kept.get(p.poolId)!.length + gainedMap.get(p.poolId)!.length
        if (pt < bt || (pt === bt && p.position < best.position)) best = p
      }
    }
    if (!best) break
    const court = available.shift()!
    gainedMap.get(best.poolId)!.push(court)
    deficit.set(best.poolId, deficit.get(best.poolId)! - 1)
  }

  const assignments = pools.map((p) => ({
    poolId: p.poolId,
    courts: [...kept.get(p.poolId)!, ...gainedMap.get(p.poolId)!].sort((a, b) => a - b),
  }))
  const gained = pools
    .map((p) => ({ poolId: p.poolId, courts: [...gainedMap.get(p.poolId)!].sort((a, b) => a - b) }))
    .filter((g) => g.courts.length > 0)

  return { assignments, gained, leisureCourts: available.sort((a, b) => a - b) }
}

// ─── Attribution des terrains dans le tableau final ───────────────────────────

export interface BracketDispatchMatch {
  id: string
  phase: BracketNodePhase
  bracketPosition: number // 0 = barrage/qualification, ≥1 = position dans l'arbre
}

export interface BracketRemaining {
  main: number // matchs principal+barrages non terminés (prêts ou non)
  consolante: number // matchs consolante+repêchages non terminés
}

/**
 * Attribue les terrains libres aux matchs prêts du tableau en ÉQUILIBRANT le
 * tableau principal et la consolante : les deux progressent en parallèle et
 * finissent ~en même temps, au lieu de vider tout le principal avant d'attaquer
 * la consolante (gros tournois où #matchs prêts > #terrains).
 *
 * - Barrages et repêchages (`bracketPosition === 0`) restent prioritaires DANS
 *   leur groupe : ils débloquent les tours suivants.
 * - Au sein d'un tableau, les tours les plus précoces (roundSize le plus grand)
 *   passent d'abord.
 * - Les terrains libres sont répartis entre les deux tableaux au prorata du
 *   travail restant (`remaining`), avec report du surplus vers l'autre tableau
 *   s'il a moins de matchs prêts que sa part. À défaut de `remaining`, le prorata
 *   se base sur le nombre de matchs prêts de chaque côté.
 *
 * Fonction pure — testée dans classic-bracket.test.ts.
 */
export function planBracketCourtDispatch(
  freeCourts: number[],
  ready: BracketDispatchMatch[],
  remaining?: BracketRemaining,
): Array<{ matchId: string; courtNumber: number }> {
  const isConso = (m: BracketDispatchMatch): boolean => m.phase === 'bracket_consolante'
  const roundSize = (m: BracketDispatchMatch): number =>
    m.bracketPosition >= 1 ? 2 ** Math.floor(Math.log2(m.bracketPosition)) : 0

  // Ordre interne d'un tableau : barrage/repêchage (pos 0) d'abord, puis tour le
  // plus précoce (plus grand roundSize), puis position dans l'arbre.
  const byPriority = (a: BracketDispatchMatch, b: BracketDispatchMatch): number =>
    (a.bracketPosition === 0 ? 0 : 1) - (b.bracketPosition === 0 ? 0 : 1) ||
    roundSize(b) - roundSize(a) ||
    a.bracketPosition - b.bracketPosition

  const mainReady = ready.filter((m) => !isConso(m)).sort(byPriority)
  const consoReady = ready.filter(isConso).sort(byPriority)

  const courts = [...freeCourts].sort((a, b) => a - b)
  const total = Math.min(courts.length, mainReady.length + consoReady.length)
  if (total === 0) return []

  // Part du principal : prorata du travail restant, borné par les matchs prêts,
  // avec report du surplus de terrains vers l'autre tableau.
  let mainPick: number
  if (consoReady.length === 0) {
    mainPick = Math.min(total, mainReady.length)
  } else if (mainReady.length === 0) {
    mainPick = 0
  } else {
    const mainRem = remaining ? remaining.main : mainReady.length
    const consoRem = remaining ? remaining.consolante : consoReady.length
    const denom = mainRem + consoRem
    if (total === 1) {
      // Un seul terrain : au tableau le plus chargé (principal à égalité).
      mainPick = mainRem >= consoRem ? 1 : 0
    } else {
      const quota = denom > 0 ? Math.round((total * mainRem) / denom) : Math.round(total / 2)
      // Au moins 1 terrain à chaque tableau qui a des matchs prêts.
      mainPick = Math.min(Math.max(quota, 1), total - 1, mainReady.length)
    }
  }
  let consoPick = Math.min(total - mainPick, consoReady.length)
  // Report : si un tableau n'épuise pas sa part, l'autre récupère les terrains.
  mainPick = Math.min(total - consoPick, mainReady.length)

  const chosen = [...mainReady.slice(0, mainPick), ...consoReady.slice(0, consoPick)]
  return chosen.map((m, i) => ({ matchId: m.id, courtNumber: courts[i]! }))
}

// ─── Détection de la taille de tableau ────────────────────────────────────────

export interface BracketSizing {
  bracketSize: number // plus grande puissance de 2 ≤ nbTeams (slots du principal)
  nbTeams: number
  excess: number // équipes au-delà du tableau pur → barrages/qualifications
  withBarrage: boolean
  withConsolante: boolean
  nbQualified: number // équipes dans le tableau principal après qualification
}

function floorPowerOf2(n: number): number {
  let p = 1
  while (p * 2 <= n) p *= 2
  return p
}

/**
 * Détermine le format de tableau. La taille principale est la puissance de 2
 * INFÉRIEURE ou égale au nombre d'équipes (ex. 20 → 16, 40 → 32). L'excédent
 * joue des barrages/qualifications pour rejoindre le tableau principal.
 */
export function detectBracketSize(nbTeams: number): BracketSizing {
  if (nbTeams < 4) {
    throw new Error(`detectBracketSize : ${nbTeams} équipes — minimum 4`)
  }
  const bracketSize = floorPowerOf2(nbTeams)
  const excess = nbTeams - bracketSize
  return {
    bracketSize,
    nbTeams,
    excess,
    withBarrage: excess > 0,
    withConsolante: excess > 0,
    nbQualified: bracketSize,
  }
}

// ─── Comptage des matchs (pour l'aperçu de configuration) ─────────────────────

// Nombre total de matchs de poule : somme des round-robins (n×(n-1)/2 par poule).
export function countPoolMatches(distribution: number[]): number {
  return distribution.reduce((sum, n) => sum + (n * (n - 1)) / 2, 0)
}

// Nombre total de matchs du tableau : principal (P-1) + consolante (P/2-1) +
// barrages (excédent) + repêchages consolante (excédent, si consolante existe).
// Aligné sur les nœuds générés par `generateBracket`.
export function countBracketMatches(sizing: BracketSizing): number {
  const P = sizing.bracketSize
  const consoSize = P / 2
  const consolante = consoSize >= 2 ? consoSize - 1 : 0
  const playIns = consoSize >= 2 ? sizing.excess : 0
  return P - 1 + consolante + sizing.excess + playIns
}

// ─── Génération du tableau depuis le classement global ────────────────────────

export type BracketMode = 'barrage' | 'first_match_decides'
export type BracketNodePhase = 'barrage' | 'bracket_main' | 'bracket_consolante'

export interface BracketNode {
  id: string
  phase: BracketNodePhase
  bracketPosition: number // numéroté depuis la finale (1 = finale), 0 pour barrage
  roundInBracket: number // nb de matchs dans ce tour (1=finale, 2=demie, 4=quart...)
  team1Id: string | null
  team2Id: string | null
  isQualification: boolean // true pour les matchs de qualif (first_match_decides)
  winnerAdvancesTo: string | null
  loserGoesTo: string | null
}

export interface BracketStructure {
  mainBracket: BracketNode[]
  consolante: BracketNode[]
  barrages: BracketNode[]
  byes: string[] // team_ids passant directement (vide avec le sizing « floor »)
}

// Nb de matchs dans le tour d'une position de tas (1=finale, 2=demies, 4=quarts).
function matchesInRound(heapPos: number): number {
  return 2 ** Math.floor(Math.log2(heapPos))
}

// Construit un arbre d'élimination (tas binaire) de `size` slots → size-1 matchs.
function buildHeapNodes(size: number, prefix: string, phase: BracketNodePhase): BracketNode[] {
  const nodes: BracketNode[] = []
  for (let pos = 1; pos <= size - 1; pos++) {
    nodes.push({
      id: `${prefix}-${pos}`,
      phase,
      bracketPosition: pos,
      roundInBracket: matchesInRound(pos),
      team1Id: null,
      team2Id: null,
      isQualification: false,
      winnerAdvancesTo: pos === 1 ? null : `${prefix}-${Math.floor(pos / 2)}`,
      loserGoesTo: null,
    })
  }
  return nodes
}

/**
 * Génère le tableau (principal + consolante + barrages + repêchages) depuis le
 * classement global. Les équipes sont identifiées par leur team_id ; le
 * classement définit le seed (index 0 = seed 1 = meilleure).
 *
 * - Les `excess` équipes-bulle jouent un barrage contre les `excess` équipes en
 *   trop. Le gagnant entre au tableau principal.
 * - Le PERDANT du barrage n'est pas éliminé : il est repêché en consolante via
 *   un match de repêchage `cp-j` où il affronte le perdant du 1er tour principal
 *   du même côté du tableau (les équipes les plus faibles de la consolante). Le
 *   gagnant du repêchage prend la place en consolante ; le perdant est éliminé.
 * - La consolante accueille donc : les perdants du 1er tour principal + les
 *   survivants des repêchages.
 *
 * `mode` est conservé pour compatibilité mais n'influe plus sur le sort des
 * perdants de barrage (toujours repêchés).
 */
export function generateBracket(
  globalStandings: Array<{ teamId: string }>,
  sizing: BracketSizing,
  mode: BracketMode,
): BracketStructure {
  void mode
  const P = sizing.bracketSize
  const nbTeams = globalStandings.length
  const excess = nbTeams - P
  const directCount = P - excess
  const teamOf = (rank: number): string | null => globalStandings[rank - 1]?.teamId ?? null

  // Seed → teamId : seeds 1..directCount directs, le reste via barrage/qualif.
  const seedTeam = new Map<number, string | null>()
  for (let s = 1; s <= directCount; s++) seedTeam.set(s, teamOf(s))
  for (let s = directCount + 1; s <= P; s++) seedTeam.set(s, null)

  // ─── Tableau principal (tas binaire de P slots) ─────────────────────────────
  const mainBracket = buildHeapNodes(P, 'm', 'bracket_main')
  const byPos = new Map(mainBracket.map((n) => [n.bracketPosition, n]))
  const seedOrder = seedPositions(P) // ordre standard des seeds
  const leafStart = P / 2
  const seedToLeaf = new Map<number, { pos: number; side: 1 | 2 }>()

  for (let pos = leafStart; pos <= P - 1; pos++) {
    const slot = (pos - leafStart) * 2
    const s1 = seedOrder[slot]!
    const s2 = seedOrder[slot + 1]!
    seedToLeaf.set(s1, { pos, side: 1 })
    seedToLeaf.set(s2, { pos, side: 2 })
    const node = byPos.get(pos)!
    node.team1Id = seedTeam.get(s1) ?? null
    node.team2Id = seedTeam.get(s2) ?? null
  }

  // ─── Consolante : perdants du 1er tour du principal ─────────────────────────
  const consoSize = P / 2
  const consolante = consoSize >= 2 ? buildHeapNodes(consoSize, 'c', 'bracket_consolante') : []
  const consoByPos = new Map(consolante.map((n) => [n.bracketPosition, n]))
  const consoLeafStart = consoSize / 2

  // Chaque match R1 du principal (leafStart..P-1) envoie son perdant en consolante.
  for (let pos = leafStart; pos <= P - 1; pos++) {
    const li = pos - leafStart // 0..(P/2 - 1)
    const consoLeafPos = consoLeafStart + Math.floor(li / 2)
    if (consoByPos.has(consoLeafPos)) {
      byPos.get(pos)!.loserGoesTo = `c-${consoLeafPos}`
    }
  }

  // ─── Barrages + repêchages consolante pour l'excédent ───────────────────────
  // Le perdant d'un barrage et le perdant du 1er tour principal nourri par ce
  // barrage s'affrontent dans un match de repêchage `cp-j` ; le gagnant prend la
  // place consolante normalement réservée à ce match principal. Ainsi la
  // consolante reste de taille P/2 (pas de bye) et chaque perdant de barrage est
  // repêché vers un emplacement DISTINCT (corrige l'ancien routage commun).
  const barrages: BracketNode[] = []
  const playIns: BracketNode[] = []
  for (let j = 1; j <= excess; j++) {
    const seedFed = directCount + j // slot principal rempli par le gagnant du barrage
    const extraRank = nbTeams - j + 1 // équipe en trop (P+1..nbTeams)
    const leaf = seedToLeaf.get(seedFed)
    const mainPos = leaf ? leaf.pos : null
    const hasConso = consolante.length > 0 && mainPos !== null

    const playInId = `cp-${j}`
    // Cible consolante normale du match principal — captée AVANT redirection.
    const consoTarget = hasConso ? byPos.get(mainPos!)!.loserGoesTo : null
    // Le perdant du match principal passe par le repêchage au lieu d'aller direct.
    if (hasConso) byPos.get(mainPos!)!.loserGoesTo = playInId

    barrages.push({
      id: `b-${j}`,
      phase: 'barrage',
      bracketPosition: 0,
      roundInBracket: 0,
      team1Id: teamOf(seedFed),   // équipe-bulle
      team2Id: teamOf(extraRank), // équipe excédentaire
      isQualification: false,
      winnerAdvancesTo: mainPos !== null ? `m-${mainPos}` : null,
      loserGoesTo: hasConso ? playInId : null, // perdant repêché (sinon éliminé)
    })

    if (hasConso) {
      playIns.push({
        id: playInId,
        phase: 'bracket_consolante',
        bracketPosition: 0, // hors arbre consolante (repêchage préliminaire)
        roundInBracket: 0,
        team1Id: null, // rempli par le perdant du barrage
        team2Id: null, // rempli par le perdant du 1er tour principal
        isQualification: false,
        winnerAdvancesTo: consoTarget, // prend la place consolante du match principal
        loserGoesTo: null, // perdant du repêchage éliminé
      })
    }
  }

  consolante.push(...playIns)
  return { mainBracket, consolante, barrages, byes: [] }
}
