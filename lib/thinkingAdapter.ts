// Thinking Adapter - Bridges thinking.ts module with the chat system
import {
  ThinkingManager,
  ThinkingService,
  type ThinkingStep,
  type StepStatus,
  thinkingService as defaultService,
} from '@/components/thinking'

import type { ResearchStep } from './types'

// Global singleton instances
const globalManager = defaultService.getManager()
let serviceStarted = false

export function ensureThinkingService(): ThinkingService {
  if (!serviceStarted) {
    defaultService.start()
    serviceStarted = true
  }
  return defaultService
}

export function getThinkingManager(): ThinkingManager {
  return globalManager
}

// Convert ThinkingStep to ResearchStep format
export function toResearchStep(step: ThinkingStep): ResearchStep {
  return {
    id: step.id,
    label: step.label,
    status: step.status as ResearchStep['status'],
  }
}

// Convert array of ThinkingSteps to ResearchSteps
export function toResearchSteps(steps: ThinkingStep[]): ResearchStep[] {
  return steps.map(toResearchStep)
}

// Create a new thinking session for a message
export function createThinkingSession(
  messageId: string,
  stepLabels?: string[]
): { sessionId: string; steps: ResearchStep[] } {
  const service = ensureThinkingService()
  const manager = service.getManager()
  
  const sessionId = manager.createSession(messageId)
  
  const defaultSteps = [
    'Analyzing query complexity...',
    'Breaking down the problem...',
    'Formulating approach...',
    'Processing information...',
    'Synthesizing response...',
  ]
  
  const labels = stepLabels || defaultSteps
  
  labels.forEach((label, index) => {
    manager.addStep(sessionId, label, index)
  })
  
  manager.setSessionState(sessionId, 'thinking')
  
  const session = manager.getSession(sessionId)
  const steps = session ? toResearchSteps(session.steps) : []
  
  return { sessionId, steps }
}

// Update a step status
export function updateThinkingStep(
  sessionId: string,
  stepId: string,
  status: StepStatus
): boolean {
  const manager = getThinkingManager()
  return manager.updateStepStatus(sessionId, stepId, status)
}

// Get current steps for a session
export function getThinkingSteps(sessionId: string): ResearchStep[] {
  const manager = getThinkingManager()
  const session = manager.getSession(sessionId)
  return session ? toResearchSteps(session.steps) : []
}

// Animate through thinking steps
export async function animateThinkingProcess(
  sessionId: string,
  onStepUpdate?: (steps: ResearchStep[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const manager = getThinkingManager()
  const session = manager.getSession(sessionId)
  
  if (!session) return
  
  const steps = session.steps
  
  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) return
    
    // Mark current step active
    manager.updateStepStatus(sessionId, steps[i].id, 'active')
    
    // Simulate processing time
    const delayMs = 500 + Math.random() * 1000
    await new Promise(resolve => setTimeout(resolve, delayMs))
    
    if (signal?.aborted) return
    
    // Mark step done
    manager.updateStepStatus(sessionId, steps[i].id, 'done')
    
    // Notify update
    if (onStepUpdate) {
      onStepUpdate(getThinkingSteps(sessionId))
    }
  }
  
  // Complete session
  manager.setSessionState(sessionId, 'completed')
}

// Quick thinking for simple queries
export async function quickThink(
  messageId: string,
  onStepUpdate?: (steps: ResearchStep[]) => void
): Promise<void> {
  const { sessionId } = createThinkingSession(messageId, [
    'Processing...',
    'Analyzing...',
    'Generating response...',
  ])
  
  await animateThinkingProcess(sessionId, onStepUpdate)
}

// Deep research thinking
export async function deepResearchThink(
  messageId: string,
  onStepUpdate?: (steps: ResearchStep[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const { sessionId } = createThinkingSession(messageId, [
    'Initializing deep research...',
    'Gathering comprehensive sources...',
    'Analyzing multiple perspectives...',
    'Synthesizing complex information...',
    'Validating findings...',
    'Formulating detailed response...',
  ])
  
  await animateThinkingProcess(sessionId, onStepUpdate, signal)
}

// Web search thinking
export async function webSearchThink(
  messageId: string,
  onStepUpdate?: (steps: ResearchStep[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const { sessionId } = createThinkingSession(messageId, [
    'Initiating web search...',
    'Querying search engines...',
    'Analyzing search results...',
    'Extracting relevant information...',
    'Synthesizing findings...',
  ])
  
  await animateThinkingProcess(sessionId, onStepUpdate, signal)
}

// Cleanup thinking session
export function cleanupThinkingSession(sessionId: string): void {
  const manager = getThinkingManager()
  manager.removeSession(sessionId)
}

// Get thinking progress
export function getThinkingProgress(sessionId: string): number {
  const manager = getThinkingManager()
  return manager.getSessionProgress(sessionId)
}

// Check if thinking is complete
export function isThinkingComplete(sessionId: string): boolean {
  const manager = getThinkingManager()
  const state = manager.getSessionState(sessionId)
  return state === 'completed' || state === 'error'
}
