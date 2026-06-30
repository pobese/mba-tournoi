import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LayoutDashboard, Users, Trophy, Settings, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/players', label: 'Joueurs', icon: Users },
  { href: '/tournaments', label: 'Tournois', icon: Trophy },
  { href: '/settings', label: 'Paramètres', icon: Settings },
]

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-app flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-subtle bg-surface shrink-0">
        <div className="p-5 border-b border-subtle">
          <span className="font-bebas text-2xl tracking-[2px] text-text">
            MBA <span className="text-primary">TOURNOI</span>
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted hover:text-white hover:bg-surface-alt transition-colors text-sm font-medium"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-subtle space-y-1">
          <ThemeToggle />
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-muted hover:text-danger hover:bg-surface-alt transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile (sidebar masquée < lg) */}
        <header className="lg:hidden flex items-center justify-between border-b border-subtle bg-surface px-4 py-3">
          <span className="font-bebas text-xl tracking-[2px] text-text">
            MBA <span className="text-primary">TOURNOI</span>
          </span>
          <ThemeToggle variant="compact" />
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 lg:px-8">
          {children}
        </main>

        {/* Bottom nav mobile */}
        <nav className="lg:hidden border-t border-subtle bg-surface">
          <div className="flex">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-white transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
