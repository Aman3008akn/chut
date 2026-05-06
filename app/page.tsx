'use client'

// ============================================================
// IMPORTS
// ============================================================
import {
  useState, useEffect, useRef, useCallback,
  useMemo, useReducer, createContext, useContext,
  memo, lazy, Suspense, startTransition
} from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import MessageBubble from '@/components/MessageBubble'
import ChatInput from '@/components/ChatInput'
import WelcomeScreen from '@/components/WelcomeScreen'
import ConversationAnalytics from '@/components/ConversationAnalytics'
import TeamPanel from '@/components/TeamPanel'
import ModelSelector, { ModelType } from '@/components/ModelSelector'
import { useSession } from 'next-auth/react'
import {
  generateId, isComplexQuery, isExtremelyHardQuery,
  getConversationTitle, saveConversations, loadConversations
} from '@/lib/utils'
import type {
  Message, Conversation, ResearchStep, SearchSource
} from '@/lib/types'
import { extractMemoriesFromText } from '@/lib/memories'

// ============================================================
// SECURITY CONSTANTS
// ============================================================

/**
 * Maximum number of characters allowed in a single user message.
 * Prevents prompt injection via oversized payloads.
 */
const MAX_MESSAGE_LENGTH = 8_000

/**
 * Maximum number of messages stored per conversation.
 * Prevents unbounded memory growth and context-window abuse.
 */
const MAX_MESSAGES_PER_CONVERSATION = 500

/**
 * Maximum number of conversations a user may keep simultaneously.
 */
const MAX_CONVERSATIONS = 200

/**
 * Client-side rate-limit bucket: maximum messages within the window.
 */
const RATE_LIMIT_MAX_MESSAGES = 20

/**
 * Rate-limit sliding-window duration (milliseconds).
 */
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

/**
 * Minimum delay (ms) between successive sends to defeat rapid-fire flooding.
 */
const MIN_SEND_INTERVAL_MS = 500

/**
 * Allowed URL schemes for image uploads.
 */
const ALLOWED_IMAGE_SCHEMES = ['https://', 'data:image/']

/**
 * Regex: characters that are outright rejected in user input.
 * Blocks common prompt-injection control sequences.
 */
const DANGEROUS_INPUT_PATTERN =
  /(\x00|\x08|\x0B|\x0C|\x0E-\x1F|\x7F|<script[\s\S]*?>[\s\S]*?<\/script>)/gi

/**
 * Regex: detect suspiciously repeated identical tokens that may signal
 * an adversarial repetition attack.
 */
const REPETITION_ATTACK_PATTERN = /(.{10,})\1{9,}/

/**
 * Nonce length for CSRF tokens (bytes → hex = 2× length).
 */
const CSRF_TOKEN_BYTES = 16

/**
 * LocalStorage key for persisting the CSRF token across page reloads.
 */
const CSRF_TOKEN_STORAGE_KEY = '__astra_csrf'

/**
 * Session-integrity header name sent with every mutating fetch.
 */
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * Content-Security-Policy directives logged to console in development.
 */
const DEV_CSP_HINT =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https:; connect-src 'self' https://api.openai.com"

// ============================================================
// SECURITY UTILITIES
// ============================================================

/**
 * Generates a cryptographically random hex string using the
 * Web Crypto API (falls back to Math.random in very old environments).
 */
function generateSecureToken(bytes = CSRF_TOKEN_BYTES): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(bytes)
    window.crypto.getRandomValues(arr)
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // Insecure fallback – only reached in ancient environments
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Retrieves or creates the per-session CSRF token stored in sessionStorage.
 * Using sessionStorage (not localStorage) means it is cleared when the
 * browser tab is closed, limiting replay-window duration.
 */
function getOrCreateCsrfToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_STORAGE_KEY)
    if (stored && stored.length >= CSRF_TOKEN_BYTES * 2) return stored
    const fresh = generateSecureToken()
    sessionStorage.setItem(CSRF_TOKEN_STORAGE_KEY, fresh)
    return fresh
  } catch {
    // Private-browsing mode may block storage access
    return generateSecureToken()
  }
}

/**
 * Sanitises user-supplied text before it is stored or sent to the API.
 *
 * Steps:
 *  1. Trim surrounding whitespace.
 *  2. Strip NUL and other dangerous control characters.
 *  3. Normalise Unicode to NFC to prevent homoglyph attacks.
 *  4. Truncate to MAX_MESSAGE_LENGTH.
 *
 * Returns the cleaned string or null if the result is empty.
 */
function sanitizeInput(raw: string): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s) return null
  // Strip dangerous characters
  s = s.replace(DANGEROUS_INPUT_PATTERN, '')
  // Unicode normalisation (NFC)
  try { s = s.normalize('NFC') } catch { /* not supported */ }
  // Hard truncate
  if (s.length > MAX_MESSAGE_LENGTH) s = s.slice(0, MAX_MESSAGE_LENGTH)
  return s || null
}

/**
 * Validates an image URL before it is persisted or sent to the API.
 * Accepts only https:// and data:image/ URIs to prevent SSRF / JS injection.
 */
function validateImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  const allowed = ALLOWED_IMAGE_SCHEMES.some(scheme =>
    trimmed.toLowerCase().startsWith(scheme)
  )
  return allowed ? trimmed : undefined
}

/**
 * Detects whether the input string looks like a repetition / flooding attack.
 */
function isRepetitionAttack(text: string): boolean {
  return REPETITION_ATTACK_PATTERN.test(text)
}

/**
 * Performs a lightweight profanity / policy check.
 * Extend the list as needed; returns the matched term or null.
 *
 * NOTE: Real production systems should do this server-side.
 * Client-side checks are a UX convenience, not a security boundary.
 */
const POLICY_TERMS = [
  // Add domain-specific blocked terms here
] as const

function policyCheck(text: string): string | null {
  const lower = text.toLowerCase()
  for (const term of POLICY_TERMS) {
    if (lower.includes(term)) return term
  }
  return null
}

/**
 * Immutable audit-log entry written for every user action.
 */
interface AuditEntry {
  timestamp: number
  action: AuditAction
  details?: Record<string, unknown>
  sessionId?: string
}

type AuditAction =
  | 'SEND_MESSAGE'
  | 'RATE_LIMIT_BLOCK'
  | 'SANITIZE_STRIP'
  | 'POLICY_BLOCK'
  | 'REPETITION_BLOCK'
  | 'IMAGE_REJECTED'
  | 'CONVERSATION_DELETE'
  | 'CONVERSATION_CREATE'
  | 'SESSION_START'
  | 'STOP_GENERATION'
  | 'ERROR'

/** In-memory ring buffer (max 500 entries) for audit events. */
const auditLog: AuditEntry[] = []
const AUDIT_LOG_MAX = 500

function writeAudit(
  action: AuditAction,
  details?: Record<string, unknown>,
  sessionId?: string
): void {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    action,
    details,
    sessionId,
  }
  if (auditLog.length >= AUDIT_LOG_MAX) auditLog.shift()
  auditLog.push(entry)
  if (process.env.NODE_ENV === 'development') {
    console.debug('[AUDIT]', entry)
  }
}

/** Export audit log as JSON string (useful for admin panels). */
function exportAuditLog(): string {
  return JSON.stringify(auditLog, null, 2)
}

// ============================================================
// RATE-LIMITER (CLIENT-SIDE)
// ============================================================

/**
 * Sliding-window rate limiter stored in a closure.
 * Tracks message timestamps and refuses new sends when the
 * RATE_LIMIT_MAX_MESSAGES threshold is reached within the window.
 */
class ClientRateLimiter {
  private timestamps: number[] = []
  private lastSendAt = 0

  /**
   * Returns true if the send should be allowed, false if blocked.
   * Side-effect: records the current timestamp when allowed.
   */
  check(): { allowed: boolean; reason?: string } {
    const now = Date.now()

    // Enforce minimum inter-message delay
    if (now - this.lastSendAt < MIN_SEND_INTERVAL_MS) {
      return { allowed: false, reason: 'Too fast – please wait a moment.' }
    }

    // Purge timestamps outside the sliding window
    this.timestamps = this.timestamps.filter(
      t => now - t < RATE_LIMIT_WINDOW_MS
    )

    if (this.timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      const oldest = this.timestamps[0]
      const waitSec = Math.ceil(
        (oldest + RATE_LIMIT_WINDOW_MS - now) / 1000
      )
      return {
        allowed: false,
        reason: `Rate limit reached. Try again in ${waitSec}s.`,
      }
    }

    this.timestamps.push(now)
    this.lastSendAt = now
    return { allowed: true }
  }

  /** Returns remaining sends in the current window. */
  remaining(): number {
    const now = Date.now()
    const active = this.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    return Math.max(0, RATE_LIMIT_MAX_MESSAGES - active.length)
  }

  /** Resets the limiter (e.g. after a session change). */
  reset(): void {
    this.timestamps = []
    this.lastSendAt = 0
  }
}

const rateLimiter = new ClientRateLimiter()

// ============================================================
// SECURE FETCH WRAPPER
// ============================================================

interface SecureFetchOptions extends RequestInit {
  /** Add CSRF token header automatically (default: true). */
  csrf?: boolean
  /** Timeout in milliseconds (default: 30_000). */
  timeout?: number
  /** Number of retry attempts on network error (default: 0). */
  retries?: number
}

/**
 * Wraps the native fetch with:
 *  - Automatic CSRF header injection
 *  - Request timeout via AbortController
 *  - Exponential-backoff retry on network failure
 *  - Response status validation (throws on 4xx / 5xx)
 */
