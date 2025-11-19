type ScanStatus = 'idle' | 'queued' | 'scanning' | 'generating' | 'uploading' | 'completed' | 'failed' | 'expired'

interface ProgressStepperProps {
  status: ScanStatus
  error?: string
}

const steps = [
  { key: 'queued', label: 'Queued', description: 'Scan request received' },
  { key: 'scanning', label: 'Scanning', description: 'Analyzing URL with Radar' },
  { key: 'generating', label: 'Generating', description: 'Creating PDF report' },
  { key: 'uploading', label: 'Uploading', description: 'Saving to cloud storage' },
  { key: 'completed', label: 'Completed', description: 'Report ready!' },
]

export function ProgressStepper({ status, error }: ProgressStepperProps) {
  const currentIndex = steps.findIndex(step => step.key === status)
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700">
      <div className="space-y-6">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex || (status === 'completed' && step.key === 'completed')
          const isCurrent = index === currentIndex && status !== 'completed'
          
          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isCurrent ? 'bg-blue-500 text-white animate-pulse' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : ''}
                `}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    w-0.5 h-12 mt-2 transition-all
                    ${isCompleted ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}
                  `} />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pt-1">
                <h3 className={`
                  font-semibold transition-colors
                  ${isCurrent ? 'text-blue-600 dark:text-blue-400' : ''}
                  ${isCompleted ? 'text-green-600 dark:text-green-400' : ''}
                  ${!isCompleted && !isCurrent ? 'text-slate-400 dark:text-slate-600' : ''}
                `}>
                  {step.label}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  )
}
