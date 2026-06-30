'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Crown, Shield, Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateClubMemberRole, removeClubMember } from '@/app/settings/club-actions'
import { formatDate } from '@/lib/utils'

export interface ClubMemberFullRow {
  id: string
  /** Nom affiché — JAMAIS l'email (confidentialité : la page est visible par tout adhérent). */
  displayName: string
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

// Effet hover commun aux cartes (cf. cartes flottantes du hero / landing).
const CARD_HOVER =
  'transition-all duration-200 hover:scale-[1.02] hover:border-primary/40 ' +
  'hover:shadow-[0_0_20px_rgba(200,241,53,0.1)]'

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

  async function remove(id: string, name: string) {
    setBusyId(id)
    try {
      const res = await removeClubMember(id)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success(`${name} retiré du club`)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  // Bureau = membres qui gèrent le club ; Adhérents = membres simples.
  const bureau = members.filter((m) => m.role !== 'member')
  const adherents = members.filter((m) => m.role === 'member')

  return (
    <div className="flex flex-col gap-8">
      <Section title="Bureau" count={bureau.length} emptyLabel="Aucun membre du bureau.">
        {bureau.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            canManage={canManage}
            busy={busyId === m.id}
            onChangeRole={changeRole}
            onRemove={remove}
          />
        ))}
      </Section>

      <Section title="Adhérents" count={adherents.length} emptyLabel="Aucun adhérent pour l'instant.">
        {adherents.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            canManage={canManage}
            busy={busyId === m.id}
            onChangeRole={changeRole}
            onRemove={remove}
          />
        ))}
      </Section>
    </div>
  )
}

function Section({
  title, count, emptyLabel, children,
}: {
  title: string
  count: number
  emptyLabel: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 font-bebas text-2xl tracking-[1px] text-text">
        {title} <span className="text-muted">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="rounded-xl border border-subtle bg-surface px-5 py-6 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      )}
    </section>
  )
}

const ROLE_ICON: Partial<Record<ClubMemberFullRow['role'], { Icon: typeof Crown; cls: string }>> = {
  owner: { Icon: Crown, cls: 'text-accent' },
  admin: { Icon: Shield, cls: 'text-primary' },
  editor: { Icon: Pencil, cls: 'text-info' },
}

function MemberRow({
  member: m, canManage, busy, onChangeRole, onRemove,
}: {
  member: ClubMemberFullRow
  canManage: boolean
  busy: boolean
  onChangeRole: (id: string, role: 'admin' | 'editor' | 'member') => void
  onRemove: (id: string, name: string) => void
}) {
  const manageable = canManage && !m.isOwner && !m.isSelf
  const roleIcon = ROLE_ICON[m.role]

  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-subtle bg-surface px-4 py-3.5 ${CARD_HOVER}`}>
      <div className="flex min-w-0 items-center gap-3">
        {roleIcon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-alt">
            <roleIcon.Icon className={`h-4 w-4 ${roleIcon.cls}`} />
          </span>
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-alt text-sm font-bold text-muted">
            {m.displayName[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-text">{m.displayName}</span>
            {m.isSelf && (
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">
                vous
              </span>
            )}
          </div>
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
              onChange={(e) => onChangeRole(m.id, e.target.value as 'admin' | 'editor' | 'member')}
              aria-label={`Rôle de ${m.displayName}`}
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
                  aria-label={`Retirer ${m.displayName}`}
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-subtle bg-surface">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-text">Retirer {m.displayName} ?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted">
                    Ce membre perdra l&apos;accès au club.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-subtle bg-surface-alt text-text hover:bg-surface-alt/80">Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onRemove(m.id, m.displayName)}
                    className="border border-danger/30 bg-danger/20 text-danger hover:bg-danger hover:text-white"
                  >
                    Retirer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : roleIcon ? (
          <span className="rounded-full border border-subtle bg-surface-alt px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
            {ROLE_LABELS[m.role]}
          </span>
        ) : null}
      </div>
    </li>
  )
}
