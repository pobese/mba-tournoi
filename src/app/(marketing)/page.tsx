import Link from 'next/link'
import { ArrowRight, Check, X } from 'lucide-react'

const CHANGES = [
  {
    before: 'Le classement sur un Excel partagé WhatsApp',
    after: 'Classement live pour tous',
  },
  {
    before: 'Les équipes du tournoi américain tirées au sort à la main',
    after: "L'algo s'en charge — partenaires mixés, zéro répétition",
  },
  {
    before: 'Les résultats oubliés après le tournoi',
    after: 'Chaque joueur garde son historique et ses badges',
  },
] as const

const STORY = [
  { when: 'Hier', text: "Né d'un tournoi BBQ." },
  { when: "Aujourd'hui", text: 'Utilisé par le MBA pour ses tournois du club.' },
  { when: 'Demain', text: "L'espace de tous les clubs." },
] as const

const STATS = [
  { num: '1', label: 'club' },
  { num: '3', label: 'formats de tournoi' },
  { num: '100%', label: 'gratuit' },
] as const

function Logo({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-bebas tracking-[2px] text-primary ${className}`}>
      RACKET<span className="text-text">CLUB</span>
    </span>
  )
}

export default function MarketingLanding() {
  return (
    <main className="rc-landing min-h-screen bg-app font-dmsans text-text">
      {/* ===== Navbar — frosted glass ===== */}
      <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-primary/10 bg-app/85 px-5 backdrop-blur-xl sm:px-8">
        <Link href="/" aria-label="RacketClub — accueil">
          <Logo className="text-xl sm:text-2xl" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-primary sm:inline-flex"
          >
            Se connecter
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Rejoindre →
          </Link>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <div className="rc-hero-bg absolute inset-0 z-0" />
        <div className="rc-grid absolute inset-0 z-0" />

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16">
          {/* Colonne gauche — texte */}
          <div>
            <div
              className="rc-fade mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[1px] text-primary"
              style={{ animationDelay: '0s' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              🏸 La communauté badminton
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
              Construit par des joueurs, pour les clubs. Tournois, classements, badges — tout
              ce dont votre club a besoin.
            </p>

            <div
              className="rc-fade mt-9 flex flex-wrap gap-3"
              style={{ animationDelay: '0.3s' }}
            >
              <Link
                href="/register"
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Rejoindre la communauté
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-subtle px-7 py-3.5 font-medium text-text transition-colors hover:border-primary hover:text-primary"
              >
                Se connecter
              </Link>
            </div>

            <div
              className="rc-fade mt-12 flex gap-8"
              style={{ animationDelay: '0.4s' }}
            >
              {STATS.map(({ num, label }) => (
                <div key={label} className="flex flex-col">
                  <span className="font-bebas text-4xl leading-none text-primary">{num}</span>
                  <span className="mt-1 text-xs tracking-wide text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite — card stack (masquée < md) */}
          <div
            className="rc-fade hidden justify-center md:flex"
            style={{ animationDelay: '0.2s' }}
            aria-hidden="true"
          >
            <div className="relative h-[440px] w-80">
              {/* Carte 1 — derrière */}
              <article className="rc-card-1 absolute left-5 top-0 z-10 w-64 rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
                <div className="mb-2 text-2xl">🏸</div>
                <div className="text-sm font-bold text-text">Tournoi Américain</div>
                <div className="text-xs text-muted">BBQ d'été 2026 · 24 joueurs</div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-alt">
                  <div className="h-full w-full rounded-full bg-primary" />
                </div>
                <span className="mt-3 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-primary">
                  Terminé
                </span>
              </article>

              {/* Carte 2 — milieu */}
              <article className="rc-card-2 absolute left-14 top-[60px] z-20 w-64 rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
                <div className="mb-2 text-2xl">🏆</div>
                <div className="text-sm font-bold text-text">Classement live</div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <div>
                    <span className="font-bold text-text">1. Léo</span> — 4V{' '}
                    <span className="text-primary">+28pts</span>
                  </div>
                  <div>
                    <span className="font-bold text-text">2. Alice</span> — 3V{' '}
                    <span className="text-primary">+21pts</span>
                  </div>
                </div>
                <span className="mt-3 inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-primary">
                  En cours
                </span>
              </article>

              {/* Carte 3 — devant, bordure lime */}
              <article className="rc-card-3 absolute left-5 top-[150px] z-30 w-64 rounded-2xl border border-primary/30 bg-surface-alt p-6 shadow-2xl">
                <div className="mb-2 text-2xl">🎯</div>
                <div className="text-sm font-bold text-text">Round 3 / 5</div>
                <div className="text-xs text-muted">Terrain 2 · Léo &amp; Marc vs Alice &amp; Sophie</div>
                <div className="mt-3 font-bebas text-4xl tracking-wide text-text">
                  18 <span className="text-muted">—</span> 15
                </div>
                <span className="mt-2 inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-accent">
                  À valider
                </span>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Ce que ça change — avant / après ===== */}
      <section className="border-t border-subtle px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center font-mono text-xs uppercase tracking-[3px] text-primary">
            // Concrètement
          </p>
          <h2 className="mb-10 text-center font-bebas text-4xl tracking-[2px] text-text sm:text-5xl">
            CE QUE ÇA CHANGE
          </h2>

          <ul className="space-y-3">
            {CHANGES.map(({ before, after }) => (
              <li
                key={after}
                className="grid grid-cols-1 gap-3 rounded-2xl border border-white/[0.06] bg-surface p-4 sm:grid-cols-2 sm:gap-0"
              >
                <div className="flex items-start gap-3 text-muted sm:pr-5">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-danger/80" aria-hidden="true" />
                  <span className="text-sm line-through decoration-danger/40 sm:text-base">
                    {before}
                  </span>
                </div>
                <div className="flex items-start gap-3 sm:border-l sm:border-subtle sm:pl-5">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium text-text sm:text-base">{after}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== Pourquoi RacketClub — l'histoire ===== */}
      <section className="px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.06] bg-surface/50 px-6 py-10 sm:px-10">
          <p className="mb-2 font-mono text-xs uppercase tracking-[3px] text-primary">
            // L'histoire
          </p>
          <h2 className="mb-8 font-bebas text-3xl tracking-[2px] text-text sm:text-4xl">
            POURQUOI RACKETCLUB ?
          </h2>
          <ol className="space-y-6">
            {STORY.map(({ when, text }) => (
              <li key={when} className="flex gap-4">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <p className="text-base text-text sm:text-lg">
                  <span className="font-bebas text-xl tracking-wide text-primary">{when}.</span>{' '}
                  <span className="text-muted">{text}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="px-5 pb-24 pt-8 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-primary/20 bg-gradient-to-b from-surface to-app px-6 py-14 text-center">
          <h2 className="mx-auto max-w-2xl font-bebas text-4xl leading-tight tracking-[1px] text-text sm:text-5xl">
            VOTRE CLUB MÉRITE MIEUX QU'UN TABLEUR
          </h2>
          <p className="mt-4 text-base text-muted sm:text-lg">
            Créez votre espace en 2 minutes. Gratuit.
          </p>
          <div className="mt-8">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Créer l'espace de mon club
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/[0.06] bg-surface/40 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <Logo className="text-xl" />
          <p>© {new Date().getFullYear()} RacketClub — Construit par des joueurs, pour les clubs.</p>
        </div>
      </footer>
    </main>
  )
}
