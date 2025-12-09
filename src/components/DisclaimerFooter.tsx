export function DisclaimerFooter() {
  return (
    <footer className="mt-8 pt-6 border-t border-gray-200">
      <div className="max-w-3xl mx-auto text-center px-4">
        <p className="text-xs text-gray-500 mb-2">
          <strong>Demo Project:</strong> This is a demonstration of Cloudflare Workers, Durable Objects, 
          D1, R2, WebSockets, and Radar URL Scanner API. Use responsibly and ensure you have authorization 
          to scan any URLs you submit.
        </p>
        <p className="text-xs text-gray-400">
          Provided "as-is" for educational purposes. Not affiliated with Cloudflare, Inc.
        </p>
      </div>
    </footer>
  )
}
