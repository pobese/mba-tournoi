'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Settings, LogOut } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { MarketingView } from './data'

const TABS: { id: MarketingView; label: string }[] = [
  { id: 'home', label: '🏠 Accueil' },
  { id: 'player', label: '🏸 Joueur' },
  { id: 'club', label: '🏢 Club' },
  { id: 'organizer', label: '🏆 Organisateur' },
]

interface MarketingNavProps {
  // Onglet actif (highlight). Absent sur les pages hors landing (ex. /settings).
  active?: MarketingView
}

/** Nom affiché — jamais l'email : full_name/display_name/name, sinon partie locale de l'email. */
function displayNameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const meta = user?.user_metadata ?? {}
  const name = [meta.full_name, meta.display_name, meta.name].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )
  if (name) return name.trim()
  const local = (user?.email ?? '').split('@')[0]?.trim()
  if (local) return local.charAt(0).toUpperCase() + local.slice(1)
  return 'Compte'
}

export function MarketingNav({ active }: MarketingNavProps) {
  // getSession() lit le stockage local (pas d'appel réseau) ; onAuthStateChange
  // garde la navbar à jour en live.
  const [authed, setAuthed] = useState(false)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setAuthed(Boolean(data.session))
      setDisplayName(data.session ? displayNameFromUser(data.session.user) : null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session))
      setDisplayName(session ? displayNameFromUser(session.user) : null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-primary/10 bg-app/85 px-4 backdrop-blur-xl sm:px-8">
      <Link href="/" className="font-bebas text-xl tracking-[2px] text-primary sm:text-2xl">
        RACKET<span className="text-text">CLUB</span>
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        {authed &&
          TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/?view=${tab.id}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active === tab.id
                  ? 'bg-primary font-bold text-primary-foreground'
                  : 'text-muted hover:text-primary'
              } ${tab.id === active ? 'inline-flex' : 'hidden md:inline-flex'}`}
            >
              {tab.label}
            </Link>
          ))}

        {authed ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-subtle px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:border-primary hover:text-primary focus:outline-none">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {displayName?.[0]?.toUpperCase() ?? '?'}
              </span>
              <span className="hidden max-w-[10rem] truncate sm:inline">{displayName ?? 'Compte'}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-subtle bg-surface">
              {displayName && <DropdownMenuLabel className="max-w-[14rem] truncate text-muted">{displayName}</DropdownMenuLabel>}
              <DropdownMenuSeparator className="bg-subtle" />
              <DropdownMenuItem asChild className="text-text focus:bg-surface-alt focus:text-primary">
                <Link href="/settings"><Settings className="mr-2 h-4 w-4" /> Paramètres</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-muted focus:bg-surface-alt focus:text-danger"
              >
                <LogOut className="mr-2 h-4 w-4" /> Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="ml-1 flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="hidden rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:inline-flex"
            >
              S&apos;inscrire →
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
