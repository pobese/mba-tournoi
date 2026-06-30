'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Copy, Loader2, Plus, Settings, Users } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS, MATCH_STATUS, CLUB_DEFAULT_COURTS } from '@/lib/constants'

interface ClubOverview {
  id: string
  name: string
  full_name: string | null
  city: string | null
  invite_code: string | null
  invite_token: string
}

interface ClubTournament {
  id: string
  name: string
  type: string
  status: string
}

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-surface-alt text-muted',
  ongoing: 'bg-primary/15 text-primary',
  finished: 'bg-accent/15 text-accent',
}

export function ClubView() {
  const [loading, setLoading] = useState(true)
  const [club, setClub] = useState<ClubOverview | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [tournaments, setTournaments] = useState<ClubTournament[]>([])
  const [kpis, setKpis] = useState({ tournamentsMonth: 0, matches: 0, courts: CLUB_DEFAULT_COURTS })

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (active) setLoading(false); return }

      const { data: owned } = await supabase
        .from('clubs')
        .select('id, name, full_name, city, invite_code, invite_token')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (!active) return

      const c = owned as ClubOverview | null
      setClub(c)
      if (c) {
        const [{ data: members }, { data: tourns }] = await Promise.all([
          supabase.from('club_members').select('user_id').eq('club_id', c.id),
          supabase
            .from('tournaments')
            .select('id, name, type, status, config, created_at')
            .eq('club_id', c.id)
            .order('created_at', { ascending: false }),
        ])
        if (!active) return

        // L'owner est parfois déjà une ligne club_members, parfois non → union
        // d'IDs (avec l'owner = user courant) pour ne jamais le compter en double.
        const ids = new Set(((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id))
        ids.add(user.id)
        setMemberCount(ids.size)

        const rows = (tourns as Array<ClubTournament & { config: { courtsAvailable?: number } | null; created_at: string }> | null) ?? []
        setTournaments(rows)

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const tournamentsMonth = rows.filter((t) => new Date(t.created_at) >= startOfMonth).length
        const courts = rows.reduce((mx, t) => Math.max(mx, Number(t.config?.courtsAvailable ?? 0)), 0) || CLUB_DEFAULT_COURTS

        // Matchs joués : count() côté Supabase (pas de fetch des rows) sur les tournois du club.
        let matches = 0
        const tourIds = rows.map((t) => t.id)
        if (tourIds.length) {
          const { count } = await supabase
            .from('matches')
            .select('id', { count: 'exact', head: true })
            .in('tournament_id', tourIds)
            .eq('status', MATCH_STATUS.DONE)
          if (!active) return
          matches = count ?? 0
        }
        setKpis({ tournamentsMonth, matches, courts })
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!club) return <NoClub />

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-8">
      {/* En-tête */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-3xl">🏢</div>
          <div>
            <h1 className="font-bebas text-3xl tracking-[2px] text-text sm:text-4xl">{club.name}</h1>
            <p className="text-sm text-muted">
              {[club.full_name, club.city].filter(Boolean).join(' · ') || 'Votre club'}
              {' · '}{memberCount} membre{memberCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/tournaments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Créer un tournoi
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-subtle px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-primary hover:text-primary"
          >
            <Settings className="h-4 w-4" /> Gérer le club
          </Link>
        </div>
      </div>

      {/* KPIs (vraies données) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: '👥', val: memberCount, label: 'Membres actifs' },
          { icon: '🏆', val: kpis.tournamentsMonth, label: 'Tournois ce mois' },
          { icon: '🏸', val: kpis.matches, label: 'Matchs joués' },
          { icon: '🎯', val: kpis.courts, label: 'Terrains' },
        ].map((k) => (
          <div key={k.label} className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-surface p-5">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
            <div className="text-2xl">{k.icon}</div>
            <div className="mt-2 font-bebas text-3xl tracking-wide text-text tabular-nums">{k.val}</div>
            <div className="text-xs text-muted">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Invitation */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CopyCard label="Code d'invitation" value={club.invite_code ?? '—'} display={club.invite_code ?? '—'} mono />
        <CopyCard
          label="Lien partageable"
          value={typeof window !== 'undefined' ? `${window.location.origin}/rejoindre/${club.invite_token}` : ''}
          display={`…/rejoindre/${club.invite_token.slice(0, 8)}…`}
        />
      </div>

      {/* Tournois du club */}
      <h2 className="mb-3 mt-8 font-bebas text-2xl tracking-[1px] text-text">Tournois du club</h2>
      {tournaments.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-surface px-5 py-8 text-center text-sm text-muted">
          Aucun tournoi pour l&apos;instant.{' '}
          <Link href="/tournaments/new" className="font-semibold text-primary hover:underline">Créez le premier →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-surface px-4 py-3 transition-colors hover:border-primary/30"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-text">🏸 {t.name}</div>
                <div className="text-xs text-muted">{TOURNAMENT_TYPE_LABELS[t.type] ?? t.type}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${STATUS_CLS[t.status] ?? 'bg-surface-alt text-muted'}`}>
                {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function NoClub() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 pt-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-4xl">🏢</div>
      <h1 className="mt-5 font-bebas text-3xl tracking-[2px] text-text">Créez votre club</h1>
      <p className="mt-2 text-muted">
        Regroupez vos adhérents, partagez un code d&apos;invitation et organisez vos tournois.
      </p>
      <Link
        href="/settings"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Building2 className="h-4 w-4" /> Créer mon club
      </Link>
    </div>
  )
}

function CopyCard({ label, value, display, mono }: { label: string; value: string; display: string; mono?: boolean }) {
  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copié`)
    } catch {
      toast.error('Copie impossible')
    }
  }
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
        {label === 'Code d\'invitation' ? <Users className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`flex-1 truncate text-text ${mono ? 'font-spacemono text-2xl font-bold tracking-[3px] text-accent' : 'text-sm'}`}>
          {display}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-alt hover:text-primary"
          aria-label={`Copier ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
