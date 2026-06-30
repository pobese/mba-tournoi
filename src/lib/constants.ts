export const TOURNAMENT_TYPES = {
  AMERICAN: 'american',
  CLASSIC: 'classic',
  ROUNDS: 'rounds',
} as const

export const TOURNAMENT_STATUS = {
  DRAFT: 'draft',
  ONGOING: 'ongoing',
  FINISHED: 'finished',
} as const

export const MATCH_STATUS = {
  PENDING: 'pending',
  ONGOING: 'ongoing',
  DONE: 'done',
  BYE: 'bye',
} as const

export const ROUND_STATUS = {
  PENDING: 'pending',
  ONGOING: 'ongoing',
  FINISHED: 'finished',
} as const

export const PLAYER_LEVEL_MIN = 1
export const PLAYER_LEVEL_MAX = 5
export const PLAYER_LEVEL_DEFAULT = 3

export const TOURNAMENT_NAME_MIN = 3
export const TOURNAMENT_NAME_MAX = 80
export const PLAYER_NAME_MIN = 2
export const PLAYER_NAME_MAX = 50

// Badminton scoring
export const STANDARD_WIN_SCORE = 21
export const MAX_BADMINTON_SCORE = 30

// American tournament
export const AMERICAN_MIN_PLAYERS = 4
export const AMERICAN_DEFAULT_ROUNDS = 5

// Classic bracket
export const CLASSIC_MIN_TEAMS = 4
export const CLASSIC_MAX_TEAMS = 64

// Mode classique — options de configuration
export const CLASSIC_TARGET_SCORES = [15, 21] as const

// Écart minimal de points pour gagner un set (règle standard badminton).
export const CLASSIC_MIN_GAP = 2

// Rounds tournament
export const ROUNDS_MIN_TEAMS = 4

export const ROUNDS_MIN_GAP = 2

// Mode américain — écart minimal de points par set (règle badminton officielle).
export const AMERICAN_MIN_GAP = 2

export const AMERICAN_TARGET_SCORES = [11, 15, 21] as const

export const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  american: 'Tournoi Américain',
  classic: 'Tournoi Classique',
  rounds: 'Tournoi par Rounds',
}

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  ongoing: 'En cours',
  finished: 'Terminé',
}

// ─── Clubs ──────────────────────────────────────────────────────────────────
export const CLUB_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export const CLUB_DEFAULT_SPORT = 'badminton'

export const CLUB_NAME_MIN = 2
export const CLUB_NAME_MAX = 60

// Code d'invitation court (ex. "9F0727") : alphabet sans caractères ambigus
// (pas de 0/O ni 1/I/L) pour la dictée orale / WhatsApp.
export const CLUB_INVITE_CODE_LENGTH = 6
export const CLUB_INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
