import { useState } from 'react'

interface TermsModalProps {
  onAccept: () => void
}

export function TermsModal({ onAccept }: TermsModalProps) {
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r from-orange to-orange-light p-6">
          <h2 className="text-2xl font-bold text-white">Terms of Service</h2>
          <p className="text-white/90 text-sm mt-1">Please read and accept before using RadarScan</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Acceptable Use Policy</h3>
            
            <p className="text-gray-700 mb-4">
              RadarScan uses Cloudflare's Radar URL Scanner API to analyze website security. 
              By using this service, you agree to the following terms:
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">✅ You May:</h4>
              <ul className="text-sm text-blue-800 space-y-1 ml-4">
                <li>Scan websites you own or have permission to scan</li>
                <li>Scan public websites for legitimate security research</li>
                <li>Use results for security analysis and improvement</li>
              </ul>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <h4 className="font-semibold text-red-900 mb-2">❌ You Must Not:</h4>
              <ul className="text-sm text-red-800 space-y-1 ml-4">
                <li>Scan websites without authorization</li>
                <li>Use this service for malicious purposes</li>
                <li>Abuse the service with excessive scanning</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </div>

            <h4 className="font-semibold text-gray-900 mb-2">Service Disclaimer</h4>
            <p className="text-sm text-gray-600 mb-4">
              This service is provided "as-is" without warranties. Scan results are informational 
              only and should not be the sole basis for security decisions. You are solely responsible 
              for ensuring your use complies with all applicable laws and terms of service.
            </p>

            <h4 className="font-semibold text-gray-900 mb-2">Data & Privacy</h4>
            <p className="text-sm text-gray-600 mb-4">
              Scan results are stored temporarily. Email addresses are used only for report delivery. 
              We do not share your data with third parties.
            </p>

            <h4 className="font-semibold text-gray-900 mb-2">Rate Limits</h4>
            <p className="text-sm text-gray-600">
              To prevent abuse, this service implements rate limiting. Excessive use may result in 
              temporary access restrictions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 text-orange border-gray-300 rounded focus:ring-orange"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to these terms. I confirm that I have authorization to scan 
              the URLs I submit and will use this service responsibly and legally.
            </span>
          </label>

          <button
            onClick={onAccept}
            disabled={!accepted}
            className="w-full py-3 px-6 bg-linear-to-r from-orange to-orange-light text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  )
}
