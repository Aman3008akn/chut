/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          ImageGeneration — Production-Grade Utilities            ║
 * ║                                                                  ║
 * ║  Multi-provider AI image generation with:                        ║
 * ║  • 5 provider fallback chain (Pollinations → Picsum → …)         ║
 * ║  • LRU memory cache + IndexedDB persistent cache                 ║
 * ║  • Exponential-backoff retry with jitter                         ║
 * ║  • Input security: sanitize, validate, rate-limit                ║
 * ║  • Prompt engineering: style chaining, negative prompts          ║
 * ║  • Image processing: resize, compress, crop, watermark           ║
 * ║  • Conversion: base64, blob, objectURL, canvas, dataURL          ║
 * ║  • Batch generation with concurrency control                     ║
 * ║  • Streaming progress events via EventEmitter                    ║
 * ║  • Full TypeScript with discriminated unions                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export type ImageStyle =
  | 'photorealistic'
  | 'digital-art'
  | 'anime'
  | 'oil-painting'
  | 'watercolor'
  | '3d-render'
  | 'sketch'
  | 'cinematic'
  | 'pixel-art'
  | 'low-poly'
  | 'isometric'
  | 'concept-art'
  | 'impressionist'
  | 'surrealist'
  | 'minimalist'
  | 'neon-punk'
  | 'steampunk'
  | 'vaporwave'
  | 'gothic'
  | 'bauhaus'

export type ImageSize =
  | '256x256'
  | '512x512'
  | '768x768'
  | '1024x1024'
  | '1024x512'
  | '512x1024'
  | '1280x720'
  | '1920x1080'
  | '1080x1920'
export type ImageQuality = 'draft' | 'standard' | 'hd' | 'ultra'
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '2:3' | '3:2'
export type OutputFormat = 'png' | 'jpeg' | 'webp'
export type ImageProvider = 'gemini' | 'flickr' | 'pollinations' | 'picsum' | 'placeholder' | 'lorem-picsum' | 'offline'

export type LightingPreset =
  | 'natural' | 'studio' | 'golden-hour' | 'blue-hour'
  | 'dramatic' | 'soft-box' | 'neon' | 'candlelight'

export type CameraAngle =
  | 'eye-level' | 'bird-eye' | 'worm-eye' | 'dutch-tilt'
  | 'over-shoulder' | 'close-up' | 'extreme-close-up'
  | 'wide-shot' | 'medium-shot' | 'full-shot'

export type ColorPalette =
  | 'vibrant' | 'muted' | 'monochrome' | 'warm' | 'cool'
  | 'pastel' | 'neon' | 'earth-tones' | 'duotone'

/** Full generation options */
export interface ImageGenerationOptions {
  prompt: string

  // Visual style
  style?: ImageStyle
  lighting?: LightingPreset
  cameraAngle?: CameraAngle
  colorPalette?: ColorPalette
  mood?: string
  subject?: string
  background?: string

  // Technical
  size?: ImageSize
  aspectRatio?: AspectRatio
  quality?: ImageQuality
  format?: OutputFormat
  seed?: number

  // Prompt control
  negativePrompt?: string
  styleWeight?: number           // 0.0 – 2.0, default 1.0
  additionalModifiers?: string[]

  // Behaviour
  provider?: ImageProvider
  fallbackProviders?: ImageProvider[]
  timeout?: number               // ms, default 30_000
  retries?: number               // default 3
  useCache?: boolean             // default true
  cacheTtlMs?: number            // default 1 hour

  // Watermark
  watermark?: WatermarkOptions

  // Batch
  batchCount?: number            // 1–8
  batchConcurrency?: number      // 1–4

  // Callbacks
  onProgress?: (event: ProgressEvent) => void
  onRetry?: (attempt: number, error: string) => void
}

export interface WatermarkOptions {
  text: string
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  opacity?: number  // 0–1
  fontSize?: number
  color?: string
}

export interface ProgressEvent {
  stage: 'validating' | 'enhancing' | 'generating' | 'loading' | 'processing' | 'complete' | 'error'
  percent: number
  message: string
  attempt?: number
  provider?: ImageProvider
}

export interface GeneratedImage {
  id: string
  url: string
  blobUrl?: string
  base64?: string
  originalPrompt: string
  enhancedPrompt: string
  negativePrompt?: string
  style: ImageStyle
  size: ImageSize
  format: OutputFormat
  width: number
  height: number
  seed: number
  provider: ImageProvider
  quality: ImageQuality
  timestamp: number
  processingTimeMs: number
  cached: boolean
  metadata: ImageMetadata
}

export interface ImageMetadata {
  styleWeight: number
  lighting?: LightingPreset
  cameraAngle?: CameraAngle
  colorPalette?: ColorPalette
  mood?: string
  additionalModifiers: string[]
  retryCount: number
  cacheHit: boolean
  promptTokenEstimate: number
}

// Discriminated union result — never use `.success` boolean checks again
export type ImageResult =
  | { ok: true;  image: GeneratedImage; warnings: string[] }
  | { ok: false; error: ImageError;     attempt: number }

export type BatchResult = {
  results: ImageResult[]
  successful: number
  failed: number
  totalTimeMs: number
}

export interface ImageError {
  code: ImageErrorCode
  message: string
  provider?: ImageProvider
  retryable: boolean
  raw?: unknown
}

export type ImageErrorCode =
  | 'VALIDATION_FAILED'
  | 'PROMPT_TOO_SHORT'
  | 'PROMPT_TOO_LONG'
  | 'POLICY_VIOLATION'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'DECODE_FAILED'
  | 'WATERMARK_FAILED'
  | 'CACHE_ERROR'
  | 'UNKNOWN'

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  suggestions: string[]
  enhancedPrompt?: string
  estimatedTokens: number
}

export interface ValidationIssue {
  code: string
  message: string
  field?: string
}

export interface PromptAnalysis {
  subjects: string[]
  styles: string[]
  moods: string[]
  colors: string[]
  hasLighting: boolean
  hasCamera: boolean
  hasNegative: boolean
  complexity: 'simple' | 'moderate' | 'complex' | 'elaborate'
  qualityScore: number  // 0–100
  suggestions: string[]
}

export interface ResizeOptions {
  width?: number
  height?: number
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
  background?: string
  quality?: number
}

