'use client'

import { Label } from '@/components/ui/label'
import {
  calculatePoolDistribution,
  detectBracketSize,
  maxPoolCount,
  countPoolMatches,
  countBracketMatches,
} from '@/lib/algorithms/classic-bracket'
import { CLASSIC_TARGET_SCORES } from '@/lib/constants'
import type { AmericanConfig, ClassicConfig, RoundsConfig } from '@/types/app'

export const TARGET_SCORES = [15, 21, 30] as const
export const ROUNDS_TARGET_SCORES = [11, 15, 21] as const

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  formatLabel,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  formatLabel?: (v: T) => string
}) {
  return (
    <div className="flex rounded-lg border border-subtle overflow-hidden">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            value === opt
              ? 'bg-primary text-app'
              : 'text-muted hover:text-white hover:bg-surface-alt'
          }`}
        >
          {formatLabel ? formatLabel(opt) : String(opt)}
        </button>
      ))}
    </div>
  )
}

export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-white text-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-lg border border-subtle bg-surface-alt text-white font-bold text-lg hover:bg-subtle disabled:opacity-30 transition-colors"
        >
          −
        </button>
        <span className="w-8 text-center font-display font-bold text-white text-lg tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-lg border border-subtle bg-surface-alt text-white font-bold text-lg hover:bg-subtle disabled:opacity-30 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-white text-sm">{label}</Label>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-alt border border-subtle'}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

export function AmericanForm({
  config,
  onChange,
}: {
  config: AmericanConfig
  onChange: (c: AmericanConfig) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Format</Label>
        <SegmentedControl
          options={['singles', 'doubles'] as const}
          value={config.format}
          onChange={(v) => onChange({ ...config, format: v })}
          formatLabel={(v) => (v === 'singles' ? 'Simple (1v1)' : 'Double (2v2)')}
        />
      </div>
      <NumberStepper
        label="Terrains disponibles"
        value={config.courtsAvailable}
        min={1}
        max={9}
        onChange={(v) => onChange({ ...config, courtsAvailable: v })}
      />
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Format de match</Label>
        <SegmentedControl
          options={['1set', '2sets'] as const}
          value={config.matchFormat}
          onChange={(v) => onChange({ ...config, matchFormat: v })}
          formatLabel={(v) => (v === '1set' ? '1 set gagnant' : '2 sets gagnants (best of 3)')}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Score cible par set</Label>
        <SegmentedControl
          options={ROUNDS_TARGET_SCORES}
          value={config.targetScore}
          onChange={(v) => onChange({ ...config, targetScore: v })}
        />
      </div>
    </div>
  )
}

export function ClassicForm({
  config,
  teamCount,
  onChange,
}: {
  config: ClassicConfig
  teamCount: number
  onChange: (c: ClassicConfig) => void
}) {
  // Aperçu dynamique poules + tableau (seulement si effectif ≥ 4).
  const preview = (() => {
    if (teamCount < 4) return null
    try {
      return {
        dist: calculatePoolDistribution(teamCount, config.nbPools),
        sizing: detectBracketSize(teamCount),
      }
    } catch {
      return null
    }
  })()

  const matchFormatLabel = (v: '1set' | '2sets') =>
    v === '1set' ? '1 set gagnant' : '2 sets gagnants'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Format</span>
        <span className="text-white font-medium">
          {config.format === 'singles' ? 'Simple (1v1)' : 'Double (2v2)'}
        </span>
      </div>

      <NumberStepper
        label="Terrains disponibles"
        value={config.courtsAvailable}
        min={1}
        max={12}
        onChange={(v) => onChange({ ...config, courtsAvailable: v })}
      />

      {/* Poules */}
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Format de match — Poules</Label>
        <SegmentedControl
          options={['1set', '2sets'] as const}
          value={config.poolMatchFormat}
          onChange={(v) => onChange({ ...config, poolMatchFormat: v })}
          formatLabel={matchFormatLabel}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Score cible — Poules</Label>
        <SegmentedControl
          options={CLASSIC_TARGET_SCORES}
          value={config.poolTargetScore}
          onChange={(v) => onChange({ ...config, poolTargetScore: v })}
        />
      </div>

      {/* Tableau */}
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Format de match — Tableau</Label>
        <SegmentedControl
          options={['1set', '2sets'] as const}
          value={config.bracketMatchFormat}
          onChange={(v) => onChange({ ...config, bracketMatchFormat: v })}
          formatLabel={matchFormatLabel}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Score cible — Tableau</Label>
        <SegmentedControl
          options={CLASSIC_TARGET_SCORES}
          value={config.bracketTargetScore}
          onChange={(v) => onChange({ ...config, bracketTargetScore: v })}
        />
      </div>

      {/* Nombre de poules */}
      <NumberStepper
        label="Nombre de poules"
        value={config.nbPools}
        min={1}
        max={maxPoolCount(teamCount)}
        onChange={(v) => onChange({ ...config, nbPools: v })}
      />

      {/* Aperçu dynamique */}
      <div className="bg-surface border border-subtle rounded-lg p-3 text-sm space-y-1.5">
        {preview ? (
          <>
            <p className="text-muted leading-relaxed">
              → <span className="text-white font-medium">{teamCount} équipes</span>
              {' · '}
              <span className="text-primary font-medium">
                {preview.dist.nbPools} poule{preview.dist.nbPools > 1 ? 's' : ''}
              </span>{' '}
              de {preview.dist.distribution.join(' / ')}
              {' · '}
              Tableau de <span className="text-accent font-medium">{preview.sizing.bracketSize}</span>
              {preview.sizing.excess > 0 && (
                <span className="text-accent"> + {preview.sizing.excess} en barrage</span>
              )}
            </p>
            <p className="text-muted leading-relaxed">
              →{' '}
              <span className="text-white font-medium tabular-nums">
                {countPoolMatches(preview.dist.distribution)}
              </span>{' '}
              matchs en poule
              {' · '}
              <span className="text-white font-medium tabular-nums">
                {countBracketMatches(preview.sizing)}
              </span>{' '}
              en tableau
              {' · '}
              <span className="text-white font-medium tabular-nums">
                {countPoolMatches(preview.dist.distribution) + countBracketMatches(preview.sizing)}
              </span>{' '}
              au total
            </p>
          </>
        ) : (
          <p className="text-muted">
            Sélectionnez au moins 4 équipes pour voir l&apos;aperçu.
          </p>
        )}
      </div>
    </div>
  )
}

export function RoundsForm({
  config,
  onChange,
}: {
  config: RoundsConfig
  onChange: (c: RoundsConfig) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Format</Label>
        <SegmentedControl
          options={['singles', 'doubles'] as const}
          value={config.format}
          onChange={(v) => onChange({ ...config, format: v })}
          formatLabel={(v) => (v === 'singles' ? 'Simple (1v1)' : 'Double (2v2)')}
        />
      </div>
      <NumberStepper
        label="Terrains disponibles"
        value={config.courtsAvailable}
        min={1}
        max={9}
        onChange={(v) => onChange({ ...config, courtsAvailable: v })}
      />
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Format de match</Label>
        <SegmentedControl
          options={['1set', '2sets'] as const}
          value={config.matchFormat}
          onChange={(v) => onChange({ ...config, matchFormat: v })}
          formatLabel={(v) => (v === '1set' ? '1 set gagnant' : '2 sets gagnants (best of 3)')}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white text-sm">Score cible par set</Label>
        <SegmentedControl
          options={ROUNDS_TARGET_SCORES}
          value={config.targetScore}
          onChange={(v) => onChange({ ...config, targetScore: v })}
        />
      </div>
    </div>
  )
}
