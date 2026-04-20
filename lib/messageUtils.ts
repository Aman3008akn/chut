/**
 * MessageUtils - Comprehensive utility functions for message processing
 * Handles formatting, parsing, validation, and transformation
 */

import { ExtendedMessage, Reaction, MessageEdit, CodeBlockMeta, ValidationResult } from './messageTypes'
import { sanitizeHTML, validateMessageContent, escapeHTML } from './messageSecurity'

/**
 * Format timestamp to readable time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatMessageTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: timestamp > now - 365 * 24 * 60 * 60 * 1000 ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

/**
 * Format timestamp to full date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Full date and time string
 */
export function formatFullDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp))
}

/**
 * Format file size to human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Calculate reading time for message content
 * @param content - Message content
 * @returns Estimated reading time in seconds
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  return Math.ceil((words / wordsPerMinute) * 60)
}

/**
 * Extract code blocks from markdown content
 * @param content - Markdown content
 * @returns Array of code blocks with metadata
 */
export function extractCodeBlocks(content: string): Array<{
  fullMatch: string
  code: string
  language: string
  position: number
}> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const blocks: Array<{ fullMatch: string; code: string; language: string; position: number }> = []
  
  let match
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      fullMatch: match[0],
      code: match[2],
      language: match[1] || 'text',
      position: match.index
    })
  }
  
  return blocks
}

/**
 * Extract URLs from content
 * @param content - Text content
 * @returns Array of URLs found
 */
export function extractURLs(content: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g
  return content.match(urlRegex) || []
}

/**
 * Extract email addresses from content
 * @param content - Text content
 * @returns Array of email addresses found
 */
export function extractEmails(content: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  return content.match(emailRegex) || []
}

/**
 * Extract hashtags from content
 * @param content - Text content
 * @returns Array of hashtags found
 */
export function extractHashtags(content: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const matches = content.match(hashtagRegex) || []
  return matches.map(tag => tag.slice(1))
}

/**
 * Extract mentions from content
 * @param content - Text content
 * @returns Array of usernames mentioned
 */
export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = content.match(mentionRegex) || []
  return matches.map(mention => mention.slice(1))
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Generate message preview for notifications
 * @param message - Message object
 * @param maxLength - Maximum preview length
 * @returns Preview string
 */
export function generateMessagePreview(message: ExtendedMessage, maxLength: number = 50): string {
  const content = message.content.trim()
  
  if (message.images && message.images.length > 0) {
    return `📷 ${message.images.length} image${message.images.length > 1 ? 's' : ''}`
  }
  
  if (message.files && message.files.length > 0) {
    return `📎 ${message.files.length} file${message.files.length > 1 ? 's' : ''}`
  }
  
  return truncateText(content, maxLength)
}

/**
 * Count words in content
 * @param content - Text content
 * @returns Word count
 */
export function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(word => word.length > 0).length
}

/**
 * Count characters in content
 * @param content - Text content
 * @returns Character count
 */
export function countCharacters(content: string): number {
  return content.length
}

/**
 * Detect programming language from code
 * @param code - Code snippet
 * @returns Detected language
 */
