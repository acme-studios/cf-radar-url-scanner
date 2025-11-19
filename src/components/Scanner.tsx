import { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button.tsx'
import { ScanForm } from './ScanForm.tsx'
import { ProgressStepper } from './ProgressStepper.tsx'
import { ResultsCard } from './ResultsCard.tsx'

type ScanStatus = 'idle' | 'queued' | 'scanning' | 'generating' | 'uploading' | 'completed' | 'failed' | 'expired'

interface SessionData {
  sessionId: string
  url: string
  email?: string
  status: ScanStatus
  r2Key?: string
  error?: string
  radarUuid?: string
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

  // Handle form submission
  const handleSubmit = async (url: string) => {
    setIsSubmitting(true)
    setError(null)

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

  // Connect to WebSocket for real-time updates
  const connectWebSocket = (sessionId: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`)

    ws.onopen = () => {
      console.log('WebSocket connected')
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

    ws.onclose = () => {
      console.log('WebSocket closed')
    }

    wsRef.current = ws
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

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Reset to start new scan
  const handleReset = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setSessionData(null)
    setError(null)
  }

  return (
    <div className="space-y-8">
      {!sessionData ? (
        <ScanForm 
          onSubmit={handleSubmit} 
          isSubmitting={isSubmitting}
          error={error}
        />
      ) : (
        <>
          <ProgressStepper status={sessionData.status} error={sessionData.error} />
          
          {sessionData.status === 'completed' && (
            <ResultsCard 
              sessionId={sessionData.sessionId}
              url={sessionData.url}
              email={sessionData.email}
              onReset={handleReset}
            />
          )}

          {sessionData.status === 'failed' && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Scan Failed
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-4">
                {sessionData.error || 'An unknown error occurred'}
              </p>
              <Button onClick={handleReset} variant="outline">
                Start New Scan
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
