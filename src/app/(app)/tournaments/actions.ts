'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  CreateTournamentSchema,
  ClassicConfigSchema,
  RoundsConfigSchema,
  AmericanConfigSchema,
  DeleteTournamentSchema,
  UpdateTournamentSchema,
} from '@/lib/validations/schemas'
import {
  generateAmericanRound,
  createEmptyHistory,
} from '@/lib/algorithms/american-scheduler'
import { insertAmericanTeam, generateClassicPools } from '@/lib/tournament-db'
import type { AmericanConfig, ClassicConfig, RoundsConfig } from '@/types/app'

// Paire d'équipe (classique double) transmise par le wizard.
interface ClassicTeamPair {
  player1Id: string
  player2Id?: string
  name?: string
}

export async function createTournament(input: unknown) {
  const parsed = CreateTournamentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { name, type, playerIds, config, teams } = parsed.data

  // 1. Insert tournament
  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .insert({ name, type, config, created_by: user.id })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (tError || !tournament) {
    console.error('createTournament insert:', tError)
    return { error: 'Impossible de créer le tournoi' }
  }

  const tournamentId = tournament.id

  // 2. Insert tournament_players with seeds
  const { error: tpError } = await supabase.from('tournament_players').insert(
    playerIds.map((pid, i) => ({
      tournament_id: tournamentId,
      player_id: pid,
      seed: i + 1,
    }))
  )

  if (tpError) {
    console.error('createTournament players:', tpError)
    await supabase.from('tournaments').delete().eq('id', tournamentId)
    return { error: "Impossible d'associer les joueurs" }
  }

  // 3. Generate initial rounds / bracket
  try {
    if (type === 'american') {
      const americanConfig = AmericanConfigSchema.parse(config) as AmericanConfig
      await insertAmericanRound1(supabase, tournamentId, playerIds, americanConfig)
    } else if (type === 'rounds') {
      const roundsConfig = RoundsConfigSchema.parse(config) as RoundsConfig
      await insertRoundsRound1(supabase, tournamentId, playerIds, roundsConfig)
    } else {
      const classicConfig = ClassicConfigSchema.parse(config) as ClassicConfig
      await setupClassicTeams(supabase, tournamentId, playerIds, classicConfig, teams)
    }
  } catch (err) {
    console.error('createTournament generate:', err)
    await supabase.from('tournaments').delete().eq('id', tournamentId)
    return {
      error: err instanceof Error ? err.message : 'Erreur lors de la génération des matchs',
    }
  }

  revalidatePath('/tournaments')
  revalidatePath('/dashboard')
  redirect(`/tournaments/${tournamentId}`)
}

// ─── American : génère round 1 avec équipes temporaires ──────────────────────

async function insertAmericanRound1(
  supabase: SupabaseClient,
  tournamentId: string,
  playerIds: string[],
  config: AmericanConfig
) {
  const history = createEmptyHistory()
  const byeHistory = new Map<string, number>()
  const { matches, byePlayers } = generateAmericanRound(playerIds, history, byeHistory, {
    format: config.format,
    courtsAvailable: config.courtsAvailable,
  })

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: 1, status: 'ongoing' })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (roundError || !round) throw new Error('Impossible de créer le round 1')

  for (const match of matches) {
    const t1id = await insertAmericanTeam(supabase, tournamentId, match.team1)
    const t2id = await insertAmericanTeam(supabase, tournamentId, match.team2)
    await supabase.from('matches').insert({
      round_id: round.id,
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
        round_id: round.id,
        tournament_id: tournamentId,
        team1_id: byeTeam.id,
        team2_id: null,
        status: 'bye',
      })
    }
  }

  // Passer le tournoi en ongoing
  await supabase
    .from('tournaments')
    .update({ status: 'ongoing', started_at: new Date().toISOString() })
    .eq('id', tournamentId)
}

// ─── Rounds : démarre le tournoi sans créer de round ─────────────────────────
// Le round 1 est lancé manuellement via le tirage de raquette dans le dashboard.

async function insertRoundsRound1(
  supabase: SupabaseClient,
  tournamentId: string,
  _playerIds: string[],
  _config: RoundsConfig
) {
  await supabase
    .from('tournaments')
    .update({ status: 'ongoing', started_at: new Date().toISOString() })
    .eq('id', tournamentId)
}

// ─── Classic : crée les équipes permanentes et passe en phase poule ───────────
// Les poules (répartition + matchs round-robin) sont générées à l'étape suivante
// par createClassicTournament (classic-actions.ts). Ici on se contente de
// matérialiser les équipes choisies et de basculer le tournoi en phase 'pool'.

async function setupClassicTeams(
  supabase: SupabaseClient,
  tournamentId: string,
  playerIds: string[],
  config: ClassicConfig,
  teamPairs?: ClassicTeamPair[]
) {
  interface TeamRow {
    tournament_id: string
    player1_id: string
    player2_id: string | null
    name: string | null
    is_temporary: boolean
  }

  let teamRows: TeamRow[]
  if (config.format === 'singles') {
    teamRows = playerIds.map((pid) => ({
      tournament_id: tournamentId,
      player1_id: pid,
      player2_id: null,
      name: null,
      is_temporary: false,
    }))
  } else {
    const pairs: ClassicTeamPair[] =
      teamPairs && teamPairs.length > 0
        ? teamPairs
        : // Repli : appariement séquentiel si aucune paire explicite fournie.
          Array.from({ length: Math.ceil(playerIds.length / 2) }, (_, i) => ({
            player1Id: playerIds[2 * i]!,
            player2Id: playerIds[2 * i + 1],
          }))
    teamRows = pairs.map((pair) => ({
      tournament_id: tournamentId,
      player1_id: pair.player1Id,
      player2_id: pair.player2Id ?? null,
      name: pair.name ?? null,
      is_temporary: false,
    }))
  }

  const teamCount = teamRows.length
  if (teamCount < 4) {
    throw new Error(`Nombre d'équipes invalide : ${teamCount} (minimum 4 requis)`)
  }

  const { error: teamError } = await supabase.from('teams').insert(teamRows)
  if (teamError) {
    console.error('setupClassicTeams:', teamError.code, teamError.message)
    throw new Error('Impossible de créer les équipes')
  }

  // Génère immédiatement les poules (répartition serpent + matchs round-robin).
  await generateClassicPools(supabase, tournamentId)

  await supabase
    .from('tournaments')
    .update({ status: 'ongoing', current_phase: 'pool', started_at: new Date().toISOString() })
    .eq('id', tournamentId)
}

// ─── Update tournament (draft only) ──────────────────────────────────────────

export async function updateTournament(input: unknown) {
  const parsed = UpdateTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by, type, status')
    .eq('id', parsed.data.tournamentId)
    .single() as { data: { created_by: string; type: string; status: string } | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }
  if (tournament.status !== 'draft') return { error: 'Seuls les tournois en brouillon peuvent être modifiés' }

  // Valider le config selon le type du tournoi
  const configSchema =
    tournament.type === 'american' ? AmericanConfigSchema
    : tournament.type === 'classic' ? ClassicConfigSchema
    : RoundsConfigSchema
  const configParsed = configSchema.safeParse(parsed.data.config)
  if (!configParsed.success) return { error: 'Configuration invalide' }

  const { error } = await supabase
    .from('tournaments')
    .update({ name: parsed.data.name, config: configParsed.data })
    .eq('id', parsed.data.tournamentId)

  if (error) {
    console.error('updateTournament:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath(`/tournaments/${parsed.data.tournamentId}`)
  revalidatePath('/tournaments')
  return { success: true }
}

// ─── Delete tournament ────────────────────────────────────────────────────────

export async function deleteTournament(input: unknown) {
  const parsed = DeleteTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // Vérifier la propriété avant de supprimer
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', parsed.data.tournamentId)
    .single() as { data: { created_by: string } | null; error: unknown }

  if (!tournament || tournament.created_by !== user.id) return { error: 'Permission refusée' }

  // Supprimer en cascade avec le service role (contournement RLS intentionnel)
  const service = createServiceRoleClient()
  const tid = parsed.data.tournamentId

  await service.from('round_bye').delete().eq('tournament_id', tid)
  await service.from('player_tournament_stats').delete().eq('tournament_id', tid)
  await service.from('standings').delete().eq('tournament_id', tid)
  await service.from('matches').delete().eq('tournament_id', tid)
  await service.from('teams').delete().eq('tournament_id', tid)
  await service.from('rounds').delete().eq('tournament_id', tid)
  await service.from('tournament_players').delete().eq('tournament_id', tid)
  const { error: delError } = await service.from('tournaments').delete().eq('id', tid)

  if (delError) {
    console.error('deleteTournament:', delError.code, delError.message)
    return { error: 'Impossible de supprimer le tournoi' }
  }

  revalidatePath('/tournaments')
  revalidatePath('/dashboard')
  return { success: true }
}

