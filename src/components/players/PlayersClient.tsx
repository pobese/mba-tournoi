'use client'

import { useMemo, useState } from 'react'
import { Plus, Upload, Pencil, Trash2, MoreVertical, CheckSquare, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerFormDialog } from './PlayerFormDialog'
import { DeletePlayerDialog } from './DeletePlayerDialog'
import { BulkDeletePlayersDialog } from './BulkDeletePlayersDialog'
import { BulkImportDialog } from './BulkImportDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import type { Player } from '@/types/app'

export type PlayerRow = Pick<Player, 'id' | 'name' | 'level' | 'created_at'> & {
  club_id?: string | null
  club_name_hint?: string | null
  city_hint?: string | null
}

interface PlayersClientProps {
  initialPlayers: PlayerRow[]
}

interface DialogState {
  type: 'add' | 'edit' | 'delete' | 'import' | 'bulkDelete' | null
  player?: PlayerRow
}

export function PlayersClient({ initialPlayers }: PlayersClientProps) {
  const [dialog, setDialog] = useState<DialogState>({ type: null })
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const playerNames = useMemo(
    () => Object.fromEntries(initialPlayers.map((p) => [p.id, p.name])),
    [initialPlayers],
  )

  function openAdd() {
    setDialog({ type: 'add' })
  }
  function openEdit(player: PlayerRow) {
    setDialog({ type: 'edit', player })
  }
  function openDelete(player: PlayerRow) {
    setDialog({ type: 'delete', player })
  }
  function openImport() {
    setDialog({ type: 'import' })
  }
  function closeDialog() {
    setDialog({ type: null })
  }

  function enterSelectMode() {
    setSelectMode(true)
    setSelected(new Set())
  }
  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === initialPlayers.length ? new Set() : new Set(initialPlayers.map((p) => p.id)),
    )
  }

  const allSelected = initialPlayers.length > 0 && selected.size === initialPlayers.length

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {selectMode ? (
          <>
            <span className="text-sm text-white font-medium">
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              onClick={toggleAll}
              className="text-muted hover:text-white border border-subtle gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
            <Button
              onClick={() => setDialog({ type: 'bulkDelete' })}
              disabled={selected.size === 0}
              className="bg-danger text-white font-bold hover:bg-danger/90 gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer ({selected.size})
            </Button>
            <Button
              variant="ghost"
              onClick={exitSelectMode}
              className="text-muted hover:text-white gap-2"
            >
              <X className="w-4 h-4" />
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={openAdd}
              className="bg-primary text-app font-bold hover:bg-primary/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un joueur
            </Button>
            <Button
              variant="ghost"
              onClick={openImport}
              className="text-muted hover:text-white border border-subtle gap-2"
            >
              <Upload className="w-4 h-4" />
              Import
            </Button>
            {initialPlayers.length > 0 && (
              <Button
                variant="ghost"
                onClick={enterSelectMode}
                className="text-muted hover:text-white border border-subtle gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                Sélectionner
              </Button>
            )}
          </>
        )}
      </div>

      {/* Liste */}
      {initialPlayers.length === 0 ? (
        <EmptyState
          title="Aucun joueur"
          description="Ajoutez des joueurs pour les inclure dans vos tournois."
          action={
            <Button
              onClick={openAdd}
              className="bg-primary text-app font-bold hover:bg-primary/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un joueur
            </Button>
          }
        />
      ) : (
        <div className="bg-surface border border-subtle rounded-xl divide-y divide-subtle overflow-hidden">
          {initialPlayers.map((player) => {
            const isSelected = selected.has(player.id)
            return (
              <div
                key={player.id}
                onClick={selectMode ? () => toggle(player.id) : undefined}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 group transition-colors',
                  selectMode ? 'cursor-pointer' : '',
                  isSelected ? 'bg-primary/10' : 'hover:bg-surface-alt/50',
                )}
              >
                {/* Case de sélection */}
                {selectMode && (
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      isSelected ? 'bg-primary border-primary text-app' : 'border-subtle text-transparent',
                    )}
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}

                {/* Avatar */}
                <PlayerAvatar name={player.name} level={player.level ?? 3} size="sm" />

                {/* Nom + niveau + club/ville */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{player.name}</p>
                  <p className="text-muted text-xs">
                    {'★'.repeat(player.level ?? 3)}
                    <span className="text-subtle">{'★'.repeat(5 - (player.level ?? 3))}</span>
                  </p>
                  {(player.club_name_hint || player.city_hint) && (
                    <p className="text-muted text-xs truncate">
                      {[player.club_name_hint, player.city_hint].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {/* Actions (masquées en mode sélection) */}
                {!selectMode && (
                  <>
                    <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Modifier ${player.name}`}
                        onClick={() => openEdit(player)}
                        className="h-8 w-8 text-muted hover:text-white"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer ${player.name}`}
                        onClick={() => openDelete(player)}
                        className="h-8 w-8 text-muted hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="sm:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Actions"
                            className="h-8 w-8 text-muted"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-surface border-subtle">
                          <DropdownMenuItem
                            onClick={() => openEdit(player)}
                            className="text-white hover:bg-surface-alt cursor-pointer gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDelete(player)}
                            className="text-danger hover:bg-surface-alt cursor-pointer gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <PlayerFormDialog
        open={dialog.type === 'add'}
        onOpenChange={(o) => !o && closeDialog()}
      />
      <PlayerFormDialog
        open={dialog.type === 'edit'}
        onOpenChange={(o) => !o && closeDialog()}
        player={dialog.player}
      />
      <DeletePlayerDialog
        open={dialog.type === 'delete'}
        onOpenChange={(o) => !o && closeDialog()}
        playerId={dialog.player?.id ?? ''}
        playerName={dialog.player?.name ?? ''}
      />
      <BulkDeletePlayersDialog
        open={dialog.type === 'bulkDelete'}
        onOpenChange={(o) => !o && closeDialog()}
        playerIds={[...selected]}
        playerNames={playerNames}
        onDone={exitSelectMode}
      />
      <BulkImportDialog
        open={dialog.type === 'import'}
        onOpenChange={(o) => !o && closeDialog()}
      />
    </>
  )
}
