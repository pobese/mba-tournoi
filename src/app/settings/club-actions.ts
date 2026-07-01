'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomBytes, randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  CreateClubSchema,
  UpdateClubSchema,
  InviteClubMemberSchema,
  ClubIdSchema,
  JoinClubByCodeSchema,
  JoinClubByTokenSchema,
  ClubMemberIdSchema,
  UpdateClubMemberRoleSchema,
} from '@/lib/validations/schemas'
import {
  CLUB_ROLES,
  CLUB_DEFAULT_SPORT,
  CLUB_DEFAULT_COURTS,
  CLUB_INVITE_CODE_ALPHABET,
  CLUB_INVITE_CODE_LENGTH,
  MATCH_STATUS,
} from '@/lib/constants'
import type { ClubOverview, ClubOverviewResult } from '@/types/app'
import { isPlatformAdmin } from '@/lib/platform-admin'

type SupabaseError = { code: string; message: string; hint: string | null } | null
type ClubRole = 'admin' | 'member'

// ─── Helpers (non exportés) ─────────────────────────────────────────────────

function logErr(scope: string, e: SupabaseError) {
  if (e) console.error(`${scope}:`, e.code, e.message, e.hint)
}

function randomCode(): string {
  const bytes = randomBytes(CLUB_INVITE_CODE_LENGTH)
  let s = ''
  for (let i = 0; i < CLUB_INVITE_CODE_LENGTH; i++) {
    s += CLUB_INVITE_CODE_ALPHABET[bytes[i] % CLUB_INVITE_CODE_ALPHABET.length]
  }
  return s
}

function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'club'
}

async function generateUniqueInviteCode(admin: SupabaseClient): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomCode()
    const { data } = await admin.from('clubs').select('id').eq('invite_code', code).maybeSingle()
    if (!data) return code
  }
  return `${randomCode()}${randomUUID().slice(0, 2).toUpperCase()}`
}

async function generateUniqueSlug(admin: SupabaseClient, name: string): Promise<string> {
  const base = slugify(name)
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const { data } = await admin.from('clubs').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
  }
  return `${base}-${randomUUID().slice(0, 6)}`
}

/** owner du club, membre avec rôle admin, OU admin plateforme. */
async function isClubAdmin(admin: SupabaseClient, clubId: string, userId: string): Promise<boolean> {
  const { data: club } = await admin.from('clubs').select('owner_id').eq('id', clubId).maybeSingle() as {
    data: { owner_id: string } | null
  }
  if (club?.owner_id === userId) return true
  const { data: mem } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle() as { data: { role: string } | null }
  if (mem?.role === CLUB_ROLES.ADMIN) return true
  // Les admins plateforme peuvent gérer n'importe quel club.
  return isPlatformAdmin(userId)
}

// ─── createClub ──────────────────────────────────────────────────────────────

/**
 * Crée un club et rend le créateur admin. Si un club très similaire existe déjà
 * (même ville + sport + nom proche via pg_trgm), renvoie un avertissement au lieu
 * d'insérer — sauf si `opts.force` est vrai.
 */
