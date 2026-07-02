import type { SupabaseClient } from '@supabase/supabase-js'
import { TOURNAMENT_STATUS, TOURNAMENT_TYPE_LABELS } from '@/lib/constants'

// ════════════════════════════════════════════════════════════════════════════
// Carrière d'un joueur — stats dérivées À LA VOLÉE (option 1, aucune table de
// cumul). On agrège les profils `players` rattachés au compte (players.user_id)
// à travers les sources de résultats propres à chaque mode :
//   - rounds   → player_tournament_stats (par player_id)
//   - american → standings (par player_id, ou par team_id si équipes)
//   - classic  → pool_standings (par team_id)
// L'historique des MATCHS vient directement de `matches` (JOIN teams). Les
// tournois GELÉS ont eu leurs lignes vives purgées → absents de cet historique
// fondé sur les identifiants.
// ════════════════════════════════════════════════════════════════════════════

const NEW_MEMBER_DAYS = 30
const DAY_MS = 86_400_000
const MAX_CHAMPIONSHIP_BADGES = 3
const MAX_RECENT_MATCHES = 10
const WIN_STREAK_BADGE = 5

export interface CareerTournament {
  id: string
  name: string
  typeLabel: string
  date: string | null
  rank: number | null
  won: boolean
}

export interface MatchResult {
  id: string
  tournamentName: string
  date: string | null
  opponent: string
  score: string
  won: boolean
  goalAverage: number
}

export interface PlayerCareer {
  linked: boolean
  level: number | null
  memberSince: string | null
  tournamentsPlayed: number
  wins: number
  matchesPlayed: number
  goalAverage: number
  /** Noms des tournois gagnés (rang 1, terminés), pour le badge Vainqueur. */
  championships: string[]
  finalist: boolean
  maxWinStreak: number
  playedThisMonth: boolean
  isClubMember: boolean
  clubName: string | null
  isNewMember: boolean
  tournaments: CareerTournament[]
  recentMatches: MatchResult[]
}

interface ClubInfo {
  name: string
  isNew: boolean
  joinedAt: string | null
}

const emptyCareer = (linked: boolean, club: ClubInfo | null): PlayerCareer => ({
  linked,
  level: null,
  memberSince: club?.joinedAt ?? null,
  tournamentsPlayed: 0,
  wins: 0,
  matchesPlayed: 0,
  goalAverage: 0,
  championships: [],
  finalist: false,
  maxWinStreak: 0,
  playedThisMonth: false,
  isClubMember: club != null,
  clubName: club?.name ?? null,
  isNewMember: club?.isNew ?? false,
  tournaments: [],
  recentMatches: [],
})

/** Liste PostgREST pour un filtre `.in.` : "(uuid1,uuid2)". */
function inList(ids: string[]): string {
  return `(${ids.join(',')})`
}

async function resolveClub(
  admin: SupabaseClient,
  userId: string,
  players: { club_id: string | null }[],
): Promise<ClubInfo | null> {
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
    return { name: chosen.club.name, isNew, joinedAt: chosen.joined_at }
  }

  // Sinon : propriétaire d'un club (pas stocké dans club_members).
  const { data: owned } = await admin
    .from('clubs')
    .select('name, created_at')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as { data: { name: string; created_at: string } | null }
  return owned ? { name: owned.name, isNew: false, joinedAt: owned.created_at } : null
}

