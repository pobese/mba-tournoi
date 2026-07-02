'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { claimPlayerProfile } from '@/app/(marketing)/actions'

export interface ClaimTournament {
  name: string
  typeLabel: string
}

export interface ClaimCandidate {
  id: string
  name: string
  tournaments: ClaimTournament[]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function ClaimProfileSection({ candidates }: { candidates: ClaimCandidate[] }) {
  const router = useRouter()
  const [visible, setVisible] = useState(candidates)
  const [pendingId, setPendingId] = useState<string | null>(null)

  function skip() {
    router.push('/?view=player')
  }

  async function claim(id: string) {
    setPendingId(id)
    try {
      const res = await claimPlayerProfile(id)
      if (!res.ok) {
        toast.error('Impossible de rattacher ce profil', { description: res.error })
        return
      }
      toast.success('Profil rattaché !', { description: 'Votre historique est maintenant lié à votre compte.' })
      router.push('/?view=player')
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  function reject(id: string) {
    setVisible((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) router.push('/?view=player')
      return next
    })
  }

  if (visible.length === 0) return null

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-8">
      <div className="overflow-hidden rounded-2xl border border-primary/25 bg-surface shadow-2xl">
        <div className="border-b border-subtle bg-primary/10 px-5 py-4 sm:px-6">
          <h2 className="font-bebas text-2xl tracking-wide text-text">🏸 On a trouvé des correspondances !</h2>
          <p className="mt-0.5 text-sm text-muted">Avez-vous participé à ces tournois ?</p>
        </div>

        <div className="flex flex-col gap-3 p-5 sm:p-6">
          {visible.map((c) => {
            const busy = pendingId === c.id
            return (
              <div key={c.id} className="rounded-xl border border-subtle bg-surface-alt p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary font-bebas text-lg text-primary-foreground">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text">{c.name}</p>
                    {c.tournaments.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {c.tournaments.map((t, i) => (
                          <li key={i} className="truncate text-xs text-muted">
                            {t.name} · {t.typeLabel}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted">Aucun tournoi enregistré</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => claim(c.id)}
                    disabled={busy || pendingId !== null}
                    className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Oui, c’est moi !
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(c.id)}
                    disabled={pendingId !== null}
                    className="rounded-lg border border-subtle px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Non
                  </button>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={skip}
            disabled={pendingId !== null}
            className="mt-1 self-center text-sm font-medium text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            Passer cette étape →
          </button>
        </div>
      </div>
    </div>
  )
}
