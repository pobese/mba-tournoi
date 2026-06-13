import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { RoundsDashboard } from '@/components/tournament/rounds/RoundsDashboard'
import { AmericanDashboard } from '@/components/tournament/american/AmericanDashboard'
import { ClassicPoolsDashboard, type PoolView, type TeamLite } from '@/components/tournament/classic/ClassicPoolsDashboard'
import { ClassicBracketDashboard } from '@/components/tournament/classic/ClassicBracketDashboard'
import { StaticResultsView } from '@/components/tournament/StaticResultsView'
import type { ResultsSnapshot } from '@/lib/tournament-archive'
import type { BracketMatchView } from '@/components/tournament/classic/bracket-types'
import { TournamentHeaderActions } from '@/components/tournament/TournamentHeaderActions'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS, AMERICAN_MIN_GAP } from '@/lib/constants'
import { computeEvolution, computeEncounters } from '@/lib/algorithms/american-analytics'
import { getTournamentPermissions } from '@/lib/permissions'
import type { Tournament, RoundsConfig, AmericanConfig, ClassicConfig } from '@/types/app'
import type { RoundsStatsRow } from '@/hooks/useRealtime'
import type { RoundsMatchInfo, ByePlayerInfo } from '@/components/tournament/rounds/RoundsDashboard'
import type { AmericanMatchInfo, AmericanByePlayer } from '@/components/tournament/american/AmericanDashboard'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

// ─── Raw shapes ────────────────────────────────────────────────────────────────

interface RawPlayer { id: string; name: string; level: number }
interface RawTeam { id: string; name?: string | null; player1: RawPlayer; player2: RawPlayer | null }

interface RawMatch {
  id: string; status: string
  score_team1: number | null; score_team2: number | null
  winner_team_id: string | null; court: string | null
  team1: RawTeam | null; team2: RawTeam | null
}

interface RawRoundsMatch extends Omit<RawMatch, 'court'> {
  wave: number; court_number: number | null; set_scores: unknown | null
}

interface RawRound { id: string; round_number: number; status: string }

