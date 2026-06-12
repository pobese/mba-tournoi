// Algorithme serpent pour tournoi par rounds.
// Round 1 : classement par niveau initial. Round N+1 : classement cumulatif.
// Serpent : P[i] + P[N-1-i] → équipes. Appariement : équipe i vs équipe i+K/2.

import type { RoundsConfig } from '@/types/app'

// ─── Types d'entrée ───────────────────────────────────────────────────────────

export interface PlayerWithStats {
  playerId: string
  playerName: string
  level: number
  consecutivePlayed: number   // rounds joués de suite sans pause
  totalWaited: number         // total rounds en attente sur le tournoi
  lastWaitedRound: number | null
  currentRank: number         // 1 = meilleur ; calculé par l'appelant avant round 1
}

// ─── Types de sortie ──────────────────────────────────────────────────────────

export interface RoundsTeam {
  players: PlayerWithStats[]  // 1 en simple, 2 en double
}

export interface MatchToCreate {
  team1: RoundsTeam
  team2: RoundsTeam
  courtNumber: number         // 1-based
  wave: number                // 1-based
}

export interface RoundsMatchResult {
  team1PlayerIds: string[]
  team2PlayerIds: string[]
  scoreTeam1: number          // total points marqués (somme de tous les sets)
  scoreTeam2: number
  winnerIsTeam1: boolean | null // déterminé par sets gagnés, pas par total de points
}

export interface ByeRecord {
  playerId: string
  roundNumber: number
}

export interface PlayerStanding {
  playerId: string
  playerName: string
  totalWins: number
  totalPointsFor: number
  totalPointsAgainst: number
  goalAverage: number
  roundsPlayed: number
  rank: number
}

export interface RoundSchedule {
  byes: PlayerWithStats[]
  teams: RoundsTeam[]
  waves: MatchToCreate[][]
  warnings: string[]
}

// ─── computeNeededByes ──────────────────────────────────────────────────────────

/**
 * Détermine combien de joueurs passent en liste d'attente (bye) ce round.
 *
 * Deux raisons de mettre un joueur en attente :
 *  1. Plafond de capacité : au-delà de `terrains × joueursParTerrain`, les
 *     matchs ne tiennent pas en une seule vague. On plafonne donc le nombre de
 *     joueurs actifs à la capacité d'une vague et on renvoie le surplus en
 *     attente (rotation gérée par selectBye aux rounds suivants).
 *  2. Reste de parité : si l'effectif actif n'est pas un multiple de la taille
 *     de groupe (4 en double, 2 en simple), le reliquat attend aussi.
 *
 * joueursParTerrain = 4 en double (2 équipes de 2), 2 en simple.
 */
export function computeNeededByes(
  totalPlayers: number,
  format: RoundsConfig['format'],
  courtsAvailable: number,
): number {
  const playersPerCourt = format === 'doubles' ? 4 : 2
  const maxActive = courtsAvailable * playersPerCourt
  return totalPlayers > maxActive
    ? totalPlayers - maxActive
    : totalPlayers % playersPerCourt
}

// ─── selectBye ────────────────────────────────────────────────────────────────

/**
 * Sélectionne les `needed` joueurs qui attendent ce round.
 * Priorité : consecutivePlayed DESC, puis currentRank ASC (meilleur classé attend en 1er).
 * Contrainte : un joueur ne fait jamais deux byes consécutifs sauf si impossible.
 */
export function selectBye(
  players: PlayerWithStats[],
  needed: number,
  currentRound: number,
): PlayerWithStats[] {
  if (needed === 0) return []
  if (needed >= players.length) return [...players]

  const sortByPriority = (a: PlayerWithStats, b: PlayerWithStats): number => {
    if (b.consecutivePlayed !== a.consecutivePlayed) {
      return b.consecutivePlayed - a.consecutivePlayed
    }
    return a.currentRank - b.currentRank
  }

  const justWaited = (p: PlayerWithStats) =>
    p.lastWaitedRound === currentRound - 1

  const eligible = players.filter((p) => !justWaited(p)).sort(sortByPriority)
  const forced = players.filter((p) => justWaited(p)).sort(sortByPriority)

  const result: PlayerWithStats[] = []

  for (const p of eligible) {
    if (result.length >= needed) break
    result.push(p)
  }
  // Seulement si pas assez d'éligibles (cas rare, forcé)
  for (const p of forced) {
    if (result.length >= needed) break
    result.push(p)
  }

  return result
}

// ─── formTeams ────────────────────────────────────────────────────────────────