async function secureFetch(
  url: string,
  opts: SecureFetchOptions = {}
): Promise<Response> {
  const {
    csrf = true,
    timeout = 30_000,
    retries = 0,
    headers = {},
    ...rest
  } = opts

  const mergedHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  }

  if (csrf) {
    mergedHeaders[CSRF_HEADER_NAME] = getOrCreateCsrfToken()
  }

  let attempt = 0
  while (true) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)

    try {
      const res = await fetch(url, {
        ...rest,
        headers: mergedHeaders,
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new SecureFetchError(res.status, body)
      }

      return res
    } catch (err: any) {
      clearTimeout(timer)
      if (attempt >= retries || err instanceof SecureFetchError) throw err
      // Exponential back-off: 200ms, 400ms, 800ms …
      await delay(200 * Math.pow(2, attempt))
      attempt++
    }
  }
}

class SecureFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`)
    this.name = 'SecureFetchError'
  }
}

// ============================================================
// HELPERS
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms))
}

function clampMessages(messages: Message[]): Message[] {
  if (messages.length <= MAX_MESSAGES_PER_CONVERSATION) return messages
  // Keep the most recent messages, never drop system or initial context
  return messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
}

function clampConversations(convs: Conversation[]): Conversation[] {
  if (convs.length <= MAX_CONVERSATIONS) return convs
  // Drop oldest conversations (sorted by updatedAt desc → drop from tail)
  return convs.slice(0, MAX_CONVERSATIONS)
}

/** Deep-freeze an object to prevent accidental mutation (dev-mode only). */
function deepFreeze<T>(obj: T): T {
  if (process.env.NODE_ENV !== 'development') return obj
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const val = (obj as any)[prop]
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  })
  return obj
}

/** Stable identity check for memoisation guards. */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => a[k] === b[k])
}

// ============================================================
// ERROR BOUNDARY CONTEXT
// ============================================================

interface AppErrorState {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
}

const AppErrorContext = createContext<AppErrorState>({
  hasError: false,
  error: null,
  errorInfo: null,
})

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

type NotificationType = 'info' | 'warning' | 'error' | 'success'

interface Notification {
  id: string
  type: NotificationType
  message: string
  autoClose?: boolean
  duration?: number
}

type NotificationAction =
  | { type: 'ADD'; payload: Omit<Notification, 'id'> }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }

function notificationReducer(
  state: Notification[],
  action: NotificationAction
): Notification[] {
  switch (action.type) {
    case 'ADD': {
      const n: Notification = { id: generateId(), ...action.payload }
      // Prevent duplicate messages
      if (state.some(s => s.message === n.message)) return state
      return [...state, n].slice(-5) // max 5 visible
    }
    case 'REMOVE':
      return state.filter(n => n.id !== action.id)
    case 'CLEAR':
      return []
    default:
      return state
  }
}

interface NotificationContextValue {
  notifications: Notification[]
  notify: (n: Omit<Notification, 'id'>) => void
  dismiss: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  notify: () => undefined,
  dismiss: () => undefined,
})

function useNotifications() {
  return useContext(NotificationContext)
}

// ============================================================
// CONVERSATION STATE MACHINE
// ============================================================

type ConvStatus =
  | 'idle'
  | 'thinking'
  | 'researching'
  | 'searching'
  | 'streaming'
  | 'error'
  | 'aborted'

interface ConvState {
  status: ConvStatus
  activeConvId: string | null
  activeAssistantMsgId: string | null
  rateLimitRemaining: number
}

type ConvAction =
  | { type: 'SEND_START'; convId: string; assistantId: string; mode: ConvStatus }
  | { type: 'STREAMING_START'; assistantId: string }
  | { type: 'SEND_DONE' }
  | { type: 'SEND_ERROR' }
  | { type: 'ABORT' }
  | { type: 'RATE_LIMIT_UPDATE'; remaining: number }

function convReducer(state: ConvState, action: ConvAction): ConvState {
  switch (action.type) {
    case 'SEND_START':
      return {
        ...state,
        status: action.mode,
        activeConvId: action.convId,
        activeAssistantMsgId: action.assistantId,
      }
    case 'STREAMING_START':
      return { ...state, status: 'streaming', activeAssistantMsgId: action.assistantId }
    case 'SEND_DONE':
      return { ...state, status: 'idle', activeAssistantMsgId: null }
    case 'SEND_ERROR':
      return { ...state, status: 'error', activeAssistantMsgId: null }
    case 'ABORT':
      return { ...state, status: 'aborted', activeAssistantMsgId: null }
    case 'RATE_LIMIT_UPDATE':
      return { ...state, rateLimitRemaining: action.remaining }
    default:
      return state
  }
}

// ============================================================
// RESEARCH / WEB-SEARCH STEP DEFINITIONS
// ============================================================

const RESEARCH_STEPS: Omit<ResearchStep, 'status'>[] = [
  { id: 'r1',  label: '🔎 Decoding your question & identifying key themes' },
  { id: 'r2',  label: '📚 Diving into knowledge archives' },
  { id: 'r3',  label: '🌍 Exploring global perspectives & historical context' },
  { id: 'r4',  label: '🧩 Breaking down complex concepts into pieces' },
  { id: 'r5',  label: '🔗 Connecting dots across different domains' },
  { id: 'r6',  label: '⚡ Hunting down the latest trends & innovations' },
  { id: 'r7',  label: '🎯 Analysing cause-and-effect chains' },
  { id: 'r8',  label: '✅ Validating sources & cross-checking facts' },
  { id: 'r9',  label: '🧠 Synthesising insights & finding patterns' },
  { id: 'r10', label: '🕵️ Filling knowledge gaps & exploring edge cases' },
  { id: 'r11', label: '📖 Crafting a comprehensive narrative' },
  { id: 'r12', label: '🚀 Polishing & preparing final insights' },
]

const WEB_SEARCH_STEPS: Omit<ResearchStep, 'status'>[] = [
  { id: 'ws1', label: '🔍 Generating search queries' },
  { id: 'ws2', label: '🌐 Searching the web' },
  { id: 'ws3', label: '📄 Reading top results' },
  { id: 'ws4', label: '🔗 Cross-referencing sources' },
  { id: 'ws5', label: '✨ Synthesising findings' },
]

const THINKING_STEPS_TEMPLATE: Omit<ResearchStep, 'status'>[] = [
  { id: 't1', label: '1. Extracting Core Context' },
  { id: 't2', label: '2. Thinking with Deep Precision' },
  { id: 't3', label: '3. Analytical Synthesis' },
]

function makeResearchSteps(): ResearchStep[] {
  return RESEARCH_STEPS.map(s => ({ ...s, status: 'pending' as const }))
}

function makeWebSearchSteps(): ResearchStep[] {
  return WEB_SEARCH_STEPS.map(s => ({ ...s, status: 'pending' as const }))
}

function makeThinkingSteps(): ResearchStep[] {
  return THINKING_STEPS_TEMPLATE.map(s => ({ ...s, status: 'pending' as const }))
}

// ============================================================
// STEP ANIMATION TIMINGS
// ============================================================

const RESEARCH_STEP_DELAYS_MS = [
  9000, 11000, 8500, 10500, 12000,
  9500, 11500, 10000, 8000, 11000,
  9500, 10000,
] as const

const WEB_SEARCH_STEP_DELAYS_MS = [800, 1200, 1000, 800, 600] as const
const THINKING_STEP_DELAY_MS = 1500
const THINKING_STEP_JITTER_MS = 800

// ============================================================
// CONVERSATION PERSISTENCE — SECURE WRAPPERS
// ============================================================

/**
 * Persists conversations to localStorage with a basic integrity check.
 * Skips persistence if the payload would exceed 4 MB (leaves headroom).
 */
function secureSaveConversations(convs: Conversation[]): void {
  try {
    const payload = JSON.stringify(convs)
    if (payload.length > 4_000_000) {
      console.warn('[Storage] Payload too large – skipping localStorage save.')
      return
    }
    saveConversations(convs)
  } catch (err) {
    console.error('[Storage] Failed to persist conversations:', err)
  }
}

/**
 * Loads conversations from localStorage and validates the shape.
 * Malformed or tampered data is silently dropped.
 */
function secureLoadConversations(): Conversation[] {
  try {
    const raw = loadConversations()
    if (!Array.isArray(raw)) return []
    return raw
      .filter(c => c && typeof c === 'object' && typeof c.id === 'string')
      .map(c => ({
        ...c,
        id: String(c.id).slice(0, 64),
        title: typeof c.title === 'string' ? c.title.slice(0, 200) : 'Chat',
        messages: Array.isArray(c.messages) ? c.messages : [],
        createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      }))
  } catch {
    return []
  }
}

// ============================================================
// API HISTORY BUILDER
// ============================================================

interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Builds the message history array sent to the backend.
 *
 * Security considerations:
 *  - Only 'done' assistant messages are included (avoids leaking partial/error states).
 *  - Each content field is re-sanitised to strip any stored injection artefacts.
 *  - History is capped at the last 40 exchanges to bound context-window cost.
 */
function buildApiHistory(
  messages: Message[],
  newUserText: string,
  maxPairs = 10
): ApiMessage[] {
  const history: ApiMessage[] = messages
    .filter(m =>
      (m.role === 'user') ||
      (m.role === 'assistant' && m.status === 'done' && m.content)
    )
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: (sanitizeInput(m.content) ?? '').slice(0, MAX_MESSAGE_LENGTH),
    }))
    .slice(-(maxPairs * 2)) // keep last N turns

  history.push({
    role: 'user',
    content: (sanitizeInput(newUserText) ?? '').slice(0, MAX_MESSAGE_LENGTH),
  })

  return history
}

// ============================================================
// SSE STREAM PARSER
// ============================================================

interface StreamChunk {
  text?: string
  sources?: SearchSource[]
  webSearchQueries?: string[]
  done?: boolean
  error?: string
}

/**
 * Parses a single SSE line into a structured chunk.
 * Swallows malformed JSON and returns null.
 */
function parseSSELine(line: string): StreamChunk | null {
  if (!line.startsWith('data: ')) return null
  const payload = line.slice(6).trim()
  if (payload === '[DONE]') return { done: true }
  try {
    const parsed = JSON.parse(payload)
    // Validate shape to prevent prototype-pollution via __proto__ keys
    if (typeof parsed !== 'object' || parsed === null) return null
    if (Object.prototype.hasOwnProperty.call(parsed, '__proto__')) return null
    if (Object.prototype.hasOwnProperty.call(parsed, 'constructor')) return null
    return {
      text: typeof parsed.text === 'string' ? parsed.text : undefined,
      sources: Array.isArray(parsed.sources) ? parsed.sources : undefined,
      webSearchQueries: Array.isArray(parsed.webSearchQueries)
        ? parsed.webSearchQueries
        : undefined,
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Async generator that yields parsed chunks from a streaming response body.
 */
async function* readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamChunk> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const chunk = parseSSELine(line)
      if (chunk) yield chunk
      if (chunk?.done) return
    }
  }
}

// ============================================================
// STEP ANIMATION HELPERS
// ============================================================

type StepUpdater = (
  convId: string,
  assistantId: string,
  index: number,
  status: ResearchStep['status']
) => void

async function animateSteps(
  steps: Omit<ResearchStep, 'status'>[],
  delaysMs: readonly number[],
  convId: string,
  assistantId: string,
  updateStep: StepUpdater,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) return
    updateStep(convId, assistantId, i, 'active')
    const ms = delaysMs[i] ?? 1000
    await delay(ms)
    if (signal?.aborted) return
    updateStep(convId, assistantId, i, 'done')
  }
}

async function animateThinkingSteps(
  convId: string,
  assistantId: string,
  updateStep: StepUpdater,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < THINKING_STEPS_TEMPLATE.length; i++) {
    if (signal?.aborted) return
    updateStep(convId, assistantId, i, 'active')
    const ms = THINKING_STEP_DELAY_MS + Math.random() * THINKING_STEP_JITTER_MS
    await delay(ms)
    if (signal?.aborted) return
    updateStep(convId, assistantId, i, 'done')
  }
}

// ============================================================
// NETWORK STATUS HOOK
// ============================================================

function useNetworkStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}

// ============================================================
// VISIBILITY HOOK (pause animations when tab hidden)
// ============================================================

function usePageVisibility() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  return visible
}

// ============================================================
// CONVERSATION SYNC HOOK
// ============================================================

interface SyncState {
  syncing: boolean
  lastSyncedAt: number | null
  syncError: string | null
}

function useDatabaseSync(session: ReturnType<typeof useSession>['data']) {
  const [syncState, setSyncState] = useState<SyncState>({
    syncing: false,
    lastSyncedAt: null,
    syncError: null,
  })

  const loadFromDb = useCallback(async (): Promise<Conversation[] | null> => {
    if (!session) return null
    setSyncState(s => ({ ...s, syncing: true, syncError: null }))
    try {
      const res = await secureFetch('/api/conversations', {
        csrf: false, // GET requests don't need CSRF
        retries: 2,
      })
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Unexpected response shape')
      const sanitized: Conversation[] = data.map((conv: any) => ({
        ...conv,
        id: String(conv.id ?? '').slice(0, 64),
        title: String(conv.title ?? 'Chat').slice(0, 200),
        messages: Array.isArray(conv.messages) ? conv.messages : [],
        createdAt: Number(conv.createdAt) || Date.now(),
        updatedAt: Number(conv.updatedAt) || Date.now(),
      }))
      setSyncState({ syncing: false, lastSyncedAt: Date.now(), syncError: null })
      return sanitized
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error'
      setSyncState(s => ({ ...s, syncing: false, syncError: msg }))
      writeAudit('ERROR', { context: 'loadFromDb', error: msg })
      return null
    }
  }, [session])

  const saveToDb = useCallback(async (conv: Conversation): Promise<void> => {
    if (!session) return
    try {
      await secureFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conv }),
        retries: 1,
      })
      setSyncState(s => ({ ...s, lastSyncedAt: Date.now(), syncError: null }))
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error'
      setSyncState(s => ({ ...s, syncError: msg }))
      writeAudit('ERROR', { context: 'saveToDb', convId: conv.id, error: msg })
    }
  }, [session])

  const deleteFromDb = useCallback(async (id: string): Promise<void> => {
    if (!session) return
    try {
      await secureFetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        retries: 1,
      })
    } catch (err: any) {
      writeAudit('ERROR', { context: 'deleteFromDb', convId: id, error: err?.message })
    }
  }, [session])

  return { syncState, loadFromDb, saveToDb, deleteFromDb }
}

// ============================================================
// CONVERSATION UPDATER (CURRIED LENS)
// ============================================================

type ConvLens = (c: Conversation) => Conversation

function lensSetMessages(messages: Message[]): ConvLens {
  return c => ({ ...c, messages, updatedAt: Date.now() })
}

function lensUpdateMessage(
  msgId: string,
  updater: (m: Message) => Message
): ConvLens {
  return c => ({
    ...c,
    messages: c.messages.map(m => (m.id === msgId ? updater(m) : m)),
    updatedAt: Date.now(),
  })
}

function lensSetResearchStep(
  msgId: string,
  stepIndex: number,
  status: ResearchStep['status']
): ConvLens {
  return lensUpdateMessage(msgId, m => ({
    ...m,
    researchSteps: m.researchSteps?.map((s, i) => (i === stepIndex ? { ...s, status } : s)),
  }))
}

function lensSetThinkingStep(
  msgId: string,
  stepIndex: number,
  status: ResearchStep['status']
): ConvLens {
  return lensUpdateMessage(msgId, m => ({
    ...m,
    thinkingSteps: m.thinkingSteps?.map((s, i) => (i === stepIndex ? { ...s, status } : s)),
  }))
}

// ============================================================
// SEND-MESSAGE SECURITY VALIDATOR
// ============================================================

interface ValidationResult {
  ok: boolean
  reason?: string
  sanitized?: string
  sanitizedImage?: string
}

function validateSendPayload(
  text: string,
  imageUrl: string | undefined
): ValidationResult {
  // 1. Sanitise text
  const sanitized = sanitizeInput(text)
  if (!sanitized) {
    return { ok: false, reason: 'Message is empty or contains only invalid characters.' }
  }

  // 2. Length check
  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: `Message too long (max ${MAX_MESSAGE_LENGTH} characters).`,
    }
  }

  // 3. Repetition attack
  if (isRepetitionAttack(sanitized)) {
    writeAudit('REPETITION_BLOCK', { len: sanitized.length })
    return { ok: false, reason: 'Message contains repetitive patterns and was blocked.' }
  }

  // 4. Policy check
  const blocked = policyCheck(sanitized)
  if (blocked) {
    writeAudit('POLICY_BLOCK', { term: blocked })
    return { ok: false, reason: 'Message blocked by content policy.' }
  }

  // 5. Image URL validation
  const sanitizedImage = validateImageUrl(imageUrl)
  if (imageUrl && !sanitizedImage) {
    writeAudit('IMAGE_REJECTED', { url: imageUrl.slice(0, 100) })
    return { ok: false, reason: 'Image URL is not from an allowed source.' }
  }

  return { ok: true, sanitized, sanitizedImage }
}

// ============================================================
// KEYBOARD SHORTCUT HOOK
// ============================================================

interface ShortcutMap {
  [combo: string]: () => void
}

function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push('mod')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')
      if (shortcuts[combo]) {
        e.preventDefault()
        shortcuts[combo]()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

// ============================================================
// SEARCH / FILTER HOOK (for conversation sidebar search)
// ============================================================

function useConversationSearch(conversations: Conversation[]) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    )
  }, [conversations, query])
  return { query, setQuery, filtered }
}

// ============================================================
// CONVERSATION STATS HOOK
// ============================================================

interface ConvStats {
  totalConversations: number
  totalMessages: number
  avgMessagesPerConv: number
  oldestConvDate: Date | null
  newestConvDate: Date | null
}

function useConversationStats(conversations: Conversation[]): ConvStats {
  return useMemo(() => {
    if (!conversations.length) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgMessagesPerConv: 0,
        oldestConvDate: null,
        newestConvDate: null,
      }
    }
    const totalMessages = conversations.reduce(
      (acc, c) => acc + c.messages.length,
      0
    )
    const timestamps = conversations.map(c => c.createdAt)
    return {
      totalConversations: conversations.length,
      totalMessages,
      avgMessagesPerConv: +(totalMessages / conversations.length).toFixed(1),
      oldestConvDate: new Date(Math.min(...timestamps)),
      newestConvDate: new Date(Math.max(...timestamps)),
    }
  }, [conversations])
}

// ============================================================
// AUTO-SCROLL HOOK
// ============================================================

function useAutoScroll(dependency: unknown) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dependency])

  return bottomRef
}

// ============================================================
// NOTIFICATION PROVIDER COMPONENT
// ============================================================

function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, dispatch] = useReducer(notificationReducer, [])

  const notify = useCallback((n: Omit<Notification, 'id'>) => {
    dispatch({ type: 'ADD', payload: n })
    if (n.autoClose !== false) {
      const dur = n.duration ?? 4000
      setTimeout(() => dispatch({ type: 'REMOVE', id: '' }), dur)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id })
  }, [])

  // Auto-remove with correct id
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const n of notifications) {
      if (n.autoClose !== false) {
        const t = setTimeout(
          () => dispatch({ type: 'REMOVE', id: n.id }),
          n.duration ?? 4000
        )
        timers.push(t)
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [notifications])

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
      <NotificationToast notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  )
}

// ============================================================
// NOTIFICATION TOAST UI
// ============================================================

const TOAST_COLORS: Record<NotificationType, string> = {
  info: 'var(--accent)',
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#22c55e',
}

const TOAST_ICONS: Record<NotificationType, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚫',
  success: '✅',
}

const NotificationToast = memo(function NotificationToast({
  notifications,
  onDismiss,
}: {
  notifications: Notification[]
  onDismiss: (id: string) => void
}) {
  if (!notifications.length) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '24rem',
        width: '100%',
      }}
    >
      {notifications.map(n => (
        <div
          key={n.id}
          role="alert"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${TOAST_COLORS[n.type]}`,
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.2s ease',
          }}
        >
          <span aria-hidden="true">{TOAST_ICONS[n.type]}</span>
          <p
            style={{
              flex: 1,
              fontSize: '0.875rem',
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {n.message}
          </p>
          <button
            aria-label="Dismiss notification"
            onClick={() => onDismiss(n.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '1rem',
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
})

// ============================================================
// OFFLINE BANNER COMPONENT
// ============================================================

const OfflineBanner = memo(function OfflineBanner() {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: '#f59e0b',
        color: '#1a1a1a',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}
    >
      ⚠️ You are offline. Messages will be queued and sent when reconnected.
    </div>
  )
})

