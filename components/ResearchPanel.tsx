'use client'
import { Globe, Check, Loader2, Clock } from 'lucide-react'
import type { ResearchStep } from '@/lib/types'

interface Props {
  steps: ResearchStep[]
}

const ICONS = {
  done: <Check size={10} />,
  active: <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />,
  pending: <Clock size={10} />,
}

export default function ResearchPanel({ steps }: Props) {
  const done = steps.filter(s => s.status === 'done').length
  const total = steps.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex items-start gap-3 msg-enter">
      <div className="w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-center shrink-0 mt-0.5">
        <Globe size={13} className="text-[var(--research-color)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="research-badge mb-3">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: 'var(--research-color)', animation: 'thinkingPulse 1.2s ease-in-out infinite' }}
          />
          Deep Research — {pct}% complete
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-[var(--surface-border)] mb-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'var(--research-color)', boxShadow: `0 0 12px var(--research-color)` }}
          />
        </div>

        {/* Research Panel with Glassmorphism */}
        <div className="research-panel bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl p-3">
          {steps.map(step => (
            <div key={step.id} className="research-step">
              <span className={`step-icon ${step.status === 'done' ? 'step-done' : step.status === 'active' ? 'step-active' : 'step-pending'}`}>
                {ICONS[step.status]}
              </span>
              <span className={step.status === 'done' ? 'text-[var(--text-primary)]' : step.status === 'active' ? 'text-[var(--research-color)]' : 'text-[var(--text-muted)]'}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