export function detectLanguage(code: string): string {
  const patterns: Record<string, RegExp> = {
    javascript: /\b(const|let|var|function|return|import|export|from)\b/,
    typescript: /\b(interface|type|enum|namespace|implements)\b/,
    python: /\b(def|class|import|from|print|elif|except)\b/,
    java: /\b(public|private|protected|class|void|static|final)\b/,
    cpp: /\b(#include|cout|cin|std::|namespace|int main)\b/,
    csharp: /\b(using|namespace|class|public|private|void|static)\b/,
    php: /\b(\$this|function|public|private|protected|echo|print)\b/,
    ruby: /\b(def|end|class|module|require|puts|puts)\b/,
    go: /\b(func|package|import|fmt\.|var|type|struct)\b/,
    rust: /\b(fn|let|mut|pub|use|mod|struct|impl)\b/,
    swift: /\b(func|var|let|import|class|struct|protocol)\b/,
    html: /<(!DOCTYPE|html|head|body|div|span|p|a|img)/i,
    css: /\b(body|margin|padding|color|background|font-size)\b.*{/,
    sql: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN)\b/i,
    bash: /\b(echo|cd|ls|grep|sudo|chmod|export)\b/
  }
  
  for (const [language, pattern] of Object.entries(patterns)) {
    if (pattern.test(code)) {
      return language
    }
  }
  
  return 'plaintext'
}

/**
 * Format code with syntax highlighting markers
 * @param code - Raw code
 * @param language - Programming language
 * @returns Formatted code string
 */
export function formatCode(code: string, language: string): string {
  // Basic formatting - in production, use a library like Prism.js or highlight.js
  const lines = code.split('\n')
  
  return lines.map((line, index) => {
    // Add line numbers
    const lineNum = (index + 1).toString().padStart(3, ' ')
    return `${lineNum} | ${escapeHTML(line)}`
  }).join('\n')
}

/**
 * Parse markdown links to HTML
 * @param content - Markdown content
 * @returns HTML with links
 */
export function parseMarkdownLinks(content: string): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  return content.replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

/**
 * Parse markdown images to HTML
 * @param content - Markdown content
 * @returns HTML with images
 */
export function parseMarkdownImages(content: string): string {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  return content.replace(imageRegex, '<img src="$2" alt="$1" loading="lazy" />')
}

/**
 * Parse markdown bold and italic
 * @param content - Markdown content
 * @returns HTML with formatting
 */
export function parseMarkdownFormatting(content: string): string {
  return content
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
}

/**
 * Convert message to plain text
 * @param message - Message object
 * @returns Plain text representation
 */
export function messageToPlainText(message: ExtendedMessage): string {
  let text = message.content
  
  // Remove markdown formatting
  text = text.replace(/#{1,6}\s/g, '')
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/\*(.+?)\*/g, '$1')
  text = text.replace(/`(.+?)`/g, '$1')
  text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1')
  text = text.replace(/!\[.*?\]\(.+?\)/g, '[Image]')
  
  return text.trim()
}

/**
 * Convert message to markdown format
 * @param message - Message object
 * @returns Markdown representation
 */
export function messageToMarkdown(message: ExtendedMessage): string {
  let markdown = `# Message from ${message.role}\n\n`
  markdown += `${message.content}\n\n`
  
  if (message.images && message.images.length > 0) {
    markdown += '## Images\n'
    message.images.forEach(img => {
      markdown += `![${img.alt}](${img.url})\n`
    })
    markdown += '\n'
  }
  
  if (message.reactions && message.reactions.length > 0) {
    markdown += '## Reactions\n'
    message.reactions.forEach(reaction => {
      markdown += `${reaction.emoji} ${reaction.userName}\n`
    })
    markdown += '\n'
  }
  
  markdown += `---\n*Sent at ${formatFullDateTime(message.timestamp)}*\n`
  
  return markdown
}

/**
 * Convert message to HTML format
 * @param message - Message object
 * @returns HTML representation
 */
export function messageToHTML(message: ExtendedMessage): string {
  let html = '<div class="message">\n'
  html += `  <div class="message-header">\n`
  html += `    <strong>${message.role}</strong> - ${formatFullDateTime(message.timestamp)}\n`
  html += `  </div>\n`
  html += `  <div class="message-content">\n`
  html += `    ${sanitizeHTML(message.content)}\n`
  html += `  </div>\n`
  
  if (message.images && message.images.length > 0) {
    html += `  <div class="message-images">\n`
    message.images.forEach(img => {
      html += `    <img src="${img.url}" alt="${img.alt}" />\n`
    })
    html += `  </div>\n`
  }
  
  html += '</div>\n'
  
  return html
}

/**
 * Merge consecutive messages from same sender
 * @param messages - Array of messages
 * @returns Merged message array
 */
export function mergeConsecutiveMessages(messages: ExtendedMessage[]): ExtendedMessage[] {
  if (messages.length === 0) return []
  
  const merged: ExtendedMessage[] = [messages[0]]
  
  for (let i = 1; i < messages.length; i++) {
    const current = messages[i]
    const previous = merged[merged.length - 1]
    
    if (current.role === previous.role && 
        current.timestamp - previous.timestamp < 60000) { // Within 1 minute
      previous.content += '\n\n' + current.content
      previous.timestamp = current.timestamp
    } else {
      merged.push(current)
    }
  }
  
  return merged
}

/**
 * Sort messages by timestamp
 * @param messages - Array of messages
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted message array
 */
export function sortMessages(messages: ExtendedMessage[], order: 'asc' | 'desc' = 'asc'): ExtendedMessage[] {
  return [...messages].sort((a, b) => {
    return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  })
}

/**
 * Filter messages by criteria
 * @param messages - Array of messages
 * @param criteria - Filter criteria
 * @returns Filtered message array
 */
export function filterMessages(
  messages: ExtendedMessage[],
  criteria: {
    role?: string
    hasReactions?: boolean
    isPinned?: boolean
    searchQuery?: string
  }
): ExtendedMessage[] {
  return messages.filter(message => {
    if (criteria.role && message.role !== criteria.role) return false
    if (criteria.hasReactions && (!message.reactions || message.reactions.length === 0)) return false
    if (criteria.isPinned !== undefined && message.isPinned !== criteria.isPinned) return false
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase()
      return message.content.toLowerCase().includes(query)
    }
    return true
  })
}