// ============================================================
// RATE LIMIT INDICATOR COMPONENT
// ============================================================

const RateLimitIndicator = memo(function RateLimitIndicator({
  remaining,
}: {
  remaining: number
}) {
  if (remaining > 5) return null
  const pct = (remaining / RATE_LIMIT_MAX_MESSAGES) * 100

  return (
    <div
      role="status"
      aria-label={`${remaining} messages remaining in rate limit window`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.75rem',
        color: remaining === 0 ? '#ef4444' : '#f59e0b',
        padding: '0.25rem 0.5rem',
      }}
    >
      <span>⚡</span>
      <span>{remaining} msg{remaining !== 1 ? 's' : ''} left</span>
      <div
        style={{
          width: '4rem',
          height: '4px',
          background: 'var(--surface)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: remaining === 0 ? '#ef4444' : '#f59e0b',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
})

// ============================================================
// SECURITY STATUS INDICATOR (DEV ONLY)
// ============================================================

const SecurityStatusIndicator = memo(function SecurityStatusIndicator({
  csrfToken,
}: {
  csrfToken: string
}) {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '0.5rem',
        left: '0.5rem',
        fontSize: '0.6rem',
        color: '#22c55e',
        background: 'rgba(0,0,0,0.7)',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        fontFamily: 'monospace',
        zIndex: 9998,
        userSelect: 'none',
      }}
    >
      🔒 CSRF: {csrfToken.slice(0, 8)}…
    </div>
  )
})

