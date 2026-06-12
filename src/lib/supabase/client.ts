'use client'

import { createBrowserClient } from '@supabase/ssr'

// Singleton : une seule instance partagée par toute l'application côté client.
// Plusieurs instances simultanées provoquent des conflits de rafraîchissement
// de token → déconnexions aléatoires + fuites de canaux Realtime.
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabaseClient() {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  if (!url || !key) {
    throw new Error(
      `Variables Supabase manquantes dans .env.local — URL: "${url}", KEY: "${key ? '[définie]' : '[manquante]'}"`
    )
  }

  // Supprime le slash final si présent (cause "Invalid path" dans auth-js)
  const cleanUrl = url.replace(/\/$/, '')

  _client = createBrowserClient(cleanUrl, key)
  return _client
}
