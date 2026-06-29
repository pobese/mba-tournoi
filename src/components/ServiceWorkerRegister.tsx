'use client'

import { useEffect } from 'react'

// Enregistre le service worker (PWA) après l'hydratation, hors développement
// pour éviter d'interférer avec le HMR de Next.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Échec silencieux : la PWA reste fonctionnelle sans cache offline.
      })
    }

    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