// ============================================================
// EMPTY STATE GUARD
// ============================================================

function guardConversation(conv: Conversation | undefined): Conversation | null {
  if (!conv) return null
  if (!Array.isArray(conv.messages)) return { ...conv, messages: [] }
  return conv
}

// ============================================================
// CONVERSATION FACTORY
// ============================================================

function createConversation(title: string): Conversation {
  return {
    id: generateId(),
    title: title.slice(0, 200) || 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ============================================================
// OFFLINE MESSAGE QUEUE
// ============================================================

interface QueuedMessage {
  id: string
  text: string
  deepResearch: boolean
  webSearch: boolean
  imageUrl?: string
  queuedAt: number
}

class OfflineMessageQueue {
  private queue: QueuedMessage[] = []

  enqueue(msg: Omit<QueuedMessage, 'id' | 'queuedAt'>): void {
    this.queue.push({
      ...msg,
      id: generateId(),
      queuedAt: Date.now(),
    })
  }

  dequeueAll(): QueuedMessage[] {
    const all = [...this.queue]
    this.queue = []
    return all
  }

  get size(): number {
    return this.queue.length
  }
}

const offlineQueue = new OfflineMessageQueue()

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function Home() {
  // ── State ────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [csrfToken] = useState(() => getOrCreateCsrfToken())
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showTeams, setShowTeams] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelType>('nexus-4')

  // Conversation state machine
  const [convState, convDispatch] = useReducer(convReducer, {
    status: 'idle',
    activeConvId: null,
    activeAssistantMsgId: null,
    rateLimitRemaining: RATE_LIMIT_MAX_MESSAGES,
  })

  // Abort controller ref
  const abortRef = useRef<AbortController | null>(null)

  // ── Session ──────────────────────────────────────────────
  const { data: session } = useSession()
  const userName = useMemo(
    () => session?.user?.name?.split(' ')[0],
    [session]
  )

  // ── Derived state ─────────────────────────────────────────
  const loading = convState.status !== 'idle' && convState.status !== 'error' && convState.status !== 'aborted'
  const activeConv = useMemo(
    () => guardConversation(conversations.find(c => c.id === activeId)),
    [conversations, activeId]
  )

  // ── Hooks ─────────────────────────────────────────────────
  const isOnline = useNetworkStatus()
  const isPageVisible = usePageVisibility()
  const bottomRef = useAutoScroll(activeConv?.messages)
  const { notify } = useNotifications()
  const { syncState, loadFromDb, saveToDb, deleteFromDb } = useDatabaseSync(session)
  const convSearch = useConversationSearch(conversations)
  const stats = useConversationStats(conversations)

  // ── Dev-mode CSP hint ─────────────────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Security] Recommended CSP:', DEV_CSP_HINT)
    }
    writeAudit('SESSION_START', { userId: session?.user?.email ?? 'anonymous' })
  }, [session])

  // ── Conversation loading ──────────────────────────────────
  useEffect(() => {
    async function init() {
      if (session) {
        const data = await loadFromDb()
        if (data) {
          startTransition(() => setConversations(clampConversations(data)))
        }
      } else {
        setConversations(secureLoadConversations())
      }
    }
    init()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to localStorage (non-authenticated) ───────────
  useEffect(() => {
    if (!session) {
      secureSaveConversations(conversations)
    }
  }, [conversations, session])

  // ── Flush offline queue when reconnected ──────────────────
  useEffect(() => {
    if (isOnline && offlineQueue.size > 0) {
      notify({
        type: 'info',
        message: `Sending ${offlineQueue.size} queued message(s)…`,
      })
      // Flushing is handled by sendMessage on reconnect
    }
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation updater ──────────────────────────────────
  const updateConv = useCallback(
    (id: string, lens: ConvLens) => {
      setConversations(prev => prev.map(c => (c.id === id ? lens(c) : c)))
    },
    []
  )

  // ── Research / thinking step updater ─────────────────────
  const updateResearchStep: StepUpdater = useCallback(
    (convId, assistantId, index, status) => {
      updateConv(convId, lensSetResearchStep(assistantId, index, status))
    },
    [updateConv]
  )

  const updateThinkingStep: StepUpdater = useCallback(
    (convId, assistantId, index, status) => {
      updateConv(convId, lensSetThinkingStep(assistantId, index, status))
    },
    [updateConv]
  )

  // ── New chat ──────────────────────────────────────────────
  const newChat = useCallback(() => {
    const conv = createConversation('New Chat')
    writeAudit('CONVERSATION_CREATE', { id: conv.id })
    setConversations(prev => clampConversations([conv, ...prev]))
    setActiveId(conv.id)
  }, [])

  // ── Delete conversation ───────────────────────────────────
  const deleteConv = useCallback(
    async (id: string) => {
      writeAudit('CONVERSATION_DELETE', { id })
      setConversations(prev => prev.filter(c => c.id !== id))
      setActiveId(prev => (prev === id ? null : prev))
      await deleteFromDb(id)
    },
    [deleteFromDb]
  )

  // ── Manual refresh ────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    if (!session) return
    const data = await loadFromDb()
    if (data) {
      startTransition(() => setConversations(clampConversations(data)))
      notify({ type: 'success', message: 'Conversations refreshed.' })
    } else {
      notify({ type: 'error', message: syncState.syncError ?? 'Refresh failed.' })
    }
  }, [session, loadFromDb, notify, syncState.syncError])

  // ── Keyboard shortcuts ────────────────────────────────────
  useKeyboardShortcuts(
    useMemo(
      () => ({
        'mod+shift+o': newChat,
        'mod+shift+d': () => {
          if (activeId) deleteConv(activeId)
        },
      }),
      [newChat, deleteConv, activeId]
    )
  )

  // ── MAIN SEND MESSAGE ─────────────────────────────────────
  const sendMessage = useCallback(
    async (
      rawText: string,
      deepResearch: boolean,
      imageUrl?: string,
      webSearch?: boolean
    ) => {
      // Guard: already loading
      if (loading) return

      // Guard: offline
      if (!isOnline) {
        offlineQueue.enqueue({
          text: rawText,
          deepResearch,
          webSearch: webSearch ?? false,
          imageUrl,
        })
        notify({
          type: 'warning',
          message: 'You are offline. Message queued.',
        })
        return
      }

      // ── Security validation ──────────────────────────────
      const validation = validateSendPayload(rawText, imageUrl)
      if (!validation.ok) {
        notify({ type: 'error', message: validation.reason ?? 'Invalid input.' })
        return
      }

      const text = validation.sanitized!
      const safeImage = validation.sanitizedImage

      // Check if this is an image generation request
      const imageGenKeywords = /\b(generate|create|make|draw|paint|illustrate)\b.*\b(image|picture|photo|art|illustration)\b/i
      const imageGenCommand = text.startsWith('/image') || text.startsWith('/img') || text.startsWith('/generate')
      
      const isImageRequest = imageGenKeywords.test(text) || imageGenCommand
      
      if (isImageRequest) {
        const cleanPrompt = text
          .replace(/^(generate|create|make|draw|paint|illustrate)\s*(me\s*)?(an?\s*)?(image|picture|photo|art|illustration)?\s*(of|with|showing)?\s*/i, '')
          .replace(/^\/\w+\s*/i, '')
          .trim()
        
        if (cleanPrompt && cleanPrompt.length > 2) {
          // Handle image generation inline - just like ChatGPT/Gemini
          await handleImageGenerationInline(cleanPrompt, text)
          return
        }
      }

      // ── Rate limiting ─────────────────────────────────────
      const rl = rateLimiter.check()
      if (!rl.allowed) {
        writeAudit('RATE_LIMIT_BLOCK', { reason: rl.reason })
        notify({ type: 'warning', message: rl.reason ?? 'Rate limit reached.' })
        return
      }

      // Update remaining counter
      convDispatch({
        type: 'RATE_LIMIT_UPDATE',
        remaining: rateLimiter.remaining(),
      })

      writeAudit('SEND_MESSAGE', {
        len: text.length,
        deepResearch,
        webSearch,
        hasImage: !!safeImage,
      })

      // -- Memory check (client-side for instant feedback) --
      const detectedMemories = extractMemoriesFromText(text)
      if (detectedMemories.length > 0) {
        const memoryDetails = detectedMemories.map(m => `${m.key}: ${m.value}`).join(', ')
        notify({
          type: 'info',
          message: `Memory updated: ${memoryDetails}`,
          duration: 5000
        })
      }

      // ── Resolve or create conversation ───────────────────
      let convId = activeId
      let currentConv: Conversation

      if (!convId) {
        currentConv = createConversation(text.slice(0, 45))
        setConversations(prev => clampConversations([currentConv, ...prev]))
        setActiveId(currentConv.id)
        convId = currentConv.id
      } else {
        const found = conversations.find(c => c.id === convId)
        if (!found) {
          currentConv = createConversation(text.slice(0, 45))
          currentConv = { ...currentConv, id: convId }
          setConversations(prev => clampConversations([currentConv, ...prev]))
        } else {
          currentConv = Array.isArray(found.messages)
            ? found
            : { ...found, messages: [] }
        }
      }

      // ── Build messages ─────────────────────────────────────
      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: text,
        status: 'done',
        timestamp: Date.now(),
        imageUrl: safeImage,
      }

      const shouldThink = !deepResearch && !webSearch && isComplexQuery(text)
      const isVeryHard = shouldThink && isExtremelyHardQuery(text)
      const thinkDelay = isVeryHard
        ? 5000 + Math.random() * 2000
        : shouldThink
        ? 2000 + Math.random() * 1000
        : 600

      const initialStatus: ConvStatus = webSearch
        ? 'searching'
        : deepResearch || shouldThink
        ? deepResearch
          ? 'researching'
          : 'thinking'
        : 'streaming'

      const assistantId = generateId()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        status: initialStatus,
        thinkingStart: shouldThink || deepResearch || webSearch ? Date.now() : undefined,
        thinkingTime: 0,
        researchSteps: deepResearch
          ? makeResearchSteps()
          : webSearch
          ? makeWebSearchSteps()
          : undefined,
        thinkingSteps: isVeryHard ? makeThinkingSteps() : undefined,
        isDeepResearch: deepResearch,
        isWebSearch: webSearch ?? false,
        timestamp: Date.now(),
      }

      const updatedMessages = clampMessages([
        ...currentConv.messages,
        userMsg,
        assistantMsg,
      ])

      const updatedConv: Conversation = {
        ...currentConv,
        messages: updatedMessages,
        title: getConversationTitle(updatedMessages),
        updatedAt: Date.now(),
      }

      updateConv(convId, () => updatedConv)
      convDispatch({ type: 'SEND_START', convId, assistantId, mode: initialStatus })

      // ── Abort controller ──────────────────────────────────
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        // ── Thinking animation ─────────────────────────────
        if (isVeryHard && !deepResearch) {
          await animateThinkingSteps(
            convId,
            assistantId,
            updateThinkingStep,
            ctrl.signal
          )
        } else if (shouldThink && !deepResearch) {
          await delay(thinkDelay)
        }

        if (ctrl.signal.aborted) {
          convDispatch({ type: 'ABORT' })
          return
        }

        // ── Research animation ─────────────────────────────
        if (deepResearch) {
          await animateSteps(
            RESEARCH_STEPS,
            RESEARCH_STEP_DELAYS_MS,
            convId,
            assistantId,
            updateResearchStep,
            ctrl.signal
          )
          // Mark all done
          updateConv(
            convId,
            lensUpdateMessage(assistantId, m => ({
              ...m,
              researchSteps: m.researchSteps?.map(s => ({ ...s, status: 'done' as const })),
            }))
          )
          await delay(1000)
        }

        // ── Web search animation ───────────────────────────
        if (webSearch) {
          await animateSteps(
            WEB_SEARCH_STEPS,
            WEB_SEARCH_STEP_DELAYS_MS,
            convId,
            assistantId,
            updateResearchStep,
            ctrl.signal
          )
          updateConv(
            convId,
            lensUpdateMessage(assistantId, m => ({
              ...m,
              researchSteps: m.researchSteps?.map(s => ({ ...s, status: 'done' as const })),
            }))
          )
          await delay(500)
        }

        if (ctrl.signal.aborted) {
          convDispatch({ type: 'ABORT' })
          return
        }

        // ── Transition to streaming state ──────────────────
        const thinkingEnd = Date.now()
        updateConv(
          convId,
          lensUpdateMessage(assistantId, m => ({
            ...m,
            status: 'streaming' as const,
            content: '',
            thinkingTime: m.thinkingStart ? thinkingEnd - m.thinkingStart : 0,
          }))
        )
        convDispatch({ type: 'STREAMING_START', assistantId })

        // ── Fetch API (via secure wrapper) ─────────────────
        const apiHistory = buildApiHistory(
          // Use the latest stored messages for history
          conversations.find(c => c.id === convId)?.messages ?? updatedMessages,
          text
        )

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [CSRF_HEADER_NAME]: csrfToken,
          },
          body: JSON.stringify({
            messages: apiHistory,
            mode: deepResearch
              ? 'deep_research'
              : webSearch
              ? 'web_search'
              : 'normal',
            userName,
            userEmail: session?.user?.email,
            imageUrl: safeImage,
            model: selectedModel,
          }),
          signal: ctrl.signal,
        })

        if (!res.ok) {
          throw new SecureFetchError(res.status, await res.text().catch(() => ''))
        }

        // ── Stream reading ─────────────────────────────────
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        let fullContent = ''
        let sources: SearchSource[] = []
        let queries: string[] = []

        for await (const chunk of readStream(reader)) {
          if (ctrl.signal.aborted) break
          if (chunk.done) break
          if (chunk.error) {
            fullContent = `❌ **Error:** ${chunk.error}`
            updateConv(
              convId!,
              lensUpdateMessage(assistantId, m => ({
                ...m,
                content: fullContent,
                status: 'error',
              }))
            )
            notify({ type: 'error', message: chunk.error })
            break
          }
          if (chunk.text) {
            fullContent += chunk.text
            updateConv(
              convId!,
              lensUpdateMessage(assistantId, m => ({
                ...m,
                content: fullContent,
              }))
            )
          }
          if (chunk.sources) sources = chunk.sources
          if (chunk.webSearchQueries) queries = chunk.webSearchQueries
        }

        // ── Finalise conversation ──────────────────────────
        const finalConv: Conversation = {
          ...updatedConv,
          messages: updatedConv.messages.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  content: fullContent,
                  status: 'done' as const,
                  searchSources: sources.length > 0 ? sources : undefined,
                  webSearchQueries: queries.length > 0 ? queries : undefined,
                }
              : m
          ),
          updatedAt: Date.now(),
        }

        updateConv(convId!, () => finalConv)
        convDispatch({ type: 'SEND_DONE' })

        // Persist
        await saveToDb(finalConv)
      } catch (err: any) {
        if (
          err?.name === 'AbortError' ||
          ctrl.signal.aborted
        ) {
          convDispatch({ type: 'ABORT' })
          updateConv(
            convId!,
            lensUpdateMessage(assistantId, m => ({
              ...m,
              status: 'done' as const,
              content: m.content || '_(Generation stopped)_',
            }))
          )
          return
        }

        writeAudit('ERROR', { message: err?.message, context: 'sendMessage' })
        convDispatch({ type: 'SEND_ERROR' })

        const errorMessage =
          err instanceof SecureFetchError
            ? err.status === 429
              ? 'Server rate limit reached. Please wait before sending another message.'
              : err.status === 401
              ? 'Session expired. Please sign in again.'
              : err.status >= 500
              ? 'Server error. Please try again shortly.'
              : 'An error occurred.'
            : err?.message ?? 'Something went wrong.'

        notify({ type: 'error', message: errorMessage })

        updateConv(
          convId!,
          lensUpdateMessage(assistantId, m => ({
            ...m,
            status: 'error' as const,
            content: errorMessage,
          }))
        )
      } finally {
        // Reset rate-limit display counter
        convDispatch({
          type: 'RATE_LIMIT_UPDATE',
          remaining: rateLimiter.remaining(),
        })
      }
    },
    [
      loading,
      isOnline,
      activeId,
      conversations,
      updateConv,
      updateResearchStep,
      updateThinkingStep,
      session,
      userName,
      saveToDb,
      notify,
      csrfToken,
    ]
  )

  // ── Stop generation ───────────────────────────────────────
  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      writeAudit('STOP_GENERATION')
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // ── Inline Image Generation (like ChatGPT/Gemini) ─────────
  const handleImageGenerationInline = useCallback(async (prompt: string, originalText: string) => {
    // 1. Setup IDs and resolve Target Conversation ID
    const assistantId = generateId()
    const userMsgId = generateId()
    let targetConvId = activeId

    console.log('🎨 [IMAGE-START] Prompt:', prompt)

    // 2. Initial state update: Add User & Loading Assistant Message
    // Use functional update to avoid stale closures
    setConversations(prev => {
      let currentConv = prev.find(c => c.id === targetConvId)
      
      if (!currentConv) {
        // Create new conversation if none active
        currentConv = createConversation(prompt.slice(0, 45))
        targetConvId = currentConv.id
        setActiveId(targetConvId)
      }

      const userMsg: Message = {
        id: userMsgId,
        role: 'user',
        content: originalText,
        status: 'done',
        timestamp: Date.now(),
      }

      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        status: 'thinking',
        thinkingStart: Date.now(),
        thinkingTime: 0,
        isDeepResearch: false,
        isWebSearch: false,
        timestamp: Date.now(),
        imageUrl: '', // Trigger shimmer loading in MessageBubble
      }

      const updatedMessages = clampMessages([
        ...currentConv.messages,
        userMsg,
        assistantMsg,
      ])

      const updatedConv = {
        ...currentConv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      }

      // If existing interaction, update it. If new, prepend it.
      const exists = prev.some(c => c.id === targetConvId)
      return exists 
        ? prev.map(c => c.id === targetConvId ? updatedConv : c)
        : [updatedConv, ...prev]
    })

    // Simulate thinking delay for UX
    await delay(1500)

    try {
      // 3. Import and trigger image generation
      const { generateImage } = await import('@/lib/imageGeneration')
      
      // Update assistant status to 'streaming' with prompt text
      setConversations(prev => prev.map(c => c.id === targetConvId ? {
        ...c,
        messages: c.messages.map(m => m.id === assistantId ? { 
          ...m, 
          status: 'streaming' as const,
          content: ' Creating your image...',
        } : m)
      } : c))

      const result = await generateImage({
        prompt: prompt,
        style: 'photorealistic',
        quality: 'hd',
        size: '1024x1024',
      })

      if (result.ok && result.image) {
        console.log('✅ [IMAGE-SUCCESS] URL:', result.image.url)
        console.log('🖼️ [IMAGE-SUCCESS] URL type:', typeof result.image.url)
        console.log('🖼️ [IMAGE-SUCCESS] Starts with data:?', result.image.url.startsWith('data:'))
        console.log('🖼️ [IMAGE-SUCCESS] URL length:', result.image.url.length)
        
        const finalImageUrl = result.image.url
        
        // 4. Update state with final image and result
        setConversations(prev => {
          const newState = prev.map(c => {
            if (c.id !== targetConvId) return c
            
            const newMessages = c.messages.map(m => {
              if (m.id !== assistantId) return m
              
              // Merge with previous message object to preserve metadata
              const finalMsg: Message = {
                ...m,
                content: '',
                status: 'done',
                timestamp: Date.now(),
                imageUrl: finalImageUrl, // Setting the URL here
                thinkingTime: Date.now() - (m.thinkingStart || Date.now()),
              }
              
              console.log('🖼️ [STATE-UPDATE] imageUrl set for ID:', m.id)
              console.log('🖼️ [STATE-UPDATE] imageUrl type:', typeof finalMsg.imageUrl)
              console.log('🖼️ [STATE-UPDATE] imageUrl starts with:', finalMsg.imageUrl?.substring(0, 30))
              return finalMsg
            })
            
            return {
              ...c,
              messages: newMessages,
              title: getConversationTitle(newMessages),
              updatedAt: Date.now(),
            }
          })

          // 5. Database Synchronization using the NEW state
          if (session) {
            const freshConv = newState.find(c => c.id === targetConvId)
            if (freshConv) {
              saveToDb(freshConv).catch(err => console.error('DB Sync Error:', err))
            }
          }
          
          return newState
        })
      } else {
        throw new Error(result.ok === false ? result.error.message : 'Generation failed')
      }
    } catch (err: any) {
      console.error('❌ [IMAGE-ERROR]', err)
      const errorMsg = err.message || 'Image generation failed.'
      
      setConversations(prev => prev.map(c => c.id === targetConvId ? {
        ...c,
        messages: c.messages.map(m => m.id === assistantId ? {
          ...m,
          status: 'done' as const,
          content: `❌ **Error Generating Image**\n\n${errorMsg}\n\nPlease try a different prompt or check your connection.`,
        } : m),
        updatedAt: Date.now(),
      } : c))
    }
  }, [activeId, session, saveToDb])

  // ── Follow-up handler (wrapper to avoid re-renders) ───────
  const handleFollowUp = useCallback(
    (t: string) => sendMessage(t, false),
    [sendMessage]
  )

  // ── Suggestion handler ────────────────────────────────────
  const handleSuggestion = useCallback(
    (t: string) => sendMessage(t, false),
    [sendMessage]
  )

  // ── Render ────────────────────────────────────────────────
  return (
    <ThemeProvider>
      <NotificationProvider>
        <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
          {/* Offline banner */}
          {!isOnline && <OfflineBanner />}

          {/* Sidebar */}
          <Sidebar
            conversations={convSearch.filtered}
            activeId={activeId}
            onSelect={setActiveId}
            onNew={newChat}
            onDelete={deleteConv}
            syncing={syncState.syncing}
            onRefresh={refreshConversations}
          />

          {/* Main content */}
          <main className="flex flex-col flex-1 min-w-0 h-full">
            <Header 
              onNew={newChat}
              onAnalytics={() => setShowAnalytics(true)}
              onTeams={() => setShowTeams(true)}
              currentModel={selectedModel}
              onModelChange={setSelectedModel}
            />

            {/* Message list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {!activeConv || activeConv.messages.length === 0 ? (
                <WelcomeScreen onSuggestion={handleSuggestion} />
              ) : (
                <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 pt-16 sm:pt-6">
                  {activeConv.messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onFollowUp={handleFollowUp}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Chat input area */}
            <div className="shrink-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/95 to-transparent pt-6 sm:pt-10">
              {/* Rate limit indicator */}
              <div className="max-w-2xl mx-auto px-4 flex justify-end">
                <RateLimitIndicator remaining={convState.rateLimitRemaining} />
              </div>

              <div className="max-w-2xl mx-auto w-full px-3 sm:px-6 mb-2 sm:mb-4 pb-safe">
                <ChatInput
                  onSend={sendMessage}
                  onStop={stopGeneration}
                  disabled={loading || !isOnline}
                  isGenerating={loading}
                />
              </div>

              <p className="text-center text-[10px] text-[var(--text-muted)]/60 mb-4 px-4 font-medium max-w-2xl mx-auto hidden sm:block">
                Astra AI can produce inaccurate info about people, places, or
                facts. Verify important information.
              </p>
            </div>
          </main>

          {/* Dev-only security badge */}
          <SecurityStatusIndicator csrfToken={csrfToken} />
          
          {/* Conversation Analytics Modal */}
          {showAnalytics && (
            <ConversationAnalytics
              conversations={conversations}
              currentMessages={activeConv?.messages || []}
              onClose={() => setShowAnalytics(false)}
            />
          )}

          {/* Team Panel */}
          {session?.user && (
            <TeamPanel
              userId={session.user.email || session.user.id || ''}
              userEmail={session.user.email || ''}
              isOpen={showTeams}
              onClose={() => setShowTeams(false)}
              onSelectTeam={(team) => {
                console.log('Selected team:', team)
                setShowTeams(false)
              }}
            />
          )}
        </div>
      </NotificationProvider>
    </ThemeProvider>
  )
}

