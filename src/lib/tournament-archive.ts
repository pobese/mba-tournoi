import type { SupabaseClient } from '@supabase/supabase-js'

// ════════════════════════════════════════════════════════════════════════════
// Archivage d'un tournoi terminé : snapshot statique + purge des données vives
// ════════════════════════════════════════════════════════════════════════════
// Objectif : permettre la suppression d'un joueur présent dans un tournoi
// TERMINÉ sans perdre l'historique. On capture les résultats finaux (noms
// dénormalisés en texte) dans tournaments.results_snapshot, puis on supprime les
// lignes relationnelles qui dépendent encore du joueur (matchs, équipes,
// inscriptions…). La page tournoi rend alors une vue statique depuis le snapshot.

export interface SnapshotStanding {
  rank: number
  name: string
  wins: number
  played: number
  detail: string // points marqués/encaissés, ou repère de phase
}

export interface ResultsSnapshot {
  version: 1
  frozenAt: string
  type: 'american' | 'classic' | 'rounds'
  champion: string | null
  consolanteWinner: string | null
  standings: SnapshotStanding[]
}

interface ArchivableTournament {
  id: string
  type: string
}

// ─── Construction du snapshot par mode ──────────────────────────────────────

async function buildRoundsSnapshot(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Pick<ResultsSnapshot, 'champion' | 'consolanteWinner' | 'standings'>> {
  type Row = {
    total_wins: number
    total_points_for: number
    total_points_against: number
    rounds_played: number
    current_rank: number | null
    player: { name: string } | null
  }
  const { data } = await supabase
    .from('player_tournament_stats')
    .select('total_wins, total_points_for, total_points_against, rounds_played, current_rank, player:players(name)')
    .eq('tournament_id', tournamentId)
    .order('current_rank', { ascending: true, nullsFirst: false }) as { data: Row[] | null; error: unknown }

  const standings: SnapshotStanding[] = (data ?? []).map((s, i) => ({
    rank: s.current_rank ?? i + 1,
    name: s.player?.name ?? '—',
    wins: s.total_wins,
    played: s.rounds_played,
    detail: `${s.total_points_for}–${s.total_points_against}`,
  }))
  return { champion: standings[0]?.name ?? null, consolanteWinner: null, standings }
}

async function buildAmericanSnapshot(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Pick<ResultsSnapshot, 'champion' | 'consolanteWinner' | 'standings'>> {
  type Row = {
    rank: number | null
    points_scored: number
    points_conceded: number
    wins: number
    matches_played: number
    player: { name: string } | null
    team: { player1: { name: string } | null; player2: { name: string } | null } | null
  }
  const { data } = await supabase
    .from('standings')
    .select(`
      rank, points_scored, points_conceded, wins, matches_played,
      player:players!standings_player_id_fkey (name),
      team:teams!standings_team_id_fkey ( player1:players!teams_player1_id_fkey (name), player2:players!teams_player2_id_fkey (name) )
    `)
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true, nullsFirst: false }) as { data: Row[] | null; error: unknown }

  const name = (s: Row): string => {
    if (s.player?.name) return s.player.name
    if (s.team) {
      const p1 = s.team.player1?.name ?? ''
      const p2 = s.team.player2?.name ?? ''
      return p2 ? `${p1} / ${p2}` : p1
    }
    return '—'
  }

  const standings: SnapshotStanding[] = (data ?? []).map((s, i) => ({
    rank: s.rank ?? i + 1,
    name: name(s),
    wins: s.wins,
    played: s.matches_played,
    detail: `${s.points_scored}–${s.points_conceded}`,
  }))
  return { champion: standings[0]?.name ?? null, consolanteWinner: null, standings }
}

