import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Auto-accepte les invitations de club en attente pour l'email du nouvel
 * utilisateur (cas : on a invité par email un compte qui n'existait pas encore).
 * Best-effort : ne doit jamais casser le flux d'authentification.
 */
async function acceptPendingClubInvitations(supabase: SupabaseClient) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return
    const email = user.email.toLowerCase()
    const admin = createServiceRoleClient()

    const { data: invitations } = await admin
      .from('club_invitations')
      .select('id, club_id, role, expires_at')
      .eq('email', email)
      .eq('status', 'pending') as {
        data: { id: string; club_id: string; role: string; expires_at: string | null }[] | null
      }

    const now = Date.now()
    for (const inv of invitations ?? []) {
      if (inv.expires_at && new Date(inv.expires_at).getTime() < now) continue

      const { data: existing } = await admin
        .from('club_members').select('id')
        .eq('club_id', inv.club_id).eq('user_id', user.id).maybeSingle()
      if (!existing) {
        const { error } = await admin
          .from('club_members').insert({ club_id: inv.club_id, user_id: user.id, role: inv.role })
        if (error && error.code !== '23505') continue
      }
      await admin
        .from('club_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', inv.id)
    }
  } catch (e) {
    console.error('acceptPendingClubInvitations:', e instanceof Error ? e.message : e)
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await acceptPendingClubInvitations(supabase)
      // `next` doit rester un chemin interne (anti open-redirect).
      const dest = next.startsWith('/') ? next : '/'
      return NextResponse.redirect(`${origin}${dest}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