/**
 * Forme les équipes par système serpent à partir des joueurs actifs classés.
 * Singles : chaque joueur est sa propre équipe (pas de serpent).
 * Doubles : serpent P[i] + P[N-1-i].
 * Précondition (doubles) : activePlayers.length % 4 === 0.
 */
export function formTeams(
  activePlayers: PlayerWithStats[],
  format: RoundsConfig['format'],
): RoundsTeam[] {
  if (format === 'singles') {
    return activePlayers.map((p) => ({ players: [p] }))
  }

  const n = activePlayers.length
  if (n % 4 !== 0) {
    throw new Error(
      `formTeams doubles : ${n} joueurs, doit être multiple de 4 — utiliser selectBye d'abord`,
    )
  }

  const teams: RoundsTeam[] = []
  // Serpent : P[i] + P[N-1-i], de i=0 à i<N/2
  for (let i = 0; i < n / 2; i++) {
    teams.push({ players: [activePlayers[i]!, activePlayers[n - 1 - i]!] })
  }
  return teams
}

// ─── formMatches ──────────────────────────────────────────────────────────────

/**
 * Apparie les équipes et découpe en vagues selon les terrains disponibles.
 * Appariement : équipe i vs équipe i+K/2 (les deux moitiés se font face).
 * Retourne un tableau de vagues ; chaque vague = tableau de matchs.
 */
export function formMatches(
  teams: RoundsTeam[],
  courtsAvailable: number,
): MatchToCreate[][] {
  const k = teams.length
  if (k < 2 || k % 2 !== 0) {
    throw new Error(
      `formMatches : ${k} équipe(s), nombre pair ≥ 2 requis`,
    )
  }
  if (courtsAvailable < 1) {
    throw new Error('formMatches : courtsAvailable doit être ≥ 1')
  }

  const half = k / 2
  const allMatches: Omit<MatchToCreate, 'courtNumber' | 'wave'>[] = []

  for (let i = 0; i < half; i++) {
    allMatches.push({ team1: teams[i]!, team2: teams[i + half]! })
  }

  // Découpage en vagues
  const waves: MatchToCreate[][] = []
  for (let i = 0; i < allMatches.length; i += courtsAvailable) {
    const waveNumber = waves.length + 1
    const wave = allMatches.slice(i, i + courtsAvailable).map((m, idx) => ({
      ...m,
      courtNumber: idx + 1,
      wave: waveNumber,
    }))
    waves.push(wave)
  }

  return waves
}

// ─── calculateStandings ───────────────────────────────────────────────────────

/**
 * Calcule le classement cumulatif à partir de tous les résultats de matchs.
 * Les joueurs en bye (absents de allMatches) conservent leurs stats inchangées.
 * Tri : wins DESC → goal average DESC → points for DESC → alphabétique ASC.
 */
export function calculateStandings(
  players: PlayerWithStats[],
  allMatches: RoundsMatchResult[],
): PlayerStanding[] {
  const stats = new Map(
    players.map((p) => [
      p.playerId,
      {
        playerName: p.playerName,
        totalWins: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        roundsPlayed: 0,
      },
    ]),
  )

  for (const match of allMatches) {
    const { team1PlayerIds, team2PlayerIds, scoreTeam1, scoreTeam2, winnerIsTeam1 } = match
    // Victoire déterminée par sets gagnés (winnerIsTeam1), PAS par total de points.
    // Cas extrême possible : 21-20 + 10-21 + 21-20 → team1 gagne (2-1) mais
    // scoreTeam1=52 < scoreTeam2=61 — utiliser le total serait incorrect.
    const team1Won = winnerIsTeam1 === true
    const team2Won = winnerIsTeam1 === false

    for (const id of team1PlayerIds) {
      const s = stats.get(id)
      if (!s) continue
      s.totalPointsFor += scoreTeam1
      s.totalPointsAgainst += scoreTeam2
      s.roundsPlayed += 1
      if (team1Won) s.totalWins += 1
    }

    for (const id of team2PlayerIds) {
      const s = stats.get(id)
      if (!s) continue
      s.totalPointsFor += scoreTeam2
      s.totalPointsAgainst += scoreTeam1
      s.roundsPlayed += 1
      if (team2Won) s.totalWins += 1
    }
  }

  const standings: PlayerStanding[] = Array.from(stats.entries()).map(
    ([playerId, s]) => ({
      playerId,
      playerName: s.playerName,
      totalWins: s.totalWins,
      totalPointsFor: s.totalPointsFor,
      totalPointsAgainst: s.totalPointsAgainst,
      goalAverage: s.totalPointsFor - s.totalPointsAgainst,
      roundsPlayed: s.roundsPlayed,
      rank: 0,
    }),
  )

  standings.sort((a, b) => {
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins
    if (b.goalAverage !== a.goalAverage) return b.goalAverage - a.goalAverage
    if (b.totalPointsFor !== a.totalPointsFor)
      return b.totalPointsFor - a.totalPointsFor
    return a.playerName.localeCompare(b.playerName, 'fr')
  })

  standings.forEach((s, idx) => {
    s.rank = idx + 1
  })

  return standings
}