async function buildClassicSnapshot(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Pick<ResultsSnapshot, 'champion' | 'consolanteWinner' | 'standings'>> {
  type TeamRow = {
    id: string
    name: string | null
    player1: { name: string } | null
    player2: { name: string } | null
  }
  type StandRow = {
    team_id: string
    wins: number
    losses: number
    points_for: number
    points_against: number
    matches_played: number
    global_rank: number | null
    rank_in_pool: number | null
  }
  type BracketRow = {
    phase: string
    bracket_position: number | null
    status: string
    winner_team_id: string | null
  }

  const [{ data: teamsRaw }, { data: standRaw }, { data: bracketRaw }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, player1:players!teams_player1_id_fkey(name), player2:players!teams_player2_id_fkey(name)')
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: TeamRow[] | null; error: unknown }>,
    supabase
      .from('pool_standings')
      .select('team_id, wins, losses, points_for, points_against, matches_played, global_rank, rank_in_pool')
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: StandRow[] | null; error: unknown }>,
    supabase
      .from('matches')
      .select('phase, bracket_position, status, winner_team_id')
      .eq('tournament_id', tournamentId)
      .in('phase', ['bracket_main', 'bracket_consolante']) as unknown as Promise<{ data: BracketRow[] | null; error: unknown }>,
  ])

  const teamName = new Map<string, string>()
  for (const t of teamsRaw ?? []) {
    const players = t.player2 ? `${t.player1?.name ?? '?'} / ${t.player2.name}` : t.player1?.name ?? '—'
    teamName.set(t.id, t.name ?? players)
  }

  const ranked = [...(standRaw ?? [])].sort((a, b) => {
    const ra = a.global_rank ?? Number.MAX_SAFE_INTEGER
    const rb = b.global_rank ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
  const standings: SnapshotStanding[] = ranked.map((s, i) => ({
    rank: s.global_rank ?? i + 1,
    name: teamName.get(s.team_id) ?? '—',
    wins: s.wins,
    played: s.matches_played,
    detail: `${s.points_for}–${s.points_against}`,
  }))

  const finaleWinner = (phase: string): string | null => {
    const finale = (bracketRaw ?? []).find(
      (m) => m.phase === phase && m.bracket_position === 1 && m.status === 'done',
    )
    return finale?.winner_team_id ? teamName.get(finale.winner_team_id) ?? null : null
  }

  return {
    champion: finaleWinner('bracket_main') ?? standings[0]?.name ?? null,
    consolanteWinner: finaleWinner('bracket_consolante'),
    standings,
  }
}

export async function buildTournamentSnapshot(
  supabase: SupabaseClient,
  tournament: ArchivableTournament,
  frozenAt: string,
): Promise<ResultsSnapshot> {
  const base =
    tournament.type === 'rounds'
      ? await buildRoundsSnapshot(supabase, tournament.id)
      : tournament.type === 'american'
        ? await buildAmericanSnapshot(supabase, tournament.id)
        : await buildClassicSnapshot(supabase, tournament.id)

  return {
    version: 1,
    frozenAt,
    type: (tournament.type as ResultsSnapshot['type']) ?? 'rounds',
    ...base,
  }
}

// ─── Gel du tournoi : snapshot + purge des données vives ─────────────────────

/**
 * Fige un tournoi terminé : enregistre son snapshot puis supprime les lignes
 * relationnelles vives (dans un ordre respectant les clés étrangères). À l'issue,
 * plus aucune ligne ne référence les joueurs du tournoi → ils deviennent
 * supprimables. Le tournoi reste visible via results_snapshot (rendu statique).
 *
 * Réservé au propriétaire du tournoi : les policies RLS "Gestion par le créateur"
 * conditionnent toutes les suppressions ci-dessous.
 */
export async function freezeTournament(
  supabase: SupabaseClient,
  tournament: ArchivableTournament,
  frozenAt: string,
): Promise<void> {
  const snapshot = await buildTournamentSnapshot(supabase, tournament, frozenAt)

  const { error: snapError } = await supabase
    .from('tournaments')
    .update({ results_snapshot: snapshot, status: 'finished', finished_at: frozenAt })
    .eq('id', tournament.id)
  if (snapError) {
    throw new Error(`Impossible d'archiver le tournoi : ${snapError.message}`)
  }

  // Ordre de purge : matchs (réf. équipes en RESTRICT) avant équipes ;
  // classements de poule / terrains avant poules ; le reste cascade naturellement.
  const tables = [
    'matches',
    'pool_standings',
    'pool_courts',
    'teams',
    'pools',
    'player_tournament_stats',
    'round_bye',
    'rounds',
    'standings',
    'tournament_players',
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('tournament_id', tournament.id)
    if (error) {
      console.error(`freezeTournament purge ${table}:`, error.code, error.message)
      throw new Error(`Échec de la purge (${table}) : ${error.message}`)
    }
  }
}
