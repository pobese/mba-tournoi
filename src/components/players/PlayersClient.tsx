'use client'

import { useState } from 'react'
import { Plus, Upload, Pencil, Trash2, MoreVertical } from 'lucide-react'
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
import { BulkImportDialog } from './BulkImportDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Player } from '@/types/app'

type PlayerRow = Pick<Player, 'id' | 'name' | 'level' | 'created_at'>

interface PlayersClientProps {
  initialPlayers: PlayerRow[]
}

interface DialogState {
  type: 'add' | 'edit' | 'delete' | 'import' | null
  player?: PlayerRow
}

export function PlayersClient({ initialPlayers }: PlayersClientProps) {
  const [dialog, setDialog] = useState<DialogState>({ type: null })

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

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
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
          {initialPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-4 px-4 py-3 group hover:bg-surface-alt/50 transition-colors"
            >
              {/* Avatar */}
              <PlayerAvatar name={player.name} level={player.level ?? 3} size="sm" />

              {/* Nom + niveau */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{player.name}</p>
                <p className="text-muted text-xs">
                  {'★'.repeat(player.level ?? 3)}
                  <span className="text-subtle">{'★'.repeat(5 - (player.level ?? 3))}</span>
                </p>
              </div>

              {/* Actions desktop — visibles au hover */}
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

              {/* Actions mobile — DropdownMenu */}
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
            </div>
          ))}
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
      <BulkImportDialog
        open={dialog.type === 'import'}
        onOpenChange={(o) => !o && closeDialog()}
      />
    </>
  )
}