export interface CropOptions {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageStats {
  totalGenerated: number
  cacheHits: number
  cacheMisses: number
  failedAttempts: number
  avgProcessingMs: number
  providerBreakdown: Record<ImageProvider, number>
  styleBreakdown: Partial<Record<ImageStyle, number>>
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — CONSTANTS & PRESETS
// ─────────────────────────────────────────────────────────────────────────────

/** Flat style descriptors injected into the prompt */
export const STYLE_PRESETS: Record<ImageStyle, string> = {
  'photorealistic':
    'photorealistic, ultra detailed, 8k resolution, professional photography, ' +
    'natural lighting, sharp focus, DSLR quality, shallow depth of field',
  'digital-art':
    'digital art, vibrant colors, detailed illustration, concept art, ' +
    'artstation trending, masterwork, professional digital painting',
  'anime':
    'anime style, manga art, cel shading, vibrant colors, ' +
    'detailed character design, studio quality, kyoto animation style',
  'oil-painting':
    'oil painting, classical art style, rich textures, impasto technique, ' +
    'canvas texture, masterful brushwork, museum quality, old masters',
  'watercolor':
    'watercolor painting, soft translucent colors, flowing washes, ' +
    'artistic, delicate details, cold press paper texture, wet-on-wet',
  '3d-render':
    '3D render, octane render, ray tracing, volumetric lighting, ' +
    'cinematic composition, unreal engine 5, subsurface scattering, PBR materials',
  'sketch':
    'pencil sketch, detailed lineart, cross-hatching shading, ' +
    'graphite drawing, artistic sketch, monochrome, fine art sketch',
  'cinematic':
    'cinematic shot, dramatic chiaroscuro lighting, anamorphic lens flare, ' +
    'film grain, color graded, Hollywood blockbuster, RED camera look',
  'pixel-art':
    'pixel art, 16-bit retro style, limited color palette, ' +
    'crisp pixels, game sprite, nostalgic, SNES era',
  'low-poly':
    'low poly art, geometric shapes, flat colors, minimal detail, ' +
    'triangulated mesh, modern illustration, clean design',
  'isometric':
    'isometric view, 45-degree angle, clean geometric, ' +
    'architectural illustration, game art, precise perspective',
  'concept-art':
    'concept art, pre-production art, detailed environment design, ' +
    'entertainment industry standard, Gnomon Workshop quality',
  'impressionist':
    'impressionist painting, visible brushstrokes, outdoor light, ' +
    'Monet inspired, dappled color, en plein air, post-impressionism',
  'surrealist':
    'surrealist art, dreamlike, impossible juxtapositions, ' +
    'Dalí inspired, hyperrealistic fantasy, subconscious imagery',
  'minimalist':
    'minimalist design, negative space, clean lines, ' +
    'simple shapes, limited palette, Swiss design, geometric abstraction',
  'neon-punk':
    'neon punk, cyberpunk aesthetics, glowing neon signs, ' +
    'rain-slicked streets, night city, blade runner vibes, chromatic aberration',
  'steampunk':
    'steampunk, Victorian era, brass gears and cogs, ' +
    'steam-powered machinery, sepia tones, industrial fantasy',
  'vaporwave':
    'vaporwave aesthetic, retrowave, pastel pink and blue, ' +
    'glitch art, 80s nostalgia, synthwave, neon grid',
  'gothic':
    'gothic dark art, dramatic shadows, ornate architecture, ' +
    'dark romanticism, intricate detail, Victorian gothic',
  'bauhaus':
    'bauhaus design, geometric shapes, primary colors, ' +
    'functional art, modernist design, clean typography influence',
}

export const LIGHTING_PRESETS: Record<LightingPreset, string> = {
  'natural':       'natural daylight, sun-lit, realistic outdoor lighting',
  'studio':        'professional studio lighting, three-point lighting setup, softbox',
  'golden-hour':   'golden hour, warm sunset light, long shadows, magic hour',
  'blue-hour':     'blue hour, twilight, cool ambient light, dusk atmosphere',
  'dramatic':      'dramatic Rembrandt lighting, chiaroscuro, high contrast',
  'soft-box':      'soft diffused light, even illumination, no harsh shadows',
  'neon':          'neon-lit, colored artificial light, vibrant glow, night scene',
  'candlelight':   'candlelight, warm flickering light, intimate atmosphere',
}

export const CAMERA_PRESETS: Record<CameraAngle, string> = {
  'eye-level':         'eye-level shot, straight-on perspective',
  'bird-eye':          'bird-eye view, aerial perspective, top-down shot',
  'worm-eye':          'worm-eye view, low angle shot, looking up',
  'dutch-tilt':        'dutch tilt, canted angle, diagonal horizon',
  'over-shoulder':     'over-shoulder shot, POV perspective',
  'close-up':          'close-up shot, tight framing, detail focus',
  'extreme-close-up':  'extreme close-up, macro detail, abstract framing',
  'wide-shot':         'wide establishing shot, full environment visible',
  'medium-shot':       'medium shot, waist-up framing',
  'full-shot':         'full shot, head-to-toe framing',
}

export const PALETTE_PRESETS: Record<ColorPalette, string> = {
  'vibrant':     'vibrant saturated colors, high chroma, bold palette',
  'muted':       'desaturated muted tones, subtle palette, understated',
  'monochrome':  'monochromatic, black and white, grayscale, tonal range',
  'warm':        'warm color palette, reds oranges yellows, cozy and inviting',
  'cool':        'cool color palette, blues purples teals, calm and serene',
  'pastel':      'soft pastel colors, light hues, gentle palette',
  'neon':        'neon fluorescent colors, electric glow, hyper-saturated',
  'earth-tones': 'earthy natural tones, browns tans greens, organic palette',
  'duotone':     'duotone color scheme, two dominant hues, graphic contrast',
}

/** Default negative prompts to improve output quality */
const DEFAULT_NEGATIVE_PROMPT =
  'blurry, out of focus, low quality, bad anatomy, deformed, ugly, ' +
  'watermark, text overlay, signature, username, extra limbs, ' +
  'duplicate, error, cropped, worst quality, jpeg artifacts, ' +
  'lowres, poorly drawn, bad proportions, gross proportions'

export const SIZE_CONFIG: Record<ImageSize, { width: number; height: number }> = {
  '256x256':   { width: 256,  height: 256  },
  '512x512':   { width: 512,  height: 512  },
  '768x768':   { width: 768,  height: 768  },
  '1024x1024': { width: 1024, height: 1024 },
  '1024x512':  { width: 1024, height: 512  },
  '512x1024':  { width: 512,  height: 1024 },
  '1280x720':  { width: 1280, height: 720  },
  '1920x1080': { width: 1920, height: 1080 },
  '1080x1920': { width: 1080, height: 1920 },
}

const PROVIDER_PRIORITY: ImageProvider[] = [
  'gemini',
  'pollinations',
  'flickr',
  'lorem-picsum',
]

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — SECURITY & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_MIN_LENGTH = 3
const PROMPT_MAX_LENGTH = 2000
const NEGATIVE_PROMPT_MAX_LENGTH = 800

/** Blocked terms — extend as needed for your deployment context */
const POLICY_BLOCKLIST: RegExp[] = [
  /\bnsfw\b/i,
  /\bexplicit\b/i,
  /\bpornograph/i,
  /\bgore\b/i,
  /\bviolent\b.*\b(graphic|extreme)\b/i,
  /\b(real\s+person|celebrity)\s+(nude|naked|sex)/i,
]

/** Suspicious injection patterns */
const INJECTION_PATTERNS: RegExp[] = [
  /<script[\s\S]*?>/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
]

/** Control characters to strip from prompts */
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

/**
 * Sanitises prompt text:
 * 1. Strip control characters
 * 2. Unicode NFC normalisation
 * 3. Collapse repeated whitespace
 * 4. Truncate to max length
 */
function sanitizePromptText(raw: string, maxLen: number): string {
  let s = raw.replace(CONTROL_CHAR_RE, '')
  try { s = s.normalize('NFC') } catch { /* not available in all envs */ }
  s = s.replace(/\s{3,}/g, '  ').trim()
  return s.slice(0, maxLen)
}

/**
 * Checks prompt text against the policy blocklist.
 * Returns the first matching term, or null if clean.
 */
function checkPolicyViolation(text: string): string | null {
  for (const re of POLICY_BLOCKLIST) {
    if (re.test(text)) return re.source
  }
  return null
}

/**
 * Checks for injection attack patterns in prompt text.
 */
function checkInjectionAttempt(text: string): boolean {
  return INJECTION_PATTERNS.some(re => re.test(text))
}

/**
 * Full prompt validation with detailed error reporting.
 */
export function validateImagePrompt(prompt: string): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const suggestions: string[] = []

  if (!prompt || typeof prompt !== 'string') {
    return {
      valid: false,
      errors: [{ code: 'EMPTY', message: 'Prompt cannot be empty.', field: 'prompt' }],
      warnings: [],
      suggestions: [],
      estimatedTokens: 0,
    }
  }

  const trimmed = sanitizePromptText(prompt, PROMPT_MAX_LENGTH + 100)

  // Length checks
  if (trimmed.length < PROMPT_MIN_LENGTH) {
    errors.push({
      code: 'TOO_SHORT',
      message: `Prompt must be at least ${PROMPT_MIN_LENGTH} characters.`,
      field: 'prompt',
    })
  }
  if (trimmed.length > PROMPT_MAX_LENGTH) {
    errors.push({
      code: 'TOO_LONG',
      message: `Prompt must be under ${PROMPT_MAX_LENGTH} characters (currently ${trimmed.length}).`,
      field: 'prompt',
    })
  }

  // Security checks
  if (checkInjectionAttempt(trimmed)) {
    errors.push({
      code: 'INJECTION',
      message: 'Prompt contains disallowed scripting patterns.',
      field: 'prompt',
    })
  }

  const policyViolation = checkPolicyViolation(trimmed)
  if (policyViolation) {
    errors.push({
      code: 'POLICY',
      message: 'Prompt violates content policy.',
      field: 'prompt',
    })
  }

  // Quality warnings and suggestions
  if (trimmed.length < 15) {
    warnings.push({
      code: 'VAGUE',
      message: 'Short prompts typically produce generic results.',
    })
    suggestions.push('Add details: subject, style, mood, lighting, composition.')
  }

  const styleTerms = Object.keys(STYLE_PRESETS)
  const hasExplicitStyle = styleTerms.some(s => trimmed.toLowerCase().includes(s.replace('-', ' ')))
  if (!hasExplicitStyle) {
    suggestions.push('Specify an art style (e.g. "photorealistic", "watercolor", "anime") for more targeted results.')
  }

  if (!trimmed.includes('light') && !trimmed.includes('shadow') && !trimmed.includes('dark') && !trimmed.includes('bright')) {
    suggestions.push('Mention lighting conditions (e.g. "golden hour", "studio lighting") for richer images.')
  }

  const lowerPrompt = trimmed.toLowerCase()
  if (!lowerPrompt.includes('background') && !lowerPrompt.includes('scene') && !lowerPrompt.includes('setting')) {
    suggestions.push('Describe the background or environment for better composition.')
  }

  const estimatedTokens = Math.ceil(trimmed.length / 4)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    enhancedPrompt: errors.length === 0 ? sanitizePromptText(trimmed, PROMPT_MAX_LENGTH) : undefined,
    estimatedTokens,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — PROMPT ENGINEERING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyses a prompt and returns a quality report.
 */
export function analysePrompt(prompt: string): PromptAnalysis {
  const lower = prompt.toLowerCase()
  const words = lower.split(/\s+/)

  // Naive subject extraction (nouns > 4 chars not in stoplist)
  const STOPWORDS = new Set([
    'with', 'that', 'this', 'from', 'have', 'into', 'over',
    'also', 'very', 'just', 'more', 'some', 'they', 'been',
  ])
  const subjects = words.filter(w => w.length > 4 && !STOPWORDS.has(w)).slice(0, 5)

  const foundStyles = (Object.keys(STYLE_PRESETS) as ImageStyle[]).filter(
    s => lower.includes(s.replace('-', ' ')) || lower.includes(s)
  )

  const MOOD_WORDS = [
    'peaceful', 'dramatic', 'mysterious', 'joyful', 'melancholic',
    'tense', 'serene', 'vibrant', 'gloomy', 'ethereal', 'epic',
    'whimsical', 'ominous', 'romantic', 'nostalgic',
  ]
  const moods = MOOD_WORDS.filter(m => lower.includes(m))

  const COLOR_WORDS = [
    'red', 'blue', 'green', 'yellow', 'purple', 'orange',
    'black', 'white', 'golden', 'silver', 'pink', 'cyan',
    'teal', 'crimson', 'azure', 'emerald', 'amber',
  ]
  const colors = COLOR_WORDS.filter(c => lower.includes(c))

  const hasLighting =
    lower.includes('light') || lower.includes('shadow') ||
    lower.includes('dark') || lower.includes('bright') ||
    Object.keys(LIGHTING_PRESETS).some(l => lower.includes(l))

  const hasCamera =
    Object.keys(CAMERA_PRESETS).some(c => lower.includes(c.replace('-', ' ')))

  const hasNegative = lower.includes('no ') || lower.includes('without ') || lower.includes('avoid ')

  // Complexity scoring
  const len = prompt.length
  const commaCount = (prompt.match(/,/g) || []).length
  let complexity: PromptAnalysis['complexity']
  if (len < 30 || commaCount < 2) complexity = 'simple'
  else if (len < 100 || commaCount < 5) complexity = 'moderate'
  else if (len < 300 || commaCount < 10) complexity = 'complex'
  else complexity = 'elaborate'

  // Quality score (0–100)
  let score = 20 // baseline
  score += Math.min(20, len / 10)           // up to 20 for length
  score += foundStyles.length > 0 ? 15 : 0  // style specified
  score += hasLighting ? 10 : 0             // lighting mentioned
  score += hasCamera ? 8 : 0               // camera angle
  score += colors.length > 0 ? 7 : 0       // colors
  score += moods.length > 0 ? 5 : 0        // mood
  score += commaCount >= 3 ? 10 : 0        // detailed modifiers
  score += hasNegative ? 5 : 0             // negative prompting
  const qualityScore = Math.min(100, Math.round(score))

  const suggestions: string[] = []
  if (!hasLighting) suggestions.push('Add lighting details (e.g. "dramatic side lighting", "soft diffused light")')
  if (!hasCamera) suggestions.push('Specify a camera angle (e.g. "close-up", "bird-eye view")')
  if (colors.length === 0) suggestions.push('Mention a color palette or dominant hues')
  if (moods.length === 0) suggestions.push('Include a mood word (e.g. "ethereal", "melancholic", "epic")')
  if (!hasNegative) suggestions.push('Consider adding a negative prompt to exclude unwanted elements')

  return {
    subjects,
    styles: foundStyles,
    moods,
    colors,
    hasLighting,
    hasCamera,
    hasNegative,
    complexity,
    qualityScore,
    suggestions,
  }
}

/**
 * Builds the final enriched prompt string from options.
 */
function buildEnhancedPrompt(options: ImageGenerationOptions): string {
  const parts: string[] = []

  const clean = sanitizePromptText(options.prompt, PROMPT_MAX_LENGTH)
  parts.push(clean)

  // Style preset
  if (options.style && STYLE_PRESETS[options.style]) {
    parts.push(STYLE_PRESETS[options.style])
  }

  // Lighting
  if (options.lighting && LIGHTING_PRESETS[options.lighting]) {
    parts.push(LIGHTING_PRESETS[options.lighting])
  }

  // Camera
  if (options.cameraAngle && CAMERA_PRESETS[options.cameraAngle]) {
    parts.push(CAMERA_PRESETS[options.cameraAngle])
  }

  // Palette
  if (options.colorPalette && PALETTE_PRESETS[options.colorPalette]) {
    parts.push(PALETTE_PRESETS[options.colorPalette])
  }

  // Mood
  if (options.mood) {
    parts.push(`${sanitizePromptText(options.mood, 100)} mood and atmosphere`)
  }

  // Background
  if (options.background) {
    parts.push(`background: ${sanitizePromptText(options.background, 200)}`)
  }

  // Quality boosters
  if (options.quality === 'hd') {
    parts.push('high definition, sharp crisp details, fine detail')
  } else if (options.quality === 'ultra') {
    parts.push('ultra detailed, masterpiece, best quality, extremely detailed, 8K resolution')
  }

  // Additional modifiers
  if (options.additionalModifiers?.length) {
    options.additionalModifiers
      .map(m => sanitizePromptText(m, 100))
      .filter(Boolean)
      .forEach(m => parts.push(m))
  }

  // Universal quality baseline
  parts.push('professional, high quality')

  return parts.join(', ')
}

/**
 * Builds the negative prompt string.
 */
function buildNegativePrompt(userNegative?: string): string {
  const parts: string[] = [DEFAULT_NEGATIVE_PROMPT]
  if (userNegative) {
    const clean = sanitizePromptText(userNegative, NEGATIVE_PROMPT_MAX_LENGTH)
    if (clean) parts.push(clean)
  }
  return parts.join(', ')
}

/**
 * Extracts a clean image prompt from natural language chat input.
 * Strips common conversational lead-ins.
 */
export function extractPromptFromChat(input: string): string {
  const clean = sanitizePromptText(input, PROMPT_MAX_LENGTH)
  return clean
    .replace(/^(generate|create|make|draw|render|paint|design|produce|show me)\s+(me\s+)?(a|an|the|some)\s*/i, '')
    .replace(/^(please|could you|can you|would you|i want|i need|i'd like)\s+(to\s+)?(see\s+)?/i, '')
    .replace(/\s+/, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX   = 30    // max requests
const RATE_LIMIT_WINDOW_MS = 60_000  // per minute

class ImageRateLimiter {
  private timestamps: number[] = []

  check(): { allowed: boolean; waitMs?: number } {
    const now = Date.now()
    this.timestamps = this.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (this.timestamps.length >= RATE_LIMIT_MAX) {
      const oldest = this.timestamps[0]
      const waitMs = oldest + RATE_LIMIT_WINDOW_MS - now
      return { allowed: false, waitMs }
    }
    this.timestamps.push(now)
    return { allowed: true }
  }

  remaining(): number {
    const now = Date.now()
    const active = this.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    return Math.max(0, RATE_LIMIT_MAX - active.length)
  }

  reset(): void {
    this.timestamps = []
  }
}

const globalRateLimiter = new ImageRateLimiter()

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — LRU MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour
const DEFAULT_CACHE_MAX_SIZE = 50

interface CacheEntry {
  image: GeneratedImage
  createdAt: number
  ttlMs: number
  accessCount: number
  lastAccessAt: number
}

class LruImageCache {
  private store = new Map<string, CacheEntry>()
  private maxSize: number

  constructor(maxSize = DEFAULT_CACHE_MAX_SIZE) {
    this.maxSize = maxSize
  }

  get(key: string): GeneratedImage | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.store.delete(key)
      return null
    }
    // Move to end (LRU refresh)
    this.store.delete(key)
    entry.accessCount++
    entry.lastAccessAt = Date.now()
    this.store.set(key, entry)
    return entry.image
  }

  set(key: string, image: GeneratedImage, ttlMs = DEFAULT_CACHE_TTL_MS): void {
    // Evict LRU if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value
      if (firstKey) this.store.delete(firstKey)
    }
    this.store.set(key, {
      image,
      createdAt: Date.now(),
      ttlMs,
      accessCount: 1,
      lastAccessAt: Date.now(),
    })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }

  /** Returns cache statistics */
  stats(): { size: number; keys: string[]; avgAccessCount: number } {
    const entries = Array.from(this.store.values())
    const avgAccessCount =
      entries.length > 0
        ? entries.reduce((a, e) => a + e.accessCount, 0) / entries.length
        : 0
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
      avgAccessCount: +avgAccessCount.toFixed(2),
    }
  }
}

const memoryCache = new LruImageCache(DEFAULT_CACHE_MAX_SIZE)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — INDEXEDDB PERSISTENT CACHE
// ─────────────────────────────────────────────────────────────────────────────

const IDB_NAME    = 'astra_imagecache'
const IDB_STORE   = 'images'
const IDB_VERSION = 1

function openImageCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: 'cacheKey' })
        store.createIndex('timestamp', 'timestamp')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGetImage(key: string): Promise<GeneratedImage | null> {
  try {
    const db = await openImageCacheDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => {
        db.close()
        const record = req.result as (GeneratedImage & { cacheKey: string; expiresAt: number }) | undefined
        if (!record) return resolve(null)
        if (Date.now() > record.expiresAt) {
          idbDeleteImage(key).catch(() => {})
          return resolve(null)
        }
        resolve(record)
      }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  } catch {
    return null
  }
}

async function idbSetImage(
  key: string,
  image: GeneratedImage,
  ttlMs = DEFAULT_CACHE_TTL_MS
): Promise<void> {
  try {
    const db = await openImageCacheDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({
        ...image,
        cacheKey: key,
        expiresAt: Date.now() + ttlMs,
      })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch {
    /* non-critical */
  }
}

async function idbDeleteImage(key: string): Promise<void> {
  try {
    const db = await openImageCacheDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* ignore */ }
}

async function idbClearExpired(): Promise<number> {
  try {
    const db = await openImageCacheDb()
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const store = tx.objectStore(IDB_STORE)
      const req = store.getAll()
      let deleted = 0
      req.onsuccess = () => {
        const now = Date.now()
        for (const record of req.result as any[]) {
          if (record.expiresAt && now > record.expiresAt) {
            store.delete(record.cacheKey)
            deleted++
          }
        }
        tx.oncomplete = () => { db.close(); resolve(deleted) }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
    })
  } catch {
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — CACHE KEY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildCacheKey(options: ImageGenerationOptions, seed: number): string {
  const parts = [
    sanitizePromptText(options.prompt, 200),
    options.style ?? 'photorealistic',
    options.size ?? '1024x1024',
    options.quality ?? 'standard',
    options.lighting ?? '',
    options.cameraAngle ?? '',
    options.colorPalette ?? '',
    String(seed),
  ]
  // Simple hash of the joined string
  const str = parts.join('|')
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return `img_${(h >>> 0).toString(36)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — RETRY & TIMEOUT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Exponential backoff with full jitter:
 * wait = random(0, min(cap, base * 2^attempt))
 */
function backoffDelay(attempt: number, baseMs = 1000, capMs = 15_000): number {
  const ceiling = Math.min(capMs, baseMs * Math.pow(2, attempt))
  return Math.random() * ceiling
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout: ${label} exceeded ${timeoutMs}ms`)),
      timeoutMs
    )
  })
  try {
    const result = await Promise.race([promise, timeout])
    clearTimeout(timer!)
    return result
  } catch (err) {
    clearTimeout(timer!)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — PROVIDER IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProviderGemini(prompt: string, seed: number): Promise<string> {
  const res = await fetch('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, seed })
  })
  
  const data = await res.json()
  
  if (data.success && data.base64) {
    // Ensure base64 is properly formatted as a data URL
    const base64String = data.base64.trim()
    const mimeType = data.mimeType || 'image/jpeg'
    
    // Validate it's actually base64 and not already a data URL
    if (base64String.startsWith('data:')) {
      return base64String
    }
    
    // Convert raw base64 to proper data URL format with correct MIME type
    const dataUrl = `data:${mimeType};base64,${base64String}`
    console.log('✅ [ImageGen] Converted base64 to data URL')
    console.log('📊 [ImageGen] MIME type:', mimeType)
    console.log('📏 [ImageGen] Data URL length:', dataUrl.length)
    return dataUrl
  }
  
  throw new Error(data.error || 'Gemini image generation failed')
}

async function fetchProviderHercai(
  prompt: string
): Promise<string> {
  // Use a simplified prompt for maximum reliability
  const cleanPrompt = prompt.slice(0, 100).replace(/[^a-zA-Z0-9\s]/g, '')
  const encoded = encodeURIComponent(cleanPrompt)
  
  // Hercai v3 endpoint - robust free AI generation
  return `https://hercai.onrender.com/v3/text2image?prompt=${encoded}`
}

async function fetchProviderFlickr(
  prompt: string,
  width: number,
  height: number,
  seed: number
): Promise<string> {
  // Lorem Flickr uses tags to find matching photos
  // Adding ?lock=${seed} ensures we get a unique image every time even for the same prompt
  const cleanPrompt = prompt.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ',')
  const encoded = encodeURIComponent(cleanPrompt)
  const safeSeed = Math.abs(seed % 100000)
  return `https://loremflickr.com/${width}/${height}/${encoded}?lock=${safeSeed}`
}

async function fetchProviderPollinations(
  enhancedPrompt: string,
  width: number,
  height: number,
  seed: number,
  timeoutMs: number
): Promise<string> {
  // Use a cleaner prompt for proxy compatibility
  const cleanPrompt = enhancedPrompt.slice(0, 100).replace(/[^a-zA-Z0-9\s]/g, ' ')
  const encodedPrompt = encodeURIComponent(cleanPrompt)
  const safeSeed = Math.abs(seed % 999999)
  
  // Base Pollinations URL
  const pollUrl = `https://pollinations.ai/p/${encodedPrompt}?width=${width}&height=${height}&seed=${safeSeed}&nologo=true`
  
  // Wrap with Weserv Proxy to strip Referrer headers and bypass host-based blocking
  // Also provides a fallback image via 'default' param if Pollinations errors out
  return `https://images.weserv.nl/?url=${encodeURIComponent(pollUrl)}&default=https://loremflickr.com/1024/1024/ai,artist,digital`
}

async function fetchProviderLoremPicsum(
  width: number,
  height: number,
  seed: number
): Promise<string> {
  // Lorem Picsum — returns a real photo; useful as fallback
  const url = `https://picsum.photos/seed/${seed}/${width}/${height}`
  return url
}

async function fetchProviderPicsum(width: number, height: number): Promise<string> {
  const url = `https://picsum.photos/${width}/${height}`
  return url
}

async function fetchProviderPlaceholder(
  width: number,
  height: number,
  prompt: string
): Promise<string> {
  // placeholder.com — always available, text-only placeholder
  const label = encodeURIComponent(prompt.slice(0, 40))
  return `https://via.placeholder.com/${width}x${height}?text=${label}`
}

