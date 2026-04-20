'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, RefreshCw, Sparkles, Instagram } from 'lucide-react'

const STATIC_SUGGESTIONS = [
  { label: 'Explain quantum computing', icon: '⚛️' },
  { label: 'Write a Python web scraper', icon: '🐍' },
  { label: 'Plan a 7-day Japan trip', icon: '🗾' },
  { label: 'Compare React vs Vue', icon: '⚡' },
]

interface TrendingTopic {
  label: string
  icon: string
  category?: string
}

interface Props {
  onSuggestion: (text: string) => void
}

export default function WelcomeScreen({ onSuggestion }: Props) {
  const [trending, setTrending] = useState<TrendingTopic[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [trendingError, setTrendingError] = useState(false)

  const fetchTrending = async () => {
    setLoadingTrending(true)
    setTrendingError(false)
    try {
      const res = await fetch('/api/trending')
      if (res.ok) {
        const data = await res.json()
        if (data.topics && Array.isArray(data.topics) && data.topics.length > 0) {
          setTrending(data.topics)
        } else {
          setTrendingError(true)
        }
      } else {
        setTrendingError(true)
      }
    } catch {
      setTrendingError(true)
    } finally {
      setLoadingTrending(false)
    }
  }

  useEffect(() => {
    fetchTrending()
  }, [])

  const categoryColors: Record<string, string> = {
    tech: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    world: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    sports: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    entertainment: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    science: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    business: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 gap-8 overflow-y-auto">
      {/* Logo & Title */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300 relative">
          <Image
            src="/logo.png"
            alt="Astra AI Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
            Astra AI
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Ask me anything — I can think, research, and create.
          </p>
          
          <motion.a
            href="https://www.instagram.com/supp.amannn"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/40 text-[10px] font-bold text-muted-foreground hover:text-white hover:bg-gradient-to-r hover:from-[#833ab4] hover:via-[#fd1d1d] hover:to-[#fcb045] transition-all duration-500 group"
          >
            <Instagram size={12} className="group-hover:scale-110 transition-transform" />
            Follow on Instagram
          </motion.a>
        </div>
      </motion.div>

      {/* Quick Start Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <Sparkles size={14} className="text-[var(--text-muted)]" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Quick Start</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STATIC_SUGGESTIONS.map((s, i) => (
            <motion.button
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSuggestion(s.label)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--text-muted)] transition-all text-left"
            >
              <span className="text-base">{s.icon}</span>
              <span className="text-xs leading-tight">{s.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Trending Topics Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Trending Now
            </span>
            {!loadingTrending && !trendingError && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <button
            onClick={fetchTrending}
            disabled={loadingTrending}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
            title="Refresh trending topics"
          >
            <RefreshCw size={12} className={loadingTrending ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingTrending ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)]">
                <div className="w-6 h-6 rounded-md shimmer" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 shimmer rounded-full" />
                  <div className="h-2 w-1/2 shimmer rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : trendingError ? (
          <div className="text-center py-6 text-[var(--text-muted)] text-xs">
            <p>Could not load trending topics</p>
            <button
              onClick={fetchTrending}
              className="mt-2 text-[var(--accent)] hover:underline text-xs font-medium"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <AnimatePresence>
              {trending.map((topic, i) => {
                const colorClass = categoryColors[topic.category || ''] || categoryColors.tech
                return (
                  <motion.button
                    key={topic.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSuggestion(topic.label)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-sm ${colorClass}`}
                  >
                    <span className="text-lg">{topic.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs leading-tight font-medium block truncate">
                        {topic.label}
                      </span>
                      {topic.category && (
                        <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold">
                          {topic.category}
                        </span>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Tips */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-[11px] text-[var(--text-muted)] text-center max-w-xs leading-relaxed"
      >
        Tip: Use <span className="text-emerald-500">🌐 Web Search</span> for real-time info, or <span className="text-[var(--research-color)]">🔬 Deep Research</span> for comprehensive analysis.
      </motion.p>
    </div>
  )
}
