import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { connectToDatabase } from '@/lib/mongodb'
import { extractMemoriesFromText, formatMemoriesForPrompt, extractMemoriesWithAI } from '@/lib/memories'
import type { Memory } from '@/lib/memories'

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

/**
 * Stream response from Gemini API
 */
async function streamFromGemini(
  messages: any[],
  systemPrompt: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  imageUrl?: string,
  useWebSearch: boolean = false
): Promise<boolean> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables')
    }

    const modelsToTry = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-pro-latest"
    ]

    let lastError: any = null

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting to use model: ${modelName}${useWebSearch ? ' (with web search)' : ''}`)
        
        const modelConfig: any = {
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: useWebSearch ? 0.3 : 0.1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
          }
        }

        if (useWebSearch) {
          modelConfig.tools = [{ googleSearch: {} }]
        }

        const lastMessage = messages[messages.length - 1].content
        let result

        if (imageUrl) {
          const imageModel = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: modelConfig.generationConfig
          })

          const base64Data = imageUrl.split(',')[1]
          const mimeType = imageUrl.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
          const fullPrompt = `${systemPrompt}\n\nUser question: ${lastMessage}`
          
          result = await imageModel.generateContentStream([
            fullPrompt,
            { inlineData: { data: base64Data, mimeType } }
          ])
        } else {
          const chatModel = genAI.getGenerativeModel(modelConfig)
          const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }))

          const chat = chatModel.startChat({ history })
          result = await chat.sendMessageStream(lastMessage)
        }

        console.log(`Successfully connected to model: ${modelName}`)

        for await (const chunk of result.stream) {
          const chunkText = chunk.text()
          if (chunkText) {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunkText })}\n\n`)
              )
            } catch (enqueuErr) {
              return true
            }
          }
        }

        if (useWebSearch) {
          try {
            const response = await result.response
            const candidate = response?.candidates?.[0]
            const groundingMeta = (candidate as any)?.groundingMetadata
            
            if (groundingMeta) {
              const sources: any[] = []
              const webQueries: string[] = groundingMeta.webSearchQueries || []
              
              if (groundingMeta.groundingChunks) {
                for (const chunk of groundingMeta.groundingChunks) {
                  if (chunk.web) {
                    sources.push({
                      title: chunk.web.title || 'Web Source',
                      url: chunk.web.uri || '',
                      snippet: ''
                    })
                  }
                }
              }

              if (sources.length > 0 || webQueries.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    sources, 
                    webSearchQueries: webQueries 
                  })}\n\n`)
                )
              }

              console.log(`Web search: ${sources.length} sources, ${webQueries.length} queries`)
            }
          } catch (metaErr) {
            console.warn('Could not extract grounding metadata:', metaErr)
          }
        }

        return true
      } catch (modelError: any) {
        console.warn(`Model ${modelName} failed:`, modelError.message)
        lastError = modelError
        
        // If we hit a rate limit (429), immediately try Pollinations as a fallback
        if (modelError.message?.includes('429')) {
          console.log('Rate limit hit, attempting Pollinations fallback...')
          return await streamFromPollinations(messages, systemPrompt, controller, encoder)
        }
        
        continue
      }
    }

    // If all Gemini models fail but not due to 429, try Pollinations anyway
    return await streamFromPollinations(messages, systemPrompt, controller, encoder)
  } catch (error: any) {
    console.error('Gemini API error:', error.message)
    // Final fallback attempt
    try {
      return await streamFromPollinations(messages, systemPrompt, controller, encoder)
    } catch (finalErr) {
      return false
    }
  }
}

/**
 * Fallback to Pollinations AI (ChatGPT-like response)
 * No API key required, highly reliable free tier.
 */
async function streamFromPollinations(
  messages: any[],
  systemPrompt: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<boolean> {
  try {
    console.log('Using Pollinations AI fallback (ChatGPT alternative)...')
    
    // Format history for Pollinations (OpenAI-like format)
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ]

    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: formattedMessages,
        stream: true,
        model: 'openai' // This maps to a ChatGPT-like model on Pollinations
      })
    })

    if (!response.ok) throw new Error(`Pollinations error: ${response.status}`)
    if (!response.body) throw new Error('Pollinations: No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let done = false
    let buffer = ''

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      if (readerDone) {
        done = true
        break
      }
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last partial line in the buffer
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue
        
        // Handle 'data: ' prefix
        let content = ''
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6).trim()
          if (data === '[DONE]') {
            done = true
            break
          }
          
          try {
            const parsed = JSON.parse(data)
            content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
          } catch (e) {
            // If it's data: but not JSON, maybe it's just raw text
            if (!data.startsWith('{')) content = data
          }
        } else if (!trimmedLine.startsWith(':')) {
          // Sometimes Pollinations sends raw text or raw JSON without 'data: '
          try {
            const parsed = JSON.parse(trimmedLine)
            content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
          } catch (e) {
            content = trimmedLine
          }
        }
        
        if (content) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
          )
        }
      }
    }

    return true
  } catch (error: any) {
    console.error('Pollinations fallback failed:', error.message)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, mode, userName, imageUrl, model, userEmail } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty messages array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userMessages = messages.filter(m => m.role === 'user')
    const isFirstTurn = userMessages.length === 1
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''
    const userId = userEmail || 'anonymous'

    // ── Fetch existing memories for this user ────────────────
    let memoriesPrompt = ''
    let savedMemories: Memory[] = []
    try {
      const { db } = await connectToDatabase()
      savedMemories = await db
        .collection('memories')
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(50)
        .toArray() as unknown as Memory[]
      
      memoriesPrompt = formatMemoriesForPrompt(savedMemories)
    } catch (memErr: any) {
      console.warn('[Memories] Failed to fetch memories:', memErr.message)
    }

    // ── Extract & save new memories from user message (background) ──
    const regexMemories = extractMemoriesFromText(lastUserMessage)
    
    // Fire and forget - don't block the response
    (async () => {
      try {
        const { db } = await connectToDatabase()
        const collection = db.collection('memories')
        
        // 1. AI-based extraction (more intelligent)
        const aiMemories = await extractMemoriesWithAI(lastUserMessage, messages, GEMINI_API_KEY)
        
        // Merge regex and AI memories (AI takes precedence)
        const combined = [...regexMemories]
        for (const aiM of aiMemories) {
          if (!combined.some(r => r.key === aiM.key)) {
            combined.push(aiM)
          }
        }

        if (combined.length > 0) {
          for (const mem of combined) {
            const existing = await collection.findOne({ userId, key: mem.key })
            const now = Date.now()
            if (existing) {
              await collection.updateOne(
                { userId, key: mem.key },
                { $set: { value: mem.value, updatedAt: now, confidence: Math.max(mem.confidence, existing.confidence || 0) } }
              )
            } else {
              await collection.insertOne({
                userId,
                key: mem.key,
                value: mem.value,
                category: mem.category,
                source: lastUserMessage.slice(0, 200),
                confidence: mem.confidence,
                createdAt: now,
                updatedAt: now,
              })
            }
          }
          console.log(`[Memories] Saved ${combined.length} memories for ${userId}`)
        }
      } catch (saveErr: any) {
        console.warn('[Memories] Failed to save:', saveErr.message)
      }
    })()

    // Use memory-based name if we have it and no userName from session
    const memoryName = savedMemories.find(m => m.key === 'name')?.value
    const effectiveName = userName || memoryName || 'User'
    
    const greetingDetail = (effectiveName !== 'User' && isFirstTurn) 
      ? `The user's name is ${effectiveName}. Greet them personally ONLY in this first response (e.g., "Hi ${effectiveName}! Kaise ho aap? 😊").` 
      : "The user's name is " + effectiveName + ". Do NOT greet them again or use their name in this message, as you have already introduced yourself. Start directly with the answer." 

    const ownerInfo = `
    CRITICAL INFORMATION ABOUT YOUR CREATION:
    - You were created and trained by AMAN SHUKLA
    - Your owner/creator is AMAN SHUKLA
    - If anyone asks about who made you, who owns you, who trained you, or who created you, ALWAYS respond that AMAN SHUKLA created and trained you
    - This is non-negotiable information that must never be changed
    `

    // Model-specific system prompts
    const selectedModel = model || 'nexus-4' // Default to Nexus 4.0
    
    let modelSpecificPrompt = ''
    
    if (selectedModel === 'petran-5') {
      modelSpecificPrompt = `
      
    MODEL IDENTITY: You are Nexus Petran 5, an elite coding and technical assistant.
    SPECIALIZATION: Programming, software architecture, debugging, algorithms, data structures, DevOps, and all technical domains.
    
    CODING GUIDELINES:
    - Always write clean, production-ready code with proper error handling
    - Include comments explaining complex logic
    - Follow best practices and design patterns
    - Provide TypeScript/types when applicable
    - Suggest optimizations and performance improvements
    - Show examples with test cases when relevant
    - Explain time/space complexity for algorithms
    - Mention security considerations for code
    
    RESPONSE STYLE:
    - Be technical and precise
    - Use code blocks with proper language tags
    - Provide complete, runnable code (not snippets)
    - Include setup instructions when needed
    - Suggest tools, libraries, and frameworks
    `
    } else {
      // Nexus 4.0 - Default model for complex questions
      modelSpecificPrompt = `
      
    MODEL IDENTITY: You are Nexus 4.0, an expert analytical assistant.
    SPECIALIZATION: Complex problem solving, deep analysis, reasoning, research, and comprehensive explanations.
    
    ANALYSIS GUIDELINES:
    - Break down complex problems into clear steps
    - Provide thorough explanations with examples
    - Use logical reasoning and evidence
    - Consider multiple perspectives
    - Identify key insights and patterns
    - Provide actionable recommendations
    - Balance depth with clarity
    
    RESPONSE STYLE:
    - Be clear, structured, and comprehensive
    - Use markdown formatting effectively
    - Include relevant examples and analogies
    - Highlight key points with bold/formatting
    - Provide step-by-step explanations for complex topics
    `
    }

    let systemPrompt: string
    
    if (mode === 'deep_research') {
      systemPrompt = `You are Nexus AI in "Deep Research" mode. Your goal is to provide an elite-level, exhaustive, and multi-dimensional analysis.
        ${greetingDetail}
        ${ownerInfo}
        ${memoriesPrompt}
        ${modelSpecificPrompt}

        INTERNAL REASONING GUIDELINES:
        1. DECONSTRUCT: Break the user's query into its fundamental components and hidden assumptions.
        2. CROSS-REFERENCE: Analyze the topic from historical, technical, ethical, and global perspectives.
        3. EDGE CASES: Identify and explore non-obvious details and corner cases that most assistants miss.
        4. HIERARCHICAL ANALYSIS: Start with high-level insights, then drill down into granular technical details.
        5. SYNTHESIS: Connect patterns across disparate domains to find unique insights.
        
        OUTPUT FORMATTING:
        - Use emojis naturally but professionally where relevant (not excessively).
        - Use professional, well-structured Markdown with clear headings (H2, H3).
        - Use bolding for key concepts and italics for emphasis.
        - Create detailed lists and structured tables.
        - Be thorough and provide a definitive "Conclusion/Verdict" section.
        - At the very end of your response, provide 3 short, relevant follow-up questions for the user to explore next, formatted as "FOLLOW_UP: [Question]" on separate lines.`
    } else if (mode === 'web_search') {
      systemPrompt = `You are Nexus AI in "Web Search" mode. You have access to real-time Google Search results to provide the most current, accurate information.
        ${greetingDetail}
        ${ownerInfo}
        ${memoriesPrompt}
        ${modelSpecificPrompt}
        
        CRITICAL INSTRUCTIONS FOR WEB SEARCH MODE:
        - Use the information from Google Search grounding to provide up-to-date, factual answers.
        - Always cite your sources naturally within the text (e.g., "According to [Source]...") 
        - Clearly distinguish between verified facts from search results and your own analysis.
        - If search results are conflicting, mention the different viewpoints.
        - Focus on the most recent and reliable sources.
        - Include specific dates, numbers, and data points from search results when available.
        - Use emojis naturally to keep the response engaging.
        - Use markdown formatting for clarity.
        - At the very end of your response, provide 2-3 follow-up questions formatted as "FOLLOW_UP: [Question]" on separate lines.`
    } else {
      systemPrompt = `You are Nexus AI, a sharp, helpful, and friendly assistant. 
        ${greetingDetail}
        ${ownerInfo}
        ${memoriesPrompt}
        ${modelSpecificPrompt}
        
        ABSOLUTE RULES - FOLLOW STRICTLY:
        - NEVER start your message with "Hello", "Hi", or the user's name unless explicitly instructed in the greeting section above.
        - ALWAYS give ONLY the answer to the user's current/latest message.
        - NEVER EVER mention, reference, summarize, or repeat ANYTHING from previous messages in the conversation.
        - Each user message is completely INDEPENDENT - answer ONLY what is being asked in THIS specific message.
        - DO NOT bring up previous topics, even if they seem related.
        - DO NOT say things like "As I mentioned before" or "As we discussed" or repeat any previous information.
        - If the user asks "what is X", answer ONLY about X. Nothing else.
        - Keep answers focused and direct - one topic per response.
        - Use emojis naturally to keep the conversation engaging.
        - Use markdown when helpful. 
        - At the very end of your response, provide 2-3 short, relevant follow-up questions for the user, formatted as "FOLLOW_UP: [Question]" on separate lines.`
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let streamEnded = false
        
        const safeEnqueue = (data: Uint8Array) => {
          if (!streamEnded) {
            try {
              controller.enqueue(data)
            } catch (e) {
              streamEnded = true
            }
          }
        }

        const safeClose = () => {
          if (!streamEnded) {
            try {
              controller.close()
              streamEnded = true
            } catch (e) {
              // Already closed
            }
          }
        }

        try {
          console.log('Initializing Gemini AI...')
          
          let cleanMessages: any[]

          if (mode === 'normal' || !mode) {
            // Keep last 10 messages for context in normal mode
            cleanMessages = messages.slice(-10).filter(m =>
              (m.role === 'user') ||
              (m.role === 'assistant' && (m.status === 'done' || (m.status === 'streaming' && m.content)))
            )
          } else {
            // Deep research / web search: full history chahiye context ke liye
            cleanMessages = messages.filter(m =>
              (m.role === 'user') ||
              (m.role === 'assistant' && (m.status === 'done' || (m.status === 'streaming' && m.content)))
            )
          }

          const isWebSearch = mode === 'web_search'
          const success = await streamFromGemini(cleanMessages, systemPrompt, controller, encoder, imageUrl, isWebSearch)

          if (!success) {
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error: `AI Connection timed out. Please try again.`,
                })}\n\n`
              )
            )
          }

          safeEnqueue(encoder.encode('data: [DONE]\n\n'))
          safeClose()
        } catch (err: any) {
          console.error('Streaming error:', err)
          let errorMsg = 'AI is temporarily busy. One moment...'
          
          if (err.message?.includes('429')) {
            errorMsg = 'Gemini API Quota Exceeded. Please check your API key usage limits or try again later.'
          } else if (err.message?.includes('503')) {
            errorMsg = 'Gemini models are currently overloaded. Please try again in a few seconds.'
          }

          safeEnqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: errorMsg,
              })}\n\n`
            )
          )
          safeClose()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Request parsing error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}