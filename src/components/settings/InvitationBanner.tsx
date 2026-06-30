'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { acceptInvitation, declineInvitation } from '@/app/settings/actions'

export interface PendingInvitation {
  id: string
  ownerEmail: string
  role: 'admin' | 'editor'
}

export function InvitationBanner({ invitations }: { invitations: PendingInvitation[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  if (invitations.length === 0) return null

  async function act(
    id: string,
    fn: (id: string) => Promise<{ success?: boolean; error?: string } | undefined>,
    okMessage: string,
  ) {
    setBusyId(id)
    try {
      const result = await fn(id)
      if (result?.error) {
        toast.error('Erreur', { description: result.error })
        return
      }
      toast.success(okMessage)
      router.refresh()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mb-6 space-y-3">
      {invitations.map((inv) => {
        const busy = busyId === inv.id
        return (
          <div
            key={inv.id}
            className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-white">
                🏸 <span className="font-bold">{inv.ownerEmail}</span> vous invite à rejoindre son organisation
                <span className="block text-xs text-muted">
                  Rôle : {inv.role === 'admin' ? 'Admin' : 'Éditeur'}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                onClick={() => act(inv.id, acceptInvitation, 'Invitation acceptée')}
                disabled={busy}
                className="bg-primary font-bold text-app hover:bg-primary/90"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accepter'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act(inv.id, declineInvitation, 'Invitation refusée')}
                disabled={busy}
                className="text-muted hover:bg-surface-alt hover:text-white"
              >
                Refuser
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
