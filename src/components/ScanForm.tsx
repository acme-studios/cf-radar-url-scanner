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
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            URL to Scan
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-base font-semibold"
        >
          {isSubmitting ? 'Starting Scan...' : 'Start Scan'}
        </Button>
      </form>
    </div>
  )
}
