import { Home, Search } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* 404 */}
        <div className="text-7xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text mb-4">
          404
        </div>

        {/* Message */}
        <h1 className="text-3xl font-black text-white mb-3">Page not found</h1>
        <p className="text-white/60 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="w-full px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>

          <Link
            href="/library"
            className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            View Library
          </Link>
        </div>

        {/* Decoration */}
        <div className="mt-12 p-8 rounded-lg bg-white/5 border border-white/10">
          <p className="text-sm text-white/40">
            If you think this is a mistake, please contact support or try navigating from the sidebar.
          </p>
        </div>
      </div>
    </div>
  )
}
