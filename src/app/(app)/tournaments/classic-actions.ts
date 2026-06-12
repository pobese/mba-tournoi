'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  SubmitClassicScoreSchema,
  ResetMatchScoreSchema,
  MoveTeamToPoolSchema,
  ClosePoolSchema,
  GenerateBracketSchema,
  UpdateClassicFormatSchema,
  AssignCourtToPoolSchema,
  ReleaseCourtFromPoolSchema,
  ReleaseAllCourtsFromPoolSchema,
  RedistributeFreeCourtsSchema,
  SetMatchCourtSchema,
} from '@/lib/validations/schemas'
import {
  generateClassicPools,
  recalculatePoolStandings,
  dispatchPoolCourts,
  dispatchBracketCourts,
} from '@/lib/tournament-db'
import {
  generatePoolMatches,
  calculateGlobalStandings,
  detectBracketSize,
  generateBracket,
  planPoolCourtRedistribution,
  type PoolStanding,
  type PoolCourtState,
} from '@/lib/algorithms/classic-bracket'
import type { ClassicConfig } from '@/types/app'
import { canManageTournament } from '@/lib/permissions'

// ─── Helpers communs ──────────────────────────────────────────────────────────

// Auth + droit de gestion + colonnes demandées du tournoi en UN passage réseau :
// getUser() et le SELECT tournaments partent en parallèle, et les actions qui
// ont besoin d'autres colonnes (config, current_phase…) les récupèrent ici au
// lieu de refaire un SELECT. `columns` doit inclure `created_by`.
// Autorise le créateur ET les membres acceptés de son organisation.
async function fetchOwnedTournament<T extends { created_by: string }>(
  supabase: SupabaseClient,
  tournamentId: string,
  columns: string,
): Promise<{ error: string } | { error: null; tournament: T }> {
  const [auth, result] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('tournaments').select(columns).eq('id', tournamentId).single(),
  ])
  if (auth.error || !auth.data.user) redirect('/login')

  // Cast : client Supabase non typé <Database> — shape garantie par `columns`.
  const tournament = result.data as T | null
  if (!tournament) return { error: 'Permission refusée' }
  if (!(await canManageTournament(supabase, tournament.created_by, auth.data.user.id))) {
    return { error: 'Permission refusée' }
  }
  return { error: null, tournament }
}

