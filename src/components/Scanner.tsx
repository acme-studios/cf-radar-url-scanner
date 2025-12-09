import { useState, useEffect, useRef } from 'react'
import { ScanForm } from './ScanForm.tsx'
import { ProgressStepper } from './ProgressStepper.tsx'
import { ResultsCard } from './ResultsCard.tsx'
import { Toast, type ToastProps } from './Toast.tsx'
import { Confetti } from './Confetti.tsx'

type ScanStatus = 'idle' | 'queued' | 'scanning' | 'generating' | 'uploading' | 'completed' | 'failed' | 'expired'

interface SessionData {
  sessionId: string
  url: string
  email?: string
  status: ScanStatus
  r2Key?: string
  error?: string
  radarUuid?: string
  workflowInstanceId?: string
  progressPercent?: number
  progressMessage?: string
}

export function Scanner() {
  const [sessionData, setSessionData] = useState<SessionData | null>(() => {
    // Restore session from sessionStorage on mount
    const saved = sessionStorage.getItem('scanSession')
    return saved ? JSON.parse(saved) : null
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'polling' | 'disconnected'>('disconnected')
  const [toast, setToast] = useState<Omit<ToastProps, 'onClose'> | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [scanStartTime, setScanStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Handle form submission
  const handleSubmit = async (url: string) => {
    setIsSubmitting(true)
    setError(null)
    setScanStartTime(Date.now())
    setElapsedTime(0)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email: 'scan@placeholder.com' }) // Placeholder email
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start scan')
      }

      const data = await response.json()
      
      setSessionData({
        sessionId: data.sessionId,
        url,
        status: 'queued'
      })

      // Connect to WebSocket for real-time updates
      connectWebSocket(data.sessionId)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Connect to WebSocket for real-time updates with auto-reconnection
  const connectWebSocket = (sessionId: string) => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnectionStatus('connected')
      reconnectAttemptsRef.current = 0 // Reset reconnection counter
      
      // Stop polling if it was running
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      if (message.type === 'state' || message.type === 'update') {
        setSessionData(prev => ({
          ...prev!,
          ...message.data
        }))
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason)
      wsRef.current = null
      
      // Only attempt reconnection if session is still active
      if (sessionData && sessionData.status !== 'completed' && sessionData.status !== 'failed') {
        attemptReconnect(sessionId)
      }
    }

    wsRef.current = ws
  }

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = (sessionId: string) => {
    const maxAttempts = 5
    
    if (reconnectAttemptsRef.current >= maxAttempts) {
      console.log('Max reconnection attempts reached, falling back to polling')
      setConnectionStatus('polling')
      startPolling(sessionId)
      return
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000)
    reconnectAttemptsRef.current++
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`)
    setConnectionStatus('reconnecting')
    
    reconnectTimeoutRef.current = window.setTimeout(() => {
      connectWebSocket(sessionId)
    }, delay)
  }

  // HTTP polling fallback when WebSocket fails
  const startPolling = (sessionId: string) => {
    // Poll every 5 seconds
    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setSessionData(prev => ({
            ...prev!,
            ...data
          }))
          
          // Stop polling if scan is complete
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000)
  }

  // Save session to sessionStorage whenever it changes
  useEffect(() => {
    if (sessionData) {
      sessionStorage.setItem('scanSession', JSON.stringify(sessionData))
    } else {
      sessionStorage.removeItem('scanSession')
    }
  }, [sessionData])

  // Reconnect WebSocket on mount if session exists
  useEffect(() => {
    if (sessionData && sessionData.status !== 'completed' && sessionData.status !== 'failed') {
      connectWebSocket(sessionData.sessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Timer effect - update elapsed time
  useEffect(() => {
    if (scanStartTime && sessionData && sessionData.status !== 'completed' && sessionData.status !== 'failed') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - scanStartTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [scanStartTime, sessionData])

  // Trigger confetti and toast on completion
  useEffect(() => {
    if (sessionData?.status === 'completed') {
      setShowConfetti(true)
      setToast({
        message: '🎉 Scan completed successfully!',
        type: 'success',
        duration: 4000
      })
      setScanStartTime(null)
      setTimeout(() => setShowConfetti(false), 4000)
    }
  }, [sessionData?.status])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to reset
      if (e.key === 'Escape' && sessionData) {
        handleReset()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sessionData])

  // Cleanup WebSocket and timers on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Reset to start new scan
  const handleReset = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    setSessionData(null)
    setError(null)
    setConnectionStatus('disconnected')
    setScanStartTime(null)
    setElapsedTime(0)
  }

  // Retry failed scan with same URL
  const handleRetry = async () => {
    if (!sessionData?.url) return
    
    // Clean up current session
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    // Clear error and retry with same URL
    setError(null)
    setConnectionStatus('disconnected')
    await handleSubmit(sessionData.url)
  }

  // Format elapsed time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-8">
      {/* Toast notifications */}
      {toast && (
        <Toast
          {...toast}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confetti animation */}
      {showConfetti && <Confetti />}
      {/* Connection Status Indicator & Timer */}
      {sessionData && sessionData.status !== 'completed' && sessionData.status !== 'failed' && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-gray-600">Live updates</span>
              </>
            )}
            {connectionStatus === 'reconnecting' && (
              <>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                <span className="text-gray-600">Reconnecting...</span>
              </>
            )}
            {connectionStatus === 'polling' && (
              <>
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                <span className="text-gray-600">Using fallback mode</span>
              </>
            )}
          </div>
          {elapsedTime > 0 && (
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-mono">{formatTime(elapsedTime)}</span>
            </div>
          )}
        </div>
      )}
      
      {!sessionData ? (
        <ScanForm 
          onSubmit={handleSubmit} 
          isSubmitting={isSubmitting}
          error={error}
        />
      ) : (
        <>
          <ProgressStepper 
            status={sessionData.status} 
            error={sessionData.error}
            progressPercent={sessionData.progressPercent}
            progressMessage={sessionData.progressMessage}
            onRetry={handleRetry}
            onReset={handleReset}
          />
          
          {sessionData.status === 'completed' && (
            <ResultsCard 
              sessionId={sessionData.sessionId}
              url={sessionData.url}
              email={sessionData.email}
              onReset={handleReset}
            />
          )}
        </>
      )}
    </div>
  )
}
