import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'fluo'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

/** Applique le thème sur <html> (no-op côté serveur). */
function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggle: () =>
        set((s) => {
          const next: Theme = s.theme === 'dark' ? 'fluo' : 'dark'
          applyTheme(next)
          return { theme: next }
        }),
    }),
    {
      name: 'badnet-theme', // localStorage
      // Re-synchronise le DOM avec la valeur persistée après hydratation
      // (le script inline de ThemeInitializer l'a déjà fait avant le paint).
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