// ============================================================
// CONTENT INTEGRITY VALIDATOR
// ============================================================

/**
 * Validates that an AI response has acceptable content before
 * it is persisted. Flags suspiciously short or malformed replies.
 */
function validateAssistantResponse(content: string): {
  valid: boolean
  reason?: string
} {
  if (!content || typeof content !== 'string') {
    return { valid: false, reason: 'Empty response' }
  }
  if (content.length < 2) {
    return { valid: false, reason: 'Response too short' }
  }
  // Detect if the model echoed a system prompt fragment
  if (content.includes('You are a helpful assistant named') && content.length < 200) {
    return { valid: false, reason: 'Possible system prompt leak' }
  }
  return { valid: true }
}

// ============================================================
// CONVERSATION EXPORT UTILITIES
// ============================================================

/**
 * Exports a single conversation as a plain-text transcript.
 * Useful for users who want to save their chat history.
 */
function exportConversationAsText(conv: Conversation): string {
  const lines: string[] = [
    `# ${conv.title}`,
    `Created: ${new Date(conv.createdAt).toLocaleString()}`,
    `Updated: ${new Date(conv.updatedAt).toLocaleString()}`,
    '',
    '---',
    '',
  ]
  for (const msg of conv.messages) {
    const role = msg.role === 'user' ? '👤 You' : '🤖 Astra'
    const time = new Date(msg.timestamp ?? 0).toLocaleTimeString()
    lines.push(`**${role}** (${time})`)
    lines.push(msg.content)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Exports a conversation as JSON.
 * Strips internal status fields that are UI-only.
 */
function exportConversationAsJson(conv: Conversation): string {
  const clean = {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: conv.messages
      .filter(m => m.status === 'done')
      .map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
  }
  return JSON.stringify(clean, null, 2)
}

/**
 * Triggers a browser download of the given text content.
 */
function downloadTextFile(filename: string, content: string, mimeType = 'text/plain'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// LOCAL STORAGE INTEGRITY CHECK
// ============================================================

/**
 * Verifies that the browser's localStorage quota is not almost
 * full. Returns an estimate of remaining space in bytes.
 *
 * Browsers typically allow 5–10 MB per origin.
 */
function estimateLocalStorageRemaining(): number {
  if (typeof localStorage === 'undefined') return 0
  try {
    let total = 0
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key)?.length ?? 0) * 2 // UTF-16 = 2 bytes/char
    }
    const limit = 5_000_000 // conservative 5 MB
    return Math.max(0, limit - total)
  } catch {
    return 0
  }
}

