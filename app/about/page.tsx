'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Github, Twitter, Mail, Heart, Code, Sparkles } from 'lucide-react'

export default function AboutPage() {
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
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent)] mb-6">
            <Sparkles size={40} className="text-[var(--bg)]" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            About Nexus AI
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            A next-generation AI chatbot powered by Google's Gemini AI, designed to provide intelligent, helpful, and engaging conversations.
          </p>
        </div>

        {/* Creator Section */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-3">
            <Heart size={24} className="text-red-500" />
            Created By
          </h2>
          
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-3xl font-bold text-white">
              AS
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Aman Shukla
              </h3>
              <p className="text-[var(--text-secondary)] mb-4">
                Creator & Developer of Nexus AI
              </p>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Nexus AI was conceptualized, designed, and developed by Aman Shukla. 
                This project represents a commitment to creating accessible, powerful, 
                and user-friendly AI tools that enhance productivity and knowledge sharing.
              </p>
              
              <div className="flex gap-3 mt-4">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)]"
                >
                  <Github size={16} />
                  GitHub
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)]"
                >
                  <Twitter size={16} />
                  Twitter
                </a>
                <a
                  href="mailto:contact@example.com"
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)]"
                >
                  <Mail size={16} />
                  Email
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-3">
            <Code size={24} className="text-[var(--accent)]" />
            Technology Stack
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Next.js 14', desc: 'React framework with App Router', icon: '⚡' },
              { name: 'TypeScript', desc: 'Type-safe JavaScript', icon: '📘' },
              { name: 'Tailwind CSS', desc: 'Utility-first CSS framework', icon: '🎨' },
              { name: 'MongoDB Atlas', desc: 'Cloud database for storage', icon: '🗄️' },
              { name: 'Google Gemini AI', desc: 'Advanced language model', icon: '🤖' },
              { name: 'NextAuth.js', desc: 'Authentication with Google OAuth', icon: '🔐' },
            ].map((tech) => (
              <div
                key={tech.name}
                className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)]"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{tech.icon}</span>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{tech.name}</h3>
                    <p className="text-sm text-[var(--text-muted)]">{tech.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
            Key Features
          </h2>
          
          <div className="space-y-4">
            {[
              '💬 Intelligent chat powered by Google Gemini AI',
              '🔍 Deep Research mode for comprehensive analysis',
              '☁️ Cloud sync across devices with MongoDB',
              '🎨 Customizable themes and accent colors',
              '💾 Export and backup your conversations',
              '🔒 Secure authentication with Google OAuth',
              '📱 Responsive design for all devices',
              '⚡ Fast and efficient streaming responses',
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-lg"
              >
                <span className="text-[var(--text-primary)]">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Version Info */}
        <div className="text-center text-sm text-[var(--text-muted)]">
          <p>Nexus AI v1.0.0</p>
          <p className="mt-1">Built with ❤️ by Aman Shukla</p>
          <p className="mt-2">© 2024 All rights reserved</p>
        </div>
      </div>
    </div>
  )
}
