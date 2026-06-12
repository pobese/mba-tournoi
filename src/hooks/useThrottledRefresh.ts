'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * router.refresh() throttlé avec appel traînant. Après un score, deux demandes
 * de refresh partent quasi simultanément (callback de l'action + écho Realtime
 * debouncé) : sans garde-fou, le serveur re-rend la page deux fois. Ici, la
 * première part immédiatement et les suivantes dans la fenêtre sont fusionnées
 * en UN refresh planifié en fin de fenêtre — le dernier état n'est jamais perdu.
 */
export function useThrottledRefresh(minIntervalMs = 400): () => void {
  const router = useRouter()
  const lastRun = useRef(0)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (pending.current) clearTimeout(pending.current)
    }
  }, [])

  return useCallback(() => {
    const elapsed = Date.now() - lastRun.current
    if (elapsed >= minIntervalMs) {
      lastRun.current = Date.now()
      router.refresh()
    } else if (!pending.current) {
      pending.current = setTimeout(() => {
        pending.current = null
        lastRun.current = Date.now()
        router.refresh()
      }, minIntervalMs - elapsed)
    }
  }, [router, minIntervalMs])
}
