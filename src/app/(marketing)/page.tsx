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
            La communauté badminton
          </div>

          <h1 className="font-display text-6xl font-extrabold leading-none tracking-tight text-text sm:text-8xl">
            Racket<span className="text-primary">Club</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
            Construit par des joueurs, <span className="text-primary">pour les clubs</span>
          </p>

          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Gérez vos tournois, connectez vos adhérents, retrouvez vos résultats.
            Gratuit, sans prise de tête, récupérez vos badges.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Rejoindre la communauté
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

      {/* Ce que ça change — avant / après */}
      <section className="border-t border-subtle px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
            Ce que ça change
          </h2>

          <ul className="space-y-3">
            {CHANGES.map(({ before, after }) => (
              <li
                key={after}
                className="grid grid-cols-1 gap-3 rounded-xl border border-subtle bg-surface p-4 sm:grid-cols-2 sm:gap-0"
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

      {/* Pourquoi RacketClub ? — l'histoire */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-subtle bg-surface/50 px-6 py-10 sm:px-10">
          <h2 className="mb-8 font-display text-2xl font-bold text-text">
            Pourquoi RacketClub ?
          </h2>
          <ol className="space-y-6">
            {STORY.map(({ when, text }) => (
              <li key={when} className="flex gap-4">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <p className="text-base text-text sm:text-lg">
                  <span className="font-display font-bold text-primary">{when}.</span>{' '}
                  <span className="text-muted">{text}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-24 pt-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-subtle bg-gradient-to-b from-surface to-app px-6 py-14 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight text-text sm:text-4xl">
            Votre club mérite mieux qu'un tableur ou qu'un format papier
          </h2>
          <p className="mt-4 text-base text-muted sm:text-lg">
            Créez votre espace en 2 minutes. Gratuit.
          </p>
          <div className="mt-8">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Créer l'espace de mon club
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
          <p>© {new Date().getFullYear()} RacketClub — Construit par des joueurs, pour les clubs.</p>
        </div>
      </footer>
    </main>
  )
}
