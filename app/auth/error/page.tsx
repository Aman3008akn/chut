'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Unknown error'

  const errorMessages: Record<string, string> = {
    'Callback': 'There was an issue processing your login. Please try again.',
    'OAuthSignin': 'Could not sign in with this provider.',
    'OAuthCallback': 'There was an error processing your login.',
    'EmailSigninEmail': 'The email could not be sent.',
    'OAuthCreateAccount': 'Could not create user account.',
    'EmailCreateAccount': 'Could not create user account.',
    'Default': 'An authentication error occurred.',
  }

  const message = errorMessages[error] || `Error: ${error}`

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Sign In Error
          </h1>
          <p className="text-[var(--text-secondary)] mb-2">
            {message}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {error}
          </p>
        </div>

        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-semibold hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
