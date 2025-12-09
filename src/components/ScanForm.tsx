import { useState } from 'react'
import { Button } from './ui/button.tsx'

interface ScanFormProps {
  onSubmit: (url: string) => void
  isSubmitting: boolean
  error: string | null
}

export function ScanForm({ onSubmit, isSubmitting, error }: ScanFormProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(url)
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200 animate-fade-in max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <div>
          <label htmlFor="url" className="block text-sm font-semibold text-gray-700 mb-2">
            Enter URL to Scan
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange transition-all duration-200"
            disabled={isSubmitting}
          />
          
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 animate-slide-in">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-base font-bold bg-linear-to-r from-orange to-orange-light hover:from-orange-dark hover:to-orange text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Starting Scan...
            </span>
          ) : (
            'Start Security Scan'
          )}
        </Button>
      </form>
    </div>
  )
}
