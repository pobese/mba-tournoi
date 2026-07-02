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

/**
 * Cherche, dans le club choisi à l'inscription, les profils joueurs non encore
 * liés dont le nom ressemble au prénom du nouveau compte (trigrammes pg_trgm via
 * la fonction match_club_players). Renvoie l'URL de redirection : soit le flux de
 * « claim » (/?view=player&claiming=true&match=…) s'il y a des candidats, soit la
 * destination normale. Best-effort : ne casse jamais l'authentification.
 */
async function resolvePostAuthRedirect(
  supabase: SupabaseClient,
  origin: string,
  dest: string,
): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const meta = (user?.user_metadata ?? {}) as { club_id?: unknown; full_name?: unknown }
    const clubId = typeof meta.club_id === 'string' ? meta.club_id : null
    if (!user || !clubId) return `${origin}${dest}`

    const firstName = String(meta.full_name ?? '').trim().split(/\s+/)[0] ?? ''
    if (firstName.length < 2) return `${origin}${dest}`

    const admin = createServiceRoleClient()
    const { data } = await admin.rpc('match_club_players', { p_club_id: clubId, p_name: firstName })
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id)
    if (ids.length === 0) return `${origin}${dest}`

    return `${origin}/?view=player&claiming=true&match=${ids.join(',')}`
  } catch (e) {
    console.error('resolvePostAuthRedirect:', e instanceof Error ? e.message : e)
    return `${origin}${dest}`
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
      const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/'
      return NextResponse.redirect(await resolvePostAuthRedirect(supabase, origin, dest))
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
