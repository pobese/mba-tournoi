'use client'

import { useEffect, useState } from 'react'
import { Moon, Zap, Check } from 'lucide-react'
import { useThemeStore, type Theme } from '@/stores/theme-store'
import { cn } from '@/lib/utils'

// Swatches de marque : aperçus FIGÉS de chaque thème, affichés quelle que soit
// le thème actif. Ce ne sont pas des tokens swappables → hex assumé (cf. règle).
const DARK_SWATCH = ['#4ade80', '#facc15', '#f87171', '#94a3b8']
const FLUO_SWATCH = ['#FF4D6D', '#FFE600', '#39FF14', '#BF5FFF']
const FLUO_GRADIENT = `linear-gradient(135deg, ${FLUO_SWATCH.join(', ')})`
const FLUO_INK = '#0D0D0D' // texte lisible sur fond fluo clair

type Variant = 'full' | 'compact' | 'cards'

export function ThemeToggle({ variant = 'full' }: { variant?: Variant }) {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const setTheme = useThemeStore((s) => s.setTheme)

  // Évite le mismatch d'hydratation : on n'affiche l'état réel qu'après montage
  // (le SSR rend toujours « dark », valeur par défaut du store).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const active: Theme = mounted ? theme : 'dark'
  const isFluo = active === 'fluo'

  if (variant === 'cards') {
    return <ThemeCards active={active} setTheme={setTheme} />
  }

  const label = isFluo
    ? 'Thème fluo actif — basculer en sombre'
    : 'Thème sombre actif — basculer en fluo'
  const fluoStyle = isFluo
    ? { background: FLUO_GRADIENT, color: FLUO_INK, borderColor: 'transparent' }
    : undefined

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-subtle text-muted transition-colors duration-200 hover:text-white"
        style={fluoStyle}
      >
        {isFluo ? <Zap className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    )
  }

  // variant === 'full'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="flex w-full items-center gap-3 rounded-lg border border-subtle px-3 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-alt hover:text-white"
      style={fluoStyle}
    >
      {isFluo ? <Zap className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {isFluo ? 'Mode fluo' : 'Mode sombre'}
    </button>
  )
}

interface ThemeOption {
  value: Theme
  label: string
  description: string
  swatch: string[]
}

const OPTIONS: ThemeOption[] = [
  { value: 'dark', label: 'Mode sombre', description: 'Sobre et reposant', swatch: DARK_SWATCH },
  { value: 'fluo', label: 'Mode fluo', description: 'Vif et énergique', swatch: FLUO_SWATCH },
]

function ThemeCards({
  active,
  setTheme,
}: {
  active: Theme
  setTheme: (t: Theme) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPTIONS.map((opt) => {
        const selected = active === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={selected}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors duration-200',
              selected
                ? 'border-primary bg-surface-alt'
                : 'border-subtle bg-surface hover:bg-surface-alt'
            )}
          >
            <span className="flex gap-1" aria-hidden>
              {opt.swatch.map((c) => (
                <span key={c} className="h-6 w-3 rounded-full" style={{ background: c }} />
              ))}
            </span>
            <span className="flex-1">
              <span className="block font-medium text-white">{opt.label}</span>
              <span className="block text-xs text-muted">{opt.description}</span>
            </span>
            {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}