interface RawStanding {
  id: string; rank: number | null; player_id: string | null; team_id: string | null
  points_scored: number; points_conceded: number; wins: number; losses: number; matches_played: number
  player: { name: string } | null
  team: { player1: { name: string } | null; player2: { name: string } | null } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SupabaseError = { code: string; message: string; hint: string | null } | null

function logSupabaseError(label: string, error: SupabaseError): void {
  if (error) console.error(`${label}:`, error.code, error.message, error.hint)
}

function resolveStandingName(s: RawStanding): string {
  if (s.player?.name) return s.player.name
  if (s.team) {
    const p1 = s.team.player1?.name ?? ''
    const p2 = s.team.player2?.name ?? ''
    return p2 ? `${p1} / ${p2}` : p1
  }
  return '—'
}

// ─── Rounds-specific data fetching ────────────────────────────────────────────

async function fetchRoundsData(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tournamentId: string,
  roundId: string,
) {
  type QErr = { code: string; message: string; hint: string | null } | null
  type RawBye = { player_id: string; player: { name: string } | null }
  type RawStats = {
    player_id: string
    total_wins: number
    total_points_for: number
    total_points_against: number
    rounds_played: number
    current_rank: number | null
    total_waited: number
    consecutive_played: number
    player: { name: string }
  }
  type RawByeHist = { player_id: string; round: { round_number: number } | null }

  // Les 4 requêtes sont indépendantes → exécutées en parallèle pour réduire
  // la latence du chargement (et donc du router.refresh() après chaque score).
  const [
    { data: matchesRaw, error: matchesError },
    { data: byeRaw, error: byeError },
    { data: statsRaw, error: statsError },
    { data: byeHistRaw, error: byeHistError },
  ] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        id, status, score_team1, score_team2, winner_team_id, wave, court_number, set_scores,
        team1:teams!matches_team1_id_fkey ( id, name, player1:players!teams_player1_id_fkey (id,name), player2:players!teams_player2_id_fkey (id,name) ),
        team2:teams!matches_team2_id_fkey ( id, name, player1:players!teams_player1_id_fkey (id,name), player2:players!teams_player2_id_fkey (id,name) )
      `)
      .eq('round_id', roundId)
      .order('wave', { ascending: true })
      .order('court_number', { ascending: true }) as unknown as Promise<{ data: RawRoundsMatch[] | null; error: QErr }>,
    supabase
      .from('round_bye')
      .select(`
        player_id,
        player:players!round_bye_player_id_fkey (name)
      `)
      .eq('round_id', roundId) as unknown as Promise<{ data: RawBye[] | null; error: QErr }>,
    supabase
      .from('player_tournament_stats')
      .select('player_id, total_wins, total_points_for, total_points_against, rounds_played, current_rank, total_waited, consecutive_played, player:players(name)')
      .eq('tournament_id', tournamentId)
      .order('current_rank', { ascending: true }) as unknown as Promise<{ data: RawStats[] | null; error: QErr }>,
    supabase
      .from('round_bye')
      .select('player_id, round:rounds!round_bye_round_id_fkey(round_number)')
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: RawByeHist[] | null; error: QErr }>,
  ])

  if (matchesError) console.error('fetchRoundsData matches:', matchesError.code, matchesError.message, matchesError.hint)
  if (byeError) console.error('fetchRoundsData byes:', byeError.code, byeError.message, byeError.hint)
  if (statsError) console.error('fetchRoundsData stats:', statsError.code, statsError.message, statsError.hint)
  if (byeHistError) console.error('fetchRoundsData byeHist:', byeHistError.code, byeHistError.message, byeHistError.hint)

  // Map playerId → consecutive_played (pour enrichir les byes)
  const consecutiveMap = new Map<string, number>()
  for (const s of statsRaw ?? []) consecutiveMap.set(s.player_id, s.consecutive_played)

  // Build bye history map
  const byeHistoryMap = new Map<string, number[]>()
  for (const b of byeHistRaw ?? []) {
    if (!b.round) continue
    if (!byeHistoryMap.has(b.player_id)) byeHistoryMap.set(b.player_id, [])
    byeHistoryMap.get(b.player_id)!.push(b.round.round_number)
  }

  const matches: RoundsMatchInfo[] = (matchesRaw ?? []).map((m) => ({
    id: m.id, status: m.status,
    score_team1: m.score_team1, score_team2: m.score_team2,
    set_scores: (m.set_scores as Array<[number, number]> | null) ?? null,
    wave: m.wave ?? 1, court_number: m.court_number,
    team1: m.team1, team2: m.team2,
  }))

  const byePlayers: ByePlayerInfo[] = (byeRaw ?? []).map((b) => ({
    playerId: b.player_id,
    playerName: b.player?.name ?? '—',
    consecutivePlayed: consecutiveMap.get(b.player_id) ?? 0,
  }))

  const playerStats: RoundsStatsRow[] = (statsRaw ?? []).map((s) => ({
    playerId: s.player_id,
    playerName: s.player.name,
    totalWins: s.total_wins,
    totalPointsFor: s.total_points_for,
    totalPointsAgainst: s.total_points_against,
    goalAverage: s.total_points_for - s.total_points_against,
    roundsPlayed: s.rounds_played,
    currentRank: s.current_rank,
    totalWaited: s.total_waited,
    byeRounds: byeHistoryMap.get(s.player_id) ?? [],
  }))

  return { matches, byePlayers, playerStats }
}

// ─── American-specific data fetching ──────────────────────────────────────────

async function fetchAmericanData(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  roundId: string,
) {
  const { data: matchesRaw, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id, status, score_team1, score_team2, winner_team_id, wave, court_number, set_scores,
      team1:teams!matches_team1_id_fkey ( id, player1:players!teams_player1_id_fkey (id,name), player2:players!teams_player2_id_fkey (id,name) ),
      team2:teams!matches_team2_id_fkey ( id, player1:players!teams_player1_id_fkey (id,name), player2:players!teams_player2_id_fkey (id,name) )
    `)
    .eq('round_id', roundId)
    .order('wave', { ascending: true })
    .order('court_number', { ascending: true }) as { data: RawRoundsMatch[] | null; error: SupabaseError }

  logSupabaseError('fetchAmericanData matches', matchesError)

  // Byes américain = matchs status='bye' (1 joueur, pas d'adversaire) → séparés
  // des matchs jouables pour ne pas afficher d'inputs de score dessus.
  const playable: AmericanMatchInfo[] = []
  const byePlayers: AmericanByePlayer[] = []

