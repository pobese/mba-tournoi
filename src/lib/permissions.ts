import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Permissions d'un utilisateur sur un tournoi.
export interface TournamentPermissions {
  canView: boolean // lecture (public)
  canEdit: boolean // saisir scores, gérer terrains
  canAdmin: boolean // clôturer, lancer rounds, terminer
  canDelete: boolean // owner uniquement
  canCreate: boolean // owner + membres admin
}

/**
 * Droits d'un utilisateur sur un tournoi donné.
 *   isOwner = créateur du tournoi
 *   isMember = membre accepté de l'organisation du créateur (admin ou editor)
 *   isAdmin = membre accepté avec rôle admin
 */
export async function getTournamentPermissions(
  tournamentId: string,
  userId: string,
): Promise<TournamentPermissions> {
  const supabase = await createServerSupabaseClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', tournamentId)
    .maybeSingle() as { data: { created_by: string } | null; error: unknown }

  if (!tournament) {
    return { canView: true, canEdit: false, canAdmin: false, canDelete: false, canCreate: false }
  }

  const isOwner = tournament.created_by === userId
  let isMember = isOwner
  let isAdmin = isOwner
  if (!isOwner) {
    // is_org_member / is_org_admin : fonctions SECURITY DEFINER, basées sur auth.uid().
    const [memberRes, adminRes] = await Promise.all([
      supabase.rpc('is_org_member', { owner_uuid: tournament.created_by }) as unknown as Promise<{ data: boolean | null }>,
      supabase.rpc('is_org_admin', { owner_uuid: tournament.created_by }) as unknown as Promise<{ data: boolean | null }>,
    ])
    isMember = memberRes.data === true
    isAdmin = adminRes.data === true
  }

  return {
    canView: true,
    canEdit: isOwner || isMember,
    canAdmin: isOwner || isMember, // un editor peut aussi clôturer / lancer
    canDelete: isOwner,
    canCreate: isOwner || isAdmin,
  }
}

/**
 * Défense en profondeur côté Server Action : l'utilisateur courant peut-il gérer
 * (éditer/administrer) ce tournoi ? = créateur OU membre accepté de son organisation.
 * Utilise le client authentifié transmis (auth.uid() = utilisateur courant).
 */
export async function canManageTournament(
  supabase: SupabaseClient,
  createdBy: string,
  userId: string,
): Promise<boolean> {
  if (createdBy === userId) return true
  const { data } = await supabase
    .rpc('is_org_member', { owner_uuid: createdBy }) as unknown as { data: boolean | null }
  return data === true
}

/**
 * Contexte de création de tournoi pour un utilisateur :
 *   - non membre → crée pour lui-même (ownerId = lui)
 *   - membre admin → crée pour l'organisation (ownerId = owner)
 *   - membre editor uniquement → ne peut pas créer
 */
export async function resolveCreateContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ canCreate: boolean; ownerId: string }> {
  const { data } = await supabase
    .from('organization_members')
    .select('owner_id, role')
    .eq('member_id', userId)
    .eq('status', 'accepted') as { data: { owner_id: string; role: string }[] | null; error: unknown }

  const memberships = data ?? []
  if (memberships.length === 0) return { canCreate: true, ownerId: userId }

  const adminOf = memberships.find((m) => m.role === 'admin')
  if (adminOf) return { canCreate: true, ownerId: adminOf.owner_id }

  // Membre editor uniquement → pas de création (cf. concept).
  return { canCreate: false, ownerId: userId }
}
