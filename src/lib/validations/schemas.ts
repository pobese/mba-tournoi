import { z } from 'zod'
import {
  PLAYER_NAME_MIN,
  PLAYER_NAME_MAX,
  PLAYER_LEVEL_MIN,
  PLAYER_LEVEL_MAX,
  TOURNAMENT_NAME_MIN,
  TOURNAMENT_NAME_MAX,
  AMERICAN_MIN_PLAYERS,
  MAX_BADMINTON_SCORE,
} from '@/lib/constants'

// ─── Players ─────────────────────────────────────────────────────────────────
export const CreatePlayerSchema = z.object({
  name: z.string().min(PLAYER_NAME_MIN).max(PLAYER_NAME_MAX),
  level: z.number().int().min(PLAYER_LEVEL_MIN).max(PLAYER_LEVEL_MAX).default(3),
  email: z.string().email().optional().or(z.literal('')),
})
export type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>

export const UpdatePlayerSchema = CreatePlayerSchema.partial().extend({
  id: z.string().uuid(),
})
export type UpdatePlayerInput = z.infer<typeof UpdatePlayerSchema>

export const BulkImportPlayersSchema = z.object({
  names: z.string().min(1, 'Au moins un nom requis'),
})
export type BulkImportPlayersInput = z.infer<typeof BulkImportPlayersSchema>

// ─── Tournaments ─────────────────────────────────────────────────────────────
const roundsTargetScoreField = z.union([z.literal(11), z.literal(15), z.literal(21)]).default(21)

export const AmericanConfigSchema = z.object({
  format: z.enum(['singles', 'doubles']).default('doubles'),
  courtsAvailable: z.number().int().min(1).max(9).default(9),
  matchFormat: z.enum(['1set', '2sets']).default('1set'),
  targetScore: roundsTargetScoreField,
})

const classicTargetScoreField = z.union([z.literal(15), z.literal(21)]).default(21)

export const ClassicConfigSchema = z.object({
  format: z.enum(['singles', 'doubles']).default('singles'),
  courtsAvailable: z.number().int().min(1).max(12).default(9),
  poolMatchFormat: z.enum(['1set', '2sets']).default('1set'),
  poolTargetScore: classicTargetScoreField,
  bracketMatchFormat: z.enum(['1set', '2sets']).default('1set'),
  bracketTargetScore: classicTargetScoreField,
  nbPools: z.number().int().min(1).max(32).default(4),
})

export const RoundsConfigSchema = z.object({
  format: z.enum(['singles', 'doubles']).default('doubles'),
  courtsAvailable: z.number().int().min(1).max(9).default(9),
  matchFormat: z.enum(['1set', '2sets']).default('1set'),
  targetScore: roundsTargetScoreField,
})

// Paires d'équipes (mode classique double) — composées par l'organisateur.
export const ClassicTeamPairSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid().optional(),
  name: z.string().max(60).optional(),
})

export const CreateTournamentSchema = z.object({
  name: z.string().min(TOURNAMENT_NAME_MIN).max(TOURNAMENT_NAME_MAX),
  type: z.enum(['american', 'classic', 'rounds']),
  playerIds: z.array(z.string().uuid()).min(AMERICAN_MIN_PLAYERS),
  config: z.union([AmericanConfigSchema.strict(), ClassicConfigSchema.strict(), RoundsConfigSchema.strict()]),
  // Optionnel : paires explicites pour le classique en double (sinon appariement séquentiel).
  teams: z.array(ClassicTeamPairSchema).optional(),
})
export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>

// ─── Match scores ─────────────────────────────────────────────────────────────
export const UpdateScoreSchema = z.object({
  matchId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  scoreTeam1: z.number().int().min(0).max(MAX_BADMINTON_SCORE),
  scoreTeam2: z.number().int().min(0).max(MAX_BADMINTON_SCORE),
  winnerTeamId: z.string().uuid(),
})
export type UpdateScoreInput = z.infer<typeof UpdateScoreSchema>

const SetScoreSchema = z.object({
  t1: z.number().int().min(0).max(MAX_BADMINTON_SCORE),
  t2: z.number().int().min(0).max(MAX_BADMINTON_SCORE),
})

