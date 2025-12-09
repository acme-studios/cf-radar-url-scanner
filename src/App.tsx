import { Scanner } from './components/Scanner.tsx'

function App() {
  const handleLogoClick = () => {
    window.location.href = '/'
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-orange-50/30 to-gray-100 overflow-hidden">
      {/* Compact Header */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={handleLogoClick}
                className="cursor-pointer"
                aria-label="Go to home"
              >
                <img 
                  src="/logo.png" 
                  alt="RadarScan Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain" 
                />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                  Radar<span className="text-primary">Scan</span>
                </h1>
                <p className="text-xs text-gray-600 hidden sm:block">Scan URLs with Cloudflare Radar • Get instant PDF reports</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Flex grow to fill remaining space */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-4 sm:py-6 overflow-auto">
        <Scanner />
      </main>
    </div>
  )
}

export default App
