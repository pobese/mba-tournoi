import Link from 'next/link'
import { ArrowRight, Trophy, Users, BarChart3 } from 'lucide-react'

const FEATURES = [
  {
    icon: Trophy,
    title: 'Tournois',
    desc: 'Américain, Classique, Rounds. Scores en temps réel.',
  },
  {
    icon: Users,
    title: 'Club',
    desc: 'Invitez vos adhérents en 30 secondes.',
  },
  {
    icon: BarChart3,
    title: 'Classements',
    desc: 'Chaque joueur suit sa progression.',
  },
] as const

function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 512 512" className="h-7 w-7" fill="none" aria-hidden="true">
        <g transform="rotate(-32 256 256)">
          <ellipse cx="206" cy="186" rx="84" ry="104" fill="none" stroke="currentColor" strokeWidth="26" />
          <rect x="194" y="286" width="24" height="168" rx="12" fill="currentColor" />
        </g>
        <circle cx="356" cy="330" r="30" fill="#facc15" />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-tight text-text">
        Racket<span className="text-primary">Club</span>
      </span>
    </span>
  )
}

export default function MarketingLanding() {
  return (
    <main className="min-h-screen bg-app text-text">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="text-primary" aria-label="RacketClub — accueil">
          <Logo />
        </Link>
        <Link
          href="/login"
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
        >
          Se connecter
        </Link>
      </header>

      {/* Hero */}
      <section className="hero-section relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-dim/30 px-4 py-1.5 text-sm font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Scores en temps réel
          </div>

          <h1 className="font-display text-6xl font-extrabold leading-none tracking-tight text-text sm:text-8xl">
            Racket<span className="text-primary">Club</span>
          </h1>

          <p className="mt-6 font-display text-xl font-semibold text-text sm:text-2xl">
            La plateforme des clubs de badminton
          </p>

          <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
            Tournois, classements, entraînement — tout ce dont votre club a besoin.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Créer mon club — gratuit
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-subtle bg-surface px-6 py-3 font-medium text-text transition-colors hover:bg-surface-alt"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-subtle px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-subtle bg-surface p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary-dim/30 p-2.5 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-bold text-text">{title}</h2>
              <p className="mt-1.5 text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-xl border border-subtle bg-surface/50 px-6 py-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Déjà adopté par
          </p>
          <p className="mt-3 font-display text-2xl font-bold text-text">
            MBA <span className="text-primary">·</span> Maule Badminton Association
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-24 pt-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-subtle bg-gradient-to-b from-surface to-app px-6 py-14 text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
            Votre club en ligne en 5 minutes
          </h2>
          <div className="mt-8">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Créer mon espace club
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-subtle px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
          <Link href="/" className="text-primary">
            <Logo />
          </Link>
          <p>© {new Date().getFullYear()} RacketClub — La plateforme des clubs de badminton.</p>
        </div>
      </footer>
    </main>
  )
}