export async function createClub(input: unknown, opts?: { force?: boolean }) {
  const parsed = CreateClubSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const name = parsed.data.name.trim()
  const fullName = parsed.data.fullName?.trim() || null
  const city = parsed.data.city?.trim() || null
  const postalCode = parsed.data.postalCode?.trim() || null
  const sport = parsed.data.sport?.trim() || CLUB_DEFAULT_SPORT

  const admin = createServiceRoleClient()

  // Anti-doublon (impossible sans ville → on déduplique seulement si ville fournie).
  if (!opts?.force && city) {
    const { data: similar, error: simErr } = await admin
      .rpc('find_similar_club', { p_name: name, p_city: city, p_sport: sport }) as {
        data: { id: string; name: string; city: string | null }[] | null
        error: SupabaseError
      }
    logErr('createClub similarity', simErr)
    const match = similar?.[0]
    if (match) {
      return { warning: true as const, similarClub: { id: match.id, name: match.name, city: match.city } }
    }
  }

  const inviteCode = await generateUniqueInviteCode(admin)
  const slug = await generateUniqueSlug(admin, name)

  // L'owner est identifié via clubs.owner_id (modèle prod) — pas de ligne
  // club_members pour lui (cf. is_club_member / get_user_club_role).
  const { data: club, error } = await admin
    .from('clubs')
    .insert({
      name,
      full_name: fullName,
      city,
      postal_code: postalCode,
      sport,
      owner_id: user.id,
      invite_code: inviteCode,
      slug,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: SupabaseError }
  if (error || !club) {
    logErr('createClub insert', error)
    return { error: 'Création du club impossible' }
  }

  revalidatePath('/settings')
  return { success: true as const, clubId: club.id }
}

// ─── requestToJoinClub (depuis l'avertissement anti-doublon) ──────────────────

/** L'utilisateur demande à rejoindre un club existant (invitation role=admin). */
export async function requestToJoinClub(clubId: string) {
  const parsed = ClubIdSchema.safeParse({ clubId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const email = (user.email ?? '').toLowerCase()
  if (!email) return { error: 'Compte sans email.' }

  const admin = createServiceRoleClient()
  const { data: mem } = await admin
    .from('club_members').select('id').eq('club_id', parsed.data.clubId).eq('user_id', user.id).maybeSingle()
  if (mem) return { success: true as const, alreadyMember: true }

  const { data: existing } = await admin
    .from('club_invitations').select('id, status')
    .eq('club_id', parsed.data.clubId).eq('email', email).maybeSingle() as {
      data: { id: string; status: string } | null
    }
  if (existing?.status === 'pending') return { success: true as const, pending: true }

  const { error } = existing
    ? await admin.from('club_invitations').update({
        role: 'admin', invited_by: user.id, status: 'pending',
        invited_at: new Date().toISOString(), accepted_at: null,
      }).eq('id', existing.id)
    : await admin.from('club_invitations').insert({
        club_id: parsed.data.clubId, email, role: 'admin', invited_by: user.id,
      })
  if (error) {
    logErr('requestToJoinClub', error)
    return { error: 'Demande impossible' }
  }
  return { success: true as const }
}

// ─── updateClub ────────────────────────────────────────────────────────────────

export async function updateClub(
  clubId: string,
  fields: { name: string; fullName?: string; city?: string; postalCode?: string },
) {
  const parsed = UpdateClubSchema.safeParse({ clubId, ...fields })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const admin = createServiceRoleClient()
  if (!(await isClubAdmin(admin, parsed.data.clubId, user.id))) return { error: 'Permission refusée' }

  const { error } = await admin.from('clubs').update({
    name: parsed.data.name.trim(),
    full_name: parsed.data.fullName?.trim() || null,
    city: parsed.data.city?.trim() || null,
    postal_code: parsed.data.postalCode?.trim() || null,
  }).eq('id', parsed.data.clubId)
  if (error) {
    logErr('updateClub', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true as const }
}

// ─── inviteMemberToClub ──────────────────────────────────────────────────────

/** Invite par email — fonctionne même si l'email n'a pas encore de compte. */
export async function inviteMemberToClub(clubId: string, email: string, role: ClubRole) {
  const parsed = InviteClubMemberSchema.safeParse({ clubId, email, role })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const admin = createServiceRoleClient()
  if (!(await isClubAdmin(admin, parsed.data.clubId, user.id))) return { error: 'Permission refusée' }

  const normalizedEmail = parsed.data.email.trim().toLowerCase()
  // UNIQUE(club_id, email) → une seule ligne possible, quel que soit le statut.
  const { data: existing } = await admin
    .from('club_invitations').select('id, status')
    .eq('club_id', parsed.data.clubId).eq('email', normalizedEmail).maybeSingle() as {
      data: { id: string; status: string } | null
    }
  if (existing?.status === 'pending') return { error: 'Une invitation est déjà en attente pour cet email.' }

  // Réinvitation (expirée/annulée) → on réarme la ligne existante ; sinon insert.
  const { error } = existing
    ? await admin.from('club_invitations').update({
        role: parsed.data.role, invited_by: user.id, status: 'pending',
        invited_at: new Date().toISOString(), accepted_at: null,
      }).eq('id', existing.id)
    : await admin.from('club_invitations').insert({
        club_id: parsed.data.clubId, email: normalizedEmail, role: parsed.data.role, invited_by: user.id,
      })
  if (error) {
    logErr('inviteMemberToClub', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true as const }
}

// ─── joinClubByCode ──────────────────────────────────────────────────────────

/** Un utilisateur connecté saisit un code court → devient membre. */
export async function joinClubByCode(inviteCode: string) {
  const parsed = JoinClubByCodeSchema.safeParse({ inviteCode })
  if (!parsed.success) return { error: 'Code invalide.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const admin = createServiceRoleClient()
  const code = parsed.data.inviteCode.trim().toUpperCase()
  const { data: club } = await admin
    .from('clubs').select('id, name, is_active').eq('invite_code', code).maybeSingle() as {
      data: { id: string; name: string; is_active: boolean } | null
    }
  if (!club || !club.is_active) return { error: 'Code invalide.' }

  const { data: existing } = await admin
    .from('club_members').select('id').eq('club_id', club.id).eq('user_id', user.id).maybeSingle()
  if (existing) return { success: true as const, alreadyMember: true, clubName: club.name }

  const { error } = await admin
    .from('club_members').insert({ club_id: club.id, user_id: user.id, role: CLUB_ROLES.MEMBER })
  if (error && error.code !== '23505') {
    logErr('joinClubByCode', error)
    return { error: 'Impossible de rejoindre le club.' }
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true as const, clubName: club.name }
}

// ─── joinClubByToken (page publique /rejoindre) ───────────────────────────────

/**
 * Rejoint via le lien partageable : token = clubs.invite_token (lien générique)
 * OU club_invitations.token (invitation personnelle, avec rôle + expiration).
 */
export async function joinClubByToken(token: string) {
  const parsed = JoinClubByTokenSchema.safeParse({ token })
  if (!parsed.success) return { error: 'Lien invalide.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Connectez-vous pour rejoindre le club.' }

  const admin = createServiceRoleClient()
  const t = parsed.data.token

  let clubId: string
  let clubName: string
  let role: ClubRole = CLUB_ROLES.MEMBER
  let invitationId: string | null = null

  const { data: club } = await admin
    .from('clubs').select('id, name, is_active').eq('invite_token', t).maybeSingle() as {
      data: { id: string; name: string; is_active: boolean } | null
    }
  if (club) {
    if (!club.is_active) return { error: 'Ce club n’est plus actif.' }
    clubId = club.id
    clubName = club.name
  } else {
    const { data: inv } = await admin
      .from('club_invitations')
      .select('id, club_id, role, status, expires_at, clubs(name, is_active)')
      .eq('token', t).maybeSingle() as {
        data: {
          id: string; club_id: string; role: ClubRole; status: string; expires_at: string | null
          clubs: { name: string; is_active: boolean } | null
        } | null
      }
    if (!inv) return { error: 'Lien invalide ou expiré.' }
    if (inv.status === 'cancelled') return { error: 'Cette invitation a été annulée.' }
    if (inv.status === 'expired' || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
      return { error: 'Cette invitation a expiré.' }
    }
    if (!inv.clubs || !inv.clubs.is_active) return { error: 'Ce club n’est plus actif.' }
    clubId = inv.club_id
    clubName = inv.clubs.name
    role = inv.role
    invitationId = inv.id
  }

  const { data: existing } = await admin
    .from('club_members').select('id').eq('club_id', clubId).eq('user_id', user.id).maybeSingle()
  if (!existing) {
    const { error } = await admin
      .from('club_members').insert({ club_id: clubId, user_id: user.id, role })
    if (error && error.code !== '23505') {
      logErr('joinClubByToken', error)
      return { error: 'Impossible de rejoindre le club.' }
    }
  }
  if (invitationId) {
    await admin
      .from('club_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitationId)
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true as const, clubName, alreadyMember: Boolean(existing) }
}

// ─── regenerateInviteToken ────────────────────────────────────────────────────

export async function regenerateInviteToken(clubId: string) {
  const parsed = ClubIdSchema.safeParse({ clubId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const admin = createServiceRoleClient()
  if (!(await isClubAdmin(admin, parsed.data.clubId, user.id))) return { error: 'Permission refusée' }

  const newToken = randomUUID()
  const { error } = await admin.from('clubs').update({ invite_token: newToken }).eq('id', parsed.data.clubId)
  if (error) {
    logErr('regenerateInviteToken', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true as const, inviteToken: newToken }
}

// ─── Gestion des membres du club (page /club/membres) ──────────────────────────

/** Change le rôle d'un membre du club. Réservé owner/admin ; l'owner reste intouchable. */
export async function updateClubMemberRole(memberId: string, role: 'admin' | 'editor' | 'member') {
  const parsed = UpdateClubMemberRoleSchema.safeParse({ memberId, role })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const admin = createServiceRoleClient()
  const { data: row } = await admin
    .from('club_members').select('club_id, role').eq('id', parsed.data.memberId).maybeSingle() as {
      data: { club_id: string; role: string } | null
    }
  if (!row) return { error: 'Membre introuvable' }
  if (row.role === 'owner') return { error: 'Le propriétaire ne peut pas être modifié.' }
  if (!(await isClubAdmin(admin, row.club_id, user.id))) return { error: 'Permission refusée' }

  const { error } = await admin
    .from('club_members').update({ role: parsed.data.role }).eq('id', parsed.data.memberId)
  if (error) {
    logErr('updateClubMemberRole', error)
    return { error: error.message }
  }

  revalidatePath('/club/membres')
  return { success: true as const }
}

/** Retire un membre du club. Réservé owner/admin ; l'owner ne peut être retiré. */
export async function removeClubMember(memberId: string) {
  const parsed = ClubMemberIdSchema.safeParse({ memberId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const admin = createServiceRoleClient()
  const { data: row } = await admin
    .from('club_members').select('club_id, role').eq('id', parsed.data.memberId).maybeSingle() as {
      data: { club_id: string; role: string } | null
    }
  if (!row) return { error: 'Membre introuvable' }
  if (row.role === 'owner') return { error: 'Le propriétaire ne peut pas être retiré.' }
  if (!(await isClubAdmin(admin, row.club_id, user.id))) return { error: 'Permission refusée' }

  const { error } = await admin.from('club_members').delete().eq('id', parsed.data.memberId)
  if (error) {
    logErr('removeClubMember', error)
    return { error: error.message }
  }

  revalidatePath('/club/membres')
  return { success: true as const }
}

// ─── getClubOverview (tab Club de la landing) ──────────────────────────────────

const EMPTY_OVERVIEW: ClubOverviewResult = {
  club: null,
  role: null,
  isPlatformAdmin: false,
  memberCount: 0,
  tournaments: [],
  kpis: { tournamentsMonth: 0, matches: 0, courts: CLUB_DEFAULT_COURTS },
}

/**
 * Vue d'ensemble du club de l'utilisateur pour le tab Club. Cherche d'abord le club
 * qu'il possède, sinon le premier club qu'il a rejoint (fix : un membre voyait
 * « Créez votre club » au lieu du club rejoint). Lecture via service-role pour ne pas
 * dépendre du RLS côté client (mêmes données pour owner et membre).
 */
export async function getClubOverview(): Promise<ClubOverviewResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY_OVERVIEW

  const admin = createServiceRoleClient()
  const platformAdmin = await isPlatformAdmin(user.id)

  // 1) Club possédé.
  const { data: owned } = await admin
    .from('clubs')
    .select('id, name, full_name, city, sport, owner_id')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as { data: (ClubOverview & { owner_id: string }) | null }

  let club: (ClubOverview & { owner_id: string }) | null = owned
  let role: ClubOverviewResult['role'] = owned ? 'owner' : null

  // 2) Sinon, premier club rejoint (membre accepté).
  if (!club) {
    const { data: membership } = await admin
      .from('club_members')
      .select('role, clubs(id, name, full_name, city, sport, owner_id, is_active)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle() as {
        data: {
          role: ClubOverviewResult['role']
          clubs: (ClubOverview & { owner_id: string; is_active: boolean }) | null
        } | null
      }
    if (membership?.clubs && membership.clubs.is_active) {
      const c = membership.clubs
      club = { id: c.id, name: c.name, full_name: c.full_name, city: c.city, sport: c.sport, owner_id: c.owner_id }
      role = membership.role
    }
  }

  if (!club) return { ...EMPTY_OVERVIEW, isPlatformAdmin: platformAdmin }

  // Comptage des membres : owner (via owner_id) + adhérents, sans double comptage.
  const { data: memberRows } = await admin
    .from('club_members').select('user_id').eq('club_id', club.id) as { data: { user_id: string }[] | null }
  const ids = new Set((memberRows ?? []).map((m) => m.user_id))
  ids.add(club.owner_id)
  const memberCount = ids.size

  // Tournois du club (+ KPIs).
  const { data: tourns } = await admin
    .from('tournaments')
    .select('id, name, type, status, config, created_at')
    .eq('club_id', club.id)
    .order('created_at', { ascending: false }) as {
      data: Array<{
        id: string; name: string; type: string; status: string
        config: { courtsAvailable?: number } | null; created_at: string
      }> | null
    }
  const rows = tourns ?? []
  const tournaments = rows.map(({ id, name, type, status }) => ({ id, name, type, status }))

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const tournamentsMonth = rows.filter((t) => new Date(t.created_at) >= startOfMonth).length
  const courts = rows.reduce((mx, t) => Math.max(mx, Number(t.config?.courtsAvailable ?? 0)), 0) || CLUB_DEFAULT_COURTS

  let matches = 0
  const tourIds = rows.map((t) => t.id)
  if (tourIds.length) {
    const { count } = await admin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .in('tournament_id', tourIds)
      .eq('status', MATCH_STATUS.DONE)
    matches = count ?? 0
  }

  const clubPublic: ClubOverview = {
    id: club.id, name: club.name, full_name: club.full_name, city: club.city, sport: club.sport,
  }
  return {
    club: clubPublic, role, isPlatformAdmin: platformAdmin, memberCount, tournaments,
    kpis: { tournamentsMonth, matches, courts },
  }
}

// ─── amIPlatformAdmin (badge navbar) ───────────────────────────────────────────

/** Statut admin plateforme de l'utilisateur courant — pour l'affichage du badge navbar. */
export async function amIPlatformAdmin(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return isPlatformAdmin(user.id)
}