  for (const m of matchesRaw ?? []) {
    if (m.status === 'bye') {
      const p = m.team1?.player1
      if (p) byePlayers.push({ playerId: p.id, playerName: p.name })
      continue
    }
    playable.push({
      id: m.id, status: m.status,
      score_team1: m.score_team1, score_team2: m.score_team2,
      set_scores: (m.set_scores as Array<[number, number]> | null) ?? null,
      wave: m.wave ?? 1, court_number: m.court_number,
      team1: m.team1, team2: m.team2,
    })
  }

  return { matches: playable, byePlayers }
}

async function fetchIndividualStandings(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tournamentId: string,
) {
  const { data: standingsRaw, error: standingsError } = await supabase
    .from('standings')
    .select(`
      id, rank, player_id, team_id, points_scored, points_conceded, wins, losses, matches_played,
      player:players!standings_player_id_fkey (name),
      team:teams!standings_team_id_fkey ( player1:players!teams_player1_id_fkey (name), player2:players!teams_player2_id_fkey (name) )
    `)
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true, nullsFirst: false }) as { data: RawStanding[] | null; error: SupabaseError }

  logSupabaseError('fetchIndividualStandings', standingsError)

  return (standingsRaw ?? []).map((s) => ({
    id: s.id, rank: s.rank,
    playerName: resolveStandingName(s),
    pointsScored: s.points_scored, pointsConceded: s.points_conceded,
    wins: s.wins, losses: s.losses, matchesPlayed: s.matches_played,
  }))
}