// ============================================================
// SESSION EXPIRY TRACKER
// ============================================================

/**
 * Returns the number of milliseconds until the NextAuth session expires,
 * or Infinity if the session has no expiry.
 */
function getSessionMsUntilExpiry(session: ReturnType<typeof useSession>['data']): number {
  if (!session?.expires) return Infinity
  const exp = new Date(session.expires).getTime()
  return Math.max(0, exp - Date.now())
}

// ============================================================
// SESSION EXPIRY HOOK
// ============================================================

/**
 * Monitors the session expiry and calls onExpiringSoon when
 * less than `warnMs` milliseconds remain.
 */
function useSessionExpiryWarning(
  session: ReturnType<typeof useSession>['data'],
  onExpiringSoon: () => void,
  warnMs = 5 * 60 * 1000 // 5 minutes
) {
  useEffect(() => {
    if (!session?.expires) return
    const remaining = getSessionMsUntilExpiry(session)
    if (remaining <= 0) {
      onExpiringSoon()
      return
    }
    const triggerAt = remaining - warnMs
    if (triggerAt <= 0) {
      onExpiringSoon()
      return
    }
    const t = setTimeout(onExpiringSoon, triggerAt)
    return () => clearTimeout(t)
  }, [session, onExpiringSoon, warnMs])
}

