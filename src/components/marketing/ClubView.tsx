import Link from 'next/link'
import { TOURNAMENTS, FORMAT_LABELS } from './data'

const KPIS = [
  { icon: '👥', val: '18', label: 'Membres actifs' },
  { icon: '🏆', val: '3', label: 'Tournois ce mois' },
  { icon: '🏸', val: '64', label: 'Matchs joués' },
  { icon: '🎯', val: '4', label: 'Terrains' },
]

const PRIVATE = TOURNAMENTS.filter((t) => t.org === 'Privé')
const PUBLIC = TOURNAMENTS.filter((t) => t.org !== 'Privé')

export function ClubView() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-8">
      {/* Header club */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">🏢</div>
          <div>
            <h1 className="font-bebas text-3xl tracking-[2px] text-text sm:text-4xl">MBA</h1>
            <p className="text-sm text-muted">Maule Badminton Association · Badminton · 18 membres</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Créer un tournoi
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-subtle px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-primary hover:text-primary"
          >
            Inviter des membres
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {KPIS.map((k) => (
          <div
            key={k.label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-surface p-5"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
            <div className="text-2xl">{k.icon}</div>
            <div className="mt-2 font-bebas text-3xl tracking-wide text-text">{k.val}</div>
            <div className="text-xs text-muted">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tournois privés / publics */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClubSection
          title="🔒 Tournois privés"
          desc="Réservés aux membres du club."
          rows={PRIVATE.map((t) => ({ name: t.name, meta: `${t.date} · ${FORMAT_LABELS[t.format]} · ${t.level}` }))}
          cta="Nouveau tournoi privé"
        />
        <ClubSection
          title="🌍 Tournois publics"
          desc="Ouverts à tous les joueurs."
          rows={PUBLIC.map((t) => ({
            name: t.name,
            meta: `${t.date} · ${FORMAT_LABELS[t.format]} · ${t.filled}/${t.spots}`,
          }))}
          cta="Ouvrir un tournoi au public"
        />
      </div>
    </div>
  )
}

interface ClubSectionProps {
  title: string
  desc: string
  rows: { name: string; meta: string }[]
  cta: string
}

function ClubSection({ title, desc, rows, cta }: ClubSectionProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface p-5 sm:p-6">
      <h2 className="font-bold text-text">{title}</h2>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3 text-sm text-muted">
            Aucun tournoi pour l&apos;instant.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.name} className="rounded-lg border border-white/[0.04] bg-surface-alt px-4 py-3">
              <div className="text-sm font-semibold text-text">{r.name}</div>
              <div className="font-spacemono text-xs text-muted">{r.meta}</div>
            </div>
          ))
        )}
      </div>
      <Link
        href="/register"
        className="mt-4 inline-block text-sm font-semibold text-primary transition-opacity hover:opacity-80"
      >
        {cta} →
      </Link>
    </div>
  )
}