/**
 * Search messages by query
 * @param messages - Array of messages
 * @param query - Search query
 * @returns Matching messages with highlights
 */
export function searchMessages(messages: ExtendedMessage[], query: string): Array<{
  message: ExtendedMessage
  highlight: string
  score: number
}> {
  const results: Array<{ message: ExtendedMessage; highlight: string; score: number }> = []
  const queryLower = query.toLowerCase()
  
  for (const message of messages) {
    const contentLower = message.content.toLowerCase()
    const index = contentLower.indexOf(queryLower)
    
    if (index !== -1) {
      const start = Math.max(0, index - 50)
      const end = Math.min(message.content.length, index + query.length + 50)
      const highlight = (start > 0 ? '...' : '') + 
                       message.content.slice(start, end) + 
                       (end < message.content.length ? '...' : '')
      
      // Calculate relevance score
      const score = (query.length / message.content.length) * 100
      
      results.push({ message, highlight, score })
    }
  }
  
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Generate message statistics
 * @param messages - Array of messages
 * @returns Statistics object
 */
export function generateMessageStats(messages: ExtendedMessage[]): {
  totalMessages: number
  totalWords: number
  totalCharacters: number
  avgMessageLength: number
  userMessages: number
  aiMessages: number
  messagesWithReactions: number
  messagesWithImages: number
  messagesWithCode: number
  avgReadingTime: number
} {
  const totalMessages = messages.length
  const totalWords = messages.reduce((sum, msg) => sum + countWords(msg.content), 0)
  const totalCharacters = messages.reduce((sum, msg) => sum + msg.content.length, 0)
  const userMessages = messages.filter(m => m.role === 'user').length
  const aiMessages = messages.filter(m => m.role === 'assistant').length
  const messagesWithReactions = messages.filter(m => m.reactions && m.reactions.length > 0).length
  const messagesWithImages = messages.filter(m => m.images && m.images.length > 0).length
  const messagesWithCode = messages.filter(m => extractCodeBlocks(m.content).length > 0).length
  
  return {
    totalMessages,
    totalWords,
    totalCharacters,
    avgMessageLength: totalMessages > 0 ? totalCharacters / totalMessages : 0,
    userMessages,
    aiMessages,
    messagesWithReactions,
    messagesWithImages,
    messagesWithCode,
    avgReadingTime: calculateReadingTime(messages.map(m => m.content).join(' '))
  }
}

/**
 * Validate message object structure
 * @param message - Message to validate
 * @returns Validation result
 */
export function validateMessageStructure(message: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!message) {
    errors.push('Message is null or undefined')
    return { isValid: false, errors, warnings }
  }
  
  if (!message.id) {
    errors.push('Message ID is required')
  }
  
  if (!message.role || !['user', 'assistant'].includes(message.role)) {
    errors.push('Invalid message role')
  }
  
  if (!message.content || typeof message.content !== 'string') {
    errors.push('Message content is required and must be a string')
  }
  
  if (!message.timestamp || typeof message.timestamp !== 'number') {
    errors.push('Invalid timestamp')
  }
  
  if (message.content && message.content.length > 100000) {
    warnings.push('Message content is very large')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Create deep copy of message
 * @param message - Message to copy
 * @returns Deep copied message
 */
export function cloneMessage(message: ExtendedMessage): ExtendedMessage {
  return JSON.parse(JSON.stringify(message))
}

/**
 * Compare two messages for equality
 * @param msg1 - First message
 * @param msg2 - Second message
 * @returns True if messages are equal
 */
export function compareMessages(msg1: ExtendedMessage, msg2: ExtendedMessage): boolean {
  return msg1.id === msg2.id &&
         msg1.content === msg2.content &&
         msg1.timestamp === msg2.timestamp &&
         msg1.role === msg2.role
}

/**
 * Export all utility functions
 */
export const MessageUtils = {
  formatMessageTime,
  formatFullDateTime,
  formatFileSize,
  calculateReadingTime,
  extractCodeBlocks,
  extractURLs,
  extractEmails,
  extractHashtags,
  extractMentions,
  truncateText,
  generateMessagePreview,
  countWords,
  countCharacters,
  detectLanguage,
  formatCode,
  parseMarkdownLinks,
  parseMarkdownImages,
  parseMarkdownFormatting,
  messageToPlainText,
  messageToMarkdown,
  messageToHTML,
  mergeConsecutiveMessages,
  sortMessages,
  filterMessages,
  searchMessages,
  generateMessageStats,
  validateMessageStructure,
  cloneMessage,
  compareMessages
} as const
