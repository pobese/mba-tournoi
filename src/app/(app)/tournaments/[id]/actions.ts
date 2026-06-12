'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UpdateScoreSchema, SubmitRoundsScoreSchema, ResetMatchScoreSchema } from '@/lib/validations/schemas'
import {
  generateAmericanRound,
  createEmptyHistory,
  recordMatch,
  calculateAmericanStandings,
} from '@/lib/algorithms/american-scheduler'
import type {
  MatchResult as AmericanMatchResult,
  PairingHistory,
} from '@/lib/algorithms/american-scheduler'
import { insertAmericanTeam } from '@/lib/tournament-db'
import type { Tournament, AmericanConfig } from '@/types/app'

// ─── Update match score ────────────────────────────────────────────────────────

export async function updateMatchScore(input: unknown) {
  const parsed = UpdateScoreSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', parsed.data.tournamentId)
    .single() as { data: Pick<Tournament, 'created_by'> | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) {
    return { error: 'Permission refusée' }
  }

  const { error } = await supabase
    .from('matches')
    .update({
      score_team1: parsed.data.scoreTeam1,
      score_team2: parsed.data.scoreTeam2,
      status: 'done',
      winner_team_id: parsed.data.winnerTeamId,
    })
    .eq('id', parsed.data.matchId)

  if (error) {
    console.error('updateMatchScore:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath(`/tournaments/${parsed.data.tournamentId}`)
  return { success: true }
}

// ─── Close round ──────────────────────────────────────────────────────────────

export async function closeRound(tournamentId: string, roundId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, config, status')
    .eq('id', tournamentId)
    .single() as {
      data: Pick<Tournament, 'created_by' | 'type' | 'config' | 'status'> | null
      error: unknown
    }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  // Mode rounds : la clôture passe par rounds-actions.closeRoundsRound (boutons
  // du RoundsDashboard) — cette action ne sert qu'à American et Classic.
  if (tournament.type === 'rounds') {
    return { error: 'Action non disponible pour le mode rounds' }
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('id', roundId)
    .single() as { data: { round_number: number } | null; error: unknown }

  if (!round) return { error: 'Round introuvable' }

  const { data: currentMatches } = await supabase
    .from('matches')
    .select('id, status')
    .eq('round_id', roundId) as { data: { id: string; status: string }[] | null; error: unknown }

  const allDone = currentMatches?.every((m) => m.status === 'done' || m.status === 'bye')
  if (!allDone) return { error: 'Tous les matchs doivent être terminés avant de clôturer' }

  await supabase.from('rounds').update({ status: 'finished' }).eq('id', roundId)

  try {
    if (tournament.type === 'american') {
      await closeAmericanRound(supabase, tournamentId, round.round_number, tournament.config as unknown as AmericanConfig)
    } else {
      await closeClassicRound(supabase, tournamentId, roundId, round.round_number)
    }
  } catch (err) {
    console.error('closeRound:', err)
    return { error: err instanceof Error ? err.message : 'Erreur lors de la clôture' }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── American : helpers partagés ──────────────────────────────────────────────

type AmericanRawMatch = {
  score_team1: number | null
  score_team2: number | null
  status: string
  team1: { id: string; player1_id: string; player2_id: string | null } | null
  team2: { id: string; player1_id: string; player2_id: string | null } | null
}

async function fetchAmericanMatches(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<AmericanRawMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      score_team1, score_team2, status,
      team1:teams!matches_team1_id_fkey (id, player1_id, player2_id),
      team2:teams!matches_team2_id_fkey (id, player1_id, player2_id)
    `)
    .eq('tournament_id', tournamentId) as { data: AmericanRawMatch[] | null; error: { code: string; message: string } | null }
  if (error) console.error('fetchAmericanMatches:', error.code, error.message)
  return data ?? []
}

// 1 joueur en simple (player2_id null), 2 en double.
function teamPlayers(team: { player1_id: string; player2_id: string | null } | null): string[] {
  if (!team) return []
  return team.player2_id ? [team.player1_id, team.player2_id] : [team.player1_id]
}

// Reconstruit l'historique des paires + l'historique des byes + les résultats
// à partir de tous les matchs du tournoi (gère simple ET double).
function buildAmericanState(matches: AmericanRawMatch[]): {
  history: PairingHistory
  byeHistory: Map<string, number>
  results: AmericanMatchResult[]
} {
  const history = createEmptyHistory()
  const byeHistory = new Map<string, number>()
  const results: AmericanMatchResult[] = []

  for (const m of matches) {
    if (m.status !== 'done') continue
    const team1 = teamPlayers(m.team1)
    const team2 = teamPlayers(m.team2)
    if (team1.length === 0 || team2.length === 0) continue
    recordMatch(history, { team1, team2 })
    results.push({
      team1,
      team2,
      scoreTeam1: m.score_team1 ?? 0,
      scoreTeam2: m.score_team2 ?? 0,
    })
  }
  for (const m of matches) {
    if (m.status !== 'bye') continue
    const pid = m.team1?.player1_id
    if (pid) byeHistory.set(pid, (byeHistory.get(pid) ?? 0) + 1)
  }
  return { history, byeHistory, results }
}

// Recalcule les standings individuels (appelé après chaque score + à la clôture).
async function recalcAmericanStandings(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  const matches = await fetchAmericanMatches(supabase, tournamentId)
  const { results } = buildAmericanState(matches)
  const standings = calculateAmericanStandings(results)
  await upsertPlayerStandings(supabase, tournamentId, standings)
}

async function closeAmericanRound(
  supabase: SupabaseClient,
  tournamentId: string,
  _roundNumber: number,
  _config: AmericanConfig
) {
  await recalcAmericanStandings(supabase, tournamentId)
}

// ─── American : saisie / reset de score (sets) ────────────────────────────────

export async function submitAmericanScore(
  matchId: string,
  sets: Array<{ t1: number; t2: number }>,
) {
  const parsed = SubmitRoundsScoreSchema.safeParse({ matchId, sets })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: match } = await supabase
    .from('matches')
    .select('tournament_id, team1_id, team2_id')
    .eq('id', matchId)
    .single() as {
      data: { tournament_id: string; team1_id: string | null; team2_id: string | null } | null
      error: unknown
    }

  if (!match) return { error: 'Match introuvable' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', match.tournament_id)
    .single() as { data: { created_by: string } | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }

  const scoreTeam1 = sets.reduce((acc, s) => acc + s.t1, 0)
  const scoreTeam2 = sets.reduce((acc, s) => acc + s.t2, 0)
  const setsWonTeam1 = sets.filter((s) => s.t1 > s.t2).length
  const setsWonTeam2 = sets.filter((s) => s.t2 > s.t1).length
  const winnerTeamId =
    setsWonTeam1 > setsWonTeam2
      ? match.team1_id
      : setsWonTeam2 > setsWonTeam1
        ? match.team2_id
        : null

  const { error: updateError } = await supabase
    .from('matches')
    .update({
      score_team1: scoreTeam1,
      score_team2: scoreTeam2,
      set_scores: sets.map((s) => [s.t1, s.t2]),
      status: 'done',
      ...(winnerTeamId ? { winner_team_id: winnerTeamId } : {}),
    })
    .eq('id', matchId)

  if (updateError) {
    console.error('submitAmericanScore:', updateError.code, updateError.message)
    return { error: updateError.message }
  }

  // Classement individuel recalculé après CHAQUE score (classement live).
  await recalcAmericanStandings(supabase, match.tournament_id)

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

export async function resetAmericanScore(matchId: string) {
  const parsed = ResetMatchScoreSchema.safeParse({ matchId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: match } = await supabase
    .from('matches')
    .select('tournament_id')
    .eq('id', matchId)
    .single() as { data: { tournament_id: string } | null; error: unknown }

  if (!match) return { error: 'Match introuvable' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', match.tournament_id)
    .single() as { data: { created_by: string } | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }

  const { error } = await supabase
    .from('matches')
    .update({
      status: 'pending',
      score_team1: null,
      score_team2: null,
      set_scores: null,
      winner_team_id: null,
    })
    .eq('id', matchId)

  if (error) {
    console.error('resetAmericanScore:', error.code, error.message)
    return { error: error.message }
  }

  await recalcAmericanStandings(supabase, match.tournament_id)

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── American : lancer le round suivant ──────────────────────────────────────

export async function startNextAmericanRound(tournamentId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, status, type, config')
    .eq('id', tournamentId)
    .single() as { data: Pick<Tournament, 'created_by' | 'status' | 'type' | 'config'> | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }
  if (tournament.type !== 'american') return { error: 'Action disponible uniquement pour le format américain' }

  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, round_number, status')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: false })
    .limit(1) as { data: { id: string; round_number: number; status: string }[] | null; error: unknown }

  const lastRound = rounds?.[0]
  if (!lastRound) return { error: 'Aucun round trouvé' }
  if (lastRound.status !== 'finished') return { error: 'Le round courant doit être clôturé avant de lancer le suivant' }

  const rawConfig = tournament.config as unknown as Partial<AmericanConfig>
  const format = rawConfig.format ?? 'doubles'
  const courtsAvailable = rawConfig.courtsAvailable ?? 9

  const allMatches = await fetchAmericanMatches(supabase, tournamentId)
  const { history, byeHistory } = buildAmericanState(allMatches)

  const { data: tPlayers } = await supabase
    .from('tournament_players')
    .select('player_id')
    .eq('tournament_id', tournamentId) as { data: { player_id: string }[] | null; error: unknown }

  const playerIds = tPlayers?.map((tp) => tp.player_id) ?? []
  let generated: ReturnType<typeof generateAmericanRound>
  try {
    generated = generateAmericanRound(playerIds, history, byeHistory, { format, courtsAvailable })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erreur lors de la génération du round' }
  }
  const { matches: newMatches, byePlayers } = generated

  const { data: newRound } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: lastRound.round_number + 1, status: 'ongoing' })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (!newRound) return { error: 'Impossible de créer le round suivant' }

  for (const match of newMatches) {
    const t1id = await insertAmericanTeam(supabase, tournamentId, match.team1)
    const t2id = await insertAmericanTeam(supabase, tournamentId, match.team2)
    await supabase.from('matches').insert({
      round_id: newRound.id,
      tournament_id: tournamentId,
      team1_id: t1id,
      team2_id: t2id,
      status: 'pending',
      wave: match.wave,
      court_number: match.courtNumber,
    })
  }

  for (const byePlayer of byePlayers) {
    const { data: byeTeam } = await supabase
      .from('teams')
      .insert({ tournament_id: tournamentId, player1_id: byePlayer, is_temporary: true })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }

    if (byeTeam) {
      await supabase.from('matches').insert({
        round_id: newRound.id,
        tournament_id: tournamentId,
        team1_id: byeTeam.id,
        team2_id: null,
        status: 'bye',
      })
    }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── American : terminer le tournoi manuellement ──────────────────────────────

export async function finishAmericanTournament(tournamentId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, status, type')
    .eq('id', tournamentId)
    .single() as { data: Pick<Tournament, 'created_by' | 'status' | 'type'> | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }
  if (tournament.type !== 'american') return { error: 'Action disponible uniquement pour le format américain' }

  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', tournamentId)

  if (error) {
    console.error('finishAmericanTournament:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── Classic : avance les vainqueurs dans le bracket ──────────────────────────

async function closeClassicRound(
  supabase: SupabaseClient,
  tournamentId: string,
  roundId: string,
  roundNumber: number
) {
  type RawMatch = {
    id: string
    position: number | null
    winner_team_id: string | null
    winner_advances_to: string | null
    loser_goes_to: string | null
    status: string
  }

  const { data: doneMatches } = await supabase
    .from('matches')
    .select('id, position, winner_team_id, winner_advances_to, loser_goes_to, status')
    .eq('round_id', roundId)
    .eq('status', 'done') as { data: RawMatch[] | null; error: unknown }

  for (const m of doneMatches ?? []) {
    if (!m.winner_team_id) continue

    // Avancer le gagnant dans le match suivant
    if (m.winner_advances_to) {
      // Position impaire → team1, paire → team2
      const slot = m.position && m.position % 2 !== 0 ? 'team1_id' : 'team2_id'
      await supabase
        .from('matches')
        .update({ [slot]: m.winner_team_id })
        .eq('id', m.winner_advances_to)
    }

    // Envoyer le perdant en consolante
    if (m.loser_goes_to) {
      // Récupérer l'équipe perdante
      const { data: match } = await supabase
        .from('matches')
        .select('team1_id, team2_id, winner_team_id')
        .eq('id', m.id)
        .single() as { data: { team1_id: string | null; team2_id: string | null; winner_team_id: string | null } | null; error: unknown }

      if (match) {
        const loserTeamId = match.team1_id === m.winner_team_id ? match.team2_id : match.team1_id
        const slot = m.position && m.position % 2 !== 0 ? 'team1_id' : 'team2_id'
        await supabase
          .from('matches')
          .update({ [slot]: loserTeamId })
          .eq('id', m.loser_goes_to)
      }
    }
  }

  // Activer le round suivant s'il existe
  const { data: nextRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round_number', roundNumber + 1)
    .single() as { data: { id: string } | null; error: unknown }

  if (nextRound) {
    await supabase.from('rounds').update({ status: 'ongoing' }).eq('id', nextRound.id)
  } else {
    // Pas de round suivant = tournoi terminé
    await supabase
      .from('tournaments')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', tournamentId)
  }
}

// ─── Helper : upsert standings joueurs ────────────────────────────────────────

async function upsertPlayerStandings(
  supabase: SupabaseClient,
  tournamentId: string,
  standings: Array<{
    playerId: string
    pointsScored: number
    pointsConceded: number
    pointDiff: number
    matchesPlayed: number
    wins: number
    rank: number
  }>
) {
  // L'index unique (tournament_id, player_id) est PARTIEL (where player_id is
  // not null) : PostgREST ne peut pas l'inférer pour un ON CONFLICT, donc un
  // upsert échoue (42P10). On remplace par delete + insert en lot : 2 requêtes
  // au lieu de N upserts, et ça fonctionne réellement.
  const { error: delError } = await supabase
    .from('standings')
    .delete()
    .eq('tournament_id', tournamentId)
    .not('player_id', 'is', null)

  if (delError) {
    console.error('upsertPlayerStandings delete:', delError.code, delError.message)
    return
  }

  if (standings.length === 0) return

  const { error: insError } = await supabase.from('standings').insert(
    standings.map((s) => ({
      tournament_id: tournamentId,
      player_id: s.playerId,
      points_scored: s.pointsScored,
      points_conceded: s.pointsConceded,
      wins: s.wins,
      losses: s.matchesPlayed - s.wins,
      matches_played: s.matchesPlayed,
      rank: s.rank,
    }))
  )

  if (insError) {
    console.error('upsertPlayerStandings insert:', insError.code, insError.message)
  }
}

// ─── Reset match score (American / Classic) ──────────────────────────────────

export async function resetMatchScore(matchId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: match } = await supabase
    .from('matches')
    .select('tournament_id')
    .eq('id', matchId)
    .single() as { data: { tournament_id: string } | null; error: unknown }

  if (!match) return { error: 'Match introuvable' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', match.tournament_id)
    .single() as { data: { created_by: string } | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }

  const { error } = await supabase
    .from('matches')
    .update({
      status: 'pending',
      score_team1: null,
      score_team2: null,
      set_scores: null,
      winner_team_id: null,
    })
    .eq('id', matchId)

  if (error) {
    console.error('resetMatchScore:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── Start / Finish (conservés) ───────────────────────────────────────────────

export async function startTournament(tournamentId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, status')
    .eq('id', tournamentId)
    .single() as { data: Pick<Tournament, 'created_by' | 'status'> | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }
  if (tournament.status !== 'draft') return { error: 'Le tournoi a déjà démarré' }

  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'ongoing', started_at: new Date().toISOString() })
    .eq('id', tournamentId)

  if (error) return { error: error.message }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}
