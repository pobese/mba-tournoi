'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  TOURNAMENTS,
  FORMAT_LABELS,
  type MarketingView,
  type TournamentFormat,
  type PublicTournament,
} from './data'

type Filter = 'all' | TournamentFormat

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'american', label: 'Américain' },
  { id: 'classic', label: 'Classique' },
  { id: 'rounds', label: 'Par Rounds' },
]

const STATUS_BADGE: Record<PublicTournament['status'], { label: string; cls: string }> = {
  open: { label: '✅ Inscriptions ouvertes', cls: 'bg-primary/15 text-primary' },
  soon: { label: '⏳ Bientôt', cls: 'bg-accent/15 text-accent' },
  full: { label: '🔴 Complet', cls: 'bg-danger/15 text-danger' },
}

const HERO_CARDS = [
  {
    cls: 'rc-card-1 left-5 top-0 z-10 border-white/10 bg-surface',
    emoji: '🏸',
    title: 'Tournoi Américain',
    body: <p className="text-xs text-muted">BBQ d&apos;été 2026 · 24 joueurs</p>,
    bar: true,
    badge: { label: 'Terminé', cls: 'bg-primary/10 text-primary' },
  },
  {
    cls: 'rc-card-2 left-14 top-[60px] z-20 border-white/10 bg-surface',
    emoji: '🏆',
    title: 'Classement live',
    body: (
      <p className="text-xs text-muted">
        1. Léo — 4V <span className="text-primary">+28pts</span>
      </p>
    ),
    bar: false,
    badge: { label: 'En cours', cls: 'bg-primary/15 text-primary' },
  },
  {
    cls: 'rc-card-3 left-5 top-[150px] z-30 border-primary/30 bg-surface-alt',
    emoji: '🎯',
    title: 'Round 3 / 5',
    body: (
      <>
        <p className="text-xs text-muted">Terrain 2 · 18—15</p>
        <div className="mt-2 font-bebas text-3xl tracking-wide text-text">
          18 <span className="text-muted">—</span> 15
        </div>
      </>
    ),
    bar: false,
    badge: { label: 'À valider', cls: 'bg-accent/15 text-accent' },
  },
] as const

interface HomeViewProps {
  onChange: (view: MarketingView) => void
}

export function HomeView({ onChange }: HomeViewProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const list = filter === 'all' ? TOURNAMENTS : TOURNAMENTS.filter((t) => t.format === filter)

  return (
    <>
      {/* ===== Hero ===== */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden">
        <div className="rc-hero-bg absolute inset-0 z-0" />
        <div className="rc-grid absolute inset-0 z-0" />

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="rc-fade mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[1px] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              🏸 Badminton · Tournois &amp; Clubs
            </div>

            <h1
              className="rc-fade font-bebas text-6xl leading-[0.95] tracking-[2px] text-text sm:text-7xl lg:text-8xl"
              style={{ animationDelay: '0.1s' }}
            >
              <span className="block">JOUE.</span>
              <span className="block text-primary">RENCONTRE.</span>
              <span className="block">REJOUE.</span>
            </h1>

            <p
              className="rc-fade mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg"
              style={{ animationDelay: '0.2s' }}
            >
              La première plateforme badminton pour les tournois publics et les clubs privés.
              Trouve un tournoi, crée ton club, retrouve tes résultats.
            </p>

            <div className="rc-fade mt-9 flex flex-wrap gap-3" style={{ animationDelay: '0.3s' }}>
              <Link
                href="/register"
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Je rejoins un tournoi 🏸
              </Link>
              <button
                type="button"
                onClick={() => onChange('club')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-subtle px-7 py-3.5 font-medium text-text transition-colors hover:border-primary hover:text-primary"
              >
                Je gère mon club <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Card stack */}
          <div className="rc-fade hidden justify-center md:flex" style={{ animationDelay: '0.2s' }} aria-hidden="true">
            <div className="relative h-[440px] w-80">
              {HERO_CARDS.map((c) => (
                <article key={c.title} className={`absolute w-64 rounded-2xl border p-6 shadow-2xl ${c.cls}`}>
                  <div className="mb-2 text-2xl">{c.emoji}</div>
                  <div className="text-sm font-bold text-text">{c.title}</div>
                  {c.body}
                  {c.bar && (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-alt">
                      <div className="h-full w-full rounded-full bg-primary" />
                    </div>
                  )}
                  <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${c.badge.cls}`}>
                    {c.badge.label}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Tournois à la une ===== */}
      <section className="border-t border-subtle px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 font-spacemono text-xs uppercase tracking-[3px] text-primary">// Découvrir</p>
          <h2 className="font-bebas text-4xl tracking-[2px] text-text sm:text-5xl">TOURNOIS À LA UNE</h2>
          <p className="mt-2 max-w-lg text-muted">Des tournois ouverts à tous, organisés par les clubs.</p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-white/[0.07] bg-surface text-text hover:border-primary hover:text-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function TournamentCard({ t }: { t: PublicTournament }) {
  const pct = Math.round((t.filled / t.spots) * 100)
  const badge = STATUS_BADGE[t.status]
  const full = t.status === 'full'

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface transition-all hover:-translate-y-1 hover:border-primary/25">
      <div className="relative overflow-hidden bg-gradient-to-br from-surface-alt to-app p-5">
        <span aria-hidden="true" className="absolute -right-2 -top-2 text-7xl opacity-10">
          🏸
        </span>
        <span className={`mb-3 inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
        <div className="font-bold text-text">🏸 {t.name}</div>
        <div className="text-sm text-muted">🏢 {t.org} · {FORMAT_LABELS[t.format]}</div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>📅 {t.date}</span>
          <span>⏰ {t.time}</span>
          <span>⭐ {t.level}</span>
          <span>💰 {t.price}</span>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex justify-between font-spacemono text-xs text-muted">
            <span>👥 {t.filled}/{t.spots} {t.unit}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {full ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-subtle bg-surface py-2.5 text-sm font-semibold text-muted"
          >
            Liste d&apos;attente
          </button>
        ) : (
          <Link
            href="/register"
            className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Je m&apos;inscris →
          </Link>
        )}
      </div>
    </div>
  )
}
