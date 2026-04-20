'use client'
import { Sun, Moon, Plus, BarChart3, Users } from 'lucide-react'
import Image from 'next/image'
import { useTheme } from './ThemeProvider'
import { UserMenu } from './UserMenu'
import ModelSelector, { ModelType } from './ModelSelector'

interface Props {
  onNew: () => void
  onAnalytics?: () => void
  onTeams?: () => void
  currentModel?: ModelType
  onModelChange?: (model: ModelType) => void
}

export default function Header({ onNew, onAnalytics, onTeams, currentModel, onModelChange }: Props) {
  const { theme, toggle } = useTheme()

  return (
    <header className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-[var(--surface-border)] bg-[var(--bg)] shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 pl-10 sm:pl-0">
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow relative">
          <Image
            src="/logo.png"
            alt="Astra AI Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <span className="text-base sm:text-lg font-semibold text-[var(--text-primary)] tracking-tight">Astra AI</span>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        {onAnalytics && (
          <button
            onClick={onAnalytics}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] touch-manipulation min-h-[40px]"
            title="View Analytics"
          >
            <BarChart3 size={16} />
          </button>
        )}
        {onTeams && (
          <button
            onClick={onTeams}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] touch-manipulation min-h-[40px]"
            title="Teams"
          >
            <Users size={16} />
          </button>
        )}
        {currentModel && onModelChange && (
          <ModelSelector
            currentModel={currentModel}
            onModelChange={onModelChange}
          />
        )}
        <button
          onClick={onNew}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-1.5 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors touch-manipulation min-h-[40px]"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New chat</span>
        </button>
        <button
          onClick={toggle}
          className="p-2 sm:p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] touch-manipulation min-h-[40px]"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
