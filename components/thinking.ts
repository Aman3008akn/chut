// thinking.ts // TypeScript Thinking Module for Web Integration
// This is a JavaScript/TypeScript port of the C++ thinking module

export type StepStatus = 'pending' | 'active' | 'done' | 'failed' | 'cancelled' | 'skipped'
export type ThinkingState = 'idle' | 'thinking' | 'completed' | 'error'

export interface ThinkingStep {
  id: string
  label: string
  status: StepStatus
  order: number
  errorMessage?: string
  startTime: Date
  endTime?: Date
  durationMs?: number
}

export interface ThinkingSession {
  id: string
  messageId: string
  state: ThinkingState
  startTime: Date
  endTime?: Date
  steps: ThinkingStep[]
  errorMessage?: string
  getProgress(): number
}

// ============================================================================
// ThinkingStepManager
// ============================================================================

export class ThinkingStepManager {
  private step: ThinkingStep

  constructor(id: string, label: string, order: number = 0) {
    this.step = {
      id,
      label,
      status: 'pending',
      order,
      startTime: new Date(),
    }
  }

  getStep(): ThinkingStep {
    return { ...this.step }
  }

  setActive(): void {
    this.step.status = 'active'
  }

  setDone(): void {
    this.step.status = 'done'
    this.step.endTime = new Date()
    this.step.durationMs = this.getDurationMs()
  }

  setFailed(error: string = ''): void {
    this.step.status = 'failed'
    this.step.errorMessage = error
    this.step.endTime = new Date()
    this.step.durationMs = this.getDurationMs()
  }

  setCancelled(): void {
    this.step.status = 'cancelled'
    this.step.endTime = new Date()
    this.step.durationMs = this.getDurationMs()
  }

  setSkipped(): void {
    this.step.status = 'skipped'
  }

  getDurationMs(): number {
    if (this.step.endTime) {
      return this.step.endTime.getTime() - this.step.startTime.getTime()
    }
    return Date.now() - this.step.startTime.getTime()
  }

  toJson(): string {
    const step = this.step
    return JSON.stringify({
      id: step.id,
      label: step.label,
      status: step.status,
      startTime: step.startTime.toISOString(),
      endTime: step.endTime?.toISOString(),
      durationMs: step.durationMs || this.getDurationMs(),
      order: step.order,
      errorMessage: step.errorMessage,
    })
  }

  static fromJson(json: string): ThinkingStepManager {
    const data = JSON.parse(json)
    const manager = new ThinkingStepManager(data.id, data.label, data.order)
    manager.step.status = data.status
    manager.step.startTime = new Date(data.startTime)
    manager.step.endTime = data.endTime ? new Date(data.endTime) : undefined
    manager.step.durationMs = data.durationMs
    manager.step.errorMessage = data.errorMessage
    return manager
  }
}

// ============================================================================
// ThinkingManager
// ============================================================================

export type StepCallback = (step: ThinkingStep) => void
export type SessionCallback = (session: ThinkingSession) => void
export type ProgressCallback = (progress: number) => void

export class ThinkingManager {
  private sessions: Map<string, ThinkingSession>
  private stepCallback?: StepCallback
  private sessionCallback?: SessionCallback
  private progressCallback?: ProgressCallback

  constructor() {
    this.sessions = new Map()
  }

