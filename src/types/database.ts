// FICHIER GÉNÉRÉ — ne pas éditer manuellement.
// Régénérer avec : npx supabase gen types typescript --local > src/types/database.ts

export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          created_by: string
          name: string
          level: number | null
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          created_by: string
          name: string
          level?: number | null
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          created_by?: string
          name?: string
          level?: number | null
          email?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          id: string
          slug: string
          created_by: string
          name: string
          type: 'american' | 'classic' | 'rounds'
          status: 'draft' | 'ongoing' | 'finished'
          config: Record<string, unknown>
          created_at: string
          started_at: string | null
          finished_at: string | null
        }
        Insert: {
          id?: string
          slug?: string
          created_by: string
          name: string
          type: 'american' | 'classic' | 'rounds'
          status?: 'draft' | 'ongoing' | 'finished'
          config?: Record<string, unknown>
          created_at?: string
          started_at?: string | null
          finished_at?: string | null
        }
        Update: {
          id?: string
          slug?: string
          created_by?: string
          name?: string
          type?: 'american' | 'classic' | 'rounds'
          status?: 'draft' | 'ongoing' | 'finished'
          config?: Record<string, unknown>
          created_at?: string
          started_at?: string | null
          finished_at?: string | null
        }
        Relationships: []
      }
      tournament_players: {
        Row: {
          id: string
          tournament_id: string
          player_id: string
          seed: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          tournament_id: string
          player_id: string
          seed?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string
          tournament_id?: string
          player_id?: string
          seed?: number | null
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'tournament_players_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] },
          { foreignKeyName: 'tournament_players_player_id_fkey'; columns: ['player_id']; isOneToOne: false; referencedRelation: 'players'; referencedColumns: ['id'] }
        ]
      }
      teams: {
        Row: {
          id: string
          tournament_id: string
          name: string | null
          player1_id: string
          player2_id: string | null
          is_temporary: boolean
        }
        Insert: {
          id?: string
          tournament_id: string
          name?: string | null
          player1_id: string
          player2_id?: string | null
          is_temporary?: boolean
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string | null
          player1_id?: string
          player2_id?: string | null
          is_temporary?: boolean
        }
        Relationships: [
          { foreignKeyName: 'teams_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] },
          { foreignKeyName: 'teams_player1_id_fkey'; columns: ['player1_id']; isOneToOne: false; referencedRelation: 'players'; referencedColumns: ['id'] },
          { foreignKeyName: 'teams_player2_id_fkey'; columns: ['player2_id']; isOneToOne: false; referencedRelation: 'players'; referencedColumns: ['id'] }
        ]
      }
      rounds: {
        Row: {
          id: string
          tournament_id: string
          round_number: number
          status: 'pending' | 'ongoing' | 'finished'
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          round_number: number
          status?: 'pending' | 'ongoing' | 'finished'
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          round_number?: number
          status?: 'pending' | 'ongoing' | 'finished'
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'rounds_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] }
        ]
      }
      matches: {
        Row: {
          id: string
          round_id: string
          tournament_id: string
          bracket: 'main' | 'consolante'
          position: number | null
          team1_id: string | null
          team2_id: string | null
          score_team1: number | null
          score_team2: number | null
          court: string | null
          wave: number
          court_number: number | null
          set_scores: unknown | null
          status: 'pending' | 'ongoing' | 'done' | 'bye'
          winner_team_id: string | null
          winner_advances_to: string | null
          loser_goes_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          round_id: string
          tournament_id: string
          bracket?: 'main' | 'consolante'
          position?: number | null
          team1_id?: string | null
          team2_id?: string | null
          score_team1?: number | null
          score_team2?: number | null
          court?: string | null
          wave?: number
          court_number?: number | null
          set_scores?: unknown | null
          status?: 'pending' | 'ongoing' | 'done' | 'bye'
          winner_team_id?: string | null
          winner_advances_to?: string | null
          loser_goes_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          round_id?: string
          tournament_id?: string
          bracket?: 'main' | 'consolante'
          position?: number | null
          team1_id?: string | null
          team2_id?: string | null
          score_team1?: number | null
          score_team2?: number | null
          court?: string | null
          wave?: number
          court_number?: number | null
          set_scores?: unknown | null
          status?: 'pending' | 'ongoing' | 'done' | 'bye'
          winner_team_id?: string | null
          winner_advances_to?: string | null
          loser_goes_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'matches_round_id_fkey'; columns: ['round_id']; isOneToOne: false; referencedRelation: 'rounds'; referencedColumns: ['id'] },
          { foreignKeyName: 'matches_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] }
        ]
      }
      round_bye: {
        Row: {
          id: string
          round_id: string
          player_id: string
          tournament_id: string
        }
        Insert: {
          id?: string
          round_id: string
          player_id: string
          tournament_id: string
        }
        Update: {
          id?: string
          round_id?: string
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          { foreignKeyName: 'round_bye_round_id_fkey'; columns: ['round_id']; isOneToOne: false; referencedRelation: 'rounds'; referencedColumns: ['id'] },
          { foreignKeyName: 'round_bye_player_id_fkey'; columns: ['player_id']; isOneToOne: false; referencedRelation: 'players'; referencedColumns: ['id'] },
          { foreignKeyName: 'round_bye_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] }
        ]
      }
      player_tournament_stats: {
        Row: {
          id: string
          tournament_id: string
          player_id: string
          total_wins: number
          total_points_for: number
          total_points_against: number
          rounds_played: number
          consecutive_played: number
          total_waited: number
          last_waited_round: number | null
          current_rank: number | null
        }
        Insert: {
          id?: string
          tournament_id: string
          player_id: string
          total_wins?: number
          total_points_for?: number
          total_points_against?: number
          rounds_played?: number
          consecutive_played?: number
          total_waited?: number
          last_waited_round?: number | null
          current_rank?: number | null
        }
        Update: {
          id?: string
          tournament_id?: string
          player_id?: string
          total_wins?: number
          total_points_for?: number
          total_points_against?: number
          rounds_played?: number
          consecutive_played?: number
          total_waited?: number
          last_waited_round?: number | null
          current_rank?: number | null
        }
        Relationships: [
          { foreignKeyName: 'player_tournament_stats_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] },
          { foreignKeyName: 'player_tournament_stats_player_id_fkey'; columns: ['player_id']; isOneToOne: false; referencedRelation: 'players'; referencedColumns: ['id'] }
        ]
      }
      standings: {
        Row: {
          id: string
          tournament_id: string
          player_id: string | null
          team_id: string | null
          points_scored: number
          points_conceded: number
          matches_played: number
          wins: number
          losses: number
          rank: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          player_id?: string | null
          team_id?: string | null
          points_scored?: number
          points_conceded?: number
          matches_played?: number
          wins?: number
          losses?: number
          rank?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          player_id?: string | null
          team_id?: string | null
          points_scored?: number
          points_conceded?: number
          matches_played?: number
          wins?: number
          losses?: number
          rank?: number | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'standings_tournament_id_fkey'; columns: ['tournament_id']; isOneToOne: false; referencedRelation: 'tournaments'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
