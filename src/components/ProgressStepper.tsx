type ScanStatus = 'idle' | 'queued' | 'scanning' | 'generating' | 'uploading' | 'completed' | 'failed' | 'expired'

interface ProgressStepperProps {
  status: ScanStatus
  error?: string
  progressPercent?: number
  progressMessage?: string
  onRetry?: () => void
  onReset?: () => void
}

const steps = [
  { key: 'queued', label: 'Queued', icon: '📋' },
  { key: 'scanning', label: 'Scanning', icon: '🔍' },
  { key: 'generating', label: 'Generating', icon: '📄' },
  { key: 'uploading', label: 'Uploading', icon: '☁️' },
  { key: 'completed', label: 'Complete', icon: '✓' },
]

export function ProgressStepper({ status, error, progressPercent, progressMessage, onRetry, onReset }: ProgressStepperProps) {
  const currentIndex = steps.findIndex(step => step.key === status)
  // Use actual progress percent if available, otherwise calculate from step
  const progress = progressPercent !== undefined ? progressPercent : ((currentIndex + 1) / steps.length) * 100
  
  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-200 animate-fade-in max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="relative mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-linear-to-r from-orange to-orange-light transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex || (status === 'completed' && step.key === 'completed')
            const isCurrent = index === currentIndex && status !== 'completed'
            
            return (
              <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                <div className={`
                  w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base
                  transition-all duration-300 border-2
                  ${isCompleted ? 'bg-orange border-orange text-white scale-110' : ''}
                  ${isCurrent ? 'bg-white border-orange text-orange animate-pulse-orange' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-gray-100 border-gray-300 text-gray-400' : ''}
                `}>
                  {isCompleted ? '✓' : step.icon}
                </div>
                <span className={`
                  text-xs sm:text-sm font-medium text-center
                  ${isCurrent ? 'text-orange' : ''}
                  ${isCompleted ? 'text-gray-700' : ''}
                  ${!isCompleted && !isCurrent ? 'text-gray-400' : ''}
                `}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Current Status with Progress */}
      {status !== 'completed' && !error && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
            <div className="w-2 h-2 bg-orange rounded-full animate-ping" />
            <span>{progressMessage || 'Processing...'}</span>
          </div>
          {progressPercent !== undefined && (
            <div className="text-center">
              <span className="text-2xl font-bold text-orange">{Math.round(progressPercent)}%</span>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-4 bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-slide-in">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-bold text-red-900 text-base mb-1">Scan Failed</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Retry Scan
              </button>
            )}
            {onReset && (
              <button
                onClick={onReset}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Start New Scan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