  createSession(messageId: string): string {
    const session: ThinkingSession = {
      id: this.generateId(),
      messageId,
      state: 'idle',
      startTime: new Date(),
      steps: [],
      getProgress: function() {
        if (this.steps.length === 0) return 0
        const completed = this.steps.filter(s => s.status === 'done').length
        return completed / this.steps.length
      }
    }
    this.sessions.set(session.id, session)
    this.notifySessionChange(session)
    return session.id
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getSession(sessionId: string): ThinkingSession | undefined {
    return this.sessions.get(sessionId)
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  addStep(sessionId: string, label: string, order: number = 0): string {
    const session = this.sessions.get(sessionId)
    if (!session) return ''

    const step: ThinkingStep = {
      id: this.generateId(),
      label,
      status: 'pending',
      order,
      startTime: new Date(),
    }
    session.steps.push(step)
    this.notifyStepChange(step)
    this.notifyProgress(session)
    return step.id
  }

  updateStepStatus(
    sessionId: string,
    stepId: string,
    status: StepStatus,
    error: string = ''
  ): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    for (const step of session.steps) {
      if (step.id === stepId) {
        step.status = status
        if (error) step.errorMessage = error
        if (status === 'done' || status === 'failed') {
          step.endTime = new Date()
          step.durationMs = step.endTime.getTime() - step.startTime.getTime()
        }
        this.notifyStepChange(step)
        this.notifyProgress(session)
        return true
      }
    }
    return false
  }

  setSessionState(sessionId: string, state: ThinkingState): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.state = state
    if (state === 'completed' || state === 'error') {
      session.endTime = new Date()
    }
    this.notifySessionChange(session)
  }

  getSessionState(sessionId: string): ThinkingState {
    const session = this.sessions.get(sessionId)
    return session ? session.state : 'error'
  }

  getSessionProgress(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    return session ? session.getProgress?.() ?? 0 : 0
  }

  getCompletedSteps(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    return session ? session.steps.filter(s => s.status === 'done').length : 0
  }

  getTotalSteps(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    return session ? session.steps.length : 0
  }

  setStepCallback(callback: StepCallback): void {
    this.stepCallback = callback
  }

  setSessionCallback(callback: SessionCallback): void {
    this.sessionCallback = callback
  }

  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback
  }

  cleanupOldSessions(maxAgeMs: number): void {
    const now = Date.now()
    for (const [id, session] of this.sessions) {
      const age = now - session.startTime.getTime()
      if (age > maxAgeMs) {
        this.sessions.delete(id)
      }
    }
  }

  clearAllSessions(): void {
    this.sessions.clear()
  }

  sessionToJson(sessionId: string): string {
    const session = this.sessions.get(sessionId)
    if (!session) return '{}'

    return JSON.stringify({
      id: session.id,
      messageId: session.messageId,
      state: session.state,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      totalDurationMs: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0,
      progress: this.calculateProgress(session),
      completedSteps: session.steps.filter(s => s.status === 'done').length,
      totalSteps: session.steps.length,
      errorMessage: session.errorMessage,
      steps: session.steps.map(step => ({
        id: step.id,
        label: step.label,
        status: step.status,
        durationMs: step.durationMs,
        order: step.order,
        errorMessage: step.errorMessage,
      })),
    })
  }

  allSessionsToJson(): string {
    const sessions = Array.from(this.sessions.values())
    return JSON.stringify({
      sessions: sessions.map(s => JSON.parse(this.sessionToJson(s.id))),
      totalSessions: sessions.length,
    })
  }

  private notifyStepChange(step: ThinkingStep): void {
    if (this.stepCallback) {
      this.stepCallback(step)
    }
  }

  private notifySessionChange(session: ThinkingSession): void {
    if (this.sessionCallback) {
      this.sessionCallback(session)
    }
  }

  private notifyProgress(session: ThinkingSession): void {
    if (this.progressCallback) {
      this.progressCallback(this.calculateProgress(session))
    }
  }

  private calculateProgress(session: ThinkingSession): number {
    if (session.steps.length === 0) return 0
    const completed = session.steps.filter(s => s.status === 'done').length
    return completed / session.steps.length
  }

  private generateId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
  }
}

// ============================================================================
// ThinkingService
// ============================================================================

export class ThinkingService {
  private manager: ThinkingManager
  private running: boolean
  private maxConcurrentSessions: number
  private processingTimeoutMs: number
  private processedCount: number
  private failedCount: number
  private processingTimes: number[]

  constructor() {
    this.manager = new ThinkingManager()
    this.running = false
    this.maxConcurrentSessions = 5
    this.processingTimeoutMs = 30000
    this.processedCount = 0
    this.failedCount = 0
    this.processingTimes = []
  }

  start(): boolean {
    if (this.running) return false
    this.running = true
    return true
  }

