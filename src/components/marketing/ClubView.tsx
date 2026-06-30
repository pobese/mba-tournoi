'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Loader2, Plus, Settings } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS, MATCH_STATUS, CLUB_DEFAULT_COURTS } from '@/lib/constants'

interface ClubOverview {
  id: string
  name: string
  full_name: string | null
  city: string | null
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
        .select('id, name, full_name, city')
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
    <div className="mx-auto max-w-screen-2xl px-4 pb-16 pt-24 sm:px-8 lg:px-12">
      {/* En-tête */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-3xl">🏢</div>
          <div>
            <h1 className="font-bebas text-4xl tracking-[2px] text-text sm:text-5xl lg:text-6xl">{club.name}</h1>
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
          { icon: '👥', val: memberCount, label: 'Membres actifs', bar: 'bg-primary' },
          { icon: '🏆', val: kpis.tournamentsMonth, label: 'Tournois ce mois', bar: 'bg-info' },
          { icon: '🏸', val: kpis.matches, label: 'Matchs joués', bar: 'bg-warning' },
          { icon: '🎯', val: kpis.courts, label: 'Terrains', bar: 'bg-special' },
        ].map((k) => (
          <div key={k.label} className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-surface p-5">
            <span className={`absolute inset-x-0 top-0 h-0.5 ${k.bar}`} />
            <div className="text-2xl">{k.icon}</div>
            <div className="mt-2 font-bebas text-3xl tracking-wide text-text tabular-nums">{k.val}</div>
            <div className="text-xs text-muted">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm font-semibold">
        <Link href="/club/membres" className="text-primary hover:underline">Voir tous les membres →</Link>
        <Link href="/settings#membres" className="text-muted hover:text-primary">Inviter des membres →</Link>
      </div>

      {/* Tournois — privés / publics (is_public pas encore en base → tout privé) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TournamentColumn
          title="🔒 Tournois privés"
          desc="Réservés aux membres du club."
          tournaments={tournaments}
        />
        <TournamentColumn
          title="🌍 Tournois publics"
          desc="Ouverts à tous les joueurs."
          tournaments={[]}
          footer={
            <span
              title="Bientôt disponible"
              className="mt-4 inline-block cursor-not-allowed text-sm font-semibold text-muted"
            >
              Ouvrir un tournoi au public → <span className="text-xs">(bientôt)</span>
            </span>
          }
        />
      </div>
    </div>
  )
}

function TournamentColumn({
  title, desc, tournaments, footer,
}: {
  title: string
  desc: string
  tournaments: ClubTournament[]
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
      <h3 className="font-bebas text-xl tracking-wide text-text">{title}</h3>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {tournaments.length === 0 ? (
          <p className="rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3 text-sm text-muted">
            Aucun tournoi pour l&apos;instant.
          </p>
        ) : (
          tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3 transition-colors hover:border-primary/30"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">🏸 {t.name}</div>
                <div className="text-xs text-muted">{TOURNAMENT_TYPE_LABELS[t.type] ?? t.type}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${STATUS_CLS[t.status] ?? 'bg-surface-alt text-muted'}`}>
                {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
              </span>
            </Link>
          ))
        )}
      </div>
      {footer}
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