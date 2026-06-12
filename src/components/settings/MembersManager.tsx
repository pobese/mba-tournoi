'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, Crown, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from '@/app/(app)/settings/actions'

export interface MemberRow {
  id: string
  member_email: string
  role: 'admin' | 'editor'
  status: 'pending' | 'accepted'
}

interface MembersManagerProps {
  ownerId: string
  ownerEmail: string
  members: MemberRow[]
}

const roleSelectCls =
  'rounded-md border border-subtle bg-surface-alt px-2 py-1 text-xs font-medium text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50'

export function MembersManager({ ownerId, ownerEmail, members }: MembersManagerProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor'>('editor')
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleInvite() {
    const trimmed = email.trim()
    if (!trimmed) return
    setInviting(true)
    try {
      const result = await inviteMember(ownerId, trimmed, role)
      if (result?.error) {
        toast.error('Erreur', { description: typeof result.error === 'string' ? result.error : undefined })
        return
      }
      toast.success(`Invitation envoyée à ${trimmed}`)
      setEmail('')
      router.refresh()
    } catch (err) {
      toast.error('Erreur inattendue', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId: string, newRole: 'admin' | 'editor') {
    setBusyId(memberId)
    try {
      const result = await updateMemberRole(memberId, newRole)
      if (result?.error) {
        toast.error('Erreur', { description: typeof result.error === 'string' ? result.error : undefined })
        return
      }
      toast.success('Rôle mis à jour')
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(memberId: string, memberEmail: string) {
    setBusyId(memberId)
    try {
      const result = await removeMember(memberId)
      if (result?.error) {
        toast.error('Erreur', { description: typeof result.error === 'string' ? result.error : undefined })
        return
      }
      toast.success(`${memberEmail} retiré`)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Formulaire d'invitation */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
          placeholder="email@exemple.com"
          aria-label="Email du membre à inviter"
          className="flex-1 border-subtle bg-surface-alt text-white placeholder:text-muted"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'editor')}
          aria-label="Rôle"
          className={roleSelectCls + ' h-10 sm:w-32'}
        >
          <option value="editor">Éditeur</option>
          <option value="admin">Admin</option>
        </select>
        <Button
          onClick={handleInvite}
          disabled={inviting || email.trim().length === 0}
          className="bg-primary font-bold text-app hover:bg-primary/90"
        >
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-1.5 h-4 w-4" />Inviter</>}
        </Button>
      </div>

      {/* Liste des membres */}
      <ul className="divide-y divide-subtle rounded-lg border border-subtle">
        {/* Owner */}
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Crown className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate text-sm text-white">{ownerEmail}</span>
          </div>
          <span className="shrink-0 rounded-full border border-accent/30 bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent">
            Propriétaire
          </span>
        </li>

        {members.map((m) => {
          const busy = busyId === m.id
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {m.status === 'pending'
                  ? <Clock className="h-4 w-4 shrink-0 text-muted" />
                  : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-alt text-[10px] font-bold text-muted">{m.member_email[0]?.toUpperCase()}</span>}
                <span className="truncate text-sm text-white">{m.member_email}</span>
                {m.status === 'pending' && (
                  <span className="shrink-0 rounded-full border border-subtle bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-muted">
                    En attente
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => handleRoleChange(m.id, e.target.value as 'admin' | 'editor')}
                  aria-label={`Rôle de ${m.member_email}`}
                  className={roleSelectCls}
                >
                  <option value="editor">Éditeur</option>
                  <option value="admin">Admin</option>
                </select>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={busy}
                      aria-label={`Retirer ${m.member_email}`}
                      className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-subtle bg-surface">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Retirer {m.member_email} ?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted">
                        Ce membre perdra l&apos;accès à vos tournois.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-subtle bg-surface-alt text-white hover:bg-surface-alt/80">Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemove(m.id, m.member_email)}
                        className="border border-danger/30 bg-danger/20 text-danger hover:bg-danger hover:text-white"
                      >
                        Retirer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