// ============================================================
// INPUT ENTROPY ESTIMATOR
// ============================================================

/**
 * Rough Shannon entropy estimator for a string.
 * Very low entropy (< 1.5 bits/char) may indicate automated or
 * repetitive input.
 */
function shannonEntropy(s: string): number {
  if (!s) return 0
  const freq: Record<string, number> = {}
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1
  const len = s.length
  return -Object.values(freq).reduce((acc, count) => {
    const p = count / len
    return acc + p * Math.log2(p)
  }, 0)
}

/**
 * Returns true if the input looks like it could be a bot or
 * low-quality automated message (very low entropy).
 */
function isLowEntropyInput(text: string): boolean {
  return text.length > 20 && shannonEntropy(text) < 1.5
}

// ============================================================
// TRUSTED ORIGINS VALIDATION
// ============================================================

/**
 * Validates that the current page origin matches the expected
 * application origin. Helps detect if the app is being
 * embedded in a malicious iframe.
 */
function validateOrigin(expectedOrigin?: string): boolean {
  if (typeof window === 'undefined') return true
  if (!expectedOrigin) return true
  return String(window.location.origin) === expectedOrigin
}

// ============================================================
// FRAME BUSTING (CLICKJACKING MITIGATION)
// ============================================================

/**
 * Breaks out of iframes in production builds.
 * This is a client-side complement to the X-Frame-Options header.
 */
function preventFrameEmbedding(): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV === 'production' && window.self !== window.top) {
    try {
      window.top!.location.href = window.self.location.href
    } catch {
      // Cross-origin top frame – can't redirect, just hide content
      document.documentElement.style.display = 'none'
    }
  }
}

// Run immediately on module load in browser context
if (typeof window !== 'undefined') {
  preventFrameEmbedding()
}

// ============================================================
// SECURE JSON PARSER
// ============================================================

/**
 * Parses JSON from untrusted sources with prototype-pollution protection.
 * Returns null on failure.
 */
function secureJsonParse<T = unknown>(raw: string): T | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return parsed as T
    // Guard against __proto__ pollution
    const str = JSON.stringify(parsed)
    if (str.includes('__proto__') || str.includes('constructor')) return null
    return parsed as T
  } catch {
    return null
  }
}

// ============================================================
// CONVERSATION MERGE UTILITY
// ============================================================

/**
 * Merges two arrays of conversations, preferring the newer
 * updatedAt for conflicts (same id). Used when reconciling
 * local and remote state after a re-connection.
 */
function mergeConversations(
  local: Conversation[],
  remote: Conversation[]
): Conversation[] {
  const map = new Map<string, Conversation>()
  for (const c of local) map.set(c.id, c)
  for (const c of remote) {
    const existing = map.get(c.id)
    if (!existing || c.updatedAt > existing.updatedAt) {
      map.set(c.id, c)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

// ============================================================
// TYPING INDICATOR HOOK
// ============================================================

/**
 * Tracks whether the AI is currently "typing" (streaming).
 * Useful for accessibility announcements.
 */
function useTypingIndicator(convStatus: ConvStatus): boolean {
  return convStatus === 'streaming'
}

// ============================================================
// CONVERSATION TITLE GENERATOR (ENHANCED)
// ============================================================

/**
 * Generates a meaningful conversation title from the first
 * user message, with smart truncation and capitalisation.
 */
function generateSmartTitle(text: string, maxLen = 45): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(can you|could you|please|help me|i need|i want)\s+/i, '')
  const truncated = cleaned.length > maxLen
    ? cleaned.slice(0, maxLen - 1) + '…'
    : cleaned
  return truncated.charAt(0).toUpperCase() + truncated.slice(1)
}

// ============================================================
// DEBOUNCE HOOK
// ============================================================

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debounced
}

// ============================================================
// PREVIOUS VALUE HOOK
// ============================================================

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value })
  return ref.current
}

// ============================================================
// STABLE CALLBACK REGISTRY
// ============================================================

/**
 * Wraps a callback in a stable ref so it can be used inside
 * effects without triggering re-runs. Useful for event handlers
 * that close over frequently-changing state.
 */
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn)
  useEffect(() => { ref.current = fn })
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T
}

// ============================================================
// FOCUS MANAGEMENT
// ============================================================

/**
 * Returns a ref that, when attached to an element, will
 * programmatically focus it whenever `trigger` changes to true.
 */
function useFocusOnTrigger(trigger: boolean) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (trigger && ref.current) {
      ref.current.focus()
    }
  }, [trigger])
  return ref
}

// ============================================================
// CONVERSATION SEARCH HIGHLIGHT
// ============================================================

/**
 * Wraps substrings matching the query in <mark> tags for
 * display in a search-results list.
 *
 * NOTE: The output is plain text, not JSX. It must be rendered
 * with dangerouslySetInnerHTML after the caller has verified
 * that `html` originated from this controlled function.
 */
function highlightSearchMatch(text: string, query: string): string {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark>$1</mark>'
  )
}

// ============================================================
// MESSAGE GROUPING UTILITY
// ============================================================

interface MessageGroup {
  role: Message['role']
  messages: Message[]
  firstTimestamp: number
}

/**
 * Groups consecutive messages by the same role into a single
 * group. Useful for rendering compact conversation threads.
 */
function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const msg of messages) {
    const last = groups[groups.length - 1]
    if (last && last.role === msg.role) {
      last.messages.push(msg)
    } else {
      groups.push({
        role: msg.role,
        messages: [msg],
        firstTimestamp: msg.timestamp ?? 0,
      })
    }
  }
  return groups
}

// ============================================================
// PERFORMANCE BUDGET MONITOR (DEV ONLY)
// ============================================================

/**
 * Logs a warning if a measured operation exceeds the given
 * budget in milliseconds. Helps catch accidental slow renders.
 */
function measurePerf(label: string, fn: () => void, budgetMs = 16): void {
  if (process.env.NODE_ENV !== 'development') {
    fn()
    return
  }
  const start = performance.now()
  fn()
  const elapsed = performance.now() - start
  if (elapsed > budgetMs) {
    console.warn(`[Perf] "${label}" took ${elapsed.toFixed(1)}ms (budget: ${budgetMs}ms)`)
  }
}

// ============================================================
// CONTEXT-WINDOW USAGE ESTIMATOR
// ============================================================

/**
 * Estimates the number of tokens consumed by the current
 * conversation history sent to the API.
 *
 * Uses the rough heuristic of 1 token ≈ 4 characters.
 */
function estimateTokenUsage(messages: ApiMessage[]): number {
  const charCount = messages.reduce((acc, m) => acc + m.content.length, 0)
  return Math.ceil(charCount / 4)
}

/**
 * Returns a warning level based on estimated token usage
 * relative to the model's typical context window.
 */
function tokenUsageWarningLevel(
  tokens: number,
  contextWindow = 200_000
): 'ok' | 'warn' | 'critical' {
  const ratio = tokens / contextWindow
  if (ratio > 0.85) return 'critical'
  if (ratio > 0.6) return 'warn'
  return 'ok'
}

// ============================================================
// CLIPBOARD UTILITY
// ============================================================

/**
 * Copies text to the clipboard with a secure fallback for
 * environments where the Clipboard API is unavailable.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Legacy fallback
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// ============================================================
// CONVERSATION TITLE EDIT HOOK
// ============================================================

function useConversationTitleEdit(
  conv: Conversation | null,
  onRename: (id: string, title: string) => void
) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = useCallback(() => {
    if (!conv) return
    setDraft(conv.title)
    setEditing(true)
  }, [conv])

  const commitEdit = useCallback(() => {
    if (!conv) return
    const trimmed = draft.trim().slice(0, 200)
    if (trimmed && trimmed !== conv.title) {
      onRename(conv.id, trimmed)
    }
    setEditing(false)
  }, [conv, draft, onRename])

  const cancelEdit = useCallback(() => setEditing(false), [])

  return { editing, draft, setDraft, startEdit, commitEdit, cancelEdit }
}

// ============================================================
// IDLE TIMEOUT HOOK
// ============================================================

/**
 * Detects user inactivity and calls onIdle after the given
 * timeout. Resets on any mouse/keyboard/touch event.
 *
 * Security use-case: auto-lock or warn if the user walks away
 * from an authenticated session.
 */
