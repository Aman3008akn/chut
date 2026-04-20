'use client'
import { Brain, Check, Loader2, Circle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Message } from '@/lib/types'

interface Props {
  message?: Message
}

const THOUGHTS = [
  'Deep Analysis Initiated...',
  'Extracting Core Concepts...',
  'Processing Complexity...',
  'Mapping Logical Paths...',
  'Synthesizing Insights...',
]

export default function ThinkingBadge({ message }: Props) {
  const [idx, setIdx] = useState(0)
  const steps = message?.thinkingSteps || []

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % THOUGHTS.length), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-start gap-4 msg-enter mb-4">
      <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-center shrink-0 mt-0.5 shadow-sm overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-pulse" />
        <Brain size={16} className="text-[var(--thinking-color)] relative z-10" />
      </div>
      
      <div className="flex-1 flex flex-col gap-3 pt-1">
        {/* Always show the core "Thinking" status first */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="thinking-badge-core flex items-center gap-2 text-[var(--thinking-color)] font-medium text-sm tracking-tight">
              <span className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-[var(--thinking-color)] animate-[thinkingPulse_1s_infinite_0s]" />
                <span className="w-1 h-1 rounded-full bg-[var(--thinking-color)] animate-[thinkingPulse_1s_infinite_0.2s]" />
                <span className="w-1 h-1 rounded-full bg-[var(--thinking-color)] animate-[thinkingPulse_1s_infinite_0.4s]" />
              </span>
              {THOUGHTS[idx]}
            </span>
          </div>
        </div>

        {/* Show detailed steps if they exist, otherwise show shimmers */}
        {steps.length > 0 ? (
          <div className="flex flex-col gap-2.5 bg-[var(--surface)]/40 border border-[var(--surface-border)] p-3.5 rounded-2xl backdrop-blur-sm shadow-sm transition-all duration-500 max-w-[95%]">
            {steps.map((step, i) => (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 text-xs transition-all duration-400 ${
                  step.status === 'done' ? 'text-[var(--text-primary)]' : 
                  step.status === 'active' ? 'text-[var(--thinking-color)] font-medium' : 
                  'text-[var(--text-muted)] opacity-60'
                }`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex-shrink-0">
                  {step.status === 'done' ? (
                    <div className="w-4 h-4 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center scale-up">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  ) : step.status === 'active' ? (
                    <Loader2 size={12} className="animate-spin text-[var(--thinking-color)]" />
                  ) : (
                    <Circle size={10} className="text-[var(--text-muted)]" />
                  )}
                </div>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 opacity-60">
            <div className="shimmer h-3 w-48 rounded-full" />
            <div className="shimmer h-3 w-64 rounded-full" />
            <div className="shimmer h-3 w-40 rounded-full" />
          </div>
        )}
      </div>
    </div>
  )
}
