/**
 * MessageSecurity - Comprehensive security utilities for message handling
 * Provides XSS protection, input sanitization, validation, and secure content processing
 */

import { SecurityOptions, ValidationResult } from './messageTypes'

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_OPTIONS: SecurityOptions = {
  maxMessageLength: 10000,
  maxCodeLength: 50000,
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'hr', 'details',
    'summary', 'abbr', 'sub', 'sup', 'mark', 'del', 'ins', 'kbd', 'var', 'samp'
  ],
  allowedAttributes: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
    'width', 'height', 'align', 'colspan', 'rowspan', 'lang', 'dir'
  ],
  sanitizeUrls: true,
  preventXSS: true,
  preventInjection: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/markdown',
    'application/json', 'application/xml',
    'text/csv', 'application/vnd.ms-excel'
  ]
}

/**
 * Dangerous URL patterns to block
 */
const DANGEROUS_URL_PATTERNS = [
  /^javascript:/i,
  /^data:text\/html/i,
  /^vbscript:/i,
  /^file:/i,
  /^about:blank/i
]

/**
 * Suspicious script patterns to detect
 */
const SCRIPT_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=/gi,
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\(/gi,
  /setInterval\s*\(/gi,
  /document\.write/gi,
  /document\.cookie/gi,
  /window\.location/gi,
  /innerHTML\s*=/gi,
  /outerHTML\s*=/gi
]

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|TABLE|WHERE|SET)\b)/gi,
  /(;\s*(DROP|DELETE|UPDATE|INSERT))/gi,
  /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
  /('--|\/\*|\*\/|@@|@)/gi
]

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param content - Raw HTML content
 * @param options - Security configuration options
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(content: string, options?: SecurityOptions): string {
  const config = { ...DEFAULT_SECURITY_OPTIONS, ...options }
  
  if (!config.preventXSS) {
    return content
  }

  try {
    // Simple HTML sanitization without external library
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"]*["']/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
  } catch (error) {
    console.error('HTML sanitization failed:', error)
    return escapeHTML(content)
  }
}

/**
 * Escape HTML special characters
 * @param content - Raw content
 * @returns Escaped HTML string
 */
export function escapeHTML(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Unescape HTML entities
 * @param content - Escaped HTML content
 * @returns Unescaped HTML string
 */
export function unescapeHTML(content: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/'
  }
  
  return content.replace(/&[^;]+;/g, (match) => entities[match] || match)
}

/**
 * Validate and sanitize URL
 * @param url - URL to validate
 * @param options - Security options
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeURL(url: string, options?: SecurityOptions): string {
  const config = { ...DEFAULT_SECURITY_OPTIONS, ...options }
  
  if (!config.sanitizeUrls) {
    return url
  }

  try {
    // Check for dangerous URL patterns
    for (const pattern of DANGEROUS_URL_PATTERNS) {
      if (pattern.test(url)) {
        console.warn('Blocked dangerous URL:', url)
        return ''
      }
    }

    // Parse URL to validate structure
    const parsed = new URL(url, window.location.origin)
    
    // Only allow http, https, and relative URLs
    if (!['http:', 'https:', ''].includes(parsed.protocol)) {
      console.warn('Blocked unsupported protocol:', parsed.protocol)
      return ''
    }

    return parsed.toString()
  } catch (error) {
    // If URL parsing fails, treat as relative path
    if (url.startsWith('/')) {
      return url
    }
    
    console.warn('Invalid URL:', url)
    return ''
  }
}

/**
 * Validate message content for security threats
 * @param content - Message content to validate
 * @param options - Security options
 * @returns Validation result with errors and warnings
 */
