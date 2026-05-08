'use client'

import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Settings, LogOut, LogIn } from 'lucide-react'
import Link from 'next/link'

export function UserMenu() {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="w-6 h-6 rounded-full bg-[var(--surface)] animate-pulse" />
    )
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-[var(--accent)] text-[var(--bg)] hover:opacity-90 transition-opacity text-sm font-medium touch-manipulation min-h-[40px]"
      >
        <LogIn size={16} />
        <span className="hidden sm:inline">Sign In</span>
        <span className="sm:hidden">Login</span>
      </button>
    )
  }

  const initials = session.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors touch-manipulation min-h-[40px]"
      >
        <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <span className="text-xs font-bold text-[var(--bg)]">{initials}</span>
          )}
        </div>
        <span className="text-sm text-[var(--text-secondary)] hidden sm:inline">
          {session.user?.name?.split(' ')[0]}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg shadow-lg z-50">
          <div className="px-4 py-3 border-b border-[var(--surface-border)]">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {session.user?.name}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {session.user?.email}
            </p>
          </div>

          <Link
            href="/settings"
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--surface-border)]"
          >
            <Settings size={16} />
            Settings
          </Link>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-[var(--surface-hover)] transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
