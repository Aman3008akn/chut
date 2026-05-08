/**
 * MessageTypes - Extended TypeScript type definitions for the message system
 * Provides comprehensive type safety for all message-related operations
 */

import { Message, MessageStatus, Role } from '@/lib/types'

// Extended message statuses for advanced features
export type ExtendedMessageStatus = MessageStatus 
  | 'editing'
  | 'deleting'
  | 'reacting'
  | 'loading'
  | 'retrying'
  | 'scheduled'
  | 'pinned'
  | 'archived'

// Reaction types for message feedback
export interface Reaction {
  id: string
  emoji: string
  userId: string
  userName: string
  timestamp: number
}

// Message edit history for audit trail
export interface MessageEdit {
  id: string
  content: string
  timestamp: number
  reason?: string
}

// Message thread for replies
export interface MessageThread {
  id: string
  parentId: string
  replies: Message[]
  replyCount: number
  lastReplyAt?: number
}

// Code block metadata
export interface CodeBlockMeta {
  language: string
  filename?: string
  lineNumbers: boolean
  highlightedLines?: number[]
  copyable: boolean
}

// Image attachment details
export interface ImageAttachment {
  id: string
  url: string
  alt: string
  width: number
  height: number
  thumbnail?: string
  caption?: string
}

// File attachment details
export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: number
}

// Link preview metadata
export interface LinkPreview {
  url: string
  title: string
  description?: string
  image?: string
  favicon?: string
  siteName?: string
}

// Message analytics for tracking
export interface MessageAnalytics {
  viewCount: number
  copyCount: number
  reactionCount: number
  timeToRead?: number
  lastViewedAt?: number
}

// Message priority levels
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent'

// Message visibility settings
export type MessageVisibility = 'public' | 'private' | 'encrypted'

// Extended message interface with all features
export interface ExtendedMessage extends Message {
  // Thread and conversation
  threadId?: string
  parentMessageId?: string
  replyTo?: string
  
  // Reactions and feedback
  reactions?: Reaction[]
  isPinned?: boolean
  priority?: MessagePriority
  
  // Editing and versioning
  editHistory?: MessageEdit[]
  isEdited?: boolean
  originalTimestamp?: number
  
  // Attachments
  images?: ImageAttachment[]
  files?: FileAttachment[]
  linkPreviews?: LinkPreview[]
  
  // Security and privacy
  visibility?: MessageVisibility
  isEncrypted?: boolean
  verified?: boolean
  
  // Analytics
  analytics?: MessageAnalytics
  
  // UI state
  isExpanded?: boolean
  isSelected?: boolean
  isHovered?: boolean
  isLoading?: boolean
  
  // Custom metadata
  tags?: string[]
  customMetadata?: Record<string, any>
}

// Message bubble component props
export interface MessageBubbleProps {
  message: ExtendedMessage
  onFollowUp?: (text: string) => void
  onReact?: (messageId: string, emoji: string) => void
  onEdit?: (messageId: string, content: string) => void
  onDelete?: (messageId: string) => void
  onCopy?: (messageId: string, content: string) => void
  onRetry?: (messageId: string) => void
  onPin?: (messageId: string) => void
  onThread?: (messageId: string) => void
  onReport?: (messageId: string, reason: string) => void
  onSelect?: (messageId: string) => void
  className?: string
  showActions?: boolean
  showTimestamp?: boolean
  showAvatar?: boolean
  allowReactions?: boolean
  allowEditing?: boolean
  allowDeleting?: boolean
  maxCodeHeight?: number
  enableAnimations?: boolean
  enableAccessibility?: boolean
}

// Reaction picker props
export interface ReactionPickerProps {
  onReact: (emoji: string) => void
  currentReactions?: Reaction[]
  position?: { top: number; left: number }
  onClose: () => void
}

// Code block props
export interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  highlightedLines?: number[]
  maxHeight?: number
  allowCopy?: boolean
  theme?: 'light' | 'dark'
}

// Message actions props
export interface MessageActionsProps {
  message: ExtendedMessage
  onCopy: () => void
  onEdit?: () => void
  onDelete?: () => void
  onReact?: () => void
  onRetry?: () => void
  onPin?: () => void
  onThread?: () => void
  onReport?: () => void
  isCopied: boolean
  canEdit: boolean
  canDelete: boolean
  canReact: boolean
  canRetry: boolean
  position?: 'top' | 'bottom'
}

// Security validation options
export interface SecurityOptions {
  maxMessageLength?: number
  maxCodeLength?: number
  allowedTags?: string[]
  allowedAttributes?: string[]
  sanitizeUrls?: boolean
  preventXSS?: boolean
  preventInjection?: boolean
  maxFileSize?: number
  allowedFileTypes?: string[]
}

// Message validation result
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitizedContent?: string
}

// Accessibility options
export interface AccessibilityOptions {
  enableScreenReader?: boolean
  enableKeyboardNav?: boolean
  enableFocusManagement?: boolean
  announceUpdates?: boolean
  highContrast?: boolean
  reducedMotion?: boolean
}

// Animation configuration
export interface AnimationConfig {
  enableEnterAnimation?: boolean
  enableExitAnimation?: boolean
  enableStatusAnimation?: boolean
  enableReactionAnimation?: boolean
  enableExpandAnimation?: boolean
  duration?: number
  easing?: string
}

// Theme configuration
export interface ThemeConfig {
  userBubbleColor?: string
  aiBubbleColor?: string
  codeTheme?: string
  borderRadius?: string
  fontSize?: string
  lineHeight?: string
  fontFamily?: string
}

// Message filter options
export interface MessageFilter {
  role?: Role
  status?: ExtendedMessageStatus
  hasReactions?: boolean
  isPinned?: boolean
  hasAttachments?: boolean
  dateRange?: { start: number; end: number }
  searchQuery?: string
  tags?: string[]
}

// Message sort options
export type MessageSort = 'newest' | 'oldest' | 'priority' | 'reactions'

// Pagination for message loading
export interface MessagePagination {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

// Message export format
export type MessageExportFormat = 'json' | 'markdown' | 'html' | 'text'

// Message import source
export type MessageImportSource = 'backup' | 'migration' | 'sync'

// WebSocket message events
export type MessageEventType = 
  | 'message:create'
  | 'message:update'
  | 'message:delete'
  | 'message:react'
  | 'message:edit'
  | 'message:pin'
  | 'message:thread'

// Real-time message event
export interface MessageEvent {
  type: MessageEventType
  messageId: string
  data: any
  timestamp: number
  userId: string
}

// Message queue item for offline support
export interface MessageQueueItem {
  id: string
  message: ExtendedMessage
  status: 'pending' | 'sending' | 'sent' | 'failed'
  retryCount: number
  createdAt: number
}

// Cache configuration
export interface MessageCacheConfig {
  maxSize: number
  ttl: number
  strategy: 'lru' | 'fifo' | 'lfu'
}

// Performance metrics
export interface MessagePerformanceMetrics {
  renderTime: number
  paintTime: number
  interactionTime: number
  memoryUsage: number
  bundleSize: number
}
