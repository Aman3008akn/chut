'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useThinking, type UseThinkingOptions, type UseThinkingReturn } from './useThinking'

const ThinkingContext = createContext<UseThinkingReturn | null>(null)

export interface ThinkingProviderProps extends UseThinkingOptions {
  children: ReactNode
}

export function ThinkingProvider({ children, ...options }: ThinkingProviderProps) {
  const thinking = useThinking(options)
  
  return (
    <ThinkingContext.Provider value={thinking}>
      {children}
    </ThinkingContext.Provider>
  )
}

export function useThinkingContext(): UseThinkingReturn {
  const context = useContext(ThinkingContext)
  if (!context) {
    throw new Error('useThinkingContext must be used within ThinkingProvider')
  }
  return context
}

// Adapter to convert thinking steps to ResearchStep format
export function adaptThinkingSteps(steps: Array<{ id: string; label: string; status: string }>): Array<{ id: string; label: string; status: 'pending' | 'active' | 'done' }> {
  return steps.map(step => ({
    id: step.id,
    label: step.label,
    status: step.status as 'pending' | 'active' | 'done',
  }))
}
