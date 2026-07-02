'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'
import { findMyHistoryMatches } from '@/app/(marketing)/actions'

export function FindHistoryButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function search() {
    setLoading(true)
    try {
      const ids = await findMyHistoryMatches()
      if (ids.length === 0) {
        toast.info('Aucun historique trouvé', {
          description: 'Aucun profil à votre nom dans vos clubs pour le moment.',
        })
        return
      }
      router.push(`/?view=player&claiming=true&match=${ids.join(',')}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={search}
      disabled={loading}
      className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      Chercher mon historique →
    </button>
  )
}
