interface WizardProgressProps {
  currentStep: 1 | 2 | 3
}

const STEPS = ['Type', 'Joueurs', 'Configuration']

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const isDone = step < currentStep
        const isActive = step === currentStep

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isDone
                    ? 'bg-primary text-app'
                    : isActive
                      ? 'bg-primary/20 border-2 border-primary text-primary'
                      : 'bg-surface-alt border border-subtle text-muted'
                }`}
              >
                {isDone ? '✓' : step}
              </div>
              <span
                className={`text-xs mt-1 font-medium ${isActive ? 'text-primary' : isDone ? 'text-white' : 'text-muted'}`}
              >
                {label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${
                  isDone ? 'bg-primary' : 'bg-subtle'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
