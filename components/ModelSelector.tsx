'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Code2, Sparkles, Zap, Check, ChevronDown } from 'lucide-react'

export type ModelType = 'nexus-4' | 'petran-5'

interface Model {
  id: ModelType
  name: string
  version: string
  description: string
  icon: any
  color: string
  specialty: string
  tokenUsage: 'low' | 'medium' | 'high'
}

export const MODELS: Model[] = [
  {
    id: 'nexus-4',
    name: 'Nexus',
    version: '4.0',
    description: 'Expert in solving complex questions with precision',
    icon: Sparkles,
    color: 'from-blue-500 to-cyan-500',
    specialty: 'Complex problem solving, analysis, reasoning',
    tokenUsage: 'low',
  },
  {
    id: 'petran-5',
    name: 'Nexus Petran',
    version: '5',
    description: 'Expert in all coding and technical tasks',
    icon: Code2,
    color: 'from-purple-500 to-pink-500',
    specialty: 'Programming, debugging, architecture, algorithms',
    tokenUsage: 'medium',
  },
]

interface ModelSelectorProps {
  currentModel: ModelType
  onModelChange: (model: ModelType) => void
}

export default function ModelSelector({
  currentModel,
  onModelChange,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model>(
    MODELS.find(m => m.id === currentModel) || MODELS[0]
  )

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model)
    onModelChange(model.id)
    setIsOpen(false)
  }

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const Icon = selectedModel.icon

  return (
    <div className="relative">
      {/* Model Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--surface)] transition-all duration-200 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {selectedModel.name} {selectedModel.version}
          </span>
          <ChevronDown 
            size={14} 
            className={`text-[var(--text-muted)] transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-72 bg-[var(--bg-secondary)] 
                         border border-[var(--surface-border)] rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--surface-border)] bg-[var(--bg)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Select Model
                </h3>
              </div>

              {/* Model Options */}
              <div className="p-2 space-y-1">
                {MODELS.map((model, index) => {
                  const ModelIcon = model.icon
                  const isSelected = model.id === currentModel

                  return (
                    <motion.button
                      key={model.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleModelSelect(model)}
                      className={`w-full p-3 rounded-lg text-left transition-all duration-200
                        ${
                          isSelected
                            ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                            : 'hover:bg-[var(--surface)] border border-transparent'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {model.name} {model.version}
                        </span>
                        {isSelected && (
                          <Check size={14} className="text-[var(--accent)]" />
                        )}
                      </div>
                      
                      <p className="text-xs text-[var(--text-secondary)]">
                        {model.description}
                      </p>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
