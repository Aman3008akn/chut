'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Shield, AlertTriangle } from 'lucide-react'

export default function TermsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="border-b border-[var(--surface-border)] bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft size={20} />
            Back
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent)] mb-6">
            <Shield size={40} className="text-[var(--bg)]" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            Terms of Use
          </h1>
          <p className="text-lg text-[var(--text-secondary)]">
            Last updated: January 2024
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              By accessing and using Nexus AI, you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to abide by these terms, 
              please do not use this service.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              2. Description of Service
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Nexus AI is an AI-powered chatbot application that provides intelligent 
              conversations using Google's Gemini AI technology. The service includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] ml-4">
              <li>AI-powered chat conversations</li>
              <li>Deep Research mode for detailed analysis</li>
              <li>Cloud storage for conversation history</li>
              <li>Customizable themes and preferences</li>
              <li>Data export capabilities</li>
            </ul>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              3. User Accounts
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              To access certain features, you must create an account using Google OAuth. 
              You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] ml-4">
              <li>Maintaining the confidentiality of your account</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              4. Acceptable Use
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              You agree to use Nexus AI only for lawful purposes. You are prohibited from:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] ml-4">
              <li>Using the service for illegal activities</li>
              <li>Attempting to harm or exploit minors</li>
              <li>Transmitting harmful or malicious code</li>
              <li>Violating intellectual property rights</li>
              <li>Harassing, abusing, or harming others</li>
              <li>Impersonating others or providing false information</li>
            </ul>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              5. Data Privacy
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We take your privacy seriously. Our data practices include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] ml-4">
              <li>Conversations are stored securely in MongoDB Atlas</li>
              <li>We use Google OAuth for authentication - we never see your password</li>
              <li>Your data is encrypted both in transit and at rest</li>
              <li>You can export or delete your data at any time</li>
              <li>We do not sell your personal information to third parties</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-4">
              Please note that conversations sent to Gemini AI are processed by Google's 
              servers according to their privacy policy.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              6. Intellectual Property
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Nexus AI, including its design, code, and branding, is owned by Aman Shukla. 
              You may not copy, modify, distribute, or create derivative works without 
              explicit permission.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              7. Limitation of Liability
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Nexus AI is provided "as is" without warranties of any kind. We are not 
              liable for any indirect, incidental, special, consequential, or punitive 
              damages resulting from your use of the service. The AI-generated content 
              should not be considered professional advice.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              8. Changes to Terms
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users 
              of significant changes. Continued use of the service after changes constitutes 
              acceptance of the new terms.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              9. Contact Information
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              For questions about these Terms of Use, please contact us at:
            </p>
            <p className="text-[var(--accent)] mt-2 font-medium">
              Email: legal@example.com
            </p>
          </section>

          {/* Important Notice */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle size={24} className="text-yellow-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                  Important Notice
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  These terms are a template and should be reviewed by a legal professional 
                  before use. Replace placeholder email addresses with actual contact 
                  information. This document does not constitute legal advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
