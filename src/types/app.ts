import type { Database } from './database'

// ─── Table row aliases ────────────────────────────────────────────────────────
export type Player = Database['public']['Tables']['players']['Row']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate = Database['public']['Tables']['players']['Update']

export type Tournament = Database['public']['Tables']['tournaments']['Row']
export type TournamentInsert = Database['public']['Tables']['tournaments']['Insert']
export type TournamentUpdate = Database['public']['Tables']['tournaments']['Update']

export type TournamentPlayer = Database['public']['Tables']['tournament_players']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Round = Database['public']['Tables']['rounds']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Standing = Database['public']['Tables']['standings']['Row']
export type RoundBye = Database['public']['Tables']['round_bye']['Row']
export type PlayerTournamentStats = Database['public']['Tables']['player_tournament_stats']['Row']
export type PlayerTournamentStatsInsert = Database['public']['Tables']['player_tournament_stats']['Insert']
export type PlayerTournamentStatsUpdate = Database['public']['Tables']['player_tournament_stats']['Update']

// ─── Domain enums ─────────────────────────────────────────────────────────────
export type TournamentType = 'american' | 'classic' | 'rounds'
export type TournamentStatus = 'draft' | 'ongoing' | 'finished'
export type MatchStatus = 'pending' | 'ongoing' | 'done' | 'bye'
export type RoundStatus = 'pending' | 'ongoing' | 'finished'

// ─── Tournament config shapes (stored in tournaments.config jsonb) ────────────
export interface AmericanConfig {
  format: 'singles' | 'doubles'
  courtsAvailable: number
  matchFormat: '1set' | '2sets'
  targetScore: 11 | 15 | 21
}

export interface ClassicConfig {
  format: 'singles' | 'doubles'
  courtsAvailable: number
  poolMatchFormat: '1set' | '2sets'
  poolTargetScore: 15 | 21
  bracketMatchFormat: '1set' | '2sets'
  bracketTargetScore: 15 | 21
  nbPools: number
}

export interface RoundsConfig {
  format: 'singles' | 'doubles'
  courtsAvailable: number
  matchFormat: '1set' | '2sets'
  targetScore: 11 | 15 | 21
}

export type TournamentConfig = AmericanConfig | ClassicConfig | RoundsConfig

// ─── Enriched types (joins) ───────────────────────────────────────────────────
export interface TeamWithPlayers extends Team {
  player1: Pick<Player, 'id' | 'name' | 'level'>
  player2: Pick<Player, 'id' | 'name' | 'level'> | null
}

export interface MatchWithTeams extends Match {
  team1: TeamWithPlayers | null
  team2: TeamWithPlayers | null
}

export interface RoundWithMatches extends Round {
  matches: MatchWithTeams[]
}

export interface TournamentWithDetails extends Tournament {
  tournament_players: Array<{
    player: Pick<Player, 'id' | 'name' | 'level'>
    seed: number | null
    is_active: boolean
  }>
  rounds: RoundWithMatches[]
}

// ─── Algorithm types ──────────────────────────────────────────────────────────
export interface PlayerStanding {
  playerId: string
  playerName: string
  pointsScored: number
  pointsConceded: number
  pointDiff: number
  matchesPlayed: number
  wins: number
  rank: number
}

export interface TeamStanding {
  teamId: string
  teamName: string
  pointsScored: number
  pointsConceded: number
  pointDiff: number
  matchesPlayed: number
  wins: number
  losses: number
  rank: number
}
