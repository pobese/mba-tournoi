interface PlayerAvatarProps {
  name: string
  level: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: { avatar: 'w-8 h-8 text-xs', stars: 'text-[8px]' },
  md: { avatar: 'w-10 h-10 text-sm', stars: 'text-[9px]' },
  lg: { avatar: 'w-14 h-14 text-lg', stars: 'text-xs' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PlayerAvatar({ name, level, size = 'md' }: PlayerAvatarProps) {
  const cls = sizeClasses[size]
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`${cls.avatar} rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-display font-bold text-primary shrink-0`}
      >
        {getInitials(name)}
      </div>
      <div className={`${cls.stars} text-accent leading-none`}>
        {'★'.repeat(level)}
        <span className="text-subtle">{'★'.repeat(5 - level)}</span>
      </div>
    </div>
  )
}