/** Score orienté côté joueur : sets détaillés si dispos, sinon totaux. */
function formatScore(
  setScores: unknown,
  mine: number | null,
  opp: number | null,
  myTeamIsOne: boolean,
): string {
  if (Array.isArray(setScores) && setScores.length > 0) {
    return setScores
      .filter((s): s is [number, number] => Array.isArray(s) && s.length >= 2)
      .map((s) => (myTeamIsOne ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`))
      .join(', ')
  }
  if (mine != null && opp != null) return `${mine} — ${opp}`
  return ''
}

interface MatchRow {
  id: string
  tournament_id: string
  team1_id: string | null
  team2_id: string | null
  score_team1: number | null
  score_team2: number | null
  set_scores: unknown
  winner_team_id: string | null
  created_at: string
}

/** Historique des matchs + stats dérivées (série de victoires, mois en cours). */
async function loadMatches(
  admin: SupabaseClient,
  myTeamIds: string[],
): Promise<{ recent: MatchResult[]; played: number; thisMonth: boolean; maxStreak: number }> {
  if (myTeamIds.length === 0) return { recent: [], played: 0, thisMonth: false, maxStreak: 0 }
  const mine = new Set(myTeamIds)

  const { data: rows } = await admin
    .from('matches')
    .select('id, tournament_id, team1_id, team2_id, score_team1, score_team2, set_scores, winner_team_id, created_at')
    .eq('status', 'done')
    .or(`team1_id.in.${inList(myTeamIds)},team2_id.in.${inList(myTeamIds)}`)
    .order('created_at', { ascending: false }) as { data: MatchRow[] | null }

  const matches = rows ?? []
  if (matches.length === 0) return { recent: [], played: 0, thisMonth: false, maxStreak: 0 }

  // Résolution des noms d'adversaires + noms de tournois.
  const oppIds = new Set<string>()
  const tournamentIds = new Set<string>()
  for (const m of matches) {
    tournamentIds.add(m.tournament_id)
    const opp = mine.has(m.team1_id ?? '') ? m.team2_id : m.team1_id
    if (opp) oppIds.add(opp)
  }

  const [{ data: teams }, { data: tournaments }] = await Promise.all([
    admin
      .from('teams')
      .select('id, name, player1:players!teams_player1_id_fkey(name), player2:players!teams_player2_id_fkey(name)')
      .in('id', [...oppIds]) as unknown as Promise<{
        data: { id: string; name: string | null; player1: { name: string } | null; player2: { name: string } | null }[] | null
      }>,
    admin.from('tournaments').select('id, name').in('id', [...tournamentIds]) as unknown as Promise<{
      data: { id: string; name: string }[] | null
    }>,
  ])

  const teamName = new Map<string, string>()
  for (const t of teams ?? []) {
    const players = t.player2 ? `${t.player1?.name ?? '?'} / ${t.player2.name}` : t.player1?.name ?? '—'
    teamName.set(t.id, t.name ?? players)
  }
  const tournamentName = new Map<string, string>()
  for (const t of tournaments ?? []) tournamentName.set(t.id, t.name)

  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  let thisMonth = false

  const recent: MatchResult[] = matches.slice(0, MAX_RECENT_MATCHES).map((m) => {
    const myTeamIsOne = mine.has(m.team1_id ?? '')
    const myScore = myTeamIsOne ? m.score_team1 : m.score_team2
    const oppScore = myTeamIsOne ? m.score_team2 : m.score_team1
    const oppId = myTeamIsOne ? m.team2_id : m.team1_id
    return {
      id: m.id,
      tournamentName: tournamentName.get(m.tournament_id) ?? '—',
      date: m.created_at,
      opponent: (oppId && teamName.get(oppId)) || '—',
      score: formatScore(m.set_scores, myScore, oppScore, myTeamIsOne),
      won: m.winner_team_id != null && mine.has(m.winner_team_id),
      goalAverage: myScore != null && oppScore != null ? myScore - oppScore : 0,
    }
  })

  for (const m of matches) {
    const d = new Date(m.created_at)
    if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
      thisMonth = true
      break
    }
  }

  // Plus longue série de victoires consécutives DANS un même tournoi.
  const byTournament = new Map<string, { at: string; won: boolean }[]>()
  for (const m of matches) {
    const list = byTournament.get(m.tournament_id) ?? []
    list.push({ at: m.created_at, won: m.winner_team_id != null && mine.has(m.winner_team_id) })
    byTournament.set(m.tournament_id, list)
  }
  let maxStreak = 0
  for (const list of byTournament.values()) {
    list.sort((a, b) => a.at.localeCompare(b.at))
    let run = 0
    for (const e of list) {
      run = e.won ? run + 1 : 0
      if (run > maxStreak) maxStreak = run
    }
  }

  return { recent, played: matches.length, thisMonth, maxStreak }
}

export async function getPlayerCareer(admin: SupabaseClient, userId: string): Promise<PlayerCareer> {
  const { data: players } = await admin
    .from('players')
    .select('id, club_id, level')
    .eq('user_id', userId) as { data: { id: string; club_id: string | null; level: number | null }[] | null }

  const linkedIds = (players ?? []).map((p) => p.id)
  const club = await resolveClub(admin, userId, players ?? [])
  if (linkedIds.length === 0) return emptyCareer(false, club)

  const level = (players ?? []).reduce<number | null>(
    (max, p) => (p.level != null && (max == null || p.level > max) ? p.level : max),
    null,
  )

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
  const result = new Map<string, { wins: number; ga: number; rank: number | null }>()
  const bump = (tid: string, wins: number, ga: number, rank: number | null) => {
    const cur = result.get(tid) ?? { wins: 0, ga: 0, rank: null }
    cur.wins += wins
    cur.ga += ga
    if (rank != null) cur.rank = cur.rank == null ? rank : Math.min(cur.rank, rank)
    result.set(tid, cur)
  }

  // rounds
  const { data: pts } = await admin
    .from('player_tournament_stats')
    .select('tournament_id, total_wins, total_points_for, total_points_against, current_rank')
    .in('player_id', linkedIds) as {
      data: {
        tournament_id: string; total_wins: number; total_points_for: number
        total_points_against: number; current_rank: number | null
      }[] | null
    }
  for (const s of pts ?? []) {
    bump(s.tournament_id, s.total_wins, s.total_points_for - s.total_points_against, s.current_rank)
  }

  // american — standings par joueur
  const { data: stand } = await admin
    .from('standings')
    .select('tournament_id, wins, points_scored, points_conceded, rank')
    .in('player_id', linkedIds) as {
      data: { tournament_id: string; wins: number; points_scored: number; points_conceded: number; rank: number | null }[] | null
    }
  for (const s of stand ?? []) {
    bump(s.tournament_id, s.wins, s.points_scored - s.points_conceded, s.rank)
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
    const { data: pool } = await admin
      .from('pool_standings')
      .select('team_id, wins, points_for, points_against, global_rank')
      .in('team_id', teamIds) as {
        data: { team_id: string; wins: number; points_for: number; points_against: number; global_rank: number | null }[] | null
      }
    for (const s of pool ?? []) {
      const tid = teamTournament.get(s.team_id)
      if (tid) bump(tid, s.wins, s.points_for - s.points_against, s.global_rank)
    }

    const { data: standTeams } = await admin
      .from('standings')
      .select('tournament_id, wins, points_scored, points_conceded, rank')
      .in('team_id', teamIds) as {
        data: { tournament_id: string; wins: number; points_scored: number; points_conceded: number; rank: number | null }[] | null
      }
    for (const s of standTeams ?? []) {
      bump(s.tournament_id, s.wins, s.points_scored - s.points_conceded, s.rank)
    }
  }

  // Agrégats + historique tournois.
  let wins = 0
  let goalAverage = 0
  let finalist = false
  const championships: string[] = []
  const history: CareerTournament[] = []

  for (const [tid, meta] of tournaments) {
    const r = result.get(tid) ?? { wins: 0, ga: 0, rank: null }
    wins += r.wins
    goalAverage += r.ga
    const finished = meta.status === TOURNAMENT_STATUS.FINISHED
    const won = finished && r.rank === 1
    if (won) championships.push(meta.name)
    if (finished && r.rank === 2) finalist = true
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

  const { recent, played, thisMonth, maxStreak } = await loadMatches(admin, teamIds)

  return {
    linked: true,
    level,
    memberSince: club?.joinedAt ?? null,
    tournamentsPlayed: tournaments.size,
    wins,
    matchesPlayed: played,
    goalAverage,
    championships: championships.slice(0, MAX_CHAMPIONSHIP_BADGES),
    finalist,
    maxWinStreak: maxStreak,
    playedThisMonth: thisMonth,
    isClubMember: club != null,
    clubName: club?.name ?? null,
    isNewMember: club?.isNew ?? false,
    tournaments: history,
    recentMatches: recent,
  }
}

/** Seuil du badge « Série de 5 victoires » — réutilisé côté UI. */
export const WIN_STREAK_THRESHOLD = WIN_STREAK_BADGE
