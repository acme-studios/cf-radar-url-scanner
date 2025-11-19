import { Scanner } from './components/Scanner.tsx'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Cloudflare Radar URL Scanner
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Scan any URL for security threats, technologies, and network analysis
          </p>
        </div>

        {/* Main Scanner Component */}
        <Scanner />

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-slate-500 dark:text-slate-400">
          <p>Powered by Cloudflare Workers, Durable Objects, and Radar API</p>
        </div>
      </div>
    </div>
  )
}

export default App