// Évolution du classement + statistiques de rencontres (mode américain).
async function fetchAmericanAnalytics(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tournamentId: string,
) {
  type Row = {
    status: string
    score_team1: number | null
    score_team2: number | null
    round: { round_number: number } | null
    team1: { player1_id: string; player2_id: string | null } | null
    team2: { player1_id: string; player2_id: string | null } | null
  }
  const { data, error } = await supabase
    .from('matches')
    .select(`
      status, score_team1, score_team2,
      round:rounds!matches_round_id_fkey ( round_number ),
      team1:teams!matches_team1_id_fkey ( player1_id, player2_id ),
      team2:teams!matches_team2_id_fkey ( player1_id, player2_id )
    `)
    .eq('tournament_id', tournamentId) as { data: Row[] | null; error: SupabaseError }

  logSupabaseError('fetchAmericanAnalytics', error)

  const rows = data ?? []
  const players = (t: Row['team1']): string[] =>
    t ? (t.player2_id ? [t.player1_id, t.player2_id] : [t.player1_id]) : []

  // Évolution : matchs terminés uniquement, rattachés à leur round.
  const evolution = computeEvolution(
    rows
      .filter((m) => m.status === 'done' && m.round && m.team1 && m.team2)
      .map((m) => ({
        roundNumber: m.round!.round_number,
        team1: players(m.team1),
        team2: players(m.team2),
        scoreTeam1: m.score_team1 ?? 0,
        scoreTeam2: m.score_team2 ?? 0,
      })),
  )

  // Rencontres : tous les matchs ayant deux équipes (les byes sont exclus).
  const encounters = computeEncounters(
    rows
      .filter((m) => m.team1 && m.team2)
      .map((m) => ({ team1: players(m.team1), team2: players(m.team2) })),
  )

  return { evolution, encounters }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function TournamentPage({ params }: Props) {
  const supabase = await createServerSupabaseClient()

  type RawTournamentPlayer = { player_id: string; player: { name: string; level: number } | null }

  // getUser + les 4 lectures de base ne dépendent que de params.id → tout part
  // en parallèle : 1 aller-retour réseau au lieu de 5 séquentiels, payé sur
  // chaque chargement ET chaque router.refresh() (après chaque score).
  const [
    { data: { user } },
    { data: tournament, error: tournamentError },
    { data: roundsRaw, error: roundsError },
    { count: playerCount, error: playerCountError },
    { data: tPlayersRaw, error: tPlayersError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('tournaments')
      .select('*')
      .eq('id', params.id)
      .single() as unknown as Promise<{ data: Tournament | null; error: SupabaseError }>,
    supabase
      .from('rounds')
      .select('id, round_number, status')
      .eq('tournament_id', params.id)
      .order('round_number', { ascending: true }) as unknown as Promise<{ data: RawRound[] | null; error: SupabaseError }>,
    supabase
      .from('tournament_players')
      .select('player_id', { count: 'exact', head: true })
      .eq('tournament_id', params.id) as unknown as Promise<{ count: number | null; error: SupabaseError }>,
    supabase
      .from('tournament_players')
      .select('player_id, player:players(name, level)')
      .eq('tournament_id', params.id) as unknown as Promise<{ data: RawTournamentPlayer[] | null; error: SupabaseError }>,
  ])

  if (!user) redirect('/login')

  logSupabaseError('TournamentPage tournament', tournamentError)
  if (!tournament) redirect('/tournaments')
  logSupabaseError('TournamentPage rounds', roundsError)
  logSupabaseError('TournamentPage playerCount', playerCountError)
  logSupabaseError('TournamentPage tournamentPlayers', tPlayersError)

  // Droits : suppression réservée au propriétaire (canDelete) ; édition ouverte
  // aux membres acceptés (appliqué côté Server Actions + RLS).
  const permissions = await getTournamentPermissions(tournament.id, user.id)

  const tournamentPlayers = (tPlayersRaw ?? [])
    .filter((tp): tp is RawTournamentPlayer & { player: { name: string; level: number } } => tp.player !== null)
    .map((tp) => ({ id: tp.player_id, name: tp.player.name, level: tp.player.level }))

  const allRounds = roundsRaw ?? []
  const currentRound =
    allRounds.find((r) => r.status === 'ongoing') ??
    allRounds.find((r) => r.status === 'pending') ??
    allRounds[allRounds.length - 1] ??
    null

  const typeLabel = TOURNAMENT_TYPE_LABELS[tournament.type] ?? tournament.type
  const statusLabel = TOURNAMENT_STATUS_LABELS[tournament.status] ?? tournament.status

  // ─── Tournoi archivé : rendu statique depuis le snapshot ────────────────────
  // results_snapshot n'est pas dans le type généré (database.ts) → lecture via cast.
  const snapshot = (tournament as unknown as { results_snapshot?: ResultsSnapshot | null }).results_snapshot
  if (snapshot) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={tournament.name}
          description={`${typeLabel} — Archivé`}
          action={
            <TournamentHeaderActions
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              tournamentStatus={tournament.status}
              tournamentType={tournament.type}
              config={tournament.config as unknown as RoundsConfig}
              playerCount={playerCount ?? 0}
              canDelete={permissions.canDelete}
            />
          }
        />
        <StaticResultsView snapshot={snapshot} />
      </div>
    )
  }

  // ─── Rounds mode : données spécifiques ──────────────────────────────────────

  if (tournament.type === 'rounds') {
    const config = tournament.config as unknown as RoundsConfig
    const roundsFormat: 'singles' | 'doubles' = (config.format as 'singles' | 'doubles' | undefined) ?? 'doubles'
    const setsToWin: 1 | 2 = config.matchFormat === '2sets' ? 2 : 1
    const targetScore = config.targetScore ?? 21
    const completedRounds = allRounds.filter((r) => r.status === 'finished').length
    const { matches, byePlayers, playerStats } = currentRound
      ? await fetchRoundsData(supabase, tournament.id, currentRound.id)
      : { matches: [], byePlayers: [], playerStats: [] }

    return (
      <div className="space-y-6">
        <PageHeader
          title={tournament.name}
          description={`${typeLabel} — ${statusLabel}`}
          action={
            <TournamentHeaderActions
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              tournamentStatus={tournament.status}
              tournamentType={tournament.type}
              config={config}
              playerCount={playerCount ?? 8}
              canDelete={permissions.canDelete}
            />
          }
        />
        <RoundsDashboard
          tournamentId={tournament.id}
          tournamentSlug={tournament.slug}
          tournamentStatus={tournament.status}
          currentRound={currentRound}
          completedRounds={completedRounds}
          matches={matches}
          byePlayers={byePlayers}
          playerStats={playerStats}
          setsToWin={setsToWin}
          targetScore={targetScore}
          players={tournamentPlayers}
          format={roundsFormat}
        />
      </div>
    )
  }

  // ─── American mode : données spécifiques ────────────────────────────────────

  if (tournament.type === 'american') {
    const config = tournament.config as unknown as Partial<AmericanConfig>
    const setsToWin: 1 | 2 = config.matchFormat === '2sets' ? 2 : 1
    const targetScore = config.targetScore ?? 21
    const minGap = AMERICAN_MIN_GAP
    const completedRounds = allRounds.filter((r) => r.status === 'finished').length

    const { matches: americanMatches, byePlayers } = currentRound
      ? await fetchAmericanData(supabase, currentRound.id)
      : { matches: [], byePlayers: [] }
    const [americanStandings, analytics] = await Promise.all([
      fetchIndividualStandings(supabase, tournament.id),
      fetchAmericanAnalytics(supabase, tournament.id),
    ])

    // Noms des joueurs (déjà chargés plus haut) pour la légende + les rencontres.
    const playerNames: Record<string, string> = Object.fromEntries(
      tournamentPlayers.map((p) => [p.id, p.name]),
    )
    const americanEvolution = {
      rounds: analytics.evolution.rounds,
      series: analytics.evolution.series.map((s) => ({
        ...s,
        name: playerNames[s.playerId] ?? '—',
      })),
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title={tournament.name}
          description={`${typeLabel} — ${statusLabel}`}
          action={
            <TournamentHeaderActions
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              tournamentStatus={tournament.status}
              tournamentType={tournament.type}
              config={tournament.config as unknown as AmericanConfig}
              playerCount={playerCount ?? 8}
              canDelete={permissions.canDelete}
            />
          }
        />
        <AmericanDashboard
          tournamentId={tournament.id}
          tournamentSlug={tournament.slug}
          tournamentStatus={tournament.status}
          currentRound={currentRound}
          completedRounds={completedRounds}
          matches={americanMatches}
          byePlayers={byePlayers}
          standings={americanStandings}
          setsToWin={setsToWin}
          targetScore={targetScore}
          minGap={minGap}
          evolution={americanEvolution}
          encounters={analytics.encounters}
          playerNames={playerNames}
        />
      </div>
    )
  }

  // ─── Classic mode : helpers communs aux deux phases ─────────────────────────

  const classicConfig = tournament.config as unknown as ClassicConfig
  // current_phase n'est pas dans le type généré (database.ts non régénéré pour
  // les tables du mode classique) → lecture via cast local.
  const classicPhase = (tournament as unknown as { current_phase?: string }).current_phase ?? 'pool'

  type RawSetCols = {
    set1_team1: number | null; set1_team2: number | null
    set2_team1: number | null; set2_team2: number | null
    set3_team1: number | null; set3_team2: number | null
  }
  const setScoresOf = (m: RawSetCols): Array<[number, number]> => {
    const out: Array<[number, number]> = []
    if (m.set1_team1 !== null && m.set1_team2 !== null) out.push([m.set1_team1, m.set1_team2])
    if (m.set2_team1 !== null && m.set2_team2 !== null) out.push([m.set2_team1, m.set2_team2])
    if (m.set3_team1 !== null && m.set3_team2 !== null) out.push([m.set3_team1, m.set3_team2])
    return out
  }

  type RawClassicTeam = {
    id: string; name: string | null
    player1: { id: string; name: string } | null
    player2: { id: string; name: string } | null
  }
  const classicTeamsMap = (rows: RawClassicTeam[] | null): Record<string, TeamLite> => {
    const map: Record<string, TeamLite> = {}
    for (const t of rows ?? []) {
      if (!t.player1) continue
      const players = t.player2 ? `${t.player1.name} / ${t.player2.name}` : t.player1.name
      map[t.id] = {
        id: t.id,
        name: t.name ?? players,
        player1: { id: t.player1.id, name: t.player1.name },
        player2: t.player2 ? { id: t.player2.id, name: t.player2.name } : null,
      }
    }
    return map
  }

  // ─── Classic mode : phase tableau (Phase 2) ─────────────────────────────────

  if (classicPhase === 'bracket') {
    const bracketSetsToWin: 1 | 2 = classicConfig.bracketMatchFormat === '2sets' ? 2 : 1
    const bracketTargetScore = classicConfig.bracketTargetScore ?? 21

    type RawBracketMatch = RawSetCols & {
      id: string; phase: 'barrage' | 'bracket_main' | 'bracket_consolante'
      bracket_position: number | null; status: string
      team1_id: string | null; team2_id: string | null; winner_team_id: string | null
      court_number: number | null
    }

    const [
      { data: bracketRaw, error: bracketError },
      { data: bracketTeamsRaw, error: bracketTeamsError },
    ] = await Promise.all([
      supabase
        .from('matches')
        .select('id, phase, bracket_position, status, team1_id, team2_id, winner_team_id, court_number, set1_team1, set1_team2, set2_team1, set2_team2, set3_team1, set3_team2')
        .eq('tournament_id', params.id)
        .in('phase', ['barrage', 'bracket_main', 'bracket_consolante'])
        .order('bracket_position', { ascending: true }) as unknown as Promise<{ data: RawBracketMatch[] | null; error: SupabaseError }>,
      supabase
        .from('teams')
        .select('id, name, player1:players!teams_player1_id_fkey(id,name), player2:players!teams_player2_id_fkey(id,name)')
        .eq('tournament_id', params.id) as unknown as Promise<{ data: RawClassicTeam[] | null; error: SupabaseError }>,
    ])

    logSupabaseError('TournamentPage bracketMatches', bracketError)
    logSupabaseError('TournamentPage bracketTeams', bracketTeamsError)

    const bracketMatches: BracketMatchView[] = (bracketRaw ?? []).map((m) => ({
      id: m.id,
      phase: m.phase,
      bracketPosition: m.bracket_position ?? 0,
      status: m.status,
      team1Id: m.team1_id,
      team2Id: m.team2_id,
      winnerTeamId: m.winner_team_id,
      courtNumber: m.court_number,
      setScores: setScoresOf(m),
    }))

    return (
      <div className="space-y-6">
        <PageHeader
          title={tournament.name}
          description={`${typeLabel} — Tableau final`}
          action={
            <TournamentHeaderActions
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              tournamentStatus={tournament.status}
              tournamentType={tournament.type}
              config={classicConfig}
              playerCount={playerCount ?? 8}
              canDelete={permissions.canDelete}
            />
          }
        />
        <ClassicBracketDashboard
          tournamentId={tournament.id}
          matches={bracketMatches}
          teams={classicTeamsMap(bracketTeamsRaw)}
          setsToWin={bracketSetsToWin}
          targetScore={bracketTargetScore}
        />
      </div>
    )
  }

  // ─── Classic mode : phase poules (Phase 1) ──────────────────────────────────

  const poolSetsToWin: 1 | 2 = classicConfig.poolMatchFormat === '2sets' ? 2 : 1
  const poolTargetScore = classicConfig.poolTargetScore ?? 21

  const poolCourtsAvailable = classicConfig.courtsAvailable ?? 0

  type RawPoolTeam = {
    id: string; pool_id: string | null; name: string | null
    player1: { id: string; name: string } | null
    player2: { id: string; name: string } | null
  }
  type RawPoolMatch = {
    id: string; pool_id: string | null; status: string
    score_team1: number | null; score_team2: number | null
    team1_id: string | null; team2_id: string | null
    court_number: number | null
    set1_team1: number | null; set1_team2: number | null
    set2_team1: number | null; set2_team2: number | null
    set3_team1: number | null; set3_team2: number | null
  }
  type RawPoolCourt = { pool_id: string; court_number: number }
  type RawPoolStanding = {
    team_id: string; pool_id: string
    wins: number; losses: number; sets_won: number; sets_lost: number
    points_for: number; points_against: number; matches_played: number
    team: { name: string | null; player1: { name: string } | null; player2: { name: string } | null } | null
  }

  const [
    { data: poolsRaw, error: poolsError },
    { data: poolTeamsRaw, error: poolTeamsError },
    { data: poolMatchesRaw, error: poolMatchesError },
    { data: poolStandingsRaw, error: poolStandingsError },
    { data: poolCourtsRaw, error: poolCourtsError },
  ] = await Promise.all([
    supabase
      .from('pools')
      .select('id, name, position, status')
      .eq('tournament_id', params.id)
      .order('position', { ascending: true }) as unknown as Promise<{ data: { id: string; name: string; position: number; status: string }[] | null; error: SupabaseError }>,
    supabase
      .from('teams')
      .select('id, pool_id, name, player1:players!teams_player1_id_fkey(id,name), player2:players!teams_player2_id_fkey(id,name)')
      .eq('tournament_id', params.id) as unknown as Promise<{ data: RawPoolTeam[] | null; error: SupabaseError }>,
    supabase
      .from('matches')
      .select('id, pool_id, status, score_team1, score_team2, team1_id, team2_id, court_number, set1_team1, set1_team2, set2_team1, set2_team2, set3_team1, set3_team2')
      .eq('tournament_id', params.id)
      .eq('phase', 'pool')
      .order('created_at', { ascending: true }) as unknown as Promise<{ data: RawPoolMatch[] | null; error: SupabaseError }>,
    supabase
      .from('pool_standings')
      .select('team_id, pool_id, wins, losses, sets_won, sets_lost, points_for, points_against, matches_played, team:teams!pool_standings_team_id_fkey(name, player1:players!teams_player1_id_fkey(name), player2:players!teams_player2_id_fkey(name))')
      .eq('tournament_id', params.id) as unknown as Promise<{ data: RawPoolStanding[] | null; error: SupabaseError }>,
    supabase
      .from('pool_courts')
      .select('pool_id, court_number')
      .eq('tournament_id', params.id) as unknown as Promise<{ data: RawPoolCourt[] | null; error: SupabaseError }>,
  ])

  logSupabaseError('TournamentPage pools', poolsError)
  logSupabaseError('TournamentPage poolTeams', poolTeamsError)
  logSupabaseError('TournamentPage poolMatches', poolMatchesError)
  logSupabaseError('TournamentPage poolStandings', poolStandingsError)
  logSupabaseError('TournamentPage poolCourts', poolCourtsError)

  const teamsMap = classicTeamsMap(poolTeamsRaw)

  // Terrains par poule + terrains libres (étape 6).
  const courtsByPool = new Map<string, number[]>()
  for (const c of poolCourtsRaw ?? []) {
    if (!courtsByPool.has(c.pool_id)) courtsByPool.set(c.pool_id, [])
    courtsByPool.get(c.pool_id)!.push(c.court_number)
  }
  for (const list of courtsByPool.values()) list.sort((a, b) => a - b)

  const assignedCourts = new Set((poolCourtsRaw ?? []).map((c) => c.court_number))
  const freeCourts = Array.from({ length: poolCourtsAvailable }, (_, i) => i + 1).filter(
    (n) => !assignedCourts.has(n),
  )

  const poolTeamName = (t: RawPoolStanding['team']): string => {
    if (!t) return '—'
    if (t.name) return t.name
    const p1 = t.player1?.name ?? ''
    const p2 = t.player2?.name ?? ''
    return p2 ? `${p1} / ${p2}` : p1
  }

  const poolViews: PoolView[] = (poolsRaw ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    status: p.status,
    courts: courtsByPool.get(p.id) ?? [],
    standings: (poolStandingsRaw ?? [])
      .filter((s) => s.pool_id === p.id)
      .map((s) => ({
        teamId: s.team_id,
        teamName: poolTeamName(s.team),
        wins: s.wins, losses: s.losses,
        setsWon: s.sets_won, setsLost: s.sets_lost,
        pointsFor: s.points_for, pointsAgainst: s.points_against,
        matchesPlayed: s.matches_played,
      })),
    matches: (poolMatchesRaw ?? [])
      .filter((m) => m.pool_id === p.id)
      .map((m) => ({
        id: m.id,
        status: m.status,
        team1Id: m.team1_id,
        team2Id: m.team2_id,
        score1: m.score_team1,
        score2: m.score_team2,
        setScores: setScoresOf(m),
        courtNumber: m.court_number,
      })),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={tournament.name}
        description={`${typeLabel} — ${statusLabel}`}
        action={
          <TournamentHeaderActions
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            tournamentStatus={tournament.status}
            tournamentType={tournament.type}
            config={classicConfig}
            playerCount={playerCount ?? 8}
          />
        }
      />
      <ClassicPoolsDashboard
        tournamentId={tournament.id}
        pools={poolViews}
        teams={teamsMap}
        setsToWin={poolSetsToWin}
        targetScore={poolTargetScore}
        courtsAvailable={poolCourtsAvailable}
        freeCourts={freeCourts}
      />
    </div>
  )
}