// ─── fisherYatesShuffle ───────────────────────────────────────────────────────

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

// ─── generateRound1Random ─────────────────────────────────────────────────────

/**
 * Tirage de raquette pour le round 1 : équipes formées aléatoirement.
 * Contrairement aux rounds suivants (serpent par classement), les équipes
 * sont tirées au sort : joueurs mélangés puis appariés séquentiellement.
 */
export function generateRound1Random(
  players: PlayerWithStats[],
  config: Pick<RoundsConfig, 'format' | 'courtsAvailable'>,
): RoundSchedule {
  const shuffled = fisherYatesShuffle(players)

  const neededByes = computeNeededByes(
    shuffled.length,
    config.format,
    config.courtsAvailable,
  )

  const byes = shuffled.slice(shuffled.length - neededByes)
  const activePlayers = shuffled.slice(0, shuffled.length - neededByes)

  const minActive = config.format === 'doubles' ? 4 : 2
  if (activePlayers.length < minActive) {
    throw new Error(
      `generateRound1Random : seulement ${activePlayers.length} joueur(s) actif(s), minimum ${minActive} requis`,
    )
  }

  // Appariement séquentiel (pas serpent) pour un tirage vraiment aléatoire
  const teams: RoundsTeam[] = []
  if (config.format === 'singles') {
    for (const p of activePlayers) {
      teams.push({ players: [p] })
    }
  } else {
    for (let i = 0; i < activePlayers.length; i += 2) {
      teams.push({ players: [activePlayers[i]!, activePlayers[i + 1]!] })
    }
  }

  const waves = formMatches(teams, config.courtsAvailable)

  const warnings: string[] = []
  if (byes.length > 0) {
    warnings.push(`${byes.length} joueur(s) en attente ce round : ${byes.map((p) => p.playerName).join(', ')}`)
  }
  if (waves.length > 1) {
    const totalMatches = waves.reduce((acc, w) => acc + w.length, 0)
    warnings.push(`${totalMatches} matchs en ${waves.length} vagues (${config.courtsAvailable} terrain(s))`)
  }

  return { byes, teams, waves, warnings }
}

// ─── generateRound ────────────────────────────────────────────────────────────

/**
 * Orchestrateur : sélectionne les byes → forme les équipes → forme les matchs.
 * Les stats dans `players` doivent déjà être à jour (calculées par l'appelant).
 * Pour le round 1 : currentRank doit être pré-calculé à partir du niveau.
 */
export function generateRound(
  roundNumber: number,
  players: PlayerWithStats[],
  config: Pick<RoundsConfig, 'format' | 'courtsAvailable'>,
): RoundSchedule {
  const warnings: string[] = []

  const neededByes = computeNeededByes(
    players.length,
    config.format,
    config.courtsAvailable,
  )

  const byes = selectBye(players, neededByes, roundNumber)
  const byeIds = new Set(byes.map((p) => p.playerId))
  const activePlayers = players
    .filter((p) => !byeIds.has(p.playerId))
    .sort((a, b) => a.currentRank - b.currentRank)

  const minActive = config.format === 'doubles' ? 4 : 2
  if (activePlayers.length < minActive) {
    throw new Error(
      `generateRound : seulement ${activePlayers.length} joueur(s) actif(s), minimum ${minActive} requis`,
    )
  }

  const teams = formTeams(activePlayers, config.format)
  const waves = formMatches(teams, config.courtsAvailable)

  if (byes.length > 0) {
    const names = byes.map((p) => p.playerName).join(', ')
    warnings.push(`${byes.length} joueur(s) en attente ce round : ${names}`)
  }

  const totalMatches = waves.reduce((acc, w) => acc + w.length, 0)
  if (waves.length > 1) {
    warnings.push(
      `${totalMatches} matchs répartis en ${waves.length} vagues (${config.courtsAvailable} terrain(s) disponible(s))`,
    )
  }

  return { byes, teams, waves, warnings }
}
