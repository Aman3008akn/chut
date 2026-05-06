import { GoogleGenerativeAI } from "@google/generative-ai"

/**
 * Memory extraction utilities for Nexus AI
 * Detects personal information from user messages and manages memory storage
 */

export interface Memory {
  _id?: string
  userId: string           // user email or session id
  key: string              // e.g. "name", "location", "favorite_language"
  value: string            // e.g. "Aman", "Delhi", "Python"
  category: MemoryCategory
  source: string           // the original message that triggered this memory
  confidence: number       // 0-1 how confident we are
  createdAt: number
  updatedAt: number
}

export type MemoryCategory =
  | 'identity'      // name, age, gender
  | 'location'      // city, country
  | 'preferences'   // likes, dislikes, favorites
  | 'professional'  // job, company, skills
  | 'personal'      // hobbies, family, pets
  | 'education'     // school, college, degree
  | 'emotional'     // mood, feelings, mental state
  | 'physical'      // health, energy, physical state
  | 'other'

export interface ExtractedMemory {
  key: string
  value: string
  category: MemoryCategory
  confidence: number
}

/**
 * Pattern-based memory extraction from user messages.
 * Fast, runs client-side or server-side without AI calls.
 */
const MEMORY_PATTERNS: {
  pattern: RegExp
  key: string
  category: MemoryCategory
  valueGroup: number
  confidence: number
}[] = [
  // Name patterns (Hindi + English)
  {
    pattern: /(?:my name is|i'?m|i am|mera naam|mera name|naam hai|name hai|call me|everyone calls me)\s+([a-z]{2,}(?:\s+[a-z]{2,})?)/i,
    key: 'name',
    category: 'identity',
    valueGroup: 1,
    confidence: 0.95,
  },
  {
    pattern: /(?:mai|main|mein)\s+([a-z]{2,})\s+(?:hu|hoon|hun|hü)/i,
    key: 'name',
    category: 'identity',
    valueGroup: 1,
    confidence: 0.85,
  },
  // Age patterns
  {
    pattern: /(?:i'?m|i am|my age is|meri age|meri umar|age hai)\s+(\d{1,3})\s*(?:years?\s*old|saal|sal|yr)?/i,
    key: 'age',
    category: 'identity',
    valueGroup: 1,
    confidence: 0.9,
  },
  // Location patterns
  {
    pattern: /(?:i live in|i'?m from|i am from|mai|main|mein)\s+(?:from\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:se|ka|ki|ke|mein|mei|me|from|city|state)/i,
    key: 'location',
    category: 'location',
    valueGroup: 1,
    confidence: 0.8,
  },
  {
    pattern: /(?:i live in|i'?m from|i am from|mera ghar|rehta|rehti)\s+([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)/i,
    key: 'location',
    category: 'location',
    valueGroup: 1,
    confidence: 0.85,
  },
  // Job/Profession patterns
  {
    pattern: /(?:i work as|i'?m a|i am a|i am an|my job is|my profession is|mai ek)\s+(.+?)(?:\.|,|$|\s+(?:at|in|for|and))/i,
    key: 'profession',
    category: 'professional',
    valueGroup: 1,
    confidence: 0.85,
  },
  {
    pattern: /(?:i work at|i work for|kaam karta|kaam karti)\s+(.+?)(?:\.|,|$)/i,
    key: 'company',
    category: 'professional',
    valueGroup: 1,
    confidence: 0.85,
  },
  // Education patterns
  {
    pattern: /(?:i study|i'm studying|studying|padh raha|padh rahi)\s+(.+?)(?:\s+at|\s+in|\s+from|\.|,|$)/i,
    key: 'studying',
    category: 'education',
    valueGroup: 1,
    confidence: 0.8,
  },
  {
    pattern: /(?:i study at|i go to|my college|my school|my university)\s+(.+?)(?:\.|,|$)/i,
    key: 'institution',
    category: 'education',
    valueGroup: 1,
    confidence: 0.85,
  },
  // Emotional State (Feelings)
  {
    pattern: /(?:i'?m feeling|i feel|i am|mai|main|mein)\s+(happy|sad|angry|anxious|stressed|excited|bored|lonely|tired|depressed|great|good|fine|awesome|low|upset)\s*(?:today|now|right now|currently)?/i,
    key: 'current_mood',
    category: 'emotional',
    valueGroup: 1,
    confidence: 0.8,
  },
  {
    pattern: /(?:mujhe|muje)\s+(gussa|dukh|khushi|pyar|dar)\s+(aa raha|lag raha|ho raha)/i,
    key: 'feeling',
    category: 'emotional',
    valueGroup: 1,
    confidence: 0.75,
  },
  // Physical State (Health/Energy)
  {
    pattern: /(?:i'?m|i am|mai|main|mein)\s+(tired|exhausted|sleepy|hungry|full|sick|ill|unwell|energetic|productive|lazy|injured)\s*(?:today|now|right now|currently)?/i,
    key: 'physical_state',
    category: 'physical',
    valueGroup: 1,
    confidence: 0.8,
  },
  {
    pattern: /(?:i have a|i've got|mere)\s+(headache|fever|cold|stomach ache|pain in my \w+|cough|sore throat)/i,
    key: 'health_issue',
    category: 'physical',
    valueGroup: 1,
    confidence: 0.85,
  },
  // Favorites/Preferences
  {
    pattern: /(?:my favorite|my fav|mera favourite|mera fav)\s+(\w+)\s+(?:is|hai|h)\s+(.+?)(?:\.|,|$)/i,
    key: 'favorite_$1',
    category: 'preferences',
    valueGroup: 2,
    confidence: 0.85,
  },
  {
    pattern: /(?:i love|i like|mujhe pasand|mujhe acha lagta)\s+(.+?)(?:\.|,|$|\s+(?:a lot|so much|bahut))/i,
    key: 'likes',
    category: 'preferences',
    valueGroup: 1,
    confidence: 0.7,
  },
  // Programming language preference
  {
    pattern: /(?:i use|i code in|i program in|i know|my language is)\s+(python|javascript|typescript|java|c\+\+|rust|go|ruby|php|swift|kotlin|c#|dart)/i,
    key: 'programming_language',
    category: 'professional',
    valueGroup: 1,
    confidence: 0.8,
  },
]

/**
 * Extract memories from a user message using pattern matching.
 */
export function extractMemoriesFromText(text: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = []

  for (const { pattern, key, category, valueGroup, confidence } of MEMORY_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[valueGroup]) {
      let extractedKey = key
      // Handle dynamic keys like "favorite_$1"
      if (key.includes('$1') && match[1]) {
        extractedKey = key.replace('$1', match[1].toLowerCase())
      }

      const value = match[valueGroup].trim()
      // Skip very short or very long values
      if (value.length < 2 || value.length > 100) continue
      // Skip if value looks like a common word (not a proper noun for names)
      if (extractedKey === 'name' && /^(the|a|an|is|am|are|i|you|he|she|it|we|they)$/i.test(value)) continue

      memories.push({
        key: extractedKey,
        value,
        category,
        confidence,
      })
    }
  }

  return memories
}

/**
 * AI-based memory extraction from user messages.
 * Uses an LLM to identify important facts that should be remembered.
 */
export async function extractMemoriesWithAI(
  text: string, 
  history: any[], 
  apiKey: string
): Promise<ExtractedMemory[]> {
  try {
    if (!apiKey) return []
    
    // Use the cheaper/faster model for extraction
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    const prompt = `
    You are a memory extraction assistant. Your task is to identify important personal information, preferences, or states that a user shares in a conversation.
    
    User Message: "${text}"
    
    Categories: identity, location, preferences, professional, personal, education, emotional, physical, other.
    
    Rules:
    1. Extract facts that should be remembered to personalize future conversations.
    2. Format the response ONLY as a JSON array of objects: [{"key": "string", "value": "string", "category": "category", "confidence": 0-1}]
    3. If nothing important is found, return an empty array [].
    4. Keep keys short and semantic (e.g., "name", "favorite_color", "current_mood").
    5. ONLY return the JSON array, no other text.
    `
    
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()
    
    // Parse JSON
    let jsonStr = responseText
    if (responseText.includes('```')) {
      jsonStr = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }
    
    const extracted = JSON.parse(jsonStr)
    if (Array.isArray(extracted)) {
      return extracted.map(m => ({
        key: m.key,
        value: String(m.value),
        category: (m.category || 'other') as MemoryCategory,
        confidence: m.confidence || 0.8
      }))
    }
    
    return []
  } catch (error) {
    console.error('AI Memory Extraction Error:', error)
    return []
  }
}

/**
 * Format memories into a string for injection into the system prompt.
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (!memories.length) return ''
  
  const grouped: Record<string, Memory[]> = {}
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(m)
  }

  let prompt = '\n\nUSER MEMORIES (Information the user has previously shared with you - use this to personalize responses):\n'

  const categoryLabels: Record<MemoryCategory, string> = {
    identity: '👤 Identity',
    location: '📍 Location',
    preferences: '❤️ Preferences',
    professional: '💼 Professional',
    personal: '🏠 Personal',
    education: '🎓 Education',
    emotional: '🧠 Emotional State',
    physical: '💪 Physical State',
    other: '📝 Other',
  }

  for (const [cat, mems] of Object.entries(grouped)) {
    const label = categoryLabels[cat as MemoryCategory] || cat
    prompt += `${label}:\n`
    for (const m of mems) {
      prompt += `  - ${m.key}: ${m.value}\n`
    }
  }

  prompt += '\nIMPORTANT: Use these memories naturally in conversation. Address the user by name if you know it. If the user mentions they are tired, sick, sad, or happy, SHOW EMPATHY and adjust your tone accordingly. Do NOT explicitly say "I remember that..." unless asked. Just use the information naturally to provide a more personalized, human-like experience.\n'

  return prompt
}
