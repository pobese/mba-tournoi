'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  MemberIdSchema,
  InvitationIdSchema,
} from '@/lib/validations/schemas'

type SupabaseError = { code: string; message: string; hint: string | null } | null

// ─── inviteMember ─────────────────────────────────────────────────────────────

/**
 * Le owner invite un membre par email. L'email doit déjà avoir un compte.
 * Pas d'email d'invitation : le membre verra une bannière sur son dashboard.
 */
export async function inviteMember(ownerId: string, email: string, role: 'admin' | 'editor') {
  const parsed = InviteMemberSchema.safeParse({ ownerId, email, role })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // Seul le owner invite dans sa propre organisation.
  if (user.id !== parsed.data.ownerId) return { error: 'Permission refusée' }

  const normalizedEmail = parsed.data.email.trim().toLowerCase()

  // Résolution email → user id via le service role (lit auth.users).
  const admin = createServiceRoleClient()
  // Cast : client non typé <Database> ; la RPC renvoie un uuid ou null.
  const { data: memberId, error: lookupError } = await admin
    .rpc('get_user_id_by_email', { p_email: normalizedEmail }) as { data: string | null; error: SupabaseError }
  if (lookupError) {
    console.error('inviteMember lookup:', lookupError.code, lookupError.message, lookupError.hint)
    return { error: 'Erreur lors de la recherche du compte' }
  }
  if (!memberId) {
    return { error: "Cet email n'a pas de compte. Demandez-lui de créer un compte sur mba.stellix.fr d'abord." }
  }
  if (memberId === user.id) {
    return { error: 'Vous ne pouvez pas vous inviter vous-même.' }
  }

  // Déjà membre ? (la contrainte UNIQUE le garantit aussi — message propre ici).
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('owner_id', user.id)
    .eq('member_email', normalizedEmail)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (existing) return { error: 'Cet email est déjà membre de votre organisation.' }

  const { error } = await supabase.from('organization_members').insert({
    owner_id: user.id,
    member_id: memberId,
    member_email: normalizedEmail,
    role: parsed.data.role,
    status: 'pending',
  })
  if (error) {
    console.error('inviteMember insert:', error.code, error.message, error.hint)
    // 23505 : violation de UNIQUE(owner_id, member_email) — course entre 2 invitations.
    if (error.code === '23505') return { error: 'Cet email est déjà membre de votre organisation.' }
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ─── updateMemberRole ─────────────────────────────────────────────────────────

export async function updateMemberRole(memberId: string, role: 'admin' | 'editor') {
  const parsed = UpdateMemberRoleSchema.safeParse({ memberId, role })
  if (!parsed.success) return { error: 'Données invalides' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // owner_id = user.id + RLS "Owner gère ses membres" → ne touche que ses membres.
  const { error } = await supabase
    .from('organization_members')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.memberId)
    .eq('owner_id', user.id)
  if (error) {
    console.error('updateMemberRole:', error.code, error.message, error.hint)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ─── removeMember ─────────────────────────────────────────────────────────────

export async function removeMember(memberId: string) {
  const parsed = MemberIdSchema.safeParse({ memberId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', parsed.data.memberId)
    .eq('owner_id', user.id)
  if (error) {
    console.error('removeMember:', error.code, error.message, error.hint)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ─── acceptInvitation ─────────────────────────────────────────────────────────

/**
 * Le membre accepte son invitation. Vérification d'appartenance via lecture RLS,
 * puis écriture via service role (le membre n'a pas d'écriture RLS directe pour
 * ne pas pouvoir modifier son propre rôle).
 */
export async function acceptInvitation(invitationId: string) {
  const parsed = InvitationIdSchema.safeParse({ invitationId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // RLS "Membre voit son invitation" → ne renvoie la ligne que si elle est à lui.
  const { data: invitation } = await supabase
    .from('organization_members')
    .select('id, member_id, status')
    .eq('id', parsed.data.invitationId)
    .maybeSingle() as { data: { id: string; member_id: string; status: string } | null; error: unknown }
  if (!invitation || invitation.member_id !== user.id) return { error: 'Invitation introuvable' }
  if (invitation.status === 'accepted') return { success: true }

  const admin = createServiceRoleClient()
  const { error } = await admin
    .from('organization_members')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', parsed.data.invitationId)
    .eq('member_id', user.id)
  if (error) {
    console.error('acceptInvitation:', error.code, error.message, error.hint)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

// ─── declineInvitation ────────────────────────────────────────────────────────

export async function declineInvitation(invitationId: string) {
  const parsed = InvitationIdSchema.safeParse({ invitationId })
  if (!parsed.success) return { error: 'Identifiant invalide' }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: invitation } = await supabase
    .from('organization_members')
    .select('id, member_id')
    .eq('id', parsed.data.invitationId)
    .maybeSingle() as { data: { id: string; member_id: string } | null; error: unknown }
  if (!invitation || invitation.member_id !== user.id) return { error: 'Invitation introuvable' }

  const admin = createServiceRoleClient()
  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('id', parsed.data.invitationId)
    .eq('member_id', user.id)
  if (error) {
    console.error('declineInvitation:', error.code, error.message, error.hint)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
