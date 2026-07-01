'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Building2, Loader2, Plus, Settings, LogIn } from 'lucide-react'
import { getClubOverview, joinClubByCode } from '@/app/settings/club-actions'
import { TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS, CLUB_DEFAULT_COURTS } from '@/lib/constants'
import type { ClubOverview, ClubOverviewResult, ClubRole } from '@/types/app'

type ClubTournament = ClubOverviewResult['tournaments'][number]

// Actions de gestion (créer un tournoi, gérer/inviter) réservées au bureau.
const MANAGER_ROLES: ClubRole[] = ['owner', 'admin', 'editor']

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-surface-alt text-muted',
  ongoing: 'bg-primary/15 text-primary',
  finished: 'bg-accent/15 text-accent',
}

const CARD_HOVER =
  'transition-all duration-200 hover:scale-[1.02] hover:border-primary/40 hover:shadow-[0_0_20px_rgba(200,241,53,0.1)]'

export function ClubView() {
  const [loading, setLoading] = useState(true)
  const [club, setClub] = useState<ClubOverview | null>(null)
  const [role, setRole] = useState<ClubRole | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [tournaments, setTournaments] = useState<ClubTournament[]>([])
  const [kpis, setKpis] = useState({ tournamentsMonth: 0, matches: 0, courts: CLUB_DEFAULT_COURTS })

  async function load() {
    const res = await getClubOverview()
    setClub(res.club)
    setRole(res.role)
    setMemberCount(res.memberCount)
    setTournaments(res.tournaments)
    setKpis(res.kpis)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      await load()
      if (active) setLoading(false)
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

  // Ni owner ni membre → inviter à rejoindre un club (pas « Créez votre club »).
  if (!club) return <JoinClub onJoined={load} />

  const canManage = role !== null && MANAGER_ROLES.includes(role)

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
              {' · '}<span className="capitalize">{club.sport}</span>
              {' · '}{memberCount} membre{memberCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canManage && (
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
        )}
      </div>

      {/* KPIs (vraies données) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: '👥', val: memberCount, label: 'Membres actifs', bar: 'bg-primary' },
          { icon: '🏆', val: kpis.tournamentsMonth, label: 'Tournois ce mois', bar: 'bg-info' },
          { icon: '🏸', val: kpis.matches, label: 'Matchs joués', bar: 'bg-warning' },
          { icon: '🎯', val: kpis.courts, label: 'Terrains', bar: 'bg-special' },
        ].map((k) => (
          <div key={k.label} className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-surface p-5 ${CARD_HOVER}`}>
            <span className={`absolute inset-x-0 top-0 h-0.5 ${k.bar}`} />
            <div className="text-2xl">{k.icon}</div>
            <div className="mt-2 font-bebas text-3xl tracking-wide text-text tabular-nums">{k.val}</div>
            <div className="text-xs text-muted">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm font-semibold">
        <Link href="/club/membres" className="text-primary hover:underline">Voir les membres →</Link>
        {canManage && (
          <Link href="/settings#membres" className="text-muted hover:text-primary">Inviter des membres →</Link>
        )}
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
              className={`flex items-center justify-between rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3 ${CARD_HOVER}`}
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

/** Utilisateur sans club : saisie d'un code d'invitation pour rejoindre un club. */
function JoinClub({ onJoined }: { onJoined: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    const trimmed = code.trim()
    if (trimmed.length === 0) return
    setLoading(true)
    try {
      const res = await joinClubByCode(trimmed)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success(res.alreadyMember ? `Vous êtes déjà membre de ${res.clubName}` : `Bienvenue dans ${res.clubName} 🎉`)
      setCode('')
      await onJoined()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 pt-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-4xl">🏸</div>
      <h1 className="mt-5 font-bebas text-3xl tracking-[2px] text-text">Rejoindre un club</h1>
      <p className="mt-2 text-muted">
        Saisissez le code d&apos;invitation communiqué par votre club pour rejoindre ses adhérents.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="Code (ex. 9F0727)"
          aria-label="Code d'invitation"
          className="flex-1 rounded-lg border border-subtle bg-surface-alt px-4 py-2.5 text-center font-spacemono text-lg font-bold tracking-[3px] text-text placeholder:text-sm placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || code.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Rejoindre
        </button>
      </div>

      <p className="mt-6 text-sm text-muted">
        Vous gérez un club ?{' '}
        <Link href="/settings" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          <Building2 className="h-3.5 w-3.5" /> Créez-le ici
        </Link>
      </p>
    </div>
  )
}