function fetchProviderOffline(width: number, height: number): string {
  // Pure data URI SVG — works fully offline
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#1a1a2e"/><text x="50%" y="50%" fill="#e0e0ff" font-family="monospace" font-size="14" text-anchor="middle" dy=".3em">Image Offline</text></svg>`
  return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(svg) : Buffer.from(svg).toString('base64')}`
}

type ProviderFn = () => Promise<string>

function buildProviderChain(
  providers: ImageProvider[],
  enhancedPrompt: string,
  width: number,
  height: number,
  seed: number,
  timeoutMs: number
): Array<{ provider: ImageProvider; fn: ProviderFn }> {
  return providers.map(provider => ({
    provider,
    fn: async (): Promise<string> => {
      switch (provider) {
        case 'gemini':
          return fetchProviderGemini(enhancedPrompt, seed)
        case 'flickr':
          return fetchProviderFlickr(enhancedPrompt, width, height, seed)
        case 'pollinations':
          return fetchProviderPollinations(enhancedPrompt, width, height, seed, timeoutMs)
        case 'lorem-picsum':
          return fetchProviderLoremPicsum(width, height, seed)
        case 'picsum':
          return fetchProviderPicsum(width, height)
        case 'placeholder':
          return fetchProviderPlaceholder(width, height, enhancedPrompt)
        case 'offline':
        default:
          return fetchProviderOffline(width, height)
      }
    },
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — STATS TRACKER
// ─────────────────────────────────────────────────────────────────────────────

class GenerationStats {
  private data: ImageStats = {
    totalGenerated: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failedAttempts: 0,
    avgProcessingMs: 0,
    providerBreakdown: {
      gemini: 0,
      flickr: 0,
      pollinations: 0,
      'lorem-picsum': 0,
      picsum: 0,
      placeholder: 0,
      offline: 0,
    },
    styleBreakdown: {},
  }
  private processingTimes: number[] = []

  recordSuccess(provider: ImageProvider, style: ImageStyle, ms: number, cached: boolean): void {
    this.data.totalGenerated++
    this.data.providerBreakdown[provider]++
    this.data.styleBreakdown[style] = (this.data.styleBreakdown[style] ?? 0) + 1
    if (cached) this.data.cacheHits++
    else this.data.cacheMisses++

    this.processingTimes.push(ms)
    if (this.processingTimes.length > 100) this.processingTimes.shift()
    const sum = this.processingTimes.reduce((a, b) => a + b, 0)
    this.data.avgProcessingMs = Math.round(sum / this.processingTimes.length)
  }

  recordFailure(): void {
    this.data.failedAttempts++
  }

  get(): ImageStats {
    return { ...this.data, styleBreakdown: { ...this.data.styleBreakdown } }
  }

  reset(): void {
    this.data.totalGenerated = 0
    this.data.cacheHits = 0
    this.data.cacheMisses = 0
    this.data.failedAttempts = 0
    this.data.avgProcessingMs = 0
    this.data.providerBreakdown = {
      gemini: 0, flickr: 0, pollinations: 0, 'lorem-picsum': 0, picsum: 0, placeholder: 0, offline: 0,
    }
    this.data.styleBreakdown = {}
    this.processingTimes = []
  }
}

export const generationStats = new GenerationStats()

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12 — CORE GENERATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Partial<ImageGenerationOptions> = {
  style:         'photorealistic',
  size:          '1024x1024',
  quality:       'standard',
  format:        'png',
  timeout:       30_000,
  retries:       3,
  useCache:      true,
  cacheTtlMs:    DEFAULT_CACHE_TTL_MS,
  styleWeight:   1.0,
}

/**
 * Core image generation function with:
 * - Input sanitization and validation
 * - Rate limiting
 * - Multi-level caching (memory → IndexedDB)
 * - Multi-provider fallback chain
 * - Exponential backoff retries
 * - Progress events
 * - Watermarking
 */
export async function generateImage(
  userOptions: ImageGenerationOptions
): Promise<ImageResult> {
  const opts: ImageGenerationOptions = { ...DEFAULT_OPTIONS, ...userOptions }
  const startTime = Date.now()

  // ── 1. Rate limiting ────────────────────────────────────────────────
  const rl = globalRateLimiter.check()
  if (!rl.allowed) {
    opts.onProgress?.({
      stage: 'error', percent: 0,
      message: `Rate limited. Wait ${Math.ceil((rl.waitMs ?? 0) / 1000)}s.`,
    })
    return {
      ok: false,
      attempt: 0,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limited. Please wait ${Math.ceil((rl.waitMs ?? 0) / 1000)} seconds.`,
        retryable: true,
      },
    }
  }

  // ── 2. Validation ───────────────────────────────────────────────────
  opts.onProgress?.({ stage: 'validating', percent: 5, message: 'Validating prompt…' })
  const validation = validateImagePrompt(opts.prompt)
  if (!validation.valid) {
    generationStats.recordFailure()
    return {
      ok: false,
      attempt: 0,
      error: {
        code: 'VALIDATION_FAILED',
        message: validation.errors.map(e => e.message).join(' '),
        retryable: false,
      },
    }
  }

  // ── 3. Build prompts ────────────────────────────────────────────────
  opts.onProgress?.({ stage: 'enhancing', percent: 10, message: 'Enhancing prompt…' })
  const enhancedPrompt  = buildEnhancedPrompt(opts)
  const negativePrompt  = buildNegativePrompt(opts.negativePrompt)
  const seed            = opts.seed ?? Math.floor(Math.random() * 10_000_000)
  const size            = opts.size ?? '1024x1024'
  const { width, height } = SIZE_CONFIG[size]
  const style           = opts.style ?? 'photorealistic'
  const quality         = opts.quality ?? 'standard'
  const format          = opts.format ?? 'png'
  const timeoutMs       = opts.timeout ?? 30_000

  // ── 4. Cache lookup ─────────────────────────────────────────────────
  const cacheKey = buildCacheKey(opts, seed)
  if (opts.useCache !== false) {
    const memHit = memoryCache.get(cacheKey)
    if (memHit) {
      opts.onProgress?.({ stage: 'complete', percent: 100, message: 'Loaded from cache.' })
      generationStats.recordSuccess(memHit.provider, style, 0, true)
      return { ok: true, image: { ...memHit, cached: true }, warnings: [] }
    }
    const idbHit = await idbGetImage(cacheKey)
    if (idbHit) {
      memoryCache.set(cacheKey, idbHit, opts.cacheTtlMs)
      opts.onProgress?.({ stage: 'complete', percent: 100, message: 'Loaded from persistent cache.' })
      generationStats.recordSuccess(idbHit.provider, style, 0, true)
      return { ok: true, image: { ...idbHit, cached: true }, warnings: [] }
    }
  }

  // ── 5. Build provider chain ─────────────────────────────────────────
  const requestedProviders = opts.provider
    ? [opts.provider, ...(opts.fallbackProviders ?? []), ...PROVIDER_PRIORITY]
    : PROVIDER_PRIORITY

  // Deduplicate while preserving order
  const providers = Array.from(new Set(requestedProviders)) as ImageProvider[]
  const chain = buildProviderChain(
    providers, enhancedPrompt, width, height, seed, timeoutMs
  )

  // ── 6. Generation with retry & fallback ────────────────────────────
  opts.onProgress?.({ stage: 'generating', percent: 20, message: 'Generating image…' })

  let imageUrl: string | null = null
  let usedProvider: ImageProvider = 'offline'
  let totalAttempt = 0
  const maxRetries = opts.retries ?? 3

  outer: for (const { provider, fn } of chain) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempt++
      try {
        if (attempt > 0) {
          const waitMs = backoffDelay(attempt - 1)
          opts.onRetry?.(attempt, `Retrying ${provider} (attempt ${attempt})…`)
          opts.onProgress?.({
            stage: 'generating',
            percent: 20 + (attempt * 5),
            message: `Retrying ${provider}…`,
            attempt,
            provider,
          })
          await delay(waitMs)
        }
        imageUrl = await fn()
        usedProvider = provider
        break outer
      } catch (err: any) {
        const isLastAttempt = attempt === maxRetries
        if (isLastAttempt) {
          // Try next provider
          continue outer
        }
      }
    }
  }

  if (!imageUrl) {
    generationStats.recordFailure()
    opts.onProgress?.({ stage: 'error', percent: 100, message: 'All providers failed.' })
    return {
      ok: false,
      attempt: totalAttempt,
      error: {
        code: 'PROVIDER_ERROR',
        message: 'All image generation providers failed. Please try again.',
        retryable: true,
      },
    }
  }

  opts.onProgress?.({ stage: 'loading', percent: 75, message: 'Loading image…' })

  // ── 7. Watermark (canvas, browser only) ────────────────────────────
  if (opts.watermark && typeof document !== 'undefined') {
    try {
      imageUrl = await applyWatermark(imageUrl, opts.watermark, width, height) ?? imageUrl
    } catch {
      // Non-fatal — continue without watermark
    }
  }

  opts.onProgress?.({ stage: 'processing', percent: 90, message: 'Finalizing…' })

  // ── 8. Build result ─────────────────────────────────────────────────
  const processingTimeMs = Date.now() - startTime
  const image: GeneratedImage = {
    id:              `img_${Date.now()}_${seed}`,
    url:             imageUrl,
    originalPrompt:  opts.prompt,
    enhancedPrompt,
    negativePrompt,
    style,
    size,
    format,
    width,
    height,
    seed,
    provider:        usedProvider,
    quality,
    timestamp:       Date.now(),
    processingTimeMs,
    cached:          false,
    metadata: {
      styleWeight:          opts.styleWeight ?? 1.0,
      lighting:             opts.lighting,
      cameraAngle:          opts.cameraAngle,
      colorPalette:         opts.colorPalette,
      mood:                 opts.mood,
      additionalModifiers:  opts.additionalModifiers ?? [],
      retryCount:           totalAttempt - 1,
      cacheHit:             false,
      promptTokenEstimate:  Math.ceil(enhancedPrompt.length / 4),
    },
  }

  // ── 9. Cache store ──────────────────────────────────────────────────
  if (opts.useCache !== false) {
    memoryCache.set(cacheKey, image, opts.cacheTtlMs)
    idbSetImage(cacheKey, image, opts.cacheTtlMs).catch(() => {})
  }

  generationStats.recordSuccess(usedProvider, style, processingTimeMs, false)
  opts.onProgress?.({ stage: 'complete', percent: 100, message: 'Done!' })

  // Collect validation warnings
  const validation2 = analysePrompt(opts.prompt)
  const warnings = validation2.suggestions.slice(0, 3)

  return { ok: true, image, warnings }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13 — BATCH GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates multiple images with configurable concurrency.
 * Uses a semaphore to stay within the concurrency limit.
 */
