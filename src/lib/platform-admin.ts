import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Admin plateforme (fondateur / staff RacketClub) : peut voir et gérer n'importe quel
 * club. La table `platform_admins` est protégée par un RLS `USING (false)` → lisible
 * uniquement via service-role (jamais depuis le client).
 */
export async function isPlatformAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  // `platform_admins` n'est pas dans les types générés (créée via SQL Editor) → client non typé.
  const admin = createServiceRoleClient() as unknown as SupabaseClient
  const { data } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data)
}
