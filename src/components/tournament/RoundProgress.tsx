interface RoundProgressProps {
  totalMatches: number
  completedMatches: number
  roundNumber: number
  totalRounds?: number
}

export function RoundProgress({
  totalMatches,
  completedMatches,
  roundNumber,
  totalRounds,
}: RoundProgressProps) {
  const pct = totalMatches === 0 ? 0 : Math.round((completedMatches / totalMatches) * 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-display font-bold text-white">
          Round {roundNumber}
          {totalRounds ? ` / ${totalRounds}` : ''}
        </span>
        <span className="text-muted tabular-nums">
          {completedMatches}/{totalMatches} matchs
        </span>
      </div>
      <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
