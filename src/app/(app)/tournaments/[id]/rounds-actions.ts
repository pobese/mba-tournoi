'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  SubmitRoundsScoreSchema,
  ResetMatchScoreSchema,
  ConfirmRound1DrawSchema,
  StartRound1ManualSchema,
  AddLatePlayerSchema,
  SetRoundsPausesSchema,
} from '@/lib/validations/schemas'
import {
  createRoundsRound,
  recalculateRoundsStandings,
  updateRoundsByeTracking,
} from '@/lib/tournament-db'
import { generateRound1Random } from '@/lib/algorithms/rounds-scheduler'
import type { RoundsConfig, Tournament } from '@/types/app'
import { canManageTournament } from '@/lib/permissions'

// Vérifie que tous les playerIds référencés sont bien inscrits au tournoi.
// Empêche un payload client falsifié d'injecter des joueurs hors tournoi.
async function assertPlayersBelong(
  supabase: SupabaseClient,
  tournamentId: string,
  playerIds: string[],
): Promise<boolean> {
  const { data } = await supabase
    .from('tournament_players')
    .select('player_id')
    .eq('tournament_id', tournamentId) as { data: { player_id: string }[] | null; error: unknown }
  const registered = new Set((data ?? []).map((tp) => tp.player_id))
  return playerIds.every((id) => registered.has(id))
}

// ─── Types pour le tirage de raquette ────────────────────────────────────────

export interface DrawPlayer { id: string; name: string }
export interface DrawTeam { players: DrawPlayer[] }
export interface DrawMatch {
  team1: DrawTeam
  team2: DrawTeam
  wave: number
  courtNumber: number
}
export interface DrawPreview {
  matches: DrawMatch[]
  byes: DrawPlayer[]
  warnings: string[]
}

// ─── previewRound1Draw ────────────────────────────────────────────────────────

/**
 * Génère un tirage aléatoire des équipes pour le round 1 SANS écrire en base.
 * À appeler autant de fois que nécessaire jusqu'à validation.
 */
export async function previewRound1Draw(tournamentId: string): Promise<{
  error?: string
  preview?: DrawPreview
}> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status, config')
    .eq('id', tournamentId)
    .single() as {
      data: Pick<Tournament, 'created_by' | 'type' | 'status' | 'config'> | null
      error: unknown
    }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  const { data: existingRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (existingRound) return { error: 'Le premier round a déjà été lancé' }

  const rawConfig = tournament.config as unknown as Partial<RoundsConfig>
  const config: RoundsConfig = {
    format: rawConfig.format ?? 'doubles',
    courtsAvailable: rawConfig.courtsAvailable ?? 9,
    matchFormat: rawConfig.matchFormat ?? '1set',
    targetScore: rawConfig.targetScore ?? 21,
  }

  type TPlayerRow = { player_id: string; player: { name: string; level: number } }
  const { data: tPlayers } = await supabase
    .from('tournament_players')
    .select('player_id, player:players(name, level)')
    .eq('tournament_id', tournamentId) as { data: TPlayerRow[] | null; error: unknown }

  if (!tPlayers || tPlayers.length === 0) return { error: 'Aucun joueur trouvé' }

  const players = tPlayers.map((tp, idx) => ({
    playerId: tp.player_id,
    playerName: tp.player.name,
    level: tp.player.level,
    consecutivePlayed: 0,
    totalWaited: 0,
    lastWaitedRound: null,
    currentRank: idx + 1,
  }))

  try {
    const schedule = generateRound1Random(players, {
      format: config.format,
      courtsAvailable: config.courtsAvailable,
    })

    const preview: DrawPreview = {
      matches: schedule.waves.flat().map((m) => ({
        team1: { players: m.team1.players.map((p) => ({ id: p.playerId, name: p.playerName })) },
        team2: { players: m.team2.players.map((p) => ({ id: p.playerId, name: p.playerName })) },
        wave: m.wave,
        courtNumber: m.courtNumber,
      })),
      byes: schedule.byes.map((p) => ({ id: p.playerId, name: p.playerName })),
      warnings: schedule.warnings,
    }

    return { preview }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erreur lors du tirage' }
  }
}

// ─── confirmRound1Draw ────────────────────────────────────────────────────────

/**
 * Valide le tirage et crée le round 1 en base avec les équipes approuvées.
 */
