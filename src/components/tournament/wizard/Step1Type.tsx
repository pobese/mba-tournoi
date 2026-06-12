'use client'

import { useState } from 'react'
import { Shuffle, Trophy, BarChart3, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TournamentType } from '@/types/app'

interface Step1TypeProps {
  defaultName: string
  defaultType: TournamentType | null
  onNext: (name: string, type: TournamentType) => void
}

const TYPES: {
  type: TournamentType
  icon: React.ReactNode
  label: string
  description: string
}[] = [
  {
    type: 'american',
    icon: <Shuffle className="w-6 h-6" />,
    label: 'Américain',
    description: 'Partenaires mixés à chaque round, classement individuel',
  },
  {
    type: 'classic',
    icon: <Trophy className="w-6 h-6" />,
    label: 'Classique',
    description: 'Élimination directe avec consolante',
  },
  {
    type: 'rounds',
    icon: <BarChart3 className="w-6 h-6" />,
    label: 'Par Rounds',
    description: 'Reclassement après chaque round, système serpent',
  },
]

export function Step1Type({ defaultName, defaultType, onNext }: Step1TypeProps) {
  const [name, setName] = useState(defaultName)
  const [type, setType] = useState<TournamentType | null>(defaultType)
  const [nameError, setNameError] = useState('')

  function handleNext() {
    const trimmed = name.trim()
    if (trimmed.length < 3) {
      setNameError('Minimum 3 caractères')
      return
    }
    if (trimmed.length > 80) {
      setNameError('Maximum 80 caractères')
      return
    }
    if (!type) return
    setNameError('')
    onNext(trimmed, type)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="tournament-name" className="text-white text-sm">
          Nom du tournoi
        </Label>
        <Input
          id="tournament-name"
          autoFocus
          placeholder="Open de printemps 2025"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setNameError('')
          }}
          className="bg-surface-alt border-subtle text-white placeholder:text-muted text-base"
        />
        {nameError && <p className="text-danger text-xs">{nameError}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">Format du tournoi</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TYPES.map(({ type: t, icon, label, description }) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`text-left p-4 rounded-xl border transition-all ${
                type === t
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-subtle bg-surface-alt hover:border-primary/40'
              }`}
            >
              <div
                className={`mb-2 ${type === t ? 'text-primary' : 'text-muted'}`}
              >
                {icon}
              </div>
              <p className="font-display font-bold text-white text-sm">{label}</p>
              <p className="text-muted text-xs mt-1 leading-snug">{description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleNext}
          disabled={!type || !name.trim()}
          className="bg-primary text-app font-bold hover:bg-primary/90 gap-2"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
