import { useState } from 'react'
import { Button } from './ui/button.tsx'

interface ResultsCardProps {
  sessionId: string
  url: string
  email?: string
  onReset: () => void
}

export function ResultsCard({ sessionId, url, onReset }: ResultsCardProps) {
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const handleDownload = () => {
    // Create a temporary link and click it to trigger download
    const link = document.createElement('a')
    link.href = `/api/download/${sessionId}`
    link.download = `radar-scan-${sessionId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSendEmail = async () => {
    if (!emailInput.trim()) {
      setEmailError('Please enter a valid email address')
      return
    }

    setIsSendingEmail(true)
    setEmailError(null)

    try {
      const response = await fetch(`/api/email/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send email')
      }

      setEmailSent(true)
      setShowEmailInput(false)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Scan Complete!
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Your security report for <span className="font-semibold">{url}</span> is ready
        </p>
      </div>

      <div className="space-y-4">
        {/* Download Button */}
        <Button
          onClick={handleDownload}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF Report
        </Button>

        {/* Send Email Section */}
        {!emailSent ? (
          !showEmailInput ? (
            <Button
              onClick={() => setShowEmailInput(true)}
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Report via Email
            </Button>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                disabled={isSendingEmail}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="flex-1"
                >
                  {isSendingEmail ? 'Sending...' : 'Send Email'}
                </Button>
                <Button
                  onClick={() => {
                    setShowEmailInput(false)
                    setEmailError(null)
                  }}
                  variant="outline"
                  disabled={isSendingEmail}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">
              ✓ Email sent successfully to {emailInput}
            </p>
          </div>
        )}

        {emailError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{emailError}</p>
          </div>
        )}
      </div>

      {/* Start New Scan */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <Button
          onClick={onReset}
          variant="ghost"
          className="w-full"
        >
          Start New Scan
        </Button>
      </div>
    </div>
  )
}