export async function confirmRound1Draw(
  tournamentId: string,
  draw: DrawPreview,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = ConfirmRound1DrawSchema.safeParse({ tournamentId, draw })
  if (!parsed.success) return { error: 'Données de tirage invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', tournamentId)
    .single() as {
      data: Pick<Tournament, 'created_by' | 'type' | 'status'> | null
      error: unknown
    }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  const drawPlayerIds = [
    ...draw.matches.flatMap((m) => [...m.team1.players, ...m.team2.players].map((p) => p.id)),
    ...draw.byes.map((b) => b.id),
  ]
  if (!(await assertPlayersBelong(supabase, tournamentId, drawPlayerIds))) {
    return { error: 'Un joueur du tirage n\'est pas inscrit à ce tournoi' }
  }

  const { data: existingRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (existingRound) return { error: 'Le premier round a déjà été lancé' }

  try {
    // Initialiser player_tournament_stats si absent
    const { count } = await supabase
      .from('player_tournament_stats')
      .select('player_id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    if ((count ?? 0) === 0) {
      type TPlayerRow = { player_id: string; seed: number | null; player: { name: string; level: number } }
      const { data: tPlayers } = await supabase
        .from('tournament_players')
        .select('player_id, seed, player:players(name, level)')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true }) as { data: TPlayerRow[] | null; error: unknown }

      if (tPlayers && tPlayers.length > 0) {
        await supabase.from('player_tournament_stats').insert(
          tPlayers.map((tp, idx) => ({
            tournament_id: tournamentId,
            player_id: tp.player_id,
            total_wins: 0,
            total_points_for: 0,
            total_points_against: 0,
            rounds_played: 0,
            consecutive_played: 0,
            total_waited: 0,
            last_waited_round: null,
            current_rank: idx + 1,
          }))
        )
      }
    }

    // Créer le round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({ tournament_id: tournamentId, round_number: 1, status: 'ongoing' })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }

    if (roundError || !round) return { error: 'Impossible de créer le round' }

    // Insérer les byes
    if (draw.byes.length > 0) {
      const { error: byeError } = await supabase.from('round_bye').insert(
        draw.byes.map((p) => ({
          round_id: round.id,
          player_id: p.id,
          tournament_id: tournamentId,
        }))
      )
      if (byeError) console.error('confirmRound1Draw byes:', byeError.code, byeError.message)
    }

    // Créer les équipes et matchs
    for (const match of draw.matches) {
      const { data: t1 } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          player1_id: match.team1.players[0]!.id,
          player2_id: match.team1.players[1]?.id ?? null,
          is_temporary: true,
        })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown }

      const { data: t2 } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          player1_id: match.team2.players[0]!.id,
          player2_id: match.team2.players[1]?.id ?? null,
          is_temporary: true,
        })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown }

      if (!t1 || !t2) {
        await supabase.from('rounds').delete().eq('id', round.id)
        return { error: 'Impossible de créer les équipes du match' }
      }

      const { error: matchError } = await supabase.from('matches').insert({
        round_id: round.id,
        tournament_id: tournamentId,
        team1_id: t1.id,
        team2_id: t2.id,
        status: 'pending',
        wave: match.wave,
        court_number: match.courtNumber,
      })

      if (matchError) {
        console.error('confirmRound1Draw match:', matchError.code, matchError.message)
        await supabase.from('rounds').delete().eq('id', round.id)
        return { error: 'Impossible de créer un match' }
      }
    }
  } catch (err) {
    console.error('confirmRound1Draw:', err)
    return { error: err instanceof Error ? err.message : 'Erreur lors de la création' }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── startRound1Manual ────────────────────────────────────────────────────────

export interface ManualTeamInput {
  player1Id: string
  player2Id?: string
  name?: string
}

/**
 * Lance le Round 1 avec des équipes composées manuellement par l'organisateur.
 * L'appariement des matchs suit la même logique que le serpent : équipe i vs équipe i+K/2.
 */
export async function startRound1Manual(
  tournamentId: string,
  teams: ManualTeamInput[],
  byePlayerIds: string[],
): Promise<{ success?: boolean; error?: string }> {
  const parsed = StartRound1ManualSchema.safeParse({ tournamentId, teams, byePlayerIds })
  if (!parsed.success) return { error: 'Équipes invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status, config')
    .eq('id', tournamentId)
    .single() as {
      data: Pick<Tournament, 'created_by' | 'type' | 'status' | 'config'> | null
      error: unknown
    }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  const manualPlayerIds = [
    ...teams.flatMap((t) => [t.player1Id, t.player2Id].filter(Boolean) as string[]),
    ...byePlayerIds,
  ]
  if (!(await assertPlayersBelong(supabase, tournamentId, manualPlayerIds))) {
    return { error: 'Un joueur assigné n\'est pas inscrit à ce tournoi' }
  }

  const { data: existingRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (existingRound) return { error: 'Le premier round a déjà été lancé' }

  const rawConfig2 = tournament.config as unknown as Partial<RoundsConfig>
  const roundsFormat = rawConfig2.format ?? 'doubles'

  if (roundsFormat === 'doubles') {
    for (const team of teams) {
      if (!team.player2Id) return { error: 'En double, chaque équipe doit avoir deux joueurs' }
    }
  }

  if (teams.length < 2 || teams.length % 2 !== 0) {
    return { error: `Nombre d'équipes invalide : ${teams.length} (nombre pair ≥ 2 requis)` }
  }

  // Un round tient en une seule vague : au plus `courtsAvailable` matchs
  // (1 match = 2 équipes). Le surplus doit passer en liste d'attente.
  const courtsAvailable = rawConfig2.courtsAvailable ?? 9
  if (teams.length / 2 > courtsAvailable) {
    return {
      error: `Trop de matchs (${teams.length / 2}) pour ${courtsAvailable} terrain(s). Mettez des joueurs en attente.`,
    }
  }

  const allPlayerIds = [
    ...teams.flatMap((t) => [t.player1Id, t.player2Id].filter(Boolean) as string[]),
    ...byePlayerIds,
  ]
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    return { error: 'Un joueur ne peut pas être assigné deux fois' }
  }

  try {
    // Initialiser player_tournament_stats si absent
    const { count } = await supabase
      .from('player_tournament_stats')
      .select('player_id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    if ((count ?? 0) === 0) {
      type TPlayerRow = { player_id: string; seed: number | null }
      const { data: tPlayers } = await supabase
        .from('tournament_players')
        .select('player_id, seed')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true }) as { data: TPlayerRow[] | null; error: unknown }

      if (tPlayers && tPlayers.length > 0) {
        await supabase.from('player_tournament_stats').insert(
          tPlayers.map((tp, idx) => ({
            tournament_id: tournamentId,
            player_id: tp.player_id,
            total_wins: 0, total_points_for: 0, total_points_against: 0,
            rounds_played: 0, consecutive_played: 0, total_waited: 0,
            last_waited_round: null, current_rank: idx + 1,
          }))
        )
      }
    }

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({ tournament_id: tournamentId, round_number: 1, status: 'ongoing' })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }
    if (roundError || !round) return { error: 'Impossible de créer le round' }

    if (byePlayerIds.length > 0) {
      const { error: byeError } = await supabase.from('round_bye').insert(
        byePlayerIds.map((pid) => ({ round_id: round.id, player_id: pid, tournament_id: tournamentId }))
      )
      if (byeError) console.error('startRound1Manual byes:', byeError.code, byeError.message)
    }

    // Appariement : équipe i vs équipe i+K/2 (garanti ≤ courtsAvailable → 1 vague).
    const half = teams.length / 2
    let wave = 1
    for (let i = 0; i < half; i += courtsAvailable) {
      const waveCount = Math.min(courtsAvailable, half - i)
      for (let j = 0; j < waveCount; j++) {
        const t1Input = teams[i + j]!
        const t2Input = teams[i + j + half]!

        const { data: t1 } = await supabase
          .from('teams')
          .insert({ tournament_id: tournamentId, player1_id: t1Input.player1Id, player2_id: t1Input.player2Id ?? null, name: t1Input.name ?? null, is_temporary: true })
          .select('id').single() as { data: { id: string } | null; error: unknown }

        const { data: t2 } = await supabase
          .from('teams')
          .insert({ tournament_id: tournamentId, player1_id: t2Input.player1Id, player2_id: t2Input.player2Id ?? null, name: t2Input.name ?? null, is_temporary: true })
          .select('id').single() as { data: { id: string } | null; error: unknown }

        if (!t1 || !t2) {
          await supabase.from('rounds').delete().eq('id', round.id)
          return { error: 'Impossible de créer les équipes du match' }
        }

        const { error: matchError } = await supabase.from('matches').insert({
          round_id: round.id, tournament_id: tournamentId,
          team1_id: t1.id, team2_id: t2.id,
          status: 'pending', wave, court_number: j + 1,
        })
        if (matchError) {
          console.error('startRound1Manual match:', matchError.code, matchError.message)
          await supabase.from('rounds').delete().eq('id', round.id)
          return { error: 'Impossible de créer un match' }
        }
      }
      wave++
    }
  } catch (err) {
    console.error('startRound1Manual:', err)
    return { error: err instanceof Error ? err.message : 'Erreur lors de la création' }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── Pauses du prochain round ─────────────────────────────────────────────────

export interface PauseStateRow { id: string; name: string; paused: boolean }

/**
 * État des pauses : liste des joueurs du tournoi avec leur drapeau "pause au
 * prochain round". Disponible une fois les stats initialisées (round 1 lancé).
 */
export async function getRoundsPauseState(
  tournamentId: string,
): Promise<{ players?: PauseStateRow[]; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié' }

  type Row = { player_id: string; pause_requested: boolean | null; player: { name: string } | null }
  const { data } = await supabase
    .from('player_tournament_stats')
    .select('player_id, pause_requested, player:players(name)')
    .eq('tournament_id', tournamentId) as { data: Row[] | null; error: unknown }

  const players = (data ?? [])
    .map((r) => ({ id: r.player_id, name: r.player?.name ?? '—', paused: r.pause_requested ?? false }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return { players }
}

/**
 * Définit l'ensemble des joueurs en pause pour le prochain round : ceux listés
 * passent en pause, tous les autres en sont retirés (état complet, pas un toggle).
 */
export async function setRoundsPauses(
  tournamentId: string,
  playerIds: string[],
): Promise<{ success?: boolean; error?: string }> {
  const parsed = SetRoundsPausesSchema.safeParse({ tournamentId, playerIds })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', tournamentId)
    .single() as { data: Pick<Tournament, 'created_by' | 'type' | 'status'> | null; error: unknown }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  const ids = [...new Set(parsed.data.playerIds)]

  // Remise à zéro globale puis activation des joueurs sélectionnés.
  const { error: resetError } = await supabase
    .from('player_tournament_stats')
    .update({ pause_requested: false })
    .eq('tournament_id', tournamentId)
    .eq('pause_requested', true)
  if (resetError) {
    console.error('setRoundsPauses reset:', resetError.code, resetError.message)
    return { error: resetError.message }
  }

  if (ids.length > 0) {
    const { error: setError } = await supabase
      .from('player_tournament_stats')
      .update({ pause_requested: true })
      .eq('tournament_id', tournamentId)
      .in('player_id', ids)
    if (setError) {
      console.error('setRoundsPauses set:', setError.code, setError.message)
      return { error: setError.message }
    }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── resetRound1 ──────────────────────────────────────────────────────────────

/**
 * Réinitialise le round 1 : efface ses matchs, équipes temporaires, byes et
 * statistiques, puis supprime le round → l'écran de constitution réapparaît.
 * Autorisé uniquement tant qu'aucun round 2 n'a démarré (sinon ce serait casser
 * l'historique des rounds suivants). Ne touche ni au tournoi ni aux inscriptions.
 */
export async function resetRound1(tournamentId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', tournamentId)
    .single() as { data: Pick<Tournament, 'created_by' | 'type' | 'status'> | null; error: unknown }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  const { data: rounds } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('tournament_id', tournamentId) as { data: { round_number: number }[] | null; error: unknown }

  if (!rounds || rounds.length === 0) return { error: 'Aucun round à réinitialiser' }
  if (rounds.some((r) => r.round_number >= 2)) {
    return { error: 'Le round 2 a déjà commencé — réinitialisation du round 1 impossible' }
  }

  // Ordre respectant les clés étrangères : matchs (réf. équipes en RESTRICT) avant
  // équipes ; byes/stats indépendants. Seul le round 1 existe ici.
  const steps: Array<{ table: string; query: () => PromiseLike<{ error: { code: string; message: string } | null }> }> = [
    { table: 'matches', query: () => supabase.from('matches').delete().eq('tournament_id', tournamentId) },
    { table: 'teams', query: () => supabase.from('teams').delete().eq('tournament_id', tournamentId).eq('is_temporary', true) },
    { table: 'round_bye', query: () => supabase.from('round_bye').delete().eq('tournament_id', tournamentId) },
    { table: 'rounds', query: () => supabase.from('rounds').delete().eq('tournament_id', tournamentId) },
    { table: 'player_tournament_stats', query: () => supabase.from('player_tournament_stats').delete().eq('tournament_id', tournamentId) },
  ]
  for (const step of steps) {
    const { error } = await step.query()
    if (error) {
      console.error(`resetRound1 ${step.table}:`, error.code, error.message)
      return { error: `Échec de la réinitialisation (${step.table}) : ${error.message}` }
    }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── startRoundsRound ─────────────────────────────────────────────────────────

export async function startRoundsRound(tournamentId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status, config')
    .eq('id', tournamentId)
    .single() as {
      data: Pick<Tournament, 'created_by' | 'type' | 'status' | 'config'> | null
      error: unknown
    }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  // Vérifier qu'il n'y a pas déjà un round en cours
  const { data: openRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'ongoing')
    .limit(1)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (openRound) return { error: 'Un round est déjà en cours. Clôturez-le avant d\'en lancer un nouveau.' }

  const config = tournament.config as unknown as RoundsConfig

  try {
    await createRoundsRound(supabase, tournamentId, config)
  } catch (err) {
    console.error('startRoundsRound:', err)
    return { error: err instanceof Error ? err.message : 'Erreur lors de la création du round' }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── submitMatchScore ─────────────────────────────────────────────────────────

export async function submitMatchScore(
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
    .select('round_id, tournament_id, team1_id, team2_id')
    .eq('id', matchId)
    .single() as {
      data: {
        round_id: string
        tournament_id: string
        team1_id: string | null
        team2_id: string | null
      } | null
      error: unknown
    }

  if (!match) return { error: 'Match introuvable' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', match.tournament_id)
    .single() as { data: { created_by: string } | null; error: unknown }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }

  // Calculer totaux de points et winner par nombre de sets gagnés
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
    console.error('submitMatchScore:', updateError.code, updateError.message)
    return { error: updateError.message }
  }

  // Classement live : recalculé à CHAQUE match validé (idempotent — repart de
  // tous les matchs `done` du tournoi), pour que le leader change immédiatement.
  await recalculateRoundsStandings(supabase, match.tournament_id)

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── resetMatchScore ──────────────────────────────────────────────────────────

export async function resetMatchScore(matchId: string) {
  const parsed = ResetMatchScoreSchema.safeParse({ matchId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: match } = await supabase
    .from('matches')
    .select('tournament_id, round_id')
    .eq('id', matchId)
    .single() as { data: { tournament_id: string; round_id: string } | null; error: unknown }

  if (!match) return { error: 'Match introuvable' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', match.tournament_id)
    .single() as { data: { created_by: string } | null; error: unknown }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }

  await supabase
    .from('matches')
    .update({
      status: 'pending',
      score_team1: null,
      score_team2: null,
      set_scores: null,
      winner_team_id: null,
    })
    .eq('id', matchId)

  // Recalculer avec les matchs restants
  await recalculateRoundsStandings(supabase, match.tournament_id)

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── closeRoundsRound ─────────────────────────────────────────────────────────

export async function closeRoundsRound(roundId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: round } = await supabase
    .from('rounds')
    .select('tournament_id, round_number, status')
    .eq('id', roundId)
    .single() as {
      data: { tournament_id: string; round_number: number; status: string } | null
      error: unknown
    }

  if (!round) return { error: 'Round introuvable' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', round.tournament_id)
    .single() as {
      data: { created_by: string; type: string; status: string } | null
      error: unknown
    }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce round n'appartient pas à un tournoi rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  const { data: roundMatches } = await supabase
    .from('matches')
    .select('id, status')
    .eq('round_id', roundId) as { data: { id: string; status: string }[] | null; error: unknown }

  const allDone = roundMatches?.every((m) => m.status === 'done' || m.status === 'bye')
  if (!allDone) return { error: 'Tous les matchs doivent être terminés avant de clôturer' }

  await supabase.from('rounds').update({ status: 'finished' }).eq('id', roundId)

  // Garantie : recalcul des standings à la clôture (au cas où un reset aurait
  // laissé les stats désynchronisées), puis mise à jour du suivi des byes.
  await recalculateRoundsStandings(supabase, round.tournament_id)
  await updateRoundsByeTracking(
    supabase,
    round.tournament_id,
    roundId,
    round.round_number,
  )

  revalidatePath(`/tournaments/${round.tournament_id}`)
  return { success: true }
}

// ─── finishRoundsTournament ───────────────────────────────────────────────────

export async function finishRoundsTournament(tournamentId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', tournamentId)
    .single() as {
      data: { created_by: string; type: string; status: string } | null
      error: unknown
    }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  // Vérifier qu'il n'y a pas de round en cours non-clôturé
  const { data: openRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'ongoing')
    .limit(1)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (openRound) return { error: 'Clôturez le round en cours avant de terminer le tournoi.' }

  await supabase
    .from('tournaments')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', tournamentId)

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── getAddablePlayers ────────────────────────────────────────────────────────

export interface AddablePlayer { id: string; name: string; level: number }

/**
 * Liste les joueurs du roster de l'organisateur qui ne sont pas encore inscrits
 * au tournoi — candidats à une entrée en cours de route.
 */
export async function getAddablePlayers(
  tournamentId: string,
): Promise<{ players?: AddablePlayer[]; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié' }

  const [{ data: existing }, { data: roster }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('player_id')
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: { player_id: string }[] | null; error: unknown }>,
    supabase
      .from('players')
      .select('id, name, level')
      .eq('created_by', user.id)
      .order('name', { ascending: true }) as unknown as Promise<{ data: AddablePlayer[] | null; error: unknown }>,
  ])

  const taken = new Set((existing ?? []).map((e) => e.player_id))
  return { players: (roster ?? []).filter((p) => !taken.has(p.id)) }
}

// ─── addLatePlayerToRounds ────────────────────────────────────────────────────

/**
 * Inscrit un joueur arrivé en retard dans un tournoi par rounds déjà en cours.
 * Il sera intégré dès le prochain round généré. Ses stats démarrent à zéro avec
 * `consecutive_played = 0`, ce qui le rend prioritaire pour jouer (et non pour
 * attendre) au round suivant.
 */
export async function addLatePlayerToRounds(
  tournamentId: string,
  playerId: string,
): Promise<{ success?: boolean; error?: string }> {
  const parsed = AddLatePlayerSchema.safeParse({ tournamentId, playerId })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', tournamentId)
    .single() as { data: Pick<Tournament, 'created_by' | 'type' | 'status'> | null; error: unknown }

  if (!tournament || !(await canManageTournament(supabase, tournament.created_by, user.id))) return { error: 'Permission refusée' }
  if (tournament.type !== 'rounds') return { error: "Ce tournoi n'est pas en mode rounds" }
  if (tournament.status !== 'ongoing') return { error: "Le tournoi n'est pas en cours" }

  // Le joueur doit appartenir au roster de l'organisateur.
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('id', playerId)
    .eq('created_by', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!player) return { error: 'Joueur introuvable' }

  // Déjà inscrit ?
  const { data: already } = await supabase
    .from('tournament_players')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (already) return { error: 'Ce joueur est déjà inscrit au tournoi' }

  // Seed = dernier + 1 (placé en fin de liste initiale).
  const { data: seedRows } = await supabase
    .from('tournament_players')
    .select('seed')
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: false })
    .limit(1) as { data: { seed: number | null }[] | null; error: unknown }
  const maxSeed = seedRows?.[0]?.seed ?? 0

  const { error: insertError } = await supabase
    .from('tournament_players')
    .insert({ tournament_id: tournamentId, player_id: playerId, seed: maxSeed + 1, is_active: true })
  if (insertError) {
    console.error('addLatePlayerToRounds insert:', insertError.code, insertError.message)
    return { error: insertError.message }
  }

  // Si le round 1 est déjà lancé, player_tournament_stats est initialisé : il faut
  // y ajouter le joueur, sinon getRoundsPlayers (qui lit cette table) l'ignorerait.
  const { count } = await supabase
    .from('player_tournament_stats')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  if ((count ?? 0) > 0) {
    const [{ data: rankRows }, { count: finishedRounds }] = await Promise.all([
      supabase
        .from('player_tournament_stats')
        .select('current_rank')
        .eq('tournament_id', tournamentId)
        .order('current_rank', { ascending: false })
        .limit(1) as unknown as Promise<{ data: { current_rank: number | null }[] | null; error: unknown }>,
      supabase
        .from('rounds')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .eq('status', 'finished'),
    ])
    const maxRank = rankRows?.[0]?.current_rank ?? (count ?? 0)

    const { error: statsError } = await supabase.from('player_tournament_stats').insert({
      tournament_id: tournamentId,
      player_id: playerId,
      total_wins: 0,
      total_points_for: 0,
      total_points_against: 0,
      rounds_played: 0,
      consecutive_played: 0,
      total_waited: finishedRounds ?? 0,
      last_waited_round: null,
      current_rank: maxRank + 1,
    })
    if (statsError) {
      console.error('addLatePlayerToRounds stats:', statsError.code, statsError.message)
      return { error: statsError.message }
    }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}
