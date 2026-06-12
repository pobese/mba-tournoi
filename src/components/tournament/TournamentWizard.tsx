'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { WizardProgress } from './wizard/WizardProgress'
import { Step1Type } from './wizard/Step1Type'
import { Step2Players } from './wizard/Step2Players'
import { Step2ClassicPlayers, type ClassicTeamPair } from './wizard/Step2ClassicPlayers'
import { Step3Config } from './wizard/Step3Config'
import { createTournament } from '@/app/(app)/tournaments/actions'
import type { TournamentType, Player, AmericanConfig, ClassicConfig, RoundsConfig } from '@/types/app'

type PlayerRow = Pick<Player, 'id' | 'name' | 'level'>
type Config = AmericanConfig | ClassicConfig | RoundsConfig

interface TournamentWizardProps {
  players: PlayerRow[]
}

interface WizardState {
  step: 1 | 2 | 3
  name: string
  type: TournamentType | null
  playerIds: string[]
  classicFormat: 'singles' | 'doubles'
  classicTeams: ClassicTeamPair[]
}

export function TournamentWizard({ players }: TournamentWizardProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    name: '',
    type: null,
    playerIds: [],
    classicFormat: 'singles',
    classicTeams: [],
  })

  function goToStep2(name: string, type: TournamentType) {
    setState((s) => ({ ...s, step: 2, name, type }))
  }

  function goToStep3(playerIds: string[]) {
    setState((s) => ({ ...s, step: 3, playerIds }))
  }

  function goToStep3Classic(data: {
    playerIds: string[]
    format: 'singles' | 'doubles'
    teams: ClassicTeamPair[]
  }) {
    setState((s) => ({
      ...s,
      step: 3,
      playerIds: data.playerIds,
      classicFormat: data.format,
      classicTeams: data.teams,
    }))
  }

  async function handleCreate(config: Config) {
    if (!state.type) return

    const result = await createTournament({
      name: state.name,
      type: state.type,
      playerIds: state.playerIds,
      config,
      ...(state.type === 'classic' && state.classicFormat === 'doubles'
        ? { teams: state.classicTeams }
        : {}),
    })

    // createTournament redirige si succès — on arrive ici uniquement en cas d'erreur
    if (result?.error) {
      const msg =
        typeof result.error === 'string'
          ? result.error
          : Object.values(result.error as Record<string, string[]>)
              .flat()
              .join(', ')
      toast.error('Création impossible', { description: msg, duration: 6000 })
    }
  }

  return (
    <div className="bg-surface border border-subtle rounded-xl p-6 sm:p-8 max-w-2xl">
      <WizardProgress currentStep={state.step} />

      {state.step === 1 && (
        <Step1Type defaultName={state.name} defaultType={state.type} onNext={goToStep2} />
      )}

      {state.step === 2 && state.type === 'classic' && (
        <Step2ClassicPlayers
          players={players}
          defaultSelected={state.playerIds}
          defaultFormat={state.classicFormat}
          defaultTeams={state.classicTeams}
          onBack={() => setState((s) => ({ ...s, step: 1 }))}
          onNext={goToStep3Classic}
        />
      )}

      {state.step === 2 && state.type && state.type !== 'classic' && (
        <Step2Players
          players={players}
          type={state.type}
          defaultSelected={state.playerIds}
          onBack={() => setState((s) => ({ ...s, step: 1 }))}
          onNext={goToStep3}
        />
      )}

      {state.step === 3 && state.type && (
        <Step3Config
          type={state.type}
          playerCount={state.playerIds.length}
          classicFormat={state.classicFormat}
          classicTeamCount={state.classicFormat === 'doubles' ? state.classicTeams.length : state.playerIds.length}
          onBack={() => setState((s) => ({ ...s, step: 2 }))}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}