// Rounds mode: tableau de sets — 1 set pour simple, 1-3 sets pour best-of-3
export const SubmitRoundsScoreSchema = z.object({
  matchId: z.string().uuid(),
  sets: z.array(SetScoreSchema).min(1).max(3),
})
export type SubmitRoundsScoreInput = z.infer<typeof SubmitRoundsScoreSchema>

export const ResetMatchScoreSchema = z.object({
  matchId: z.string().uuid(),
})

// ─── Rounds : formation des équipes du round 1 ─────────────────────────────────
const DrawPlayerSchema = z.object({ id: z.string().uuid(), name: z.string() })
const DrawTeamSchema = z.object({ players: z.array(DrawPlayerSchema).min(1).max(2) })
const DrawMatchSchema = z.object({
  team1: DrawTeamSchema,
  team2: DrawTeamSchema,
  wave: z.number().int().min(1),
  courtNumber: z.number().int().min(1),
})

export const ConfirmRound1DrawSchema = z.object({
  tournamentId: z.string().uuid(),
  draw: z.object({
    matches: z.array(DrawMatchSchema),
    byes: z.array(DrawPlayerSchema),
    warnings: z.array(z.string()),
  }),
})

export const StartRound1ManualSchema = z.object({
  tournamentId: z.string().uuid(),
  teams: z
    .array(
      z.object({
        player1Id: z.string().uuid(),
        player2Id: z.string().uuid().optional(),
      }),
    )
    .min(2),
  byePlayerIds: z.array(z.string().uuid()),
})

// ─── Classique : poules + tableau ──────────────────────────────────────────────
export const SubmitClassicScoreSchema = z.object({
  matchId: z.string().uuid(),
  sets: z.array(SetScoreSchema).min(1).max(3),
})

export const MoveTeamToPoolSchema = z.object({
  teamId: z.string().uuid(),
  targetPoolId: z.string().uuid(),
})

export const ClosePoolSchema = z.object({
  poolId: z.string().uuid(),
})

export const GenerateBracketSchema = z.object({
  tournamentId: z.string().uuid(),
  mode: z.enum(['barrage', 'first_match_decides']),
})

// ─── Classique : assignation dynamique des terrains aux poules ──────────────────
// courtNumber borné à [1, 99] (sanité) ; la borne réelle = config.courtsAvailable,
// vérifiée côté action contre la configuration du tournoi.
export const AssignCourtToPoolSchema = z.object({
  tournamentId: z.string().uuid(),
  poolId: z.string().uuid(),
  courtNumber: z.number().int().min(1).max(99),
})

export const ReleaseCourtFromPoolSchema = z.object({
  tournamentId: z.string().uuid(),
  courtNumber: z.number().int().min(1).max(99),
})

export const ReleaseAllCourtsFromPoolSchema = z.object({
  poolId: z.string().uuid(),
})

export const RedistributeFreeCourtsSchema = z.object({
  tournamentId: z.string().uuid(),
})

// Assigne (ou retire si null) un terrain de la poule à un match précis.
export const SetMatchCourtSchema = z.object({
  matchId: z.string().uuid(),
  courtNumber: z.number().int().min(1).max(99).nullable(),
})

export const UpdateClassicFormatSchema = z.object({
  tournamentId: z.string().uuid(),
  target: z.enum(['pool', 'bracket', 'both']),
  matchFormat: z.enum(['1set', '2sets']),
  targetScore: z.union([z.literal(15), z.literal(21)]),
})

export const DeleteTournamentSchema = z.object({
  tournamentId: z.string().uuid(),
})

export const UpdateTournamentSchema = z.object({
  tournamentId: z.string().uuid(),
  name: z.string().min(TOURNAMENT_NAME_MIN).max(TOURNAMENT_NAME_MAX),
  config: z.record(z.unknown()),
})

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
})
export type LoginInput = z.infer<typeof LoginSchema>

export const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  name: z.string().min(PLAYER_NAME_MIN).max(PLAYER_NAME_MAX),
})
export type RegisterInput = z.infer<typeof RegisterSchema>