export function validateMessageContent(
  content: string,
  options?: SecurityOptions
): ValidationResult {
  const config = { ...DEFAULT_SECURITY_OPTIONS, ...options }
  const errors: string[] = []
  const warnings: string[] = []

  // Check message length
  if (content.length > config.maxMessageLength) {
    errors.push(`Message exceeds maximum length of ${config.maxMessageLength} characters`)
  }

  // Detect script patterns
  if (config.preventXSS) {
    for (const pattern of SCRIPT_PATTERNS) {
      if (pattern.test(content)) {
        errors.push('Potentially malicious script detected')
        break
      }
    }
  }

  // Detect SQL injection attempts
  if (config.preventInjection) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        errors.push('Potentially malicious SQL injection attempt detected')
        break
      }
    }
  }

  // Check for excessive special characters
  const specialCharCount = (content.match(/[<>{}[\]()]/g) || []).length
  if (specialCharCount > 50) {
    warnings.push('Unusually high number of special characters detected')
  }

  // Check for repeated patterns (potential spam)
  if (/(.)\1{20,}/.test(content)) {
    warnings.push('Repeated character pattern detected')
  }

  // Check for invisible Unicode characters
  if (/[\u200B-\u200D\uFEFF\u00AD]/.test(content)) {
    warnings.push('Invisible Unicode characters detected')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedContent: config.preventXSS ? sanitizeHTML(content, config) : content
  }
}

/**
 * Sanitize code block content
 * @param code - Raw code content
 * @param language - Programming language
 * @param options - Security options
 * @returns Sanitized code string
 */
export function sanitizeCodeBlock(
  code: string,
  language?: string,
  options?: SecurityOptions
): string {
  const config = { ...DEFAULT_SECURITY_OPTIONS, ...options }

  // Check code length
  if (code.length > config.maxCodeLength) {
    throw new Error(`Code block exceeds maximum length of ${config.maxCodeLength} characters`)
  }

  // For code blocks, we escape all HTML to prevent execution
  return escapeHTML(code)
}

/**
 * Validate file attachment
 * @param file - File object to validate
 * @param options - Security options
 * @returns Validation result
 */
export function validateFileAttachment(
  file: File,
  options?: SecurityOptions
): ValidationResult {
  const config = { ...DEFAULT_SECURITY_OPTIONS, ...options }
  const errors: string[] = []
  const warnings: string[] = []

  // Check file size
  if (file.size > config.maxFileSize) {
    errors.push(`File size exceeds maximum allowed size of ${config.maxFileSize / 1024 / 1024}MB`)
  }

  // Check file type
  if (!config.allowedFileTypes.includes(file.type)) {
    errors.push(`File type "${file.type}" is not allowed`)
  }

  // Check for executable files
  const executableExtensions = ['.exe', '.bat', '.sh', '.cmd', '.com', '.scr', '.pif', '.vbs']
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  
  if (executableExtensions.includes(extension)) {
    errors.push('Executable files are not allowed for security reasons')
  }

  // Warn about large files
  if (file.size > 5 * 1024 * 1024) {
    warnings.push('Large file may take longer to upload')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Remove potentially dangerous CSS from inline styles
 * @param styles - CSS style string
 * @returns Safe CSS string
 */
export function sanitizeStyles(styles: string): string {
  const dangerousProperties = [
    'behavior',
    '-moz-binding',
    'expression',
    'javascript:',
    'url(javascript:',
    'url(data:',
    'vbscript:'
  ]

  let sanitized = styles

  for (const dangerous of dangerousProperties) {
    const regex = new RegExp(`${dangerous}\\s*:[^;]*;?`, 'gi')
    sanitized = sanitized.replace(regex, '')
  }

  return sanitized
}

/**
 * Create Content Security Policy nonce
 * @returns Random nonce string
 */
export function generateCSPNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
}

/**
 * Validate and sanitize markdown content
 * @param markdown - Raw markdown content
 * @param options - Security options
 * @returns Sanitized HTML from markdown
 */
export function sanitizeMarkdown(markdown: string, options?: SecurityOptions): string {
  const config = { ...DEFAULT_SECURITY_OPTIONS, ...options }
  
  // First pass: remove raw HTML that could be dangerous
  let sanitized = markdown
  
  if (config.preventXSS) {
    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    
    // Remove event handlers
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript\s*:/gi, '')
  }

  return sanitized
}

/**
 * Check if content contains sensitive information
 * @param content - Content to check
 * @returns Object with detected sensitive data types
 */
