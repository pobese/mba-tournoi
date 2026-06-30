'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Crown, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateClubMemberRole, removeClubMember } from '@/app/settings/club-actions'
import { formatDate } from '@/lib/utils'

export interface ClubMemberFullRow {
  id: string
  email: string
  role: 'owner' | 'admin' | 'editor' | 'member'
  isOwner: boolean
  isSelf: boolean
  joinedAt: string | null
}

const ROLE_LABELS: Record<ClubMemberFullRow['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  editor: 'Éditeur',
  member: 'Membre',
}

const roleSelectCls =
  'rounded-md border border-subtle bg-surface-alt px-2 py-1 text-xs font-medium text-text ' +
  'focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50'

export function ClubMembersManager({ members, canManage }: { members: ClubMemberFullRow[]; canManage: boolean }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function changeRole(id: string, role: 'admin' | 'editor' | 'member') {
    setBusyId(id)
    try {
      const res = await updateClubMemberRole(id, role)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success('Rôle mis à jour')
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string, email: string) {
    setBusyId(id)
    try {
      const res = await removeClubMember(id)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success(`${email} retiré du club`)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ul className="divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface">
      {members.map((m) => {
        const busy = busyId === m.id
        const manageable = canManage && !m.isOwner && !m.isSelf
        return (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              {m.isOwner ? (
                <Crown className="h-5 w-5 shrink-0 text-accent" />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-alt text-xs font-bold text-muted">
                  {m.email[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm text-text">{m.email}</div>
                <div className="text-xs text-muted">
                  {m.joinedAt ? `Depuis le ${formatDate(m.joinedAt)}` : 'Membre du club'}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {manageable ? (
                <>
                  <select
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => changeRole(m.id, e.target.value as 'admin' | 'editor' | 'member')}
                    aria-label={`Rôle de ${m.email}`}
                    className={roleSelectCls}
                  >
                    <option value="member">Membre</option>
                    <option value="editor">Éditeur</option>
                    <option value="admin">Admin</option>
                  </select>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={busy}
                        aria-label={`Retirer ${m.email}`}
                        className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-subtle bg-surface">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-text">Retirer {m.email} ?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted">
                          Ce membre perdra l&apos;accès au club.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-subtle bg-surface-alt text-text hover:bg-surface-alt/80">Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove(m.id, m.email)}
                          className="border border-danger/30 bg-danger/20 text-danger hover:bg-danger hover:text-white"
                        >
                          Retirer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <span className="rounded-full border border-subtle bg-surface-alt px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {ROLE_LABELS[m.role]}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
