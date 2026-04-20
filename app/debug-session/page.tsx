'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function DebugPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[var(--bg)] p-8">
      <div className="max-w-2xl mx-auto bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
          Session Debug Info
        </h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Status:
            </label>
            <p className="text-[var(--text-primary)] font-mono">{status}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Session Data:
            </label>
            <pre className="text-xs text-[var(--text-primary)] bg-[var(--surface)] p-4 rounded-lg overflow-auto">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              User Email:
            </label>
            <p className="text-[var(--text-primary)] font-mono">
              {session?.user?.email || 'No email'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Is Admin Email?
            </label>
            <p className={`text-lg font-bold ${
              session?.user?.email === 'declined8087@gmail.com' 
                ? 'text-green-500' 
                : 'text-red-500'
            }`}>
              {session?.user?.email === 'declined8087@gmail.com' ? 'YES ✓' : 'NO ✗'}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--surface-border)] space-y-2">
            <button
              onClick={() => router.push('/admin')}
              className="w-full px-4 py-2 bg-[var(--accent)] text-[var(--bg)] rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Go to Admin Dashboard
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="w-full px-4 py-2 bg-[var(--surface)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