// Vérifie l'authentification et le droit de gestion (créateur OU membre).
async function assertOwner(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<{ error: string } | null> {
  const res = await fetchOwnedTournament<{ created_by: string }>(supabase, tournamentId, 'created_by')
  return res.error !== null ? { error: res.error } : null
}

// Vainqueur (1 ou 2) d'après les sets gagnés, totaux de points par équipe.
function resolveScore(sets: Array<{ t1: number; t2: number }>): {
  setsWon1: number; setsWon2: number; total1: number; total2: number; winner: 1 | 2 | null
} {
  let setsWon1 = 0, setsWon2 = 0, total1 = 0, total2 = 0
  for (const s of sets) {
    total1 += s.t1
    total2 += s.t2
    if (s.t1 > s.t2) setsWon1++
    else if (s.t2 > s.t1) setsWon2++
  }
  const winner = setsWon1 > setsWon2 ? 1 : setsWon2 > setsWon1 ? 2 : null
  return { setsWon1, setsWon2, total1, total2, winner }
}

// Colonnes set1..set3 à partir d'un tableau de sets.
function setColumns(sets: Array<{ t1: number; t2: number }>) {
  return {
    set1_team1: sets[0]?.t1 ?? null, set1_team2: sets[0]?.t2 ?? null,
    set2_team1: sets[1]?.t1 ?? null, set2_team2: sets[1]?.t2 ?? null,
    set3_team1: sets[2]?.t1 ?? null, set3_team2: sets[2]?.t2 ?? null,
  }
}

// ─── createClassicTournament ──────────────────────────────────────────────────

/**
 * Génère les poules d'un tournoi classique (idempotent). Normalement déjà
 * appelé à la création ; exposé pour re-déclenchement manuel si besoin.
 */
export async function createClassicTournament(tournamentId: string) {
  const supabase = await createServerSupabaseClient()
  const res = await fetchOwnedTournament<{ created_by: string; type: string; current_phase: string }>(
    supabase, tournamentId, 'created_by, type, current_phase',
  )
  if (res.error !== null) return { error: res.error }
  if (res.tournament.type !== 'classic') return { error: 'Ce tournoi n\'est pas en mode classique' }
  if (res.tournament.current_phase !== 'pool') return { error: 'Les poules ne sont plus modifiables' }

  try {
    await generateClassicPools(supabase, tournamentId)
  } catch (err) {
    console.error('createClassicTournament:', err)
    return { error: err instanceof Error ? err.message : 'Erreur lors de la génération des poules' }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── moveTeamToPool ───────────────────────────────────────────────────────────

/**
 * Déplace une équipe dans une autre poule (correction de la répartition auto).
 * Régénère les matchs et réinitialise les classements des deux poules touchées.
 */
export async function moveTeamToPool(teamId: string, targetPoolId: string) {
  const parsed = MoveTeamToPoolSchema.safeParse({ teamId, targetPoolId })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()

  const { data: team } = await supabase
    .from('teams')
    .select('id, tournament_id, pool_id')
    .eq('id', teamId)
    .single() as { data: { id: string; tournament_id: string; pool_id: string | null } | null; error: unknown }
  if (!team) return { error: 'Équipe introuvable' }

  // Owner + phase + poule cible vérifiés en parallèle (3 → 1 aller-retour).
  const [res, { data: targetPool }] = await Promise.all([
    fetchOwnedTournament<{ created_by: string; current_phase: string }>(
      supabase, team.tournament_id, 'created_by, current_phase',
    ),
    supabase
      .from('pools')
      .select('id, tournament_id')
      .eq('id', targetPoolId)
      .single() as unknown as Promise<{ data: { id: string; tournament_id: string } | null; error: unknown }>,
  ])
  if (res.error !== null) return { error: res.error }
  if (res.tournament.current_phase !== 'pool') return { error: 'Le tournoi n\'est plus en phase de poules' }

  // La poule cible doit appartenir au même tournoi.
  if (!targetPool || targetPool.tournament_id !== team.tournament_id) {
    return { error: 'Poule cible invalide' }
  }

  const oldPoolId = team.pool_id
  if (oldPoolId === targetPoolId) return { success: true }

  // Déplacer l'équipe.
  await supabase.from('teams').update({ pool_id: targetPoolId }).eq('id', teamId)

  // Régénérer les deux poules affectées (matchs + classements).
  const affected = [oldPoolId, targetPoolId].filter(Boolean) as string[]
  for (const poolId of affected) {
    await regeneratePoolMatches(supabase, team.tournament_id, poolId)
  }

  revalidatePath(`/tournaments/${team.tournament_id}`)
  return { success: true }
}

// Supprime et recrée les matchs round-robin d'une poule, réinitialise ses stats.
async function regeneratePoolMatches(
  supabase: SupabaseClient,
  tournamentId: string,
  poolId: string,
): Promise<void> {
  const { data: members } = await supabase
    .from('teams')
    .select('id')
    .eq('pool_id', poolId) as { data: { id: string }[] | null; error: unknown }
  const teamIds = (members ?? []).map((m) => m.id)

  // Purger les matchs et classements existants de la poule.
  await supabase.from('matches').delete().eq('pool_id', poolId)
  await supabase.from('pool_standings').delete().eq('pool_id', poolId)

  if (teamIds.length === 0) return

  const matchRows = generatePoolMatches(poolId, teamIds.map((id) => ({ id }))).map((m) => ({
    tournament_id: tournamentId, pool_id: poolId, phase: 'pool',
    team1_id: m.team1Id, team2_id: m.team2Id, status: 'pending',
  }))
  if (matchRows.length > 0) await supabase.from('matches').insert(matchRows)

  await supabase.from('pool_standings').insert(
    teamIds.map((id) => ({ tournament_id: tournamentId, pool_id: poolId, team_id: id })),
  )

  // Les matchs régénérés repartent sans terrain → redéclencher l'attribution.
  await dispatchPoolCourts(supabase, poolId)
}

// ─── submitPoolMatchScore ─────────────────────────────────────────────────────

export async function submitPoolMatchScore(
  matchId: string,
  sets: Array<{ t1: number; t2: number }>,
) {
  const parsed = SubmitClassicScoreSchema.safeParse({ matchId, sets })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('id, tournament_id, pool_id, phase, team1_id, team2_id')
    .eq('id', matchId)
    .single() as {
      data: { id: string; tournament_id: string; pool_id: string | null; phase: string; team1_id: string | null; team2_id: string | null } | null
      error: unknown
    }
  if (!match) return { error: 'Match introuvable' }
  if (match.phase !== 'pool' || !match.pool_id) return { error: 'Ce match n\'est pas un match de poule' }

  // Auth + config (courtsAvailable, pour une éventuelle redistribution) en 1 appel.
  const res = await fetchOwnedTournament<{ created_by: string; config: ClassicConfig }>(supabase, match.tournament_id, 'created_by, config')
  if (res.error !== null) return { error: res.error }

  const { winner, total1, total2 } = resolveScore(sets)
  const winnerTeamId = winner === 1 ? match.team1_id : winner === 2 ? match.team2_id : null

  const { error: updateError } = await supabase
    .from('matches')
    .update({
      ...setColumns(sets),
      score_team1: total1,
      score_team2: total2,
      winner_team_id: winnerTeamId,
      status: 'done',
    })
    .eq('id', matchId)

  if (updateError) {
    console.error('submitPoolMatchScore:', updateError.code, updateError.message)
    return { error: updateError.message }
  }

  // Classement + réattribution du terrain libéré au prochain match en attente
  // (équipes non occupées, priorité aux moins servies) — en parallèle.
  await Promise.all([
    recalculatePoolStandings(supabase, match.pool_id),
    dispatchPoolCourts(supabase, match.pool_id),
  ])

  // Si la poule vient de jouer son dernier match → ses terrains sont libérés et
  // redistribués aux poules encore en jeu. Le résumé est renvoyé pour l'annonce.
  let redistribution: CourtRedistributionSummary | undefined
  const { count: pendingLeft } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', match.pool_id)
    .eq('status', 'pending')
  if ((pendingLeft ?? 0) === 0) {
    redistribution = await applyCourtRedistribution(supabase, match.tournament_id, res.tournament.config?.courtsAvailable ?? 0)
  }

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true, redistribution }
}

// ─── resetPoolMatchScore ──────────────────────────────────────────────────────

export async function resetPoolMatchScore(matchId: string) {
  const parsed = ResetMatchScoreSchema.safeParse({ matchId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('id, tournament_id, pool_id')
    .eq('id', matchId)
    .single() as { data: { id: string; tournament_id: string; pool_id: string | null } | null; error: unknown }
  if (!match || !match.pool_id) return { error: 'Match de poule introuvable' }

  // Owner + statut de la poule vérifiés en parallèle.
  const [ownerErr, { data: pool }] = await Promise.all([
    assertOwner(supabase, match.tournament_id),
    supabase
      .from('pools')
      .select('status')
      .eq('id', match.pool_id)
      .single() as unknown as Promise<{ data: { status: string } | null; error: unknown }>,
  ])
  if (ownerErr) return ownerErr

  // La poule ne doit pas être clôturée.
  if (pool?.status === 'finished') return { error: 'La poule est clôturée' }

  // court_number remis à null : le terrain a pu être réattribué depuis — le
  // match annulé redevient un candidat normal du dispatch.
  await supabase
    .from('matches')
    .update({
      status: 'pending',
      score_team1: null, score_team2: null, winner_team_id: null,
      set1_team1: null, set1_team2: null, set2_team1: null, set2_team2: null, set3_team1: null, set3_team2: null,
      court_number: null,
    })
    .eq('id', matchId)

  await Promise.all([
    recalculatePoolStandings(supabase, match.pool_id),
    dispatchPoolCourts(supabase, match.pool_id),
  ])

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── closePool ────────────────────────────────────────────────────────────────

export async function closePool(poolId: string) {
  const parsed = ClosePoolSchema.safeParse({ poolId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('id, tournament_id, status')
    .eq('id', poolId)
    .single() as { data: { id: string; tournament_id: string; status: string } | null; error: unknown }
  if (!pool) return { error: 'Poule introuvable' }

  const [ownerErr, { data: matches }] = await Promise.all([
    assertOwner(supabase, pool.tournament_id),
    supabase
      .from('matches')
      .select('status')
      .eq('pool_id', poolId) as unknown as Promise<{ data: { status: string }[] | null; error: unknown }>,
  ])
  if (ownerErr) return ownerErr

  const allDone = (matches ?? []).every((m) => m.status === 'done')
  if (!allDone) return { error: 'Tous les matchs de la poule doivent être terminés' }

  // Recalcul du classement, clôture de la poule et libération automatique de
  // ses terrains : indépendants entre eux → en parallèle.
  await Promise.all([
    recalculatePoolStandings(supabase, poolId),
    supabase.from('pools').update({ status: 'finished' }).eq('id', poolId),
    releasePoolCourts(supabase, poolId),
  ])

  revalidatePath(`/tournaments/${pool.tournament_id}`)
  return { success: true }
}

// ════════════════════════════════════════════════════════════════════════════
// GESTION DES TERRAINS — assignation dynamique terrain → poule (pool_courts)
// ════════════════════════════════════════════════════════════════════════════

// Supprime toutes les assignations de terrains d'une poule et remet en file
// ses matchs en attente (helper interne).
async function releasePoolCourts(supabase: SupabaseClient, poolId: string): Promise<void> {
  const [delRes] = await Promise.all([
    supabase
      .from('pool_courts')
      .delete()
      .eq('pool_id', poolId) as unknown as Promise<{ error: { code: string; message: string } | null }>,
    supabase
      .from('matches')
      .update({ court_number: null })
      .eq('pool_id', poolId)
      .eq('status', 'pending'),
  ])
  if (delRes.error) console.error('releasePoolCourts:', delRes.error.code, delRes.error.message)
}

// ─── assignCourtToPool ──────────────────────────────────────────────────────────

/**
 * Assigne un terrain à une poule. Si le terrain est déjà rattaché à une autre
 * poule du même tournoi, il est déplacé (UPDATE) — la contrainte
 * UNIQUE(tournament_id, court_number) garantit l'unicité.
 */
export async function assignCourtToPool(
  tournamentId: string,
  poolId: string,
  courtNumber: number,
) {
  const parsed = AssignCourtToPoolSchema.safeParse({ tournamentId, poolId, courtNumber })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()

  // Owner + config + poule cible + assignation existante : 4 → 1 aller-retour.
  const [res, { data: pool }, { data: existing }] = await Promise.all([
    fetchOwnedTournament<{ created_by: string; config: ClassicConfig }>(supabase, tournamentId, 'created_by, config'),
    supabase
      .from('pools')
      .select('id, tournament_id, status')
      .eq('id', poolId)
      .single() as unknown as Promise<{ data: { id: string; tournament_id: string; status: string } | null; error: unknown }>,
    supabase
      .from('pool_courts')
      .select('id, pool_id')
      .eq('tournament_id', tournamentId)
      .eq('court_number', courtNumber)
      .maybeSingle() as unknown as Promise<{ data: { id: string; pool_id: string } | null; error: unknown }>,
  ])
  if (res.error !== null) return { error: res.error }

  // La poule cible doit appartenir au tournoi et être encore en cours.
  if (!pool || pool.tournament_id !== tournamentId) return { error: 'Poule invalide' }
  if (pool.status !== 'ongoing') return { error: 'La poule est clôturée' }

  // Le terrain doit exister dans la configuration du tournoi.
  const courtsAvailable = res.tournament.config?.courtsAvailable ?? 0
  if (courtNumber > courtsAvailable) return { error: `Terrain ${courtNumber} hors configuration (${courtsAvailable} terrains)` }

  // Terrain déjà assigné dans ce tournoi ? → déplacer ; sinon → créer.

  if (existing) {
    if (existing.pool_id === poolId) return { success: true }
    const { error } = await supabase
      .from('pool_courts')
      .update({ pool_id: poolId })
      .eq('id', existing.id)
    if (error) {
      console.error('assignCourtToPool update:', error.code, error.message, error.hint)
      return { error: error.message }
    }
  } else {
    const { error } = await supabase
      .from('pool_courts')
      .insert({ tournament_id: tournamentId, pool_id: poolId, court_number: courtNumber })
    if (error) {
      console.error('assignCourtToPool insert:', error.code, error.message, error.hint)
      return { error: error.message }
    }
  }

  // Terrain déplacé depuis une autre poule : retirer son numéro des matchs en
  // attente de l'ancienne poule (ils repartent dans la file du dispatch).
  if (existing && existing.pool_id !== poolId) {
    await supabase
      .from('matches')
      .update({ court_number: null })
      .eq('pool_id', existing.pool_id)
      .eq('court_number', courtNumber)
      .eq('status', 'pending')
  }

  // Le nouveau terrain est attribué immédiatement à un match en attente.
  await dispatchPoolCourts(supabase, poolId)

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── releaseCourtFromPool ───────────────────────────────────────────────────────

/** Libère un terrain (le retire de toute poule du tournoi). */
export async function releaseCourtFromPool(tournamentId: string, courtNumber: number) {
  const parsed = ReleaseCourtFromPoolSchema.safeParse({ tournamentId, courtNumber })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const ownerErr = await assertOwner(supabase, tournamentId)
  if (ownerErr) return ownerErr

  const { data: removed, error } = await supabase
    .from('pool_courts')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('court_number', courtNumber)
    .select('pool_id') as { data: { pool_id: string }[] | null; error: { code: string; message: string; hint: string | null } | null }
  if (error) {
    console.error('releaseCourtFromPool:', error.code, error.message, error.hint)
    return { error: error.message }
  }

  // Les matchs en attente qui référençaient ce terrain repartent dans la file.
  const oldPoolId = removed?.[0]?.pool_id
  if (oldPoolId) {
    await supabase
      .from('matches')
      .update({ court_number: null })
      .eq('pool_id', oldPoolId)
      .eq('court_number', courtNumber)
      .eq('status', 'pending')
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── releaseAllCourtsFromPool ───────────────────────────────────────────────────

/** Libère tous les terrains d'une poule (exposé pour gestion manuelle). */
export async function releaseAllCourtsFromPool(poolId: string) {
  const parsed = ReleaseAllCourtsFromPoolSchema.safeParse({ poolId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('id, tournament_id')
    .eq('id', poolId)
    .single() as { data: { id: string; tournament_id: string } | null; error: unknown }
  if (!pool) return { error: 'Poule introuvable' }

  const ownerErr = await assertOwner(supabase, pool.tournament_id)
  if (ownerErr) return ownerErr

  await releasePoolCourts(supabase, poolId)

  revalidatePath(`/tournaments/${pool.tournament_id}`)
  return { success: true }
}

// ─── Redistribution intelligente des terrains ────────────────────────────────

export interface CourtRedistributionMove { poolName: string; courts: number[] }
export interface CourtRedistributionSummary {
  moves: CourtRedistributionMove[]   // poules ayant gagné des terrains
  leisure: number[]                  // terrains libres « loisir »
}

/**
 * Cœur de la redistribution (sans auth — appelé par des actions déjà
 * authentifiées). Récupère les terrains des poules terminées et le surplus des
 * poules sur-dotées, les répartit entre les poules encore en jeu selon leur
 * capacité utile (cf. `planPoolCourtRedistribution`), le reste devient libre.
 */
async function applyCourtRedistribution(
  supabase: SupabaseClient,
  tournamentId: string,
  courtsAvailable: number,
): Promise<CourtRedistributionSummary> {
  if (courtsAvailable <= 0) return { moves: [], leisure: [] }

  type PoolRow = { id: string; name: string; position: number }
  const [{ data: poolsRaw }, { data: courtsRaw }, { data: matchesRaw }, { data: standingsRaw }] = await Promise.all([
    supabase.from('pools').select('id, name, position').eq('tournament_id', tournamentId).order('position', { ascending: true }) as unknown as Promise<{ data: PoolRow[] | null; error: unknown }>,
    supabase.from('pool_courts').select('pool_id, court_number').eq('tournament_id', tournamentId) as unknown as Promise<{ data: { pool_id: string; court_number: number }[] | null; error: unknown }>,
    supabase.from('matches').select('pool_id, status').eq('tournament_id', tournamentId).eq('phase', 'pool') as unknown as Promise<{ data: { pool_id: string | null; status: string }[] | null; error: unknown }>,
    supabase.from('pool_standings').select('pool_id').eq('tournament_id', tournamentId) as unknown as Promise<{ data: { pool_id: string }[] | null; error: unknown }>,
  ])

  const pools = poolsRaw ?? []
  if (pools.length === 0) return { moves: [], leisure: [] }

  const courtsByPool = new Map<string, number[]>()
  const allAssigned = new Set<number>()
  for (const c of courtsRaw ?? []) {
    if (!courtsByPool.has(c.pool_id)) courtsByPool.set(c.pool_id, [])
    courtsByPool.get(c.pool_id)!.push(c.court_number)
    allAssigned.add(c.court_number)
  }
  const pendingByPool = new Map<string, number>()
  for (const m of matchesRaw ?? []) {
    if (!m.pool_id || m.status === 'done') continue
    pendingByPool.set(m.pool_id, (pendingByPool.get(m.pool_id) ?? 0) + 1)
  }
  const teamsByPool = new Map<string, number>()
  for (const s of standingsRaw ?? []) teamsByPool.set(s.pool_id, (teamsByPool.get(s.pool_id) ?? 0) + 1)

  const states: PoolCourtState[] = pools.map((p) => ({
    poolId: p.id,
    position: p.position,
    teamCount: teamsByPool.get(p.id) ?? 0,
    pendingCount: pendingByPool.get(p.id) ?? 0,
    currentCourts: courtsByPool.get(p.id) ?? [],
  }))
  const freeCourts = Array.from({ length: courtsAvailable }, (_, i) => i + 1).filter((n) => !allAssigned.has(n))

  const plan = planPoolCourtRedistribution(states, freeCourts)

  // Diff final vs courant. Les DELETE de pool_courts passent AVANT les INSERT
  // (sinon un terrain déplacé A→B viole UNIQUE(tournament_id, court_number)).
  const deleteOps: Array<PromiseLike<unknown>> = []
  const insertRows: Array<{ tournament_id: string; pool_id: string; court_number: number }> = []
  const changedPools = new Set<string>()
  for (const a of plan.assignments) {
    const before = new Set(courtsByPool.get(a.poolId) ?? [])
    const after = new Set(a.courts)
    const toRemove = [...before].filter((c) => !after.has(c))
    const toAdd = a.courts.filter((c) => !before.has(c))
    if (toRemove.length === 0 && toAdd.length === 0) continue
    changedPools.add(a.poolId)
    if (toRemove.length > 0) {
      deleteOps.push(supabase.from('pool_courts').delete().eq('pool_id', a.poolId).in('court_number', toRemove))
      deleteOps.push(supabase.from('matches').update({ court_number: null }).eq('pool_id', a.poolId).in('court_number', toRemove).eq('status', 'pending'))
    }
    for (const c of toAdd) insertRows.push({ tournament_id: tournamentId, pool_id: a.poolId, court_number: c })
  }

  if (deleteOps.length === 0 && insertRows.length === 0) return { moves: [], leisure: plan.leisureCourts }

  await Promise.all(deleteOps)
  if (insertRows.length > 0) {
    const { error } = await supabase.from('pool_courts').insert(insertRows)
    if (error) console.error('applyCourtRedistribution insert:', error.code, error.message)
  }
  // Réattribue les terrains aux matchs en attente des poules modifiées.
  await Promise.all([...changedPools].map((id) => dispatchPoolCourts(supabase, id)))

  const nameOf = new Map(pools.map((p) => [p.id, p.name]))
  return {
    moves: plan.gained.map((g) => ({ poolName: nameOf.get(g.poolId) ?? 'Poule', courts: g.courts })),
    leisure: plan.leisureCourts,
  }
}

/**
 * Action publique : redistribue les terrains à la demande de l'organisateur.
 * Renvoie les mouvements (poule → terrains) + les terrains libres pour l'annonce.
 */
export async function redistributeFreeCourts(tournamentId: string) {
  const parsed = RedistributeFreeCourtsSchema.safeParse({ tournamentId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const res = await fetchOwnedTournament<{ created_by: string; config: ClassicConfig }>(supabase, tournamentId, 'created_by, config')
  if (res.error !== null) return { error: res.error }

  const summary = await applyCourtRedistribution(supabase, tournamentId, res.tournament.config?.courtsAvailable ?? 0)

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true, ...summary }
}

// ─── setMatchCourt ──────────────────────────────────────────────────────────────

/**
 * Assigne un terrain à un match de poule (ou le retire si courtNumber = null).
 * Le terrain doit faire partie des terrains de la poule du match (pool_courts).
 */
export async function setMatchCourt(matchId: string, courtNumber: number | null) {
  const parsed = SetMatchCourtSchema.safeParse({ matchId, courtNumber })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('id, tournament_id, pool_id, phase')
    .eq('id', matchId)
    .single() as { data: { id: string; tournament_id: string; pool_id: string | null; phase: string } | null; error: unknown }
  if (!match) return { error: 'Match introuvable' }
  if (match.phase !== 'pool' || !match.pool_id) return { error: 'Ce match n\'est pas un match de poule' }

  // Owner + appartenance du terrain à la poule vérifiés en parallèle.
  const [ownerErr, courtCheck] = await Promise.all([
    assertOwner(supabase, match.tournament_id),
    courtNumber === null
      ? Promise.resolve(null)
      : (supabase
          .from('pool_courts')
          .select('id')
          .eq('pool_id', match.pool_id)
          .eq('court_number', courtNumber)
          .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>),
  ])
  if (ownerErr) return ownerErr

  // Si on assigne (pas null), le terrain doit appartenir à la poule du match.
  if (courtNumber !== null && !courtCheck?.data) {
    return { error: 'Ce terrain n\'est pas assigné à cette poule' }
  }

  // Assignation manuelle : un terrain = un match à la fois → le retirer d'un
  // éventuel autre match en attente de la poule avant de l'attribuer.
  if (courtNumber !== null) {
    await supabase
      .from('matches')
      .update({ court_number: null })
      .eq('pool_id', match.pool_id)
      .eq('court_number', courtNumber)
      .eq('status', 'pending')
      .neq('id', matchId)
  }

  // NB : pas de re-dispatch après un retrait manuel (courtNumber null), sinon
  // l'automate réattribuerait aussitôt le terrain — le retrait serait impossible.
  const { error } = await supabase
    .from('matches')
    .update({ court_number: courtNumber })
    .eq('id', matchId)
  if (error) {
    console.error('setMatchCourt:', error.code, error.message, error.hint)
    return { error: error.message }
  }

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── updateClassicMatchFormat ─────────────────────────────────────────────────

export async function updateClassicMatchFormat(
  tournamentId: string,
  formatUpdate: { target: 'pool' | 'bracket' | 'both'; matchFormat: '1set' | '2sets'; targetScore: 15 | 21 },
) {
  const parsed = UpdateClassicFormatSchema.safeParse({ tournamentId, ...formatUpdate })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  // Owner + config en un seul passage.
  const res = await fetchOwnedTournament<{ created_by: string; config: ClassicConfig }>(
    supabase, tournamentId, 'created_by, config',
  )
  if (res.error !== null) return { error: res.error }
  const tournament = res.tournament

  // Le format est stocké dans la config ; les matchs joués gardent leurs scores,
  // les matchs à venir liront simplement la nouvelle config à la saisie.
  const { target, matchFormat, targetScore } = parsed.data
  const config: ClassicConfig = { ...tournament.config }
  if (target === 'pool' || target === 'both') {
    config.poolMatchFormat = matchFormat
    config.poolTargetScore = targetScore
  }
  if (target === 'bracket' || target === 'both') {
    config.bracketMatchFormat = matchFormat
    config.bracketTargetScore = targetScore
  }

  const { error } = await supabase.from('tournaments').update({ config }).eq('id', tournamentId)
  if (error) {
    console.error('updateClassicMatchFormat:', error.code, error.message)
    return { error: error.message }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── generateBracketFromStandings ─────────────────────────────────────────────

export async function generateBracketFromStandings(
  tournamentId: string,
  mode: 'barrage' | 'first_match_decides',
) {
  const parsed = GenerateBracketSchema.safeParse({ tournamentId, mode })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const res = await fetchOwnedTournament<{ created_by: string; type: string; current_phase: string; config: ClassicConfig }>(
    supabase, tournamentId, 'created_by, type, current_phase, config',
  )
  if (res.error !== null) return { error: res.error }
  if (res.tournament.type !== 'classic') return { error: 'Ce tournoi n\'est pas en mode classique' }
  if (res.tournament.current_phase === 'bracket') return { error: 'Le tableau a déjà été généré' }

  type StandingRow = {
    team_id: string
    wins: number; losses: number; sets_won: number; sets_lost: number
    points_for: number; points_against: number; matches_played: number; rank_in_pool: number | null
    team: { name: string | null; player1: { name: string } | null; player2: { name: string } | null } | null
  }

  // Statuts des poules + classements lus en parallèle.
  const [{ data: pools }, { data: rows }] = await Promise.all([
    supabase
      .from('pools')
      .select('id, status')
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: { id: string; status: string }[] | null; error: unknown }>,
    supabase
      .from('pool_standings')
      .select(`
        team_id, wins, losses, sets_won, sets_lost, points_for, points_against, matches_played, rank_in_pool,
        team:teams!pool_standings_team_id_fkey ( name, player1:players!teams_player1_id_fkey(name), player2:players!teams_player2_id_fkey(name) )
      `)
      .eq('tournament_id', tournamentId) as unknown as Promise<{ data: StandingRow[] | null; error: unknown }>,
  ])

  // Toutes les poules doivent être clôturées.
  if (!pools || pools.length === 0) return { error: 'Aucune poule trouvée' }
  if (!pools.every((p) => p.status === 'finished')) {
    return { error: 'Toutes les poules doivent être clôturées avant de générer le tableau' }
  }

  // Classement global à partir des classements de poule.

  const poolStandings: PoolStanding[] = (rows ?? []).map((r) => ({
    teamId: r.team_id,
    teamName: r.team?.name ?? (r.team?.player1 && r.team?.player2 ? `${r.team.player1.name} / ${r.team.player2.name}` : r.team?.player1?.name ?? '—'),
    wins: r.wins, losses: r.losses, setsWon: r.sets_won, setsLost: r.sets_lost,
    pointsFor: r.points_for, pointsAgainst: r.points_against, matchesPlayed: r.matches_played,
    rankInPool: r.rank_in_pool ?? 0,
  }))

  if (poolStandings.length < 4) return { error: 'Au moins 4 équipes requises pour le tableau' }

  const globalStandings = calculateGlobalStandings(poolStandings)
  const sizing = detectBracketSize(globalStandings.length)
  const structure = generateBracket(
    globalStandings.map((g) => ({ teamId: g.teamId })),
    sizing,
    mode,
  )

  const allNodes = [...structure.mainBracket, ...structure.consolante, ...structure.barrages]

  try {
    // 1re passe : insertion EN MASSE de tous les matchs (1 requête au lieu de N
    // inserts séquentiels). PostgREST renvoie les lignes insérées dans l'ordre
    // d'envoi → mapping node.id → id en base par index.
    const { data: inserted, error: insertError } = await supabase
      .from('matches')
      .insert(
        allNodes.map((node) => ({
          tournament_id: tournamentId,
          phase: node.phase,
          bracket: node.phase === 'bracket_consolante' ? 'consolante' : 'main',
          bracket_position: node.bracketPosition,
          position: node.bracketPosition,
          team1_id: node.team1Id,
          team2_id: node.team2Id,
          status: 'pending',
        })),
      )
      .select('id') as { data: { id: string }[] | null; error: { code: string; message: string; hint: string | null } | null }
    if (insertError || !inserted || inserted.length !== allNodes.length) {
      console.error('generateBracketFromStandings insert:', insertError?.code, insertError?.message, insertError?.hint)
      throw new Error('Impossible de créer les matchs du tableau')
    }
    // safe because: inserted.length === allNodes.length vérifié ci-dessus.
    const nodeToDbId = new Map<string, string>(allNodes.map((node, i) => [node.id, inserted[i]!.id]))

    // 2e passe : références croisées (gagnant/perdant).
    await Promise.all(
      allNodes.map((node) => {
        const winnerTo = node.winnerAdvancesTo ? nodeToDbId.get(node.winnerAdvancesTo) ?? null : null
        const loserTo = node.loserGoesTo ? nodeToDbId.get(node.loserGoesTo) ?? null : null
        if (winnerTo === null && loserTo === null) return Promise.resolve()
        return supabase
          .from('matches')
          .update({ winner_advances_to: winnerTo, loser_goes_to: loserTo })
          .eq('id', nodeToDbId.get(node.id)!)
      }),
    )

    // global_rank dans pool_standings.
    await Promise.all(
      globalStandings.map((g) =>
        supabase
          .from('pool_standings')
          .update({ global_rank: g.globalRank })
          .eq('tournament_id', tournamentId)
          .eq('team_id', g.teamId),
      ),
    )

    await supabase.from('tournaments').update({ current_phase: 'bracket' }).eq('id', tournamentId)

    // Attribution initiale des terrains : barrages d'abord, puis tableau principal.
    await dispatchBracketCourts(supabase, tournamentId, res.tournament.config?.courtsAvailable ?? 0)
  } catch (err) {
    console.error('generateBracketFromStandings:', err)
    return { error: err instanceof Error ? err.message : 'Erreur lors de la génération du tableau' }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  return { success: true }
}

// ─── submitBracketMatchScore ──────────────────────────────────────────────────

export async function submitBracketMatchScore(
  matchId: string,
  sets: Array<{ t1: number; t2: number }>,
) {
  const parsed = SubmitClassicScoreSchema.safeParse({ matchId, sets })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('id, tournament_id, phase, team1_id, team2_id, winner_advances_to, loser_goes_to')
    .eq('id', matchId)
    .single() as {
      data: {
        id: string; tournament_id: string; phase: string
        team1_id: string | null; team2_id: string | null
        winner_advances_to: string | null; loser_goes_to: string | null
      } | null
      error: unknown
    }
  if (!match) return { error: 'Match introuvable' }
  if (!match.phase.startsWith('bracket') && match.phase !== 'barrage') {
    return { error: 'Ce match n\'appartient pas au tableau' }
  }

  // Auth + config (pour le re-dispatch des terrains) en un appel.
  const res = await fetchOwnedTournament<{ created_by: string; config: ClassicConfig }>(supabase, match.tournament_id, 'created_by, config')
  if (res.error !== null) return { error: res.error }

  const { winner, total1, total2 } = resolveScore(sets)
  if (winner === null) return { error: 'Le match doit avoir un vainqueur' }
  const winnerTeamId = winner === 1 ? match.team1_id : match.team2_id
  const loserTeamId = winner === 1 ? match.team2_id : match.team1_id

  // court_number remis à null : le match terminé libère son terrain.
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      ...setColumns(sets),
      score_team1: total1,
      score_team2: total2,
      winner_team_id: winnerTeamId,
      status: 'done',
      court_number: null,
    })
    .eq('id', matchId)
  if (updateError) {
    console.error('submitBracketMatchScore:', updateError.code, updateError.message)
    return { error: updateError.message }
  }

  // Progression automatique : placer gagnant et perdant dans les matchs suivants.
  if (winnerTeamId && match.winner_advances_to) {
    await placeTeamIntoMatch(supabase, match.winner_advances_to, winnerTeamId)
  }
  if (loserTeamId && match.loser_goes_to) {
    await placeTeamIntoMatch(supabase, match.loser_goes_to, loserTeamId)
  }

  // Le terrain libéré est attribué aux matchs devenus prêts (barrages > principal).
  await dispatchBracketCourts(supabase, match.tournament_id, res.tournament.config?.courtsAvailable ?? 0)

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// ─── resetBracketMatchScore ───────────────────────────────────────────────────

/**
 * Annule le score d'un match du tableau (correction de saisie). Refusé si un
 * match suivant (destination du gagnant ou du perdant) a déjà été joué — il
 * faudrait l'annuler d'abord. Retire les équipes avancées des matchs suivants.
 */
export async function resetBracketMatchScore(matchId: string) {
  const parsed = ResetMatchScoreSchema.safeParse({ matchId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('id, tournament_id, phase, status, team1_id, team2_id, winner_team_id, winner_advances_to, loser_goes_to')
    .eq('id', matchId)
    .single() as {
      data: {
        id: string; tournament_id: string; phase: string; status: string
        team1_id: string | null; team2_id: string | null; winner_team_id: string | null
        winner_advances_to: string | null; loser_goes_to: string | null
      } | null
      error: unknown
    }
  if (!match) return { error: 'Match introuvable' }
  if (!match.phase.startsWith('bracket') && match.phase !== 'barrage') {
    return { error: 'Ce match n\'appartient pas au tableau' }
  }
  if (match.status !== 'done') return { error: 'Ce match n\'a pas encore de score' }

  type SuccessorRow = { id: string; status: string; team1_id: string | null; team2_id: string | null }
  const successorIds = [match.winner_advances_to, match.loser_goes_to].filter(
    (id): id is string => id !== null,
  )

  // Owner + config + lecture des matchs suivants en parallèle.
  const [res, successorsRes] = await Promise.all([
    fetchOwnedTournament<{ created_by: string; config: ClassicConfig }>(supabase, match.tournament_id, 'created_by, config'),
    successorIds.length > 0
      ? (supabase
          .from('matches')
          .select('id, status, team1_id, team2_id')
          .in('id', successorIds) as unknown as Promise<{ data: SuccessorRow[] | null; error: unknown }>)
      : Promise.resolve({ data: [] as SuccessorRow[], error: null }),
  ])
  if (res.error !== null) return { error: res.error }

  const successors = successorsRes.data ?? []
  if (successors.some((s) => s.status === 'done')) {
    return { error: 'Le match suivant a déjà été joué — annulez-le d\'abord' }
  }

  // Quelle équipe a été placée dans quel match suivant.
  const winnerId = match.winner_team_id
  const loserId = winnerId === match.team1_id ? match.team2_id : match.team1_id
  const placedTeam = new Map<string, string>()
  if (match.winner_advances_to && winnerId) placedTeam.set(match.winner_advances_to, winnerId)
  if (match.loser_goes_to && loserId) placedTeam.set(match.loser_goes_to, loserId)

  const cleanups: Array<PromiseLike<unknown>> = []
  for (const s of successors) {
    const teamId = placedTeam.get(s.id)
    if (!teamId) continue
    const patch: Record<string, number | null> = {}
    if (s.team1_id === teamId) patch.team1_id = null
    if (s.team2_id === teamId) patch.team2_id = null
    // Le successeur n'est plus prêt → il libère son éventuel terrain.
    if (Object.keys(patch).length > 0) {
      patch.court_number = null
      cleanups.push(supabase.from('matches').update(patch).eq('id', s.id))
    }
  }

  // Effacement du score (+ terrain) + retrait des équipes avancées, en parallèle.
  const [resetRes] = await Promise.all([
    supabase
      .from('matches')
      .update({
        status: 'pending',
        score_team1: null, score_team2: null, winner_team_id: null,
        set1_team1: null, set1_team2: null, set2_team1: null, set2_team2: null, set3_team1: null, set3_team2: null,
        court_number: null,
      })
      .eq('id', matchId) as unknown as Promise<{ error: { code: string; message: string; hint: string | null } | null }>,
    Promise.all(cleanups),
  ])
  if (resetRes.error) {
    console.error('resetBracketMatchScore:', resetRes.error.code, resetRes.error.message, resetRes.error.hint)
    return { error: resetRes.error.message }
  }

  // Réattribution des terrains (le match annulé redevient prêt).
  await dispatchBracketCourts(supabase, match.tournament_id, res.tournament.config?.courtsAvailable ?? 0)

  revalidatePath(`/tournaments/${match.tournament_id}`)
  return { success: true }
}

// Place une équipe dans le premier emplacement libre du match cible.
async function placeTeamIntoMatch(
  supabase: SupabaseClient,
  nextMatchId: string,
  teamId: string,
): Promise<void> {
  const { data: next } = await supabase
    .from('matches')
    .select('team1_id, team2_id')
    .eq('id', nextMatchId)
    .single() as { data: { team1_id: string | null; team2_id: string | null } | null; error: unknown }
  if (!next) return

  if (!next.team1_id) {
    await supabase.from('matches').update({ team1_id: teamId }).eq('id', nextMatchId)
  } else if (!next.team2_id) {
    await supabase.from('matches').update({ team2_id: teamId }).eq('id', nextMatchId)
  }
}