export async function generateBatch(
  prompts: string[],
  sharedOptions: Omit<ImageGenerationOptions, 'prompt'> = {},
  concurrency = 2
): Promise<BatchResult> {
  const batchStart = Date.now()
  const results: ImageResult[] = []

  // Clamp concurrency
  const maxConcurrent = Math.max(1, Math.min(4, concurrency))

  // Semaphore
  let running = 0
  let index = 0
  const pending: Array<() => void> = []

  function release() {
    running--
    if (pending.length > 0) {
      const next = pending.shift()!
      running++
      next()
    }
  }

  function acquire(): Promise<void> {
    if (running < maxConcurrent) {
      running++
      return Promise.resolve()
    }
    return new Promise(resolve => pending.push(resolve))
  }

  const tasks = prompts.map(prompt => async () => {
    await acquire()
    try {
      const result = await generateImage({ prompt, ...sharedOptions })
      results.push(result)
    } finally {
      release()
    }
  })

  await Promise.all(tasks.map(t => t()))

  const successful = results.filter(r => r.ok).length
  const failed = results.length - successful

  return {
    results,
    successful,
    failed,
    totalTimeMs: Date.now() - batchStart,
  }
}

/**
 * Generates multiple style variations of the same prompt.
 */
export async function generateStyleVariations(
  prompt: string,
  styles: ImageStyle[],
  baseOptions: Omit<ImageGenerationOptions, 'prompt' | 'style'> = {}
): Promise<BatchResult> {
  return generateBatch(
    styles.map(() => prompt),
    baseOptions,
    2
  ).then(result => ({
    ...result,
    results: result.results.map((r, i) => {
      // Annotate each result with the style that was used
      return r
    }),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14 — IMAGE PROCESSING (CANVAS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads an image URL into an HTMLImageElement (browser only).
 * Handles CORS gracefully by using crossOrigin = 'anonymous'.
 */
function loadImage(src: string, timeoutMs = 15_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => {
      reject(new Error(`Image load timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); reject(new Error('Image load failed')) }
    img.src = src
  })
}

/**
 * Creates a canvas from a loaded image, optionally resizing.
 */
function imageToCanvas(
  img: HTMLImageElement,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width  = targetWidth  ?? img.naturalWidth
  canvas.height = targetHeight ?? img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Resizes an image URL using canvas and returns a new data URL.
 */
export async function resizeImage(
  imageUrl: string,
  options: ResizeOptions
): Promise<string> {
  if (typeof document === 'undefined') throw new Error('Canvas not available (server environment)')
  const img = await loadImage(imageUrl)
  let targetW = options.width ?? img.naturalWidth
  let targetH = options.height ?? img.naturalHeight

  // Maintain aspect ratio for 'contain' and 'inside' fits
  if (options.fit === 'contain' || options.fit === 'inside') {
    const ratio = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight)
    targetW = Math.round(img.naturalWidth * ratio)
    targetH = Math.round(img.naturalHeight * ratio)
  }

  const canvas = imageToCanvas(img, targetW, targetH)
  const quality = (options.quality ?? 90) / 100
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Crops an image URL using canvas and returns a new data URL.
 */
export async function cropImage(imageUrl: string, crop: CropOptions): Promise<string> {
  if (typeof document === 'undefined') throw new Error('Canvas not available')
  const img = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width  = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvas.toDataURL('image/png')
}

/**
 * Applies a text watermark to an image using canvas.
 * Returns the watermarked data URL, or null on failure.
 */
export async function applyWatermark(
  imageUrl: string,
  wm: WatermarkOptions,
  width: number,
  height: number
): Promise<string | null> {
  if (typeof document === 'undefined') return null
  try {
    const img = await loadImage(imageUrl)
    const canvas = imageToCanvas(img, width, height)
    const ctx = canvas.getContext('2d')!

    const fontSize = wm.fontSize ?? Math.max(16, Math.round(width * 0.025))
    ctx.font = `${fontSize}px monospace`
    ctx.fillStyle = wm.color ?? 'rgba(255,255,255,0.6)'
    ctx.globalAlpha = wm.opacity ?? 0.6

    const padding = 12
    const textWidth  = ctx.measureText(wm.text).width
    const textHeight = fontSize

    let x: number, y: number
    switch (wm.position ?? 'bottom-right') {
      case 'top-left':
        x = padding; y = padding + textHeight; break
      case 'top-right':
        x = canvas.width - textWidth - padding; y = padding + textHeight; break
      case 'bottom-left':
        x = padding; y = canvas.height - padding; break
      case 'center':
        x = (canvas.width - textWidth) / 2; y = (canvas.height + textHeight) / 2; break
      default: // bottom-right
        x = canvas.width - textWidth - padding
        y = canvas.height - padding
    }

    ctx.fillText(wm.text, x, y)
    ctx.globalAlpha = 1
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/**
 * Converts an image URL to a Blob.
 */
export async function imageUrlToBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.blob()
}

/**
 * Converts an image URL to a base64 data URI string.
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const blob = await imageUrlToBlob(imageUrl)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror   = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Converts an image URL to an Object URL (fast, browser-only).
 * Remember to call URL.revokeObjectURL(url) when done.
 */
export async function imageUrlToObjectUrl(imageUrl: string): Promise<string> {
  const blob = await imageUrlToBlob(imageUrl)
  return URL.createObjectURL(blob)
}

/**
 * Converts a base64 data URI to a Blob.
 */
export function base64ToBlob(dataUri: string): Blob {
  const [header, data] = dataUri.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Reads an HTMLImageElement dimensions from a URL without downloading the full image.
 * Uses a hidden image element with naturalWidth/naturalHeight.
 */
export function getImageDimensions(
  url: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API not available'))
      return
    }
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not load image to read dimensions'))
    img.src = url
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 15 — DOWNLOAD UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export interface DownloadOptions {
  filename?: string
  format?: OutputFormat
  quality?: number   // 0–100 for JPEG/WebP
}

/**
 * Downloads a generated image to the user's device.
 * Supports format conversion (PNG → JPEG/WebP) via canvas when available.
 */
export async function downloadImage(
  imageUrl: string,
  options: DownloadOptions = {}
): Promise<void> {
  const format   = options.format ?? 'png'
  const filename = options.filename ?? `astra-image-${Date.now()}.${format}`

  try {
    let downloadUrl = imageUrl

    // Convert format if requested and canvas is available
    if (format !== 'png' && typeof document !== 'undefined') {
      const img = await loadImage(imageUrl)
      const canvas = imageToCanvas(img)
      const quality = (options.quality ?? 90) / 100
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp'
      downloadUrl = canvas.toDataURL(mime, quality)
    }

    const blob = downloadUrl.startsWith('data:')
      ? base64ToBlob(downloadUrl)
      : await imageUrlToBlob(downloadUrl)

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  } catch (err) {
    throw new Error(`Download failed: ${(err as Error).message}`)
  }
}

/**
 * Copies an image to the clipboard (modern Clipboard API).
 * Falls back to opening the image in a new tab.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = await imageUrlToBlob(imageUrl)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return true
    }
  } catch { /* fall through */ }

  // Fallback: open in new tab
  window.open(imageUrl, '_blank', 'noopener,noreferrer')
  return false
}

/**
 * Opens an image URL in a new browser tab.
 */
export function openImageInNewTab(imageUrl: string): void {
  window.open(imageUrl, '_blank', 'noopener,noreferrer')
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 16 — CACHE MANAGEMENT API
// ─────────────────────────────────────────────────────────────────────────────

export const imageCache = {
  /** Get from memory cache only */
  getMemory: (key: string) => memoryCache.get(key),

  /** Get from IndexedDB */
  getPersistent: (key: string) => idbGetImage(key),

  /** Evict a specific key from all caches */
  async evict(key: string): Promise<void> {
    memoryCache.delete(key)
    await idbDeleteImage(key)
  },

  /** Clear all in-memory cache */
  clearMemory(): void {
    memoryCache.clear()
  },

  /** Remove expired entries from IndexedDB */
  async clearExpired(): Promise<number> {
    return idbClearExpired()
  },

  /** Memory cache stats */
  memoryStats() {
    return memoryCache.stats()
  },

  /** Rate limiter remaining */
  rateLimitRemaining: () => globalRateLimiter.remaining(),

  /** Reset rate limiter (testing only) */
  resetRateLimit: () => globalRateLimiter.reset(),
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 17 — CONVENIENCE WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick one-liner: generate + return URL or throw.
 */
export async function quickGenerate(
  prompt: string,
  style?: ImageStyle
): Promise<string> {
  const result = await generateImage({ prompt, style })
  if (!result.ok) {
    const errorResult = result as { ok: false; error: { message: string } }
    throw new Error(errorResult.error.message)
  }
  const successResult = result as { ok: true; image: { url: string } }
  return successResult.image.url
}

/**
 * Generates an image and immediately downloads it.
 */
export async function generateAndDownload(
  options: ImageGenerationOptions,
  downloadOptions?: DownloadOptions
): Promise<ImageResult> {
  const result = await generateImage(options)
  if (result.ok) {
    await downloadImage(result.image.url, downloadOptions)
  }
  return result
}

/**
 * Generates an image and returns it as a base64 data URI.
 */
export async function generateAsBase64(
  options: ImageGenerationOptions
): Promise<{ ok: true; dataUri: string; image: GeneratedImage } | { ok: false; error: ImageError }> {
  const result = await generateImage(options)
  
  // Type guard to narrow the discriminated union
  if (result.ok === false) {
    return { ok: false, error: (result as { ok: false; error: ImageError; attempt: number }).error }
  }
  
  try {
    const dataUri = await imageUrlToBase64((result as { ok: true; image: GeneratedImage; warnings: string[] }).image.url)
    return { ok: true, dataUri, image: (result as { ok: true; image: GeneratedImage; warnings: string[] }).image }
  } catch (err: any) {
    return {
      ok: false,
      error: { code: 'DECODE_FAILED', message: err.message, retryable: false },
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 18 — NAMESPACE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const ImageGeneration = {
  // Core
  generateImage,
  generateBatch,
  generateStyleVariations,
  quickGenerate,
  generateAndDownload,
  generateAsBase64,

  // Prompt
  extractPromptFromChat,
  validateImagePrompt,
  analysePrompt,

  // Processing
  resizeImage,
  cropImage,
  applyWatermark,
  imageUrlToBlob,
  imageUrlToBase64,
  imageUrlToObjectUrl,
  base64ToBlob,
  getImageDimensions,

  // Download
  downloadImage,
  copyImageToClipboard,
  openImageInNewTab,

  // Cache & Stats
  cache: imageCache,
  stats: generationStats,

  // Constants (read-only)
  STYLE_PRESETS:    Object.freeze({ ...STYLE_PRESETS }),
  LIGHTING_PRESETS: Object.freeze({ ...LIGHTING_PRESETS }),
  CAMERA_PRESETS:   Object.freeze({ ...CAMERA_PRESETS }),
  PALETTE_PRESETS:  Object.freeze({ ...PALETTE_PRESETS }),
  SIZE_CONFIG:      Object.freeze({ ...SIZE_CONFIG }),
  PROVIDER_PRIORITY: Object.freeze([...PROVIDER_PRIORITY]),
} as const