import type { SupabaseClient } from '@supabase/supabase-js'
import { TOURNAMENT_STATUS, TOURNAMENT_TYPE_LABELS } from '@/lib/constants'

// ════════════════════════════════════════════════════════════════════════════
// Carrière d'un joueur — stats dérivées À LA VOLÉE (option 1, aucune table de
// cumul). On agrège les profils `players` rattachés au compte (players.user_id)
// à travers les sources de résultats propres à chaque mode :
//   - rounds   → player_tournament_stats (par player_id)
//   - american → standings (par player_id, ou par team_id si équipes)
//   - classic  → pool_standings (par team_id)
// Les tournois GELÉS ont eu leurs lignes vives purgées (voir tournament-archive)
// → ils sont naturellement absents de cet historique fondé sur les identifiants.
// ════════════════════════════════════════════════════════════════════════════

const NEW_MEMBER_DAYS = 30
const DAY_MS = 86_400_000
const MAX_CHAMPIONSHIP_BADGES = 3

export interface CareerTournament {
  id: string
  name: string
  typeLabel: string
  date: string | null
  rank: number | null
  won: boolean
}

export interface PlayerCareer {
  linked: boolean
  tournamentsPlayed: number
  wins: number
  matches: number
  goalAverage: number
  /** Noms des tournois gagnés (rang 1, terminés), pour le badge Vainqueur. */
  championships: string[]
  clubName: string | null
  isNewMember: boolean
  /** Historique des tournois joués, du plus récent au plus ancien. */
  tournaments: CareerTournament[]
}

const emptyCareer = (
  linked: boolean,
  club: { name: string; isNew: boolean } | null,
): PlayerCareer => ({
  linked,
  tournamentsPlayed: 0,
  wins: 0,
  matches: 0,
  goalAverage: 0,
  championships: [],
  clubName: club?.name ?? null,
  isNewMember: club?.isNew ?? false,
  tournaments: [],
})

/** Liste PostgREST pour un filtre `.in.` : "(uuid1,uuid2)". */
function inList(ids: string[]): string {
  return `(${ids.join(',')})`
}

async function resolveClub(
  admin: SupabaseClient,
  userId: string,
  players: { club_id: string | null }[],
): Promise<{ name: string; isNew: boolean } | null> {
  const { data: memberships } = await admin
    .from('club_members')
    .select('club_id, joined_at, club:clubs(name)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true }) as {
      data: { club_id: string; joined_at: string; club: { name: string } | null }[] | null
    }

  // Priorité au club des profils rattachés, sinon la première adhésion.
  const preferredClubId = players.find((p) => p.club_id)?.club_id ?? null
  const chosen =
    (memberships ?? []).find((m) => m.club_id === preferredClubId) ?? (memberships ?? [])[0] ?? null

  if (chosen?.club?.name) {
    const isNew = Date.now() - new Date(chosen.joined_at).getTime() < NEW_MEMBER_DAYS * DAY_MS
    return { name: chosen.club.name, isNew }
  }

  // Sinon : propriétaire d'un club (pas stocké dans club_members).
  const { data: owned } = await admin
    .from('clubs')
    .select('name')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as { data: { name: string } | null }
  return owned ? { name: owned.name, isNew: false } : null
}

export async function getPlayerCareer(admin: SupabaseClient, userId: string): Promise<PlayerCareer> {
  const { data: players } = await admin
    .from('players')
    .select('id, club_id')
    .eq('user_id', userId) as { data: { id: string; club_id: string | null }[] | null }

  const linkedIds = (players ?? []).map((p) => p.id)
  const club = await resolveClub(admin, userId, players ?? [])
  if (linkedIds.length === 0) return emptyCareer(false, club)

  // Tournois joués (participation).
  const { data: parts } = await admin
    .from('tournament_players')
    .select('tournament:tournaments(id, name, type, status, created_at, finished_at)')
    .in('player_id', linkedIds) as {
      data: {
        tournament: {
          id: string; name: string; type: string; status: string
          created_at: string; finished_at: string | null
        } | null
      }[] | null
    }

  const tournaments = new Map<string, { name: string; type: string; status: string; date: string | null }>()
  for (const row of parts ?? []) {
    const t = row.tournament
    if (t && !tournaments.has(t.id)) {
      tournaments.set(t.id, { name: t.name, type: t.type, status: t.status, date: t.finished_at ?? t.created_at })
    }
  }

  // Résultats par tournoi, agrégés (un même compte peut avoir plusieurs profils).
  const result = new Map<string, { wins: number; matches: number; ga: number; rank: number | null }>()
  const bump = (tid: string, wins: number, matches: number, ga: number, rank: number | null) => {
    const cur = result.get(tid) ?? { wins: 0, matches: 0, ga: 0, rank: null }
    cur.wins += wins
    cur.matches += matches
    cur.ga += ga
    if (rank != null) cur.rank = cur.rank == null ? rank : Math.min(cur.rank, rank)
    result.set(tid, cur)
  }

  // rounds
  const { data: pts } = await admin
    .from('player_tournament_stats')
    .select('tournament_id, total_wins, total_points_for, total_points_against, rounds_played, current_rank')
    .in('player_id', linkedIds) as {
      data: {
        tournament_id: string; total_wins: number; total_points_for: number
        total_points_against: number; rounds_played: number; current_rank: number | null
      }[] | null
    }
  for (const s of pts ?? []) {
    bump(s.tournament_id, s.total_wins, s.rounds_played, s.total_points_for - s.total_points_against, s.current_rank)
  }

  // american — standings par joueur
  const { data: stand } = await admin
    .from('standings')
    .select('tournament_id, wins, matches_played, points_scored, points_conceded, rank')
    .in('player_id', linkedIds) as {
      data: {
        tournament_id: string; wins: number; matches_played: number
        points_scored: number; points_conceded: number; rank: number | null
      }[] | null
    }
  for (const s of stand ?? []) {
    bump(s.tournament_id, s.wins, s.matches_played, s.points_scored - s.points_conceded, s.rank)
  }

  // classic / american-équipes — via les équipes du joueur
  const { data: teams } = await admin
    .from('teams')
    .select('id, tournament_id')
    .or(`player1_id.in.${inList(linkedIds)},player2_id.in.${inList(linkedIds)}`) as {
      data: { id: string; tournament_id: string }[] | null
    }
  const teamTournament = new Map<string, string>()
  for (const t of teams ?? []) teamTournament.set(t.id, t.tournament_id)
  const teamIds = [...teamTournament.keys()]

  if (teamIds.length > 0) {
    // classic → pool_standings
    const { data: pool } = await admin
      .from('pool_standings')
      .select('team_id, wins, matches_played, points_for, points_against, global_rank')
      .in('team_id', teamIds) as {
        data: {
          team_id: string; wins: number; matches_played: number
          points_for: number; points_against: number; global_rank: number | null
        }[] | null
      }
    for (const s of pool ?? []) {
      const tid = teamTournament.get(s.team_id)
      if (tid) bump(tid, s.wins, s.matches_played, s.points_for - s.points_against, s.global_rank)
    }

    // american-équipes → standings par team_id
    const { data: standTeams } = await admin
      .from('standings')
      .select('tournament_id, wins, matches_played, points_scored, points_conceded, rank')
      .in('team_id', teamIds) as {
        data: {
          tournament_id: string; wins: number; matches_played: number
          points_scored: number; points_conceded: number; rank: number | null
        }[] | null
      }
    for (const s of standTeams ?? []) {
      bump(s.tournament_id, s.wins, s.matches_played, s.points_scored - s.points_conceded, s.rank)
    }
  }

  // Agrégats + historique.
  let wins = 0
  let matches = 0
  let goalAverage = 0
  const championships: string[] = []
  const history: CareerTournament[] = []

  for (const [tid, meta] of tournaments) {
    const r = result.get(tid) ?? { wins: 0, matches: 0, ga: 0, rank: null }
    wins += r.wins
    matches += r.matches
    goalAverage += r.ga
    const won = meta.status === TOURNAMENT_STATUS.FINISHED && r.rank === 1
    if (won) championships.push(meta.name)
    history.push({
      id: tid,
      name: meta.name,
      typeLabel: TOURNAMENT_TYPE_LABELS[meta.type] ?? meta.type,
      date: meta.date,
      rank: r.rank,
      won,
    })
  }
  history.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return {
    linked: true,
    tournamentsPlayed: tournaments.size,
    wins,
    matches,
    goalAverage,
    championships: championships.slice(0, MAX_CHAMPIONSHIP_BADGES),
    clubName: club?.name ?? null,
    isNewMember: club?.isNew ?? false,
    tournaments: history,
  }
}
