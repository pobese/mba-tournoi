interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-surface rounded-xl p-8 max-w-sm w-full">
        <h3 className="font-display text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-muted text-sm mb-6">{description}</p>
        {action}
      </div>
    </div>
  )
}
