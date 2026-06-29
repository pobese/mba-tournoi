'use client'

import Link from 'next/link'
import type { MarketingView } from './data'

const TABS: { id: MarketingView; label: string }[] = [
  { id: 'home', label: '🏠 Accueil' },
  { id: 'player', label: '🏸 Joueur' },
  { id: 'club', label: '🏢 Club' },
  { id: 'organizer', label: '🏆 Organisateur' },
]

interface MarketingNavProps {
  active: MarketingView
  onChange: (view: MarketingView) => void
}

export function MarketingNav({ active, onChange }: MarketingNavProps) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-primary/10 bg-app/85 px-4 backdrop-blur-xl sm:px-8">
      <button
        type="button"
        onClick={() => onChange('home')}
        className="font-bebas text-xl tracking-[2px] text-primary sm:text-2xl"
      >
        RACKET<span className="text-text">CLUB</span>
      </button>

      <div className="flex items-center gap-1 sm:gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-primary font-bold text-primary-foreground'
                : 'text-muted hover:text-primary'
            } ${tab.id === active ? 'inline-flex' : 'hidden md:inline-flex'}`}
          >
            {tab.label}
          </button>
        ))}

        <Link
          href="/register"
          className="ml-1 rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          S&apos;inscrire →
        </Link>
      </div>
    </nav>
  )
}
