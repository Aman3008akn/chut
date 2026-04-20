'use client'
import { Globe, Check, Loader2, Search, FileText, Sparkles, Link } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResearchStep } from '@/lib/types'

interface Props {
  steps: ResearchStep[]
}

const SEARCH_THOUGHTS = [
  'Formulating search queries...',
  'Scanning the internet...',
  'Reading top results...',
  'Cross-referencing sources...',
  'Compiling findings...',
]

const STEP_ICONS = {
  done: <Check size={10} strokeWidth={3} />,
  active: <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />,
  pending: <div className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />,
}

export default function WebSearchPanel({ steps }: Props) {
  const [thoughtIdx, setThoughtIdx] = useState(0)
  const done = steps.filter(s => s.status === 'done').length
  const total = steps.length
  const pct = total ? Math.round((done / total) * 100) : 0

  useEffect(() => {
    const t = setInterval(() => setThoughtIdx(i => (i + 1) % SEARCH_THOUGHTS.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 msg-enter mb-4"
    >
      {/* Globe Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-emerald-500/20 relative">
        <Globe size={16} className="text-white" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 animate-ping" />
      </div>

      <div className="flex-1 min-w-0 max-w-[90%]">
        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span
              className="inline-block w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: 'thinkingPulse 1.2s ease-in-out infinite' }}
            />
            Web Search — {pct}%
          </span>
        </div>

        {/* Animated Thought */}
        <AnimatePresence mode="wait">
          <motion.p
            key={thoughtIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-3 italic"
          >
            {SEARCH_THOUGHTS[thoughtIdx]}
          </motion.p>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-[var(--surface-border)] mb-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' }}
          />
        </div>

        {/* Steps Panel */}
        <div className="bg-[var(--surface)]/60 border border-[var(--surface-border)] rounded-2xl p-3.5 backdrop-blur-sm shadow-sm space-y-2">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 text-xs transition-all duration-300 ${
                step.status === 'done' ? 'text-[var(--text-primary)]' :
                step.status === 'active' ? 'text-emerald-600 dark:text-emerald-400 font-medium' :
                'text-[var(--text-muted)] opacity-50'
              }`}
            >
              <div className="flex-shrink-0">
                {step.status === 'done' ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Check size={10} strokeWidth={3} />
                  </div>
                ) : step.status === 'active' ? (
                  <Loader2 size={12} className="animate-spin text-emerald-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-[var(--surface-border)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-30" />
                  </div>
                )}
              </div>
              <span>{step.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