  stop(): void {
    this.running = false
  }

  isRunning(): boolean {
    return this.running
  }

  getManager(): ThinkingManager {
    return this.manager
  }

  processSession(sessionId: string): void {
    this.processSessionInternal(sessionId)
  }

  processStep(sessionId: string, stepId: string): void {
    const session = this.manager.getSession(sessionId)
    if (!session) return

    for (const step of session.steps) {
      if (step.id === stepId) {
        this.manager.updateStepStatus(sessionId, stepId, 'active')
        
        // Simulate processing time
        const processingTime = 100 + Math.random() * 200
        setTimeout(() => {
          this.manager.updateStepStatus(sessionId, stepId, 'done')
        }, processingTime)
        break
      }
    }
  }

  processSessionAsync(sessionId: string, callback?: (success: boolean) => void): void {
    setTimeout(async () => {
      const success = await this.simulateThinkingProcess(sessionId)
      if (callback) callback(success)
    }, 0)
  }

  getProcessedCount(): number {
    return this.processedCount
  }

  getFailedCount(): number {
    return this.failedCount
  }

  getAverageProcessingTimeMs(): number {
    if (this.processingTimes.length === 0) return 0
    const sum = this.processingTimes.reduce((a, b) => a + b, 0)
    return sum / this.processingTimes.length
  }

  private processSessionInternal(sessionId: string): void {
    const session = this.manager.getSession(sessionId)
    if (!session) return

    const startTime = Date.now()
    this.manager.setSessionState(sessionId, 'thinking')

    this.simulateThinkingProcess(sessionId).then(success => {
      const endTime = Date.now()
      const duration = endTime - startTime
      this.processingTimes.push(duration)
      if (success) {
        this.processedCount++
      } else {
        this.failedCount++
      }
      this.manager.setSessionState(sessionId, success ? 'completed' : 'error')
    })
  }

  private async simulateThinkingProcess(sessionId: string): Promise<boolean> {
    const session = this.manager.getSession(sessionId)
    if (!session) return false

    // Process each step in order
    for (const step of session.steps) {
      if (!this.running) return false

      // Mark step as active
      this.manager.updateStepStatus(sessionId, step.id, 'active')

      // Simulate processing time (random between 100-500ms)
      const processingTime = 100 + Math.random() * 400
      await new Promise(resolve => setTimeout(resolve, processingTime))

      // Mark step as done
      this.manager.updateStepStatus(sessionId, step.id, 'done')
    }

    return true
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export const thinkingUtils = {
  generateId: (): string => {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
  },

  statusToString: (status: StepStatus): string => {
    const statusMap: Record<StepStatus, string> = {
      pending: 'pending',
      active: 'active',
      done: 'done',
      failed: 'failed',
      cancelled: 'cancelled',
      skipped: 'skipped',
    }
    return statusMap[status] || 'unknown'
  },

  stringToStatus: (str: string): StepStatus => {
    const statusMap: Record<string, StepStatus> = {
      pending: 'pending',
      active: 'active',
      done: 'done',
      failed: 'failed',
      cancelled: 'cancelled',
      skipped: 'skipped',
    }
    return statusMap[str.toLowerCase()] || 'pending'
  },

  stateToString: (state: ThinkingState): string => {
    const stateMap: Record<ThinkingState, string> = {
      idle: 'idle',
      thinking: 'thinking',
      completed: 'completed',
      error: 'error',
    }
    return stateMap[state] || 'unknown'
  },

  stringToState: (str: string): ThinkingState => {
    const stateMap: Record<string, ThinkingState> = {
      idle: 'idle',
      thinking: 'thinking',
      completed: 'completed',
      error: 'error',
    }
    return stateMap[str.toLowerCase()] || 'idle'
  },

  formatTimestamp: (date: Date): string => {
    return date.toISOString()
  },

  parseTimestamp: (str: string): Date => {
    return new Date(str)
  },
}

// ============================================================================
// Singleton Instances
// ============================================================================

export const thinkingService = new ThinkingService()
