'use client'

import { useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AmericanForm,
  ClassicForm,
  RoundsForm,
} from '@/components/tournament/TournamentConfigForm'
import { suggestPoolCount } from '@/lib/algorithms/classic-bracket'
import type { TournamentType, AmericanConfig, ClassicConfig, RoundsConfig } from '@/types/app'

type Config = AmericanConfig | ClassicConfig | RoundsConfig

interface Step3ConfigProps {
  type: TournamentType
  playerCount: number
  classicFormat?: 'singles' | 'doubles'
  classicTeamCount?: number
  onBack: () => void
  onSubmit: (config: Config) => Promise<void>
}

function defaultConfigFor(
  type: TournamentType,
  classicFormat: 'singles' | 'doubles',
  teamCount: number,
): Config {
  switch (type) {
    case 'american':
      return { format: 'doubles', courtsAvailable: 9, matchFormat: '1set', targetScore: 21 }
    case 'rounds':
      return { format: 'doubles', courtsAvailable: 9, matchFormat: '1set', targetScore: 21 }
    case 'classic':
      return {
        format: classicFormat,
        courtsAvailable: 9,
        poolMatchFormat: '1set',
        poolTargetScore: 21,
        bracketMatchFormat: '1set',
        bracketTargetScore: 21,
        nbPools: suggestPoolCount(teamCount),
      }
  }
}

export function Step3Config({
  type,
  playerCount,
  classicFormat = 'singles',
  classicTeamCount,
  onBack,
  onSubmit,
}: Step3ConfigProps) {
  const [config, setConfig] = useState<Config>(() =>
    defaultConfigFor(type, classicFormat, classicTeamCount ?? playerCount),
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    try {
      await onSubmit(config)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-alt border border-subtle rounded-xl p-5">
        {type === 'american' && (
          <AmericanForm config={config as AmericanConfig} onChange={setConfig} />
        )}
        {type === 'classic' && (
          <ClassicForm
            config={config as ClassicConfig}
            teamCount={classicTeamCount ?? playerCount}
            onChange={setConfig}
          />
        )}
        {type === 'rounds' && (
          <RoundsForm config={config as RoundsConfig} onChange={setConfig} />
        )}
      </div>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-muted hover:text-white gap-2"
          disabled={loading}
        >
          <ChevronLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-primary text-app font-bold hover:bg-primary/90 gap-2 min-w-36"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Création…
            </>
          ) : (
            'Créer le tournoi'
          )}
        </Button>
      </div>
    </div>
  )
}