export function detectSensitiveData(content: string): {
  hasEmail: boolean
  hasPhone: boolean
  hasCreditCard: boolean
  hasSSN: boolean
  hasIPAddress: boolean
  hasAPIKey: boolean
} {
  const patterns = {
    hasEmail: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(content),
    hasPhone: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(content),
    hasCreditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(content),
    hasSSN: /\b\d{3}-\d{2}-\d{4}\b/.test(content),
    hasIPAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(content),
    hasAPIKey: /(api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}/i.test(content)
  }

  return patterns
}

/**
 * Mask sensitive information in content
 * @param content - Content with potentially sensitive data
 * @returns Content with sensitive data masked
 */
export function maskSensitiveData(content: string): string {
  return content
    // Mask email addresses
    .replace(/\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g, '$1***@***.$2')
    // Mask phone numbers
    .replace(/(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?(\d{4})/g, '***-***-$2')
    // Mask credit cards
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})\b/g, '****-****-****-$1')
    // Mask SSN
    .replace(/\b\d{3}-\d{2}-(\d{4})\b/g, '***-**-$1')
    // Mask IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.(\d{1,3})\b/g, '***.***.***.$1')
    // Mask API keys
    .replace(/(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9]{4})[a-zA-Z0-9]{16,}/gi, '$1: $2****')
}

/**
 * Validate message for content policy compliance
 * @param content - Message content
 * @returns Array of policy violations
 */
export function checkContentPolicy(content: string): string[] {
  const violations: string[] = []
  const lowerContent = content.toLowerCase()

  // Check for hate speech patterns (simplified example)
  const hateSpeechPatterns = [
    /\b(hate|kill|die)\s+(you|them|us)\b/i,
    /\b(racist|sexist|homophobic)\b/i
  ]

  for (const pattern of hateSpeechPatterns) {
    if (pattern.test(content)) {
      violations.push('Content may violate hate speech policy')
      break
    }
  }

  // Check for excessive profanity (simplified example)
  const profanityCount = (lowerContent.match(/\b(badword1|badword2|badword3)\b/g) || []).length
  if (profanityCount > 3) {
    violations.push('Excessive inappropriate language detected')
  }

  // Check for spam patterns
  if (content.length > 1000 && content.split(' ').length < 50) {
    violations.push('Content may be spam (high character-to-word ratio)')
  }

  return violations
}

/**
 * Create secure message fingerprint for deduplication
 * @param content - Message content
 * @param timestamp - Message timestamp
 * @returns Secure hash string
 */
export async function createMessageFingerprint(
  content: string,
  timestamp: number
): Promise<string> {
  const data = `${content}:${timestamp}`
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex
}

/**
 * Encrypt message content (client-side)
 * @param content - Plain text content
 * @param key - Encryption key
 * @returns Encrypted content as base64
 */
export async function encryptMessage(
  content: string,
  key: string
): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  
  // Derive key from password
  const keyData = encoder.encode(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode.apply(null, Array.from(result)))
}

/**
 * Decrypt message content (client-side)
 * @param encryptedContent - Base64 encrypted content
 * @param key - Decryption key
 * @returns Decrypted plain text
 */
export async function decryptMessage(
  encryptedContent: string,
  key: string
): Promise<string> {
  const encoder = new TextEncoder()
  const encryptedData = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0))
  
  // Extract IV and encrypted data
  const iv = encryptedData.slice(0, 12)
  const data = encryptedData.slice(12)
  
  // Derive key from password
  const keyData = encoder.encode(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Export security utilities
 */
export const MessageSecurity = {
  sanitizeHTML,
  escapeHTML,
  unescapeHTML,
  sanitizeURL,
  validateMessageContent,
  sanitizeCodeBlock,
  validateFileAttachment,
  sanitizeStyles,
  generateCSPNonce,
  sanitizeMarkdown,
  detectSensitiveData,
  maskSensitiveData,
  checkContentPolicy,
  createMessageFingerprint,
  encryptMessage,
  decryptMessage,
  DEFAULT_SECURITY_OPTIONS
} as const
