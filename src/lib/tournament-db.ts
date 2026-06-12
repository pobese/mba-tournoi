import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateRound,
  calculateStandings,
  type PlayerWithStats,
  type RoundsMatchResult,
} from '@/lib/algorithms/rounds-scheduler'
import {
  calculatePoolDistribution,
  maxPoolCount,
  generatePoolMatches,
  calculatePoolStandings,
  selectMatchesForCourts,
  planBracketCourtDispatch,
  type PoolMatchInput,
  type CourtDispatchMatch,
  type BracketDispatchMatch,
  type BracketNodePhase,
} from '@/lib/algorithms/classic-bracket'
import type { RoundsConfig, ClassicConfig } from '@/types/app'

// ─── Shared DB helpers ────────────────────────────────────────────────────────

/**
 * Crée une équipe temporaire américaine à partir d'un tableau de joueurs
 * (1 joueur en simple, 2 en double). Retourne l'id de l'équipe créée.
 */
export async function insertAmericanTeam(
  supabase: SupabaseClient,
  tournamentId: string,
  players: string[]
): Promise<string> {
  const { data, error } = await supabase
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      player1_id: players[0]!,
      player2_id: players[1] ?? null,
      is_temporary: true,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { code: string; message: string } | null }
  if (error || !data) throw new Error('Impossible de créer une équipe temporaire')
  return data.id
}

// ─── Rounds mode helpers ──────────────────────────────────────────────────────

/**
 * Crée le round suivant pour un tournoi en mode rounds.
 * Gère automatiquement l'initialisation de player_tournament_stats au round 1.
 */
export async function createRoundsRound(
  supabase: SupabaseClient,
  tournamentId: string,
  config: RoundsConfig,
): Promise<void> {
  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const nextRoundNumber = (count ?? 0) + 1

  const players = await getRoundsPlayers(supabase, tournamentId)
  if (players.length === 0) throw new Error('Aucun joueur trouvé pour ce tournoi')

  const schedule = generateRound(nextRoundNumber, players, {
    format: config.format,
    courtsAvailable: config.courtsAvailable,
  })

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: nextRoundNumber, status: 'ongoing' })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (roundError || !round) throw new Error('Impossible de créer le round')

  if (schedule.byes.length > 0) {
    const { error: byeError } = await supabase.from('round_bye').insert(
      schedule.byes.map((p) => ({
        round_id: round.id,
        player_id: p.playerId,
        tournament_id: tournamentId,
      }))
    )
    if (byeError) {
      console.error('createRoundsRound byes:', byeError.code, byeError.message)
    }
  }

  for (const wave of schedule.waves) {
    for (const match of wave) {
      const team1Players = match.team1.players
      const team2Players = match.team2.players

      const { data: t1, error: t1Error } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          player1_id: team1Players[0]!.playerId,
          player2_id: team1Players[1]?.playerId ?? null,
          is_temporary: true,
        })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown }

      const { data: t2, error: t2Error } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          player1_id: team2Players[0]!.playerId,
          player2_id: team2Players[1]?.playerId ?? null,
          is_temporary: true,
        })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown }

      if (t1Error || t2Error || !t1 || !t2) {
        throw new Error('Impossible de créer les équipes du match')
      }

      const { error: matchError } = await supabase.from('matches').insert({
        round_id: round.id,
        tournament_id: tournamentId,
        team1_id: t1.id,
        team2_id: t2.id,
        status: 'pending',
        wave: match.wave,
        court_number: match.courtNumber,
      })

      if (matchError) {
        console.error('createRoundsRound match:', matchError.code, matchError.message)
        throw new Error('Impossible de créer un match')
      }
    }
  }
}

/**
 * Lit les joueurs avec leurs stats pour le mode rounds.
 * Si player_tournament_stats est vide (round 1) : initialise la table.
 */
export async function getRoundsPlayers(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<PlayerWithStats[]> {
  type StatsRow = {
    player_id: string
    consecutive_played: number
    total_waited: number
    last_waited_round: number | null
    current_rank: number | null
    player: { name: string; level: number }
  }

  const { data: stats } = await supabase
    .from('player_tournament_stats')
    .select('player_id, consecutive_played, total_waited, last_waited_round, current_rank, player:players(name, level)')
    .eq('tournament_id', tournamentId) as { data: StatsRow[] | null; error: unknown }

  if (stats && stats.length > 0) {
    return stats.map((s) => ({
      playerId: s.player_id,
      playerName: s.player.name,
      level: s.player.level,
      consecutivePlayed: s.consecutive_played,
      totalWaited: s.total_waited,
      lastWaitedRound: s.last_waited_round,
      currentRank: s.current_rank ?? 999,
    }))
  }

  // Round 1 : initialiser player_tournament_stats depuis tournament_players
  type TPlayerRow = {
    player_id: string
    seed: number | null
    player: { name: string; level: number }
  }

  const { data: tPlayers } = await supabase
    .from('tournament_players')
    .select('player_id, seed, player:players(name, level)')
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: true }) as { data: TPlayerRow[] | null; error: unknown }

  if (!tPlayers || tPlayers.length === 0) return []

  await supabase.from('player_tournament_stats').insert(
    tPlayers.map((tp, idx) => ({
      tournament_id: tournamentId,
      player_id: tp.player_id,
      total_wins: 0,
      total_points_for: 0,
      total_points_against: 0,
      rounds_played: 0,
      consecutive_played: 0,
      total_waited: 0,
      last_waited_round: null,
      current_rank: idx + 1,
    }))
  )

  return tPlayers.map((tp, idx) => ({
    playerId: tp.player_id,
    playerName: tp.player.name,
    level: tp.player.level,
    consecutivePlayed: 0,
    totalWaited: 0,
    lastWaitedRound: null,
    currentRank: idx + 1,
  }))
}

/**
 * Recalcule les stats cumulatives de tous les joueurs d'un tournoi rounds.
 * À appeler quand toutes les vagues d'un round sont terminées.
 */
export async function recalculateRoundsStandings(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  type RawMatch = {
    score_team1: number | null
    score_team2: number | null
    status: string
    winner_team_id: string | null
    team1: { id: string; player1_id: string; player2_id: string | null } | null
    team2: { id: string; player1_id: string; player2_id: string | null } | null
  }

  type StatsRow = { player_id: string; player: { name: string; level: number } }

  // Les deux lectures sont indépendantes → en parallèle pour réduire la latence.
  const [{ data: rawMatches }, { data: statsRows }] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        score_team1, score_team2, status, winner_team_id,
        team1:teams!matches_team1_id_fkey (id, player1_id, player2_id),
        team2:teams!matches_team2_id_fkey (id, player1_id, player2_id)
      `)
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: RawMatch[] | null; error: unknown }>,
    supabase
      .from('player_tournament_stats')
      .select('player_id, player:players(name, level)')
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: StatsRow[] | null; error: unknown }>,
  ])

  const matchResults: RoundsMatchResult[] = []
  for (const m of rawMatches ?? []) {
    if (m.status !== 'done' || !m.team1 || !m.team2) continue
    const t1Ids = [m.team1.player1_id, m.team1.player2_id].filter(Boolean) as string[]
    const t2Ids = [m.team2.player1_id, m.team2.player2_id].filter(Boolean) as string[]
    // Utiliser winner_team_id plutôt que de comparer les totaux de points (incorrect en best-of-3)
    const winnerIsTeam1 = m.winner_team_id
      ? m.winner_team_id === m.team1.id
      : null
    matchResults.push({
      team1PlayerIds: t1Ids,
      team2PlayerIds: t2Ids,
      scoreTeam1: m.score_team1 ?? 0,
      scoreTeam2: m.score_team2 ?? 0,
      winnerIsTeam1,
    })
  }

  const players: PlayerWithStats[] = (statsRows ?? []).map((s) => ({
    playerId: s.player_id,
    playerName: s.player.name,
    level: s.player.level,
    consecutivePlayed: 0,
    totalWaited: 0,
    lastWaitedRound: null,
    currentRank: 1,
  }))

  const standings = calculateStandings(players, matchResults)

  // Écritures en parallèle : N updates concurrents au lieu de séquentiels.
  // On ne touche que les colonnes de classement (consecutive_played /
  // total_waited restent gérés par updateRoundsByeTracking).
  const results = await Promise.all(
    standings.map((s) =>
      supabase
        .from('player_tournament_stats')
        .update({
          total_wins: s.totalWins,
          total_points_for: s.totalPointsFor,
          total_points_against: s.totalPointsAgainst,
          rounds_played: s.roundsPlayed,
          current_rank: s.rank,
        })
        .eq('tournament_id', tournamentId)
        .eq('player_id', s.playerId),
    ),
  )

  for (const { error } of results) {
    if (error) {
      console.error('recalculateRoundsStandings update:', error.code, error.message)
    }
  }
}

/**
 * Met à jour les colonnes de suivi des byes après la clôture d'un round.
 */
export async function updateRoundsByeTracking(
  supabase: SupabaseClient,
  tournamentId: string,
  roundId: string,
  roundNumber: number,
): Promise<void> {
  const { data: byePlayers } = await supabase
    .from('round_bye')
    .select('player_id')
    .eq('round_id', roundId) as { data: { player_id: string }[] | null; error: unknown }

  const byeIds = new Set((byePlayers ?? []).map((b) => b.player_id))

  const { data: allStats } = await supabase
    .from('player_tournament_stats')
    .select('player_id, consecutive_played, total_waited')
    .eq('tournament_id', tournamentId) as {
      data: Array<{ player_id: string; consecutive_played: number; total_waited: number }> | null
      error: unknown
    }

  // Écritures en parallèle plutôt qu'en boucle séquentielle.
  await Promise.all(
    (allStats ?? []).map((s) => {
      const update = byeIds.has(s.player_id)
        ? { consecutive_played: 0, total_waited: s.total_waited + 1, last_waited_round: roundNumber }
        : { consecutive_played: s.consecutive_played + 1 }

      return supabase
        .from('player_tournament_stats')
        .update(update)
        .eq('tournament_id', tournamentId)
        .eq('player_id', s.player_id)
    }),
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODE CLASSIQUE — génération des poules + recalcul des classements de poule
// ════════════════════════════════════════════════════════════════════════════

// Nom d'affichage d'une équipe : nom personnalisé sinon noms des joueurs.
function classicTeamName(
  name: string | null,
  p1: { name: string } | null,
  p2: { name: string } | null,
): string {
  if (name) return name
  if (p1 && p2) return `${p1.name} / ${p2.name}`
  return p1?.name ?? '—'
}

/**
 * Génère les poules d'un tournoi classique : répartition serpent par seed
 * (niveau moyen des joueurs), création des poules, des matchs round-robin et
 * initialisation des classements. Idempotent : ne fait rien si des poules
 * existent déjà.
 */
export async function generateClassicPools(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  // Ne pas régénérer si des poules existent déjà.
  const { count: existingPools } = await supabase
    .from('pools')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
  if ((existingPools ?? 0) > 0) return

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('config')
    .eq('id', tournamentId)
    .single() as { data: { config: unknown } | null; error: unknown }
  if (!tournament) throw new Error('Tournoi introuvable')
  const config = tournament.config as ClassicConfig

  type TeamRow = {
    id: string
    player1: { level: number } | null
    player2: { level: number } | null
  }
  const { data: teamsRaw } = await supabase
    .from('teams')
    .select('id, player1:players!teams_player1_id_fkey(level), player2:players!teams_player2_id_fkey(level)')
    .eq('tournament_id', tournamentId) as { data: TeamRow[] | null; error: unknown }

  const teams = (teamsRaw ?? []).map((t) => {
    const l1 = t.player1?.level ?? 3
    const l2 = t.player2?.level
    return { id: t.id, level: l2 != null ? (l1 + l2) / 2 : l1 }
  })
  if (teams.length < 4) throw new Error('Au moins 4 équipes requises')

  // Seed : niveau décroissant (seed 1 = meilleure équipe).
  teams.sort((a, b) => b.level - a.level)

  // Borne le nombre de poules choisi (au moins 2 équipes par poule).
  const nbPools = Math.min(config.nbPools, maxPoolCount(teams.length))
  const dist = calculatePoolDistribution(teams.length, nbPools)

  // Création des poules (A, B, C...).
  const poolRows = Array.from({ length: dist.nbPools }, (_, i) => ({
    tournament_id: tournamentId,
    name: `Poule ${String.fromCharCode(65 + i)}`,
    position: i + 1,
    status: 'ongoing',
  }))
  const { data: poolsRaw, error: poolError } = await supabase
    .from('pools')
    .insert(poolRows)
    .select('id, position') as { data: { id: string; position: number }[] | null; error: { code: string; message: string } | null }
  if (poolError || !poolsRaw) {
    console.error('generateClassicPools pools:', poolError?.code, poolError?.message)
    throw new Error('Impossible de créer les poules')
  }
  const poolIds = [...poolsRaw].sort((a, b) => a.position - b.position).map((p) => p.id)

  // Répartition serpent : colonne = within (aller) ou miroir (retour) par round.
  const membersByPool = new Map<string, string[]>(poolIds.map((id) => [id, []]))
  const poolOfTeam = new Map<string, string>()
  teams.forEach((team, idx) => {
    const round = Math.floor(idx / dist.nbPools)
    const within = idx % dist.nbPools
    const col = round % 2 === 0 ? within : dist.nbPools - 1 - within
    const poolId = poolIds[col]!
    membersByPool.get(poolId)!.push(team.id)
    poolOfTeam.set(team.id, poolId)
  })

  // Affecter les équipes à leur poule.
  await Promise.all(
    [...poolOfTeam].map(([teamId, poolId]) =>
      supabase.from('teams').update({ pool_id: poolId }).eq('id', teamId),
    ),
  )

  // Matchs round-robin + classements initialisés à 0.
  const matchRows: Array<Record<string, unknown>> = []
  const standingRows: Array<Record<string, unknown>> = []
  for (const poolId of poolIds) {
    const members = membersByPool.get(poolId)!
    for (const m of generatePoolMatches(poolId, members.map((id) => ({ id })))) {
      matchRows.push({
        tournament_id: tournamentId,
        pool_id: poolId,
        phase: 'pool',
        team1_id: m.team1Id,
        team2_id: m.team2Id,
        status: 'pending',
      })
    }
    for (const teamId of members) {
      standingRows.push({ tournament_id: tournamentId, pool_id: poolId, team_id: teamId })
    }
  }

  // throw (et non simple log) : un échec ici doit faire échouer la création du
  // tournoi visiblement — sinon on obtient des poules sans matchs en silence
  // (cas vécu : round_id encore NOT NULL en cloud → inserts rejetés).
  if (matchRows.length > 0) {
    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) {
      console.error('generateClassicPools matches:', error.code, error.message, error.hint)
      throw new Error(`Impossible de créer les matchs de poule : ${error.message}`)
    }
  }
  if (standingRows.length > 0) {
    const { error } = await supabase.from('pool_standings').insert(standingRows)
    if (error) {
      console.error('generateClassicPools standings:', error.code, error.message, error.hint)
      throw new Error(`Impossible d'initialiser les classements : ${error.message}`)
    }
  }

  // Répartition équitable initiale des terrains : floor(nbTerrains / nbPools)
  // terrains par poule (assignés séquentiellement), le reste demeure libre.
  // Ex : 9 terrains, 3 poules → 3 chacune ; 9 terrains, 4 poules → 2 chacune, 1 libre.
  const courtsAvailable = config.courtsAvailable ?? 0
  const perPool = Math.floor(courtsAvailable / poolIds.length)
  if (perPool > 0) {
    const courtRows: Array<Record<string, unknown>> = []
    let court = 1
    for (const poolId of poolIds) {
      for (let k = 0; k < perPool; k++) {
        courtRows.push({ tournament_id: tournamentId, pool_id: poolId, court_number: court })
        court++
      }
    }
    const { error } = await supabase.from('pool_courts').insert(courtRows)
    if (error) console.error('generateClassicPools courts:', error.code, error.message)
  }

  // Premier dispatch : place les premiers matchs de chaque poule sur ses terrains.
  await Promise.all(poolIds.map((id) => dispatchPoolCourts(supabase, id)))
}

/**
 * Attribution automatique des terrains d'une poule à ses matchs en attente.
 *
 * Convention : un match `pending` AVEC terrain = en cours sur ce terrain →
 * le terrain et ses deux équipes sont occupés. Un match `done` n'occupe rien
 * (son court_number est conservé comme historique).
 *
 * La sélection (équité + équipes non occupées) est déléguée à la fonction pure
 * `selectMatchesForCourts` (testée dans classic-bracket.test.ts).
 *
 * Appelée : à la création des poules, après chaque score validé/annulé, et à
 * chaque changement d'assignation terrain → poule.
 */
export async function dispatchPoolCourts(
  supabase: SupabaseClient,
  poolId: string,
): Promise<void> {
  type CourtRow = { court_number: number }
  type MatchRow = {
    id: string
    status: string
    team1_id: string | null
    team2_id: string | null
    court_number: number | null
  }

  const [{ data: courtsRaw }, { data: matchesRaw }] = await Promise.all([
    supabase
      .from('pool_courts')
      .select('court_number')
      .eq('pool_id', poolId) as unknown as Promise<{ data: CourtRow[] | null; error: unknown }>,
    supabase
      .from('matches')
      .select('id, status, team1_id, team2_id, court_number')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true }) as unknown as Promise<{ data: MatchRow[] | null; error: unknown }>,
  ])

  const poolCourts = (courtsRaw ?? []).map((c) => c.court_number).sort((a, b) => a - b)
  if (poolCourts.length === 0) return

  const matches = matchesRaw ?? []
  const pending = matches.filter((m) => m.status === 'pending')

  // Matchs joués par équipe → critère d'équité.
  const playedCount = new Map<string, number>()
  for (const m of matches) {
    if (m.status !== 'done') continue
    for (const id of [m.team1_id, m.team2_id]) {
      if (id) playedCount.set(id, (playedCount.get(id) ?? 0) + 1)
    }
  }

  // Terrains et équipes occupés par les matchs en cours.
  const busyCourts = new Set<number>()
  const busyTeams = new Set<string>()
  for (const m of pending) {
    if (m.court_number === null) continue
    busyCourts.add(m.court_number)
    if (m.team1_id) busyTeams.add(m.team1_id)
    if (m.team2_id) busyTeams.add(m.team2_id)
  }

  const freeCourts = poolCourts.filter((c) => !busyCourts.has(c))
  if (freeCourts.length === 0) return

  const waiting: CourtDispatchMatch[] = pending
    .filter((m) => m.court_number === null && m.team1_id !== null && m.team2_id !== null)
    // safe because: team1_id/team2_id non nuls garantis par le filter ci-dessus.
    .map((m) => ({ id: m.id, team1Id: m.team1_id!, team2Id: m.team2_id! }))

  const assignments = selectMatchesForCourts(freeCourts, waiting, busyTeams, playedCount)
  if (assignments.length === 0) return

  // Cast : client non typé <Database> — chaque update renvoie { error }.
  const results = (await Promise.all(
    assignments.map((a) =>
      supabase.from('matches').update({ court_number: a.courtNumber }).eq('id', a.matchId),
    ),
  )) as Array<{ error: { code: string; message: string } | null }>
  for (const r of results) {
    if (r.error) console.error('dispatchPoolCourts:', r.error.code, r.error.message)
  }
}

/**
 * Attribution automatique des terrains aux matchs du tableau final.
 *
 * Tous les terrains du tournoi sont disponibles (les poules sont terminées).
 * Priorité : barrages > tableau principal > consolante (cf.
 * `planBracketCourtDispatch`). Un match terminé libère son terrain (court_number
 * remis à null à la validation) ; seuls les matchs `pending` AVEC terrain
 * occupent un court.
 *
 * Appelée : à la génération du tableau et après chaque score/annulation.
 */
export async function dispatchBracketCourts(
  supabase: SupabaseClient,
  tournamentId: string,
  courtsAvailable: number,
): Promise<void> {
  if (courtsAvailable <= 0) return

  type Row = {
    id: string
    phase: BracketNodePhase
    bracket_position: number | null
    status: string
    team1_id: string | null
    team2_id: string | null
    court_number: number | null
  }
  const { data: matchesRaw } = await supabase
    .from('matches')
    .select('id, phase, bracket_position, status, team1_id, team2_id, court_number')
    .eq('tournament_id', tournamentId)
    .in('phase', ['barrage', 'bracket_main', 'bracket_consolante']) as unknown as { data: Row[] | null; error: unknown }
  const matches = matchesRaw ?? []

  const busy = new Set<number>()
  for (const m of matches) {
    if (m.status === 'pending' && m.court_number !== null) busy.add(m.court_number)
  }
  const freeCourts = Array.from({ length: courtsAvailable }, (_, i) => i + 1).filter((n) => !busy.has(n))
  if (freeCourts.length === 0) return

  const ready: BracketDispatchMatch[] = matches
    .filter((m) => m.status === 'pending' && m.court_number === null && m.team1_id !== null && m.team2_id !== null)
    .map((m) => ({ id: m.id, phase: m.phase, bracketPosition: m.bracket_position ?? 0 }))

  const assignments = planBracketCourtDispatch(freeCourts, ready)
  if (assignments.length === 0) return

  const results = (await Promise.all(
    assignments.map((a) =>
      supabase.from('matches').update({ court_number: a.courtNumber }).eq('id', a.matchId),
    ),
  )) as Array<{ error: { code: string; message: string } | null }>
  for (const r of results) {
    if (r.error) console.error('dispatchBracketCourts:', r.error.code, r.error.message)
  }
}

/**
 * Recalcule le classement d'une poule à partir de ses matchs terminés.
 */
export async function recalculatePoolStandings(
  supabase: SupabaseClient,
  poolId: string,
): Promise<void> {
  type TeamRow = {
    id: string
    name: string | null
    player1: { name: string } | null
    player2: { name: string } | null
  }
  type MatchRow = {
    team1_id: string | null
    team2_id: string | null
    status: string
    set1_team1: number | null; set1_team2: number | null
    set2_team1: number | null; set2_team2: number | null
    set3_team1: number | null; set3_team2: number | null
  }

  // Équipes + matchs de la poule lus en parallèle (appelé après chaque score).
  const [{ data: teamsRaw }, { data: matchesRaw }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, player1:players!teams_player1_id_fkey(name), player2:players!teams_player2_id_fkey(name)')
      .eq('pool_id', poolId) as unknown as Promise<{ data: TeamRow[] | null; error: unknown }>,
    supabase
      .from('matches')
      .select('team1_id, team2_id, status, set1_team1, set1_team2, set2_team1, set2_team2, set3_team1, set3_team2')
      .eq('pool_id', poolId) as unknown as Promise<{ data: MatchRow[] | null; error: unknown }>,
  ])

  const teams = (teamsRaw ?? []).map((t) => ({
    id: t.id,
    name: classicTeamName(t.name, t.player1, t.player2),
  }))

  const matches: PoolMatchInput[] = []
  for (const m of matchesRaw ?? []) {
    if (m.status !== 'done' || !m.team1_id || !m.team2_id) continue
    const sets: Array<{ team1: number; team2: number }> = []
    if (m.set1_team1 != null && m.set1_team2 != null) sets.push({ team1: m.set1_team1, team2: m.set1_team2 })
    if (m.set2_team1 != null && m.set2_team2 != null) sets.push({ team1: m.set2_team1, team2: m.set2_team2 })
    if (m.set3_team1 != null && m.set3_team2 != null) sets.push({ team1: m.set3_team1, team2: m.set3_team2 })
    matches.push({ team1Id: m.team1_id, team2Id: m.team2_id, sets })
  }

  const standings = calculatePoolStandings(matches, teams)

  await Promise.all(
    standings.map((s) =>
      supabase
        .from('pool_standings')
        .update({
          wins: s.wins,
          losses: s.losses,
          sets_won: s.setsWon,
          sets_lost: s.setsLost,
          points_for: s.pointsFor,
          points_against: s.pointsAgainst,
          matches_played: s.matchesPlayed,
          rank_in_pool: s.rankInPool,
        })
        .eq('pool_id', poolId)
        .eq('team_id', s.teamId),
    ),
  )
}
