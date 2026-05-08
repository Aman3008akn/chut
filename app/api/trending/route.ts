import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// Cache trending topics for 1 hour
let cachedTopics: any[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Return cached if fresh
    if (cachedTopics && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({ topics: cachedTopics, cached: true })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ topics: getFallbackTopics(), cached: false })
    }

    const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest"]
    let lastError: any = null

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          tools: [{ googleSearch: {} } as any],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })

        const prompt = `You are a trending topics assistant. Search Google for what's trending RIGHT NOW globally and in India.

Return EXACTLY 6 trending topics in this JSON format (and NOTHING else - no markdown, no code blocks, just pure JSON):
[
  {"label": "short topic description (max 6 words)", "icon": "relevant emoji", "category": "tech|world|sports|entertainment|science|business"},
  ...
]

Rules:
- Topics must be from TODAY's actual trending news/events
- Mix categories: include tech, world news, sports, entertainment, science
- Labels should be engaging and curiosity-provoking
- Use creative, relevant emojis
- Keep labels under 40 characters
- Make them questions or action phrases when possible (e.g., "Why is X trending?" or "Explain the Y controversy")`

        const result = await model.generateContent(prompt)
        const text = result.response.text().trim()
        
        // Parse JSON from response (handle potential markdown wrapping)
        let jsonStr = text
        if (text.includes('```')) {
          jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        }
        
        const topics = JSON.parse(jsonStr)
        
        if (Array.isArray(topics) && topics.length > 0) {
          cachedTopics = topics.slice(0, 6)
          cacheTimestamp = Date.now()
          return NextResponse.json({ topics: cachedTopics, cached: false })
        }
      } catch (modelErr: any) {
        console.warn(`Trending: ${modelName} failed:`, modelErr.message)
        lastError = modelErr
        
        // If we hit rate limit, don't try other models as they share quota
        if (modelErr.message?.includes('429')) {
          break
        }
        continue
      }
    }

    // Fallback if all models fail
    console.error('All models failed for trending:', lastError?.message)
    return NextResponse.json({ topics: getFallbackTopics(), cached: false })
  } catch (error: any) {
    console.error('Trending API error:', error)
    return NextResponse.json({ topics: getFallbackTopics(), cached: false })
  }
}

function getFallbackTopics() {
  // Rotate through different sets based on day
  const day = new Date().getDay()
  const sets = [
    [
      { label: "Latest AI breakthroughs in 2026", icon: "🤖", category: "tech" },
      { label: "Top trending news today", icon: "📰", category: "world" },
      { label: "Upcoming movie releases", icon: "🎬", category: "entertainment" },
      { label: "Stock market highlights today", icon: "📈", category: "business" },
      { label: "Latest space discoveries", icon: "🚀", category: "science" },
      { label: "Today's cricket/football scores", icon: "🏏", category: "sports" },
    ],
    [
      { label: "What's new in tech this week?", icon: "💻", category: "tech" },
      { label: "Global politics update", icon: "🌍", category: "world" },
      { label: "Trending songs right now", icon: "🎵", category: "entertainment" },
      { label: "Crypto market today", icon: "₿", category: "business" },
      { label: "Climate change latest news", icon: "🌡️", category: "science" },
      { label: "IPL/Premier League updates", icon: "⚽", category: "sports" },
    ],
    [
      { label: "New iPhone/Android features", icon: "📱", category: "tech" },
      { label: "Breaking world news today", icon: "🔴", category: "world" },
      { label: "Top Netflix/OTT releases", icon: "🍿", category: "entertainment" },
      { label: "Startup funding news today", icon: "💰", category: "business" },
      { label: "Medical breakthroughs 2026", icon: "🧬", category: "science" },
      { label: "Olympics/World Cup updates", icon: "🏆", category: "sports" },
    ],
  ]
  return sets[day % sets.length]
}
