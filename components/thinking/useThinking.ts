'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ThinkingManager,
  ThinkingService,
  ThinkingStepManager,
  type ThinkingStep,
  type StepStatus,
  thinkingService as defaultService,
} from '../thinking'

export interface UseThinkingOptions {
  enabled?: boolean
  maxSteps?: number
  onStepComplete?: (step: ThinkingStep) => void
  onComplete?: () => void
  onError?: (error: string) => void
}

export interface UseThinkingReturn {
  steps: ThinkingStep[]
  isThinking: boolean
  progress: number
  sessionId: string | null
  
  // Actions
  startThinking: (messageId: string, stepLabels?: string[]) => void
  stopThinking: () => void
  addStep: (label: string) => string | null
  updateStep: (stepId: string, status: StepStatus, error?: string) => boolean
  completeAll: () => void
  reset: () => void
}

export function useThinking(options: UseThinkingOptions = {}): UseThinkingReturn {
  const { enabled = true, maxSteps = 10, onStepComplete, onComplete, onError } = options
  
  const [steps, setSteps] = useState<ThinkingStep[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  const managerRef = useRef<ThinkingManager>(defaultService.getManager())
  const serviceRef = useRef<ThinkingService>(defaultService)
  
  // Setup callbacks
  useEffect(() => {
    if (!enabled) return
    
    const manager = managerRef.current
    
    manager.setStepCallback((step) => {
      setSteps(prev => {
        const exists = prev.find(s => s.id === step.id)
        if (exists) {
          return prev.map(s => s.id === step.id ? step : s)
        }
        return [...prev, step]
      })
      
      if (step.status === 'done' && onStepComplete) {
        onStepComplete(step)
      }
    })
    
    manager.setProgressCallback((p) => {
      setProgress(p)
    })
    
    manager.setSessionCallback((session) => {
      setIsThinking(session.state === 'thinking')
      if (session.state === 'completed' && onComplete) {
        onComplete()
      }
      if (session.state === 'error' && onError && session.errorMessage) {
        onError(session.errorMessage)
      }
    })
    
    // Start service if not running
    if (!serviceRef.current.isRunning()) {
      serviceRef.current.start()
    }
    
    return () => {
      manager.setStepCallback(undefined)
      manager.setProgressCallback(undefined)
      manager.setSessionCallback(undefined)
    }
  }, [enabled, onStepComplete, onComplete, onError])
  
  const startThinking = useCallback((messageId: string, stepLabels?: string[]) => {
    if (!enabled) return
    
    const manager = managerRef.current
    const newSessionId = manager.createSession(messageId)
    setSessionId(newSessionId)
    setSteps([])
    setProgress(0)
    setIsThinking(true)
    
    // Add initial steps if provided
    if (stepLabels && stepLabels.length > 0) {
      stepLabels.forEach((label, index) => {
        manager.addStep(newSessionId, label, index)
      })
    }
    
    manager.setSessionState(newSessionId, 'thinking')
  }, [enabled])
  
  const stopThinking = useCallback(() => {
    if (sessionId) {
      managerRef.current.setSessionState(sessionId, 'completed')
      setIsThinking(false)
    }
  }, [sessionId])
  
  const addStep = useCallback((label: string): string | null => {
    if (!sessionId || !enabled) return null
    return managerRef.current.addStep(sessionId, label, steps.length)
  }, [sessionId, enabled, steps.length])
  
  const updateStep = useCallback((stepId: string, status: StepStatus, error?: string): boolean => {
    if (!sessionId) return false
    return managerRef.current.updateStepStatus(sessionId, stepId, status, error)
  }, [sessionId])
  
  const completeAll = useCallback(() => {
    if (!sessionId) return
    
    const manager = managerRef.current
    const session = manager.getSession(sessionId)
    
    if (session) {
      session.steps.forEach((step, index) => {
        if (step.status !== 'done' && step.status !== 'failed') {
          setTimeout(() => {
            manager.updateStepStatus(sessionId, step.id, 'done')
          }, index * 100)
        }
      })
    }
    
    setTimeout(() => {
      manager.setSessionState(sessionId, 'completed')
      setIsThinking(false)
    }, session?.steps.length ? session.steps.length * 100 + 200 : 0)
  }, [sessionId])
  
  const reset = useCallback(() => {
    if (sessionId) {
      managerRef.current.removeSession(sessionId)
    }
    setSteps([])
    setProgress(0)
    setIsThinking(false)
    setSessionId(null)
  }, [sessionId])
  
  return {
    steps,
    isThinking,
    progress,
    sessionId,
    startThinking,
    stopThinking,
    addStep,
    updateStep,
    completeAll,
    reset,
  }
}
