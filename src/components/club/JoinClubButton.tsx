'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { joinClubByToken } from '@/app/settings/club-actions'

export function JoinClubButton({ token, clubName }: { token: string; clubName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function join() {
    setLoading(true)
    try {
      const res = await joinClubByToken(token)
      if (res?.error) {
        toast.error('Erreur', { description: res.error })
        return
      }
      toast.success(
        res.alreadyMember ? `Vous êtes déjà membre de ${res.clubName}` : `Bienvenue dans ${res.clubName} 🎉`,
      )
      // Un adhérent rejoint → on l'amène sur le tab Club (et non /dashboard, orienté gestion).
      router.push('/?view=club')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={join} disabled={loading} className="w-full bg-primary font-bold text-app hover:bg-primary/90">
      {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
      Rejoindre {clubName}
    </Button>
  )
}
