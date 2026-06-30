import Link from 'next/link'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { JoinClubButton } from '@/components/club/JoinClubButton'

export const dynamic = 'force-dynamic'

interface ResolvedClub {
  name: string
  full_name: string | null
  city: string | null
  sport: string
}

type Resolution =
  | { ok: true; club: ResolvedClub }
  | { ok: false; reason: 'invalid' | 'expired' | 'inactive' }

async function resolveToken(token: string): Promise<Resolution> {
  if (!z.string().uuid().safeParse(token).success) return { ok: false, reason: 'invalid' }

  const admin = createServiceRoleClient()

  // 1) Lien générique du club.
  const { data: club } = await admin
    .from('clubs')
    .select('name, full_name, city, sport, is_active')
    .eq('invite_token', token)
    .maybeSingle() as { data: (ResolvedClub & { is_active: boolean }) | null }
  if (club) {
    if (!club.is_active) return { ok: false, reason: 'inactive' }
    return { ok: true, club }
  }

  // 2) Invitation personnelle.
  const { data: inv } = await admin
    .from('club_invitations')
    .select('status, expires_at, clubs(name, full_name, city, sport, is_active)')
    .eq('token', token)
    .maybeSingle() as {
      data: {
        status: string
        expires_at: string | null
        clubs: (ResolvedClub & { is_active: boolean }) | null
      } | null
    }
  if (!inv || !inv.clubs) return { ok: false, reason: 'invalid' }
  if (inv.status === 'cancelled') return { ok: false, reason: 'invalid' }
  if (inv.status === 'expired' || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
    return { ok: false, reason: 'expired' }
  }
  if (!inv.clubs.is_active) return { ok: false, reason: 'inactive' }
  return { ok: true, club: inv.clubs }
}

export default async function JoinClubPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const resolution = await resolveToken(token)

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-md rounded-2xl border border-subtle bg-surface p-7 text-center">
        {!resolution.ok ? (
          <>
            <div className="mb-3 text-4xl">🔒</div>
            <h1 className="font-display text-2xl font-extrabold text-white">Lien invalide</h1>
            <p className="mt-2 text-sm text-muted">
              {resolution.reason === 'expired'
                ? 'Cette invitation a expiré. Demandez un nouveau lien au club.'
                : resolution.reason === 'inactive'
                  ? 'Ce club n’est plus actif.'
                  : 'Ce lien d’invitation n’est pas valide. Vérifiez l’adresse ou demandez-en un nouveau.'}
            </p>
            <Link href="/" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
              Retour à l’accueil
            </Link>
          </>
        ) : (
          <>
            <div className="mb-3 text-4xl">🏸</div>
            <p className="text-sm uppercase tracking-wide text-muted">Invitation</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-white">
              Rejoignez {resolution.club.name}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {[resolution.club.full_name, resolution.club.city].filter(Boolean).join(' · ') || resolution.club.sport}
              {' · '}
              <span className="capitalize">{resolution.club.sport}</span>
            </p>

            <div className="mt-7">
              {user ? (
                <JoinClubButton token={token} clubName={resolution.club.name} />
              ) : (
                <div className="space-y-3">
                  <Link
                    href={`/register?redirect=${encodeURIComponent(`/rejoindre/${token}`)}`}
                    className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-app transition-colors hover:bg-primary/90"
                  >
                    Créer mon compte
                  </Link>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/rejoindre/${token}`)}`}
                    className="block w-full rounded-lg border border-subtle py-2.5 text-center text-sm font-semibold text-white transition-colors hover:border-primary hover:text-primary"
                  >
                    J’ai déjà un compte
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
