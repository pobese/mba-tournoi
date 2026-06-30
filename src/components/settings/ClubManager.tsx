'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Copy, RefreshCw, Pencil, UserPlus, Crown, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  createClub, updateClub, regenerateInviteToken, inviteMemberToClub, requestToJoinClub,
} from '@/app/settings/club-actions'

type ClubRole = 'admin' | 'member'

export interface ClubData {
  id: string
  name: string
  full_name: string | null
  city: string | null
  postal_code: string | null
  invite_code: string | null
  invite_token: string
}

export interface ClubMemberRow {
  id: string
  email: string
  role: 'owner' | 'admin' | 'editor' | 'member'
  isOwner: boolean
}

const ROLE_LABELS: Record<ClubMemberRow['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  editor: 'Éditeur',
  member: 'Membre',
}

interface ClubManagerProps {
  club: ClubData | null
  members: ClubMemberRow[]
}

function useCopy() {
  return async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copié`)
    } catch {
      toast.error('Copie impossible')
    }
  }
}

const inputCls =
  'border-subtle bg-surface-alt text-white placeholder:text-muted focus-visible:ring-primary'

export function ClubManager({ club, members }: ClubManagerProps) {
  if (!club) return <CreateClubForm />
  return <ClubPanel club={club} members={members} />
}

// ─── Création (aucun club) ─────────────────────────────────────────────────────

function CreateClubForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', fullName: '', city: '', postalCode: '' })
  const [loading, setLoading] = useState(false)
  const [similar, setSimilar] = useState<{ id: string; name: string; city: string | null } | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(force = false) {
    setLoading(true)
    try {
      const res = await createClub({ ...form }, { force })
      if (res?.error) return toast.error('Erreur', { description: res.error })
      if ('warning' in res && res.warning) {
        setSimilar(res.similarClub)
        return
      }
      toast.success('Club créé 🎉')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function askToJoin() {
    if (!similar) return
    setLoading(true)
    try {
      const res = await requestToJoinClub(similar.id)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success('Demande envoyée au club')
      setSimilar(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du club *" id="club-name" value={form.name} onChange={set('name')} placeholder="MBA" />
        <Field label="Nom complet" id="club-fullname" value={form.fullName} onChange={set('fullName')} placeholder="Maule Badminton Association" />
        <Field label="Ville" id="club-city" value={form.city} onChange={set('city')} placeholder="Maule" />
        <Field label="Code postal" id="club-cp" value={form.postalCode} onChange={set('postalCode')} placeholder="78580" inputMode="numeric" />
      </div>
      <Button
        onClick={() => submit(false)}
        disabled={loading || form.name.trim().length < 2}
        className="bg-primary font-bold text-app hover:bg-primary/90"
      >
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Building2 className="mr-1.5 h-4 w-4" />}
        Créer mon club
      </Button>

      <AlertDialog open={Boolean(similar)} onOpenChange={(o) => { if (!o) setSimilar(null) }}>
        <AlertDialogContent className="border-subtle bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Un club similaire existe déjà</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              <strong className="text-white">{similar?.name}</strong>
              {similar?.city ? ` · ${similar.city}` : ''} existe déjà. Voulez-vous le rejoindre plutôt que créer un doublon ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { setSimilar(null); submit(true) }}
              className="border-subtle bg-surface-alt text-white hover:bg-surface-alt/80"
            >
              Créer quand même
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={askToJoin}
              className="bg-primary font-bold text-app hover:bg-primary/90"
            >
              Demander à rejoindre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Gestion (club existant) ───────────────────────────────────────────────────

function ClubPanel({ club, members }: { club: ClubData; members: ClubMemberRow[] }) {
  const router = useRouter()
  const copy = useCopy()
  const [origin, setOrigin] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => { setOrigin(window.location.origin) }, [])
  const link = `${origin}/rejoindre/${club.invite_token}`

  async function regenerate() {
    setRegenerating(true)
    try {
      const res = await regenerateInviteToken(club.id)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success('Lien régénéré — l’ancien est invalidé')
      router.refresh()
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* En-tête club */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-2xl">🏢</div>
          <div>
            <p className="font-display text-lg font-extrabold text-white">{club.name}</p>
            <p className="text-sm text-muted">
              {[club.full_name, club.city].filter(Boolean).join(' · ') || 'Aucune description'}
            </p>
          </div>
        </div>
        <EditClubDialog club={club} onSaved={() => router.refresh()} />
      </div>

      {/* Code d'invitation */}
      <div className="rounded-lg border border-subtle bg-surface-alt p-4">
        <Label className="text-xs uppercase tracking-wide text-muted">Code d’invitation</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-spacemono text-2xl font-bold tracking-[3px] text-accent tabular-nums">
            {club.invite_code ?? '—'}
          </span>
          {club.invite_code && (
            <button
              type="button"
              onClick={() => copy(club.invite_code!, 'Code')}
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-primary"
              aria-label="Copier le code"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lien partageable */}
      <div className="rounded-lg border border-subtle bg-surface-alt p-4">
        <Label className="text-xs uppercase tracking-wide text-muted">Lien partageable</Label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-md bg-surface px-3 py-2 text-xs text-white">
            {origin ? link : `…/rejoindre/${club.invite_token}`}
          </code>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => copy(link, 'Lien')}
              className="border-subtle bg-surface text-white hover:bg-surface/80"
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copier
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={regenerating} className="text-muted hover:text-danger">
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-subtle bg-surface">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Régénérer le lien ?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted">
                    L’ancien lien cessera de fonctionner immédiatement. Les membres déjà inscrits restent membres.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-subtle bg-surface-alt text-white hover:bg-surface-alt/80">Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={regenerate} className="bg-primary font-bold text-app hover:bg-primary/90">
                    Régénérer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Membres du club */}
      <ClubMembers clubId={club.id} members={members} />
    </div>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────────

function EditClubDialog({ club, onSaved }: { club: ClubData; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: club.name,
    fullName: club.full_name ?? '',
    city: club.city ?? '',
    postalCode: club.postal_code ?? '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setLoading(true)
    try {
      const res = await updateClub(club.id, { ...form })
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success('Club mis à jour')
      setOpen(false)
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-subtle bg-surface-alt text-white hover:bg-surface-alt/80">
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="border-subtle bg-surface">
        <DialogHeader>
          <DialogTitle className="text-white">Modifier le club</DialogTitle>
          <DialogDescription className="text-muted">Nom, nom complet et localisation.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom du club *" id="edit-name" value={form.name} onChange={set('name')} placeholder="MBA" />
          <Field label="Nom complet" id="edit-fullname" value={form.fullName} onChange={set('fullName')} placeholder="Maule Badminton Association" />
          <Field label="Ville" id="edit-city" value={form.city} onChange={set('city')} placeholder="Maule" />
          <Field label="Code postal" id="edit-cp" value={form.postalCode} onChange={set('postalCode')} placeholder="78580" inputMode="numeric" />
        </div>
        <DialogFooter>
          <Button
            onClick={save}
            disabled={loading || form.name.trim().length < 2}
            className="bg-primary font-bold text-app hover:bg-primary/90"
          >
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClubMembers({ clubId, members }: { clubId: string; members: ClubMemberRow[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ClubRole>('member')
  const [inviting, setInviting] = useState(false)

  async function invite() {
    const trimmed = email.trim()
    if (!trimmed) return
    setInviting(true)
    try {
      const res = await inviteMemberToClub(clubId, trimmed, role)
      if (res?.error) return toast.error('Erreur', { description: res.error })
      toast.success(`Invitation envoyée à ${trimmed}`)
      setEmail('')
      router.refresh()
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wide text-muted">Membres ({members.length})</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email" inputMode="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') invite() }}
          placeholder="email@exemple.com" aria-label="Email du membre à inviter"
          className={`flex-1 ${inputCls}`}
        />
        <select
          value={role} onChange={(e) => setRole(e.target.value as ClubRole)} aria-label="Rôle"
          className="h-10 rounded-md border border-subtle bg-surface-alt px-2 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary sm:w-32"
        >
          <option value="member">Membre</option>
          <option value="admin">Admin</option>
        </select>
        <Button onClick={invite} disabled={inviting || email.trim().length === 0} className="bg-primary font-bold text-app hover:bg-primary/90">
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-1.5 h-4 w-4" />Inviter</>}
        </Button>
      </div>
      <ul className="divide-y divide-subtle rounded-lg border border-subtle">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {m.isOwner
                ? <Crown className="h-4 w-4 shrink-0 text-accent" />
                : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-alt text-[10px] font-bold text-muted">{m.email[0]?.toUpperCase()}</span>}
              <span className="truncate text-sm text-white">{m.email}</span>
            </div>
            <span className="shrink-0 rounded-full border border-subtle bg-surface-alt px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
              {m.isOwner ? 'Propriétaire' : ROLE_LABELS[m.role]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Field({
  label, id, value, onChange, placeholder, inputMode,
}: {
  label: string; id: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; inputMode?: 'numeric' | 'email'
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-sm text-white">{label}</Label>
      <Input id={id} value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} className={inputCls} />
    </div>
  )
}
