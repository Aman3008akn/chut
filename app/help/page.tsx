'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, MessageCircle, Bug, BookOpen, Mail, ExternalLink } from 'lucide-react'

export default function HelpCenterPage() {
  const router = useRouter()

  const faqs = [
    {
      question: "How do I start a new chat?",
      answer: "Click the '+' button in the sidebar or press Ctrl+N to start a new conversation."
    },
    {
      question: "Can I save my conversations?",
      answer: "Yes! If you're signed in with Google, your conversations are automatically saved to the cloud. If not, they're stored locally in your browser."
    },
    {
      question: "What is Deep Research mode?",
      answer: "Deep Research mode provides more detailed, comprehensive analysis of your questions. It takes longer but gives you thorough, multi-perspective answers."
    },
    {
      question: "How do I change the theme?",
      answer: "Go to Settings → Appearance tab, where you can choose between Light, Dark, or System theme."
    },
    {
      question: "Can I customize colors?",
      answer: "Yes! In Settings → Appearance, you'll find an Accent Color section where you can choose from preset colors or pick a custom color."
    },
    {
      question: "How do I export my chats?",
      answer: "Go to Settings → Data & Storage tab, then click 'Export Conversations' to download all your chats as a JSON file."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely! We use Google OAuth for authentication and MongoDB Atlas for secure cloud storage. Your data is encrypted and protected."
    },
    {
      question: "Which AI model powers Nexus AI?",
      answer: "Nexus AI uses Google's Gemini AI models, specifically gemini-flash-latest, which provides fast and intelligent responses."
    },
    {
      question: "Who created Nexus AI?",
      answer: "Nexus AI was created and developed by Aman Shukla."
    }
  ]

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
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent)] mb-6">
            <BookOpen size={40} className="text-[var(--bg)]" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            Help Center
          </h1>
          <p className="text-lg text-[var(--text-secondary)]">
            Find answers to common questions and learn how to use Nexus AI
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <a
            href="/about"
            className="flex items-center gap-3 p-6 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl hover:border-[var(--accent)] transition-colors group"
          >
            <MessageCircle size={24} className="text-[var(--accent)]" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                About
              </h3>
              <p className="text-sm text-[var(--text-muted)]">Learn about Nexus AI</p>
            </div>
          </a>

          <a
            href="/terms"
            className="flex items-center gap-3 p-6 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl hover:border-[var(--accent)] transition-colors group"
          >
            <BookOpen size={24} className="text-[var(--accent)]" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                Terms
              </h3>
              <p className="text-sm text-[var(--text-muted)]">Terms of Use</p>
            </div>
          </a>

          <a
            href="mailto:support@example.com"
            className="flex items-center gap-3 p-6 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl hover:border-[var(--accent)] transition-colors group"
          >
            <Mail size={24} className="text-[var(--accent)]" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                Contact
              </h3>
              <p className="text-sm text-[var(--text-muted)]">Get in touch</p>
            </div>
          </a>
        </div>

        {/* FAQs */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)]"
              >
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-start gap-2">
                  <span className="text-[var(--accent)]">Q:</span>
                  {faq.question}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] ml-6">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Report Bug */}
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Bug size={24} className="text-red-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Found a Bug?
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                If you encounter any issues or bugs, please report them so we can fix them quickly.
              </p>
              <a
                href="mailto:bugs@example.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                <Bug size={16} />
                Report a Bug
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Still Need Help */}
        <div className="text-center mt-12">
          <p className="text-[var(--text-secondary)] mb-4">
            Still need help?
          </p>
          <a
            href="mailto:support@example.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-[var(--bg)] rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            <Mail size={18} />
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
