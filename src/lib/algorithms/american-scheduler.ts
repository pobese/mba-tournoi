// Algorithme de scheduling social pour tournoi américain.
// Principe : éviter au maximum les répétitions de paires (partenaires ET adversaires).
// Approche greedy avec scoring de pénalité — efficace pour N < 30 joueurs.

export interface PairingHistory {
  partners: Map<string, Set<string>>  // playerId → Set de partners déjà joués
  opponents: Map<string, Set<string>> // playerId → Set d'adversaires déjà joués
}

// team = 1 joueur en simple (1v1), 2 joueurs en double (2v2)
export interface AmericanMatch {
  team1: string[]
  team2: string[]
  wave: number          // 1-based
  courtNumber: number   // 1-based
}

export interface RoundResult {
  matches: AmericanMatch[]
  byePlayers: string[]
}

export interface AmericanRoundOptions {
  format: 'singles' | 'doubles'
  courtsAvailable: number
}

// Pour recordMatch / rebuild d'historique : seules les équipes comptent
export interface MatchTeams {
  team1: string[]
  team2: string[]
}

export interface MatchResult {
  team1: string[]
  team2: string[]
  scoreTeam1: number
  scoreTeam2: number
}

export interface PlayerStanding {
  playerId: string
  pointsScored: number
  pointsConceded: number
  pointDiff: number
  matchesPlayed: number
  wins: number
  rank: number
}

export function createEmptyHistory(): PairingHistory {
  return { partners: new Map(), opponents: new Map() }
}

function addToSet(map: Map<string, Set<string>>, key: string, value: string) {
  if (!map.has(key)) map.set(key, new Set())
  map.get(key)!.add(value) // safe because we just set it above
}

export function recordMatch(history: PairingHistory, match: MatchTeams): void {
  // Partenaires : paires à l'intérieur de chaque équipe (aucun en simple).
  for (const team of [match.team1, match.team2]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        addToSet(history.partners, team[i]!, team[j]!)
        addToSet(history.partners, team[j]!, team[i]!)
      }
    }
  }
  // Adversaires : tous les joueurs de team1 contre tous ceux de team2.
  for (const a of match.team1) {
    for (const b of match.team2) {
      addToSet(history.opponents, a, b)
      addToSet(history.opponents, b, a)
    }
  }
}

// Pénalité de re-partenariat (deux joueurs dans la même équipe).
function partnerPenalty(history: PairingHistory, a: string, b: string): number {
  return history.partners.get(a)?.has(b) ? 2 : 0
}

// Pénalité de re-confrontation (deux joueurs adverses).
function opponentPenalty(history: PairingHistory, a: string, b: string): number {
  return history.opponents.get(a)?.has(b) ? 1 : 0
}

// Génère toutes les façons de partitionner `players` en deux paires (pour 4 joueurs).
function partitions4(
  players: [string, string, string, string]
): Array<[[string, string], [string, string]]> {
  const [a, b, c, d] = players
  return [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ]
}

// Choisit le meilleur joueur "bye" parmi les candidats (celui qui a eu le moins de byes).
function chooseBye(
  playerIds: string[],
  byeHistory: Map<string, number>
): string {
  let minByes = Infinity
  let byePlayer = playerIds[0]!

  for (const pid of playerIds) {
    const byes = byeHistory.get(pid) ?? 0
    if (byes < minByes) {
      minByes = byes
      byePlayer = pid
    }
  }
  return byePlayer
}

// Score total d'un match : re-partenariats intra-équipe (poids 2) +
// re-confrontations inter-équipe (poids 1). Les paires adverses NE sont PAS
// pénalisées comme des partenariats — sinon séparer d'anciens partenaires en
// adversaires coûterait autant que les regrouper, ce qui empêche d'éviter
// les répétitions (notamment à 4 joueurs au round 2).
function matchPenalty(
  history: PairingHistory,
  team1: [string, string],
  team2: [string, string]
): number {
  return (
    partnerPenalty(history, team1[0], team1[1]) +
    partnerPenalty(history, team2[0], team2[1]) +
    opponentPenalty(history, team1[0], team2[0]) +
    opponentPenalty(history, team1[0], team2[1]) +
    opponentPenalty(history, team1[1], team2[0]) +
    opponentPenalty(history, team1[1], team2[1])
  )
}

// ─── Recherche exacte « zéro recroisement » (backtracking borné) ──────────────
//
// Garantit un appariement SANS aucune répétition (ni partenaire, ni adversaire)
// pour le round courant DÈS QU'UNE telle solution existe. Si aucune n'existe
// (limite combinatoire — ex. trop de rounds joués), on retombe sur le glouton
// qui minimise les répétitions. Budget d'itérations pour borner le pire cas ;
// largement suffisant pour des effectifs de tournoi réels (N < ~30).

const ZERO_CONFLICT_BUDGET = 1_000_000

function canPartner(history: PairingHistory, a: string, b: string): boolean {
  return !history.partners.get(a)?.has(b)
}

function canOppose(history: PairingHistory, a: string, b: string): boolean {
  return !history.opponents.get(a)?.has(b)
}

// Simple (1v1) : couplage parfait n'utilisant que des adversaires inédits.
function findZeroConflictSingles(
  players: string[],
  history: PairingHistory,
): MatchTeams[] | null {
  const n = players.length
  if (n % 2 !== 0) return null

  const used = new Array<boolean>(n).fill(false)
  const result: MatchTeams[] = []
  let steps = 0

  function backtrack(matched: number): boolean {
    if (matched === n) return true

    let i = 0
    while (i < n && used[i]) i++
    used[i] = true

    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue
      if (++steps > ZERO_CONFLICT_BUDGET) { used[i] = false; return false }
      if (!canOppose(history, players[i]!, players[j]!)) continue

      used[j] = true
      result.push({ team1: [players[i]!], team2: [players[j]!] })
      if (backtrack(matched + 2)) return true
      result.pop()
      used[j] = false
    }

    used[i] = false
    return false
  }

  return backtrack(0) ? result : null
}

// Double (2v2) : partition en matchs de 4, chaque match sans partenaire ni
// adversaire déjà rencontré. Le pivot (1er joueur libre) fixe l'ancre du match
// pour éviter d'énumérer les permutations équivalentes.
function findZeroConflictDoubles(
  players: string[],
  history: PairingHistory,
): MatchTeams[] | null {
  const n = players.length
  if (n % 4 !== 0) return null

  const used = new Array<boolean>(n).fill(false)
  const result: MatchTeams[] = []
  let steps = 0

  // Cherche un arrangement zéro-conflit des 4 indices en deux équipes.
  function validMatch(a: number, b: number, c: number, d: number): MatchTeams | null {
    const arrangements: Array<[[number, number], [number, number]]> = [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]],
    ]
    for (const [[x, y], [z, w]] of arrangements) {
      if (
        canPartner(history, players[x]!, players[y]!) &&
        canPartner(history, players[z]!, players[w]!) &&
        canOppose(history, players[x]!, players[z]!) &&
        canOppose(history, players[x]!, players[w]!) &&
        canOppose(history, players[y]!, players[z]!) &&
        canOppose(history, players[y]!, players[w]!)
      ) {
        return { team1: [players[x]!, players[y]!], team2: [players[z]!, players[w]!] }
      }
    }
    return null
  }

  function backtrack(assigned: number): boolean {
    if (assigned === n) return true

    let a = 0
    while (a < n && used[a]) a++
    used[a] = true

    const free: number[] = []
    for (let k = 0; k < n; k++) if (!used[k]) free.push(k)

    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        for (let l = j + 1; l < free.length; l++) {
          if (++steps > ZERO_CONFLICT_BUDGET) { used[a] = false; return false }
          const match = validMatch(a, free[i]!, free[j]!, free[l]!)
          if (!match) continue

          used[free[i]!] = used[free[j]!] = used[free[l]!] = true
          result.push(match)
          if (backtrack(assigned + 4)) return true
          result.pop()
          used[free[i]!] = used[free[j]!] = used[free[l]!] = false
        }
      }
    }

    used[a] = false
    return false
  }

  return backtrack(0) ? result : null
}

// Appariement 1v1 (simple) : zéro recroisement si possible, sinon glouton.
function buildSinglesMatches(
  available: string[],
  history: PairingHistory,
): MatchTeams[] {
  // Mélange : variété entre deux tirages à contraintes égales.
  const pool = [...available].sort(() => Math.random() - 0.5)

  const exact = findZeroConflictSingles(pool, history)
  if (exact) return exact

  // Repli glouton : minimise les ré-confrontations.
  const used = new Set<string>()
  const matches: MatchTeams[] = []

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]!
    if (used.has(a)) continue
    used.add(a)

    let best: string | null = null
    let bestPenalty = Infinity
    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j]!
      if (used.has(b)) continue
      const penalty = history.opponents.get(a)?.has(b) ? 1 : 0
      if (penalty < bestPenalty) {
        bestPenalty = penalty
        best = b
        if (penalty === 0) break
      }
    }

    if (best) {
      used.add(best)
      matches.push({ team1: [a], team2: [best] })
    }
  }
  return matches
}

// Appariement 2v2 (double) : zéro recroisement si possible, sinon glouton par
// groupes de 4 (minimise répétitions partenaires ET adversaires).
function buildDoublesMatches(
  available: string[],
  history: PairingHistory,
): MatchTeams[] {
  const shuffled = [...available].sort(() => Math.random() - 0.5)

  const exact = findZeroConflictDoubles(shuffled, history)
  if (exact) return exact

  // Repli glouton.
  const matches: MatchTeams[] = []

  for (let i = 0; i < shuffled.length; i += 4) {
    const group = shuffled.slice(i, i + 4) as [string, string, string, string]
    const parts = partitions4(group)

    let bestPenalty = Infinity
    let bestMatch: MatchTeams = { team1: [...parts[0]![0]], team2: [...parts[0]![1]] }
    for (const [team1, team2] of parts) {
      const penalty = matchPenalty(history, team1, team2)
      if (penalty < bestPenalty) {
        bestPenalty = penalty
        bestMatch = { team1: [...team1], team2: [...team2] }
      }
    }
    matches.push(bestMatch)
  }
  return matches
}

/**
 * Génère les matchs d'un round pour un tournoi américain.
 * - Simple (1v1) : appariement greedy anti-répétition d'adversaires.
 * - Double (2v2) : appariement greedy par groupes de 4 (partenaires + adversaires).
 * Les effectifs surnuméraires partent en bye (rotation : le moins exempté d'abord).
 * Les matchs sont répartis en vagues selon le nombre de terrains disponibles.
 */
export function generateAmericanRound(
  playerIds: string[],
  history: PairingHistory,
  byeHistory: Map<string, number>,
  options: AmericanRoundOptions,
): RoundResult {
  const unit = options.format === 'doubles' ? 4 : 2
  if (playerIds.length < unit) {
    throw new Error(
      `generateAmericanRound : ${playerIds.length} joueur(s), minimum ${unit} requis`,
    )
  }
  if (options.courtsAvailable < 1) {
    throw new Error('generateAmericanRound : courtsAvailable doit être ≥ 1')
  }

  let available = [...playerIds]
  const byePlayers: string[] = []

  // Retirer des joueurs en bye jusqu'à un multiple de l'unité (2 ou 4).
  // Ex doubles : 6 → 2 byes, 7 → 3 byes, 10 → 2 byes. Simple : 5 → 1 bye.
  while (available.length % unit !== 0) {
    const bye = chooseBye(available, byeHistory)
    byeHistory.set(bye, (byeHistory.get(bye) ?? 0) + 1)
    byePlayers.push(bye)
    available = available.filter((p) => p !== bye)
  }

  const teamMatches =
    options.format === 'doubles'
      ? buildDoublesMatches(available, history)
      : buildSinglesMatches(available, history)

  // Découpage en vagues : courtsAvailable matchs simultanés par vague.
  const matches: AmericanMatch[] = teamMatches.map((m, idx) => ({
    team1: m.team1,
    team2: m.team2,
    wave: Math.floor(idx / options.courtsAvailable) + 1,
    courtNumber: (idx % options.courtsAvailable) + 1,
  }))

  return { matches, byePlayers }
}

/**
 * Calcule le classement individuel cumulatif pour un tournoi américain.
 * Points = points marqués (pas victoires).
 */
export function calculateAmericanStandings(results: MatchResult[]): PlayerStanding[] {
  const stats = new Map<
    string,
    { scored: number; conceded: number; played: number; wins: number }
  >()

  function ensure(pid: string) {
    if (!stats.has(pid)) stats.set(pid, { scored: 0, conceded: 0, played: 0, wins: 0 })
  }

  for (const { team1, team2, scoreTeam1, scoreTeam2 } of results) {
    for (const pid of team1) {
      ensure(pid)
      const s = stats.get(pid)!
      s.scored += scoreTeam1
      s.conceded += scoreTeam2
      s.played += 1
      if (scoreTeam1 > scoreTeam2) s.wins += 1
    }
    for (const pid of team2) {
      ensure(pid)
      const s = stats.get(pid)!
      s.scored += scoreTeam2
      s.conceded += scoreTeam1
      s.played += 1
      if (scoreTeam2 > scoreTeam1) s.wins += 1
    }
  }

  const standings: PlayerStanding[] = Array.from(stats.entries()).map(
    ([playerId, { scored, conceded, played, wins }]) => ({
      playerId,
      pointsScored: scored,
      pointsConceded: conceded,
      pointDiff: scored - conceded,
      matchesPlayed: played,
      wins,
      rank: 0,
    })
  )

  // Tri : points marqués DESC, puis diff DESC
  standings.sort((a, b) => {
    if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored
    return b.pointDiff - a.pointDiff
  })

  standings.forEach((s, idx) => {
    s.rank = idx + 1
  })

  return standings
}
