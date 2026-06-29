// Données fictives de la landing (single-page démo). Aucune source externe :
// tout est statique pour la vitrine. Types locaux car non métier (jamais persisté).

export type MarketingView = 'home' | 'player' | 'club' | 'organizer'

export type TournamentFormat = 'american' | 'classic' | 'rounds'
export type TournamentStatus = 'open' | 'soon' | 'full'

export interface PublicTournament {
  id: number
  name: string
  org: string
  format: TournamentFormat
  date: string
  time: string
  level: string
  price: string
  unit: 'joueurs' | 'équipes'
  spots: number
  filled: number
  status: TournamentStatus
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  american: 'Américain',
  classic: 'Classique',
  rounds: 'Par Rounds',
}

export const TOURNAMENTS: PublicTournament[] = [
  {
    id: 1,
    name: 'Open Américain Maule',
    org: 'MBA',
    format: 'american',
    date: 'Sam 5 Juil',
    time: '9h00',
    level: 'Tous niveaux',
    price: 'Gratuit',
    unit: 'joueurs',
    spots: 24,
    filled: 12,
    status: 'open',
  },
  {
    id: 2,
    name: 'Tournoi Classique Été',
    org: 'MBA',
    format: 'classic',
    date: 'Dim 6 Juil',
    time: '10h00',
    level: 'Intermédiaire',
    price: 'Gratuit',
    unit: 'équipes',
    spots: 16,
    filled: 8,
    status: 'open',
  },
  {
    id: 3,
    name: 'Soirée Rounds Club',
    org: 'Privé',
    format: 'rounds',
    date: 'Ven 11 Juil',
    time: '19h00',
    level: 'Membres uniquement',
    price: '—',
    unit: 'joueurs',
    spots: 20,
    filled: 20,
    status: 'full',
  },
]

export interface PlayerMatch {
  opponent: string
  result: 'win' | 'loss'
  score: string
  tournament: string
  date: string
}

export const PLAYER_MATCHES: PlayerMatch[] = [
  { opponent: 'Alice & Sophie', result: 'win', score: '21-17 · 21-15', tournament: 'BBQ 2026', date: '21 Juin' },
  { opponent: 'Marc & Julie', result: 'win', score: '21-12 · 18-21 · 21-16', tournament: 'BBQ 2026', date: '21 Juin' },
  { opponent: 'Karim & Emma', result: 'loss', score: '19-21 · 15-21', tournament: 'Open Printemps', date: '12 Avr' },
  { opponent: 'Tom & Léa', result: 'win', score: '21-8 · 21-11', tournament: 'Open Printemps', date: '12 Avr' },
]

export interface ClubMember {
  name: string
  email: string
  level: string
  played: number
  wins: number
  losses: number
  badge: string
}

export const MEMBERS: ClubMember[] = [
  { name: 'Léo Martin', email: 'leo.m@mba.fr', level: 'Confirmé', played: 5, wins: 4, losses: 1, badge: '🏆 Vainqueur BBQ' },
  { name: 'Alice Bernard', email: 'alice.b@mba.fr', level: 'Confirmé', played: 5, wins: 3, losses: 2, badge: '⚡ 5 tournois' },
  { name: 'Marc Dubois', email: 'marc.d@mba.fr', level: 'Intermédiaire', played: 4, wins: 2, losses: 2, badge: '🤝 Fair-play' },
  { name: 'Sophie Leroy', email: 'sophie.l@mba.fr', level: 'Intermédiaire', played: 4, wins: 2, losses: 2, badge: '🎯 Régulière' },
  { name: 'Karim Haddad', email: 'karim.h@mba.fr', level: 'Débutant', played: 2, wins: 1, losses: 1, badge: '🐣 Rookie' },
  { name: 'Emma Petit', email: 'emma.p@mba.fr', level: 'Débutant', played: 2, wins: 0, losses: 2, badge: '😄 Sympa' },
]

export interface BracketMatch {
  p1: string
  p2: string
  s1: string
  s2: string
  winner: 0 | 1 | 2
}

export interface BracketRound {
  round: string
  matches: BracketMatch[]
}

export const BRACKET: BracketRound[] = [
  {
    round: 'Quarts',
    matches: [
      { p1: 'Léo M.', p2: 'Marc D.', s1: '21', s2: '17', winner: 1 },
      { p1: 'Alice B.', p2: 'Emma P.', s1: '21', s2: '9', winner: 1 },
      { p1: 'Sophie L.', p2: 'Karim H.', s1: '18', s2: '21', winner: 2 },
      { p1: 'Tom R.', p2: 'Julie F.', s1: '21', s2: '14', winner: 1 },
    ],
  },
  {
    round: 'Demi-finales',
    matches: [
      { p1: 'Léo M.', p2: 'Alice B.', s1: '?', s2: '?', winner: 0 },
      { p1: 'Karim H.', p2: 'Tom R.', s1: '?', s2: '?', winner: 0 },
    ],
  },
  {
    round: 'Finale',
    matches: [{ p1: 'TBD', p2: 'TBD', s1: '—', s2: '—', winner: 0 }],
  },
]

export type CourtSlot = 'free' | 'booked' | 'pending'

export interface CourtRow {
  time: string
  slots: CourtSlot[]
}

export const COURT_LABELS = ['T1', 'T2', 'T3', 'T4']

export const COURTS: CourtRow[] = [
  { time: '9h', slots: ['booked', 'booked', 'free', 'pending'] },
  { time: '10h', slots: ['booked', 'booked', 'booked', 'free'] },
  { time: '11h', slots: ['booked', 'free', 'booked', 'pending'] },
  { time: '12h', slots: ['free', 'pending', 'free', 'free'] },
]

export interface ScoreEntry {
  court: string
  teams: string
  s1: string
  s2: string
}

export const SCORE_ENTRIES: ScoreEntry[] = [
  { court: 'Terrain 1', teams: 'Léo & Marc vs Alice & Sophie', s1: '18', s2: '15' },
  { court: 'Terrain 2', teams: 'Karim & Emma vs Tom & Julie', s1: '21', s2: '12' },
  { court: 'Terrain 3', teams: 'Léo & Sophie vs Marc & Alice', s1: '', s2: '' },
]