function useIdleTimeout(timeoutMs: number, onIdle: () => void) {
  const stableOnIdle = useStableCallback(onIdle)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(stableOnIdle, timeoutMs)
  }, [timeoutMs, stableOnIdle])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }))
    reset() // Start the timer immediately
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(ev => window.removeEventListener(ev, reset))
    }
  }, [reset])
}

// ============================================================
// SECURE MEMO HOOK
// ============================================================

/**
 * Like useMemo but warns in development if the factory
 * function throws, instead of propagating the error silently.
 */
function useSecureMemo<T>(factory: () => T, deps: React.DependencyList, fallback: T): T {
  return useMemo(() => {
    try {
      return factory()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useSecureMemo] Factory threw:', err)
      }
      return fallback
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

// ============================================================
// FEATURE FLAGS
// ============================================================

/**
 * Simple feature-flag system backed by environment variables.
 * Flags are read once at module-load time and never mutated.
 */
const FEATURE_FLAGS = Object.freeze({
  DEEP_RESEARCH: process.env.NEXT_PUBLIC_FF_DEEP_RESEARCH !== 'false',
  WEB_SEARCH: process.env.NEXT_PUBLIC_FF_WEB_SEARCH !== 'false',
  EXPORT_CONVERSATIONS: process.env.NEXT_PUBLIC_FF_EXPORT !== 'false',
  AUDIT_LOG_EXPORT: process.env.NEXT_PUBLIC_FF_AUDIT_EXPORT === 'true',
  IDLE_TIMEOUT: process.env.NEXT_PUBLIC_FF_IDLE_TIMEOUT === 'true',
  SESSION_EXPIRY_WARN: process.env.NEXT_PUBLIC_FF_SESSION_WARN !== 'false',
})

function useFeatureFlag(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}

// ============================================================
// REQUEST DEDUPLICATION
// ============================================================

/**
 * Simple in-flight request tracker that prevents sending the
 * same API call twice (e.g. double-click on Send).
 *
 * Keyed by a hash of the request body string.
 */
const inflightRequests = new Set<string>()

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return h.toString(36)
}

function isRequestInFlight(body: string): boolean {
  return inflightRequests.has(hashString(body))
}

function markRequestInFlight(body: string): () => void {
  const key = hashString(body)
  inflightRequests.add(key)
  return () => inflightRequests.delete(key)
}

// ============================================================
// CONVERSATION BACKUP TO INDEXEDDB
// ============================================================

const IDB_DB_NAME = 'astra_backup'
const IDB_STORE_NAME = 'conversations'
const IDB_DB_VERSION = 1

/**
 * Opens (or creates) the IndexedDB backup database.
 */
function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Backs up a single conversation to IndexedDB.
 * Silently swallows errors to avoid disrupting the main flow.
 */
async function backupConversationToIDB(conv: Conversation): Promise<void> {
  try {
    const db = await openBackupDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
      const store = tx.objectStore(IDB_STORE_NAME)
      store.put(conv)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Non-critical – backup failures are silent
  }
}

/**
 * Retrieves all backed-up conversations from IndexedDB.
 * Returns an empty array on failure.
 */
async function restoreConversationsFromIDB(): Promise<Conversation[]> {
  try {
    const db = await openBackupDb()
    const result = await new Promise<Conversation[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly')
      const req = tx.objectStore(IDB_STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result as Conversation[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result
  } catch {
    return []
  }
}

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

/**
 * Installs a global unhandled-promise-rejection listener that
 * writes to the audit log. Call once at app startup.
 */
function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined') return () => undefined

  const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
    writeAudit('ERROR', {
      type: 'unhandledRejection',
      message: e.reason?.message ?? String(e.reason),
    })
    if (process.env.NODE_ENV === 'development') {
      console.error('[Global] Unhandled promise rejection:', e.reason)
    }
  }

  const handleError = (e: ErrorEvent) => {
    writeAudit('ERROR', {
      type: 'globalError',
      message: e.message,
      filename: e.filename,
      line: e.lineno,
    })
  }

  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  window.addEventListener('error', handleError)

  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    window.removeEventListener('error', handleError)
  }
}

// Install once at module load
let _globalErrorHandlersInstalled = false
if (typeof window !== 'undefined' && !_globalErrorHandlersInstalled) {
  installGlobalErrorHandlers()
  _globalErrorHandlersInstalled = true
}

// ============================================================
// THEME PREFERENCE PERSISTENCE
// ============================================================

const THEME_STORAGE_KEY = '__astra_theme'
type ThemePreference = 'light' | 'dark' | 'system'

function saveThemePreference(pref: ThemePreference): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, pref) } catch { /* quota */ }
}

function loadThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch { /* private mode */ }
  return 'system'
}

function useThemePreference() {
  const [pref, setPref] = useState<ThemePreference>('system')

  useEffect(() => {
    setPref(loadThemePreference())
  }, [])

  const setTheme = useCallback((p: ThemePreference) => {
    setPref(p)
    saveThemePreference(p)
  }, [])

  return { pref, setTheme }
}

// ============================================================
// CONTENT SECURITY POLICY NONCE PROVIDER
// ============================================================

/**
 * In production, script nonces should be injected by the server.
 * This utility reads the nonce from a meta tag if present,
 * enabling inline scripts to carry a valid CSP nonce.
 */
function readCspNonce(): string | null {
  if (typeof document === 'undefined') return null
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')
  return meta?.content ?? null
}

// ============================================================
// SECURE STORAGE WRAPPER
// ============================================================

/**
 * Wraps localStorage with try/catch to handle:
 *  - Private browsing quota errors
 *  - Corrupted / tampered values
 *  - Type coercion on read
 */
const secureStorage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return secureJsonParse<T>(raw)
    } catch { return null }
  },

  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch { return false }
  },

  remove(key: string): void {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  },

  clear(): void {
    try { localStorage.clear() } catch { /* ignore */ }
  },
}

// ============================================================
// SEND BUTTON DOUBLE-CLICK GUARD
// ============================================================

/**
 * Returns a wrapped send function that ignores duplicate calls
 * within a short window (250ms). Prevents accidental
 * double-message from rapid clicks.
 */
function withDoubleClickGuard<T extends (...args: any[]) => Promise<void>>(
  fn: T,
  windowMs = 250
): T {
  let lastCall = 0
  return (async (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall < windowMs) return
    lastCall = now
    await fn(...args)
  }) as T
}

// ============================================================
// CONVERSATION SEARCH PROVIDER
// ============================================================

interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  results: Conversation[]
  isSearching: boolean
}

const ConversationSearchContext = createContext<SearchContextValue>({
  query: '',
  setQuery: () => undefined,
  results: [],
  isSearching: false,
})

function ConversationSearchProvider({
  children,
  conversations,
}: {
  children: React.ReactNode
  conversations: Conversation[]
}) {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 200)
  const isSearching = query !== debounced

  const results = useMemo(() => {
    if (!debounced.trim()) return conversations
    const q = debounced.toLowerCase()
    return conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    )
  }, [conversations, debounced])

  return (
    <ConversationSearchContext.Provider
      value={{ query, setQuery, results, isSearching }}
    >
      {children}
    </ConversationSearchContext.Provider>
  )
}

function useConversationSearchCtx() {
  return useContext(ConversationSearchContext)
}

// ============================================================
// INPUT VALIDATOR FACTORY
// ============================================================

type Validator<T> = (value: T) => string | null

function composeValidators<T>(...validators: Validator<T>[]): Validator<T> {
  return (value: T) => {
    for (const v of validators) {
      const err = v(value)
      if (err) return err
    }
    return null
  }
}

const messageValidators = composeValidators<string>(
  v => (!v?.trim() ? 'Message cannot be empty' : null),
  v => (v.length > MAX_MESSAGE_LENGTH ? `Max ${MAX_MESSAGE_LENGTH} characters` : null),
  v => (isRepetitionAttack(v) ? 'Repetitive input detected' : null),
  v => (isLowEntropyInput(v) ? 'Input looks automated' : null)
)

// ============================================================
// SEARCH QUERY SANITIZER
// ============================================================

/**
 * Sanitizes a conversation search query to prevent
 * ReDoS (regular-expression denial-of-service) attacks
 * in the client-side filtering logic.
 */
function sanitizeSearchQuery(raw: string): string {
  return raw
    .slice(0, 200)                          // Hard length cap
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex metacharacters
    .trim()
}

// ============================================================
// HEALTH CHECK UTILITY
// ============================================================

interface AppHealth {
  storageAvailable: boolean
  indexedDbAvailable: boolean
  cryptoAvailable: boolean
  networkOnline: boolean
  sessionValid: boolean
  csrfTokenPresent: boolean
  storageRemainingBytes: number
}

function checkAppHealth(
  online: boolean,
  session: ReturnType<typeof useSession>['data'],
  csrfToken: string
): AppHealth {
  return {
    storageAvailable: (() => {
      try { localStorage.setItem('__hc', '1'); localStorage.removeItem('__hc'); return true }
      catch { return false }
    })(),
    indexedDbAvailable: typeof indexedDB !== 'undefined',
    cryptoAvailable: typeof window !== 'undefined' && !!window.crypto?.getRandomValues,
    networkOnline: online,
    sessionValid: !!session,
    csrfTokenPresent: csrfToken.length > 0,
    storageRemainingBytes: estimateLocalStorageRemaining(),
  }
}

// ============================================================
// CSS KEYFRAMES (injected via style tag for toast animation)
// ============================================================


if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(1rem); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `
  if (!document.head.querySelector('[data-astra-toast-styles]')) {
    style.setAttribute('data-astra-toast-styles', '1')
    document.head.appendChild(style)
  }
}