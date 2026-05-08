'use client'
import { Brain, Check, Loader2, Circle, Sparkles } from 'lucide-react'
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
      {/* Animated Icon Container with Shimmer */}
      <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-gray-400/20 via-gray-300/20 to-gray-500/20 border border-gray-400/30 flex items-center justify-center shrink-0 mt-0.5 shadow-lg overflow-hidden">
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmerSlide_2s_ease-in-out_infinite]" />
        
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-xl animate-ping bg-gray-400/30" style={{ animationDuration: '2s' }} />
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-300/50 to-gray-500/30 animate-pulse" />
        
        <Sparkles size={16} className="text-white relative z-10 animate-pulse" />
      </div>
      
      <div className="flex-1 flex flex-col gap-3 pt-1">
        {/* Main Thinking Label with shimmer text */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="thinking-badge-core flex items-center gap-2 text-[var(--thinking-color)] font-semibold text-sm tracking-tight">
              {/* Animated dots */}
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-[thinkingPulse_1s_infinite_0s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[thinkingPulse_1s_infinite_0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-[thinkingPulse_1s_infinite_0.4s]" />
              </span>
              
              {/* Shimmering text - silver/white like ChatGPT */}
              <span className="relative overflow-hidden">
                <span className="text-gray-300">
                  {THOUGHTS[idx]}
                </span>
                {/* Silver shimmer overlay */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-[shimmerSlide_2s_ease-in-out_infinite] mix-blend-overlay pointer-events-none" />
              </span>
            </span>
          </div>
        </div>

        {/* Steps with shimmer effects */}
        {steps.length > 0 ? (
          <div className="relative flex flex-col gap-2.5 bg-[var(--surface)]/60 border border-[var(--surface-border)] p-3.5 rounded-2xl backdrop-blur-md shadow-md transition-all duration-500 max-w-[95%] overflow-hidden">
            {/* Container shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmerSlide_3s_ease-in-out_infinite] pointer-events-none" />
            
            {steps.map((step, i) => (
              <div 
                key={step.id} 
                className={`relative flex items-center gap-3 text-xs transition-all duration-400 overflow-hidden ${
                  step.status === 'done' ? 'text-[var(--text-primary)]' : 
                  step.status === 'active' ? 'text-[var(--thinking-color)] font-medium' : 
                  'text-[var(--text-muted)] opacity-60'
                }`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* Active step shimmer background */}
                {step.status === 'active' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-400/20 via-gray-300/20 to-transparent animate-[shimmerSlide_1.5s_ease-in-out_infinite] rounded-lg -mx-2 px-2" />
                )}
                
                <div className="flex-shrink-0 relative z-10">
                  {step.status === 'done' ? (
                    <div className="w-4 h-4 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  ) : step.status === 'active' ? (
                    <div className="relative">
                      <Loader2 size={12} className="animate-spin text-gray-400" />
                      {/* Active icon shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmerSlide_1s_linear_infinite] rounded-full" />
                    </div>
                  ) : (
                    <Circle size={10} className="text-[var(--text-muted)]" />
                  )}
                </div>
                
                <span className="relative z-10 overflow-hidden">
                  {step.label}
                  {/* Text shimmer for active step */}
                  {step.status === 'active' && (
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmerSlide_1.5s_ease-in-out_infinite] mix-blend-overlay pointer-events-none" />
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="h-3 w-48 rounded-full bg-gradient-to-r from-[var(--surface-border)] via-gray-400/30 to-[var(--surface-border)] animate-[shimmer_2s_linear_infinite] bg-[length:200%_100%]" />
            <div className="h-3 w-64 rounded-full bg-gradient-to-r from-[var(--surface-border)] via-gray-400/20 to-[var(--surface-border)] animate-[shimmer_2s_linear_infinite] bg-[length:200%_100%]" style={{ animationDelay: '0.3s' }} />
            <div className="h-3 w-40 rounded-full bg-gradient-to-r from-[var(--surface-border)] via-gray-400/10 to-[var(--surface-border)] animate-[shimmer_2s_linear_infinite] bg-[length:200%_100%]" style={{ animationDelay: '0.6s' }} />
          </div>
        )}
      </div>
    </div>
  )
}
