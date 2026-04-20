'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, Sparkles, ArrowRight, RefreshCw } from 'lucide-react'

interface Suggestion {
  id: string
  text: string
  category: 'continue' | 'explore' | 'creative' | 'analyze'
  icon: string
}

interface SmartSuggestionsProps {
  lastUserMessage: string
  lastAIMessage: string
  conversationHistory: Array<{ role: string; content: string }>
  onSuggestionClick: (text: string) => void
}

const SUGGESTION_TEMPLATES: Record<string, string[]> = {
  coding: [
    "Can you optimize this code for better performance?",
    "Add error handling to this implementation",
    "Convert this to TypeScript with proper types",
    "Show me how to write unit tests for this",
    "Explain the time and space complexity",
  ],
  learning: [
    "Break this down into simpler terms",
    "What are the real-world applications of this?",
    "Give me examples to understand this better",
    "What should I learn next about this topic?",
    "Create a study plan for mastering this",
  ],
  creative: [
    "Give me 5 creative variations of this",
    "How can I make this more engaging?",
    "Add some humor to make it interesting",
    "Rewrite this in a storytelling format",
    "Make it more professional and polished",
  ],
  analysis: [
    "What are the pros and cons of this approach?",
    "Compare this with alternative methods",
    "What are the potential risks or limitations?",
    "Show me data or statistics about this",
    "What do experts say about this topic?",
  ],
  continue: [
    "Tell me more about this",
    "Can you elaborate on that point?",
    "What's the next step?",
    "Go deeper into this aspect",
    "Show me advanced techniques",
  ],
}

function detectContext(message: string): string {
  const lower = message.toLowerCase()
  
  if (lower.includes('code') || lower.includes('function') || lower.includes('program') || 
      lower.includes('javascript') || lower.includes('python') || lower.includes('react')) {
    return 'coding'
  }
  
  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how to') || 
      lower.includes('learn') || lower.includes('understand')) {
    return 'learning'
  }
  
  if (lower.includes('write') || lower.includes('create') || lower.includes('story') || 
      lower.includes('poem') || lower.includes('design')) {
    return 'creative'
  }
  
  if (lower.includes('analyze') || lower.includes('compare') || lower.includes('vs') || 
      lower.includes('difference') || lower.includes('better')) {
    return 'analysis'
  }
  
  return 'continue'
}

export default function SmartSuggestions({
  lastUserMessage,
  lastAIMessage,
  conversationHistory,
  onSuggestionClick,
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [seenMessages, setSeenMessages] = useState<Set<string>>(new Set())

  const generateSuggestions = useCallback(() => {
    if (!lastAIMessage) return
    
    // Don't show suggestions for the same message twice
    if (seenMessages.has(lastAIMessage)) return

    setLoading(true)
    const context = detectContext(lastUserMessage || lastAIMessage)
    const templates = SUGGESTION_TEMPLATES[context] || SUGGESTION_TEMPLATES.continue
    
    // Generate 3-4 suggestions
    const shuffled = [...templates].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 3)
    
    const newSuggestions: Suggestion[] = selected.map((text, i) => ({
      id: `suggestion-${Date.now()}-${i}`,
      text,
      category: context as any,
      icon: ['💡', '🚀', '🎯', '🔍'][i],
    }))
    
    setSuggestions(newSuggestions)
    setVisible(true)
    setLoading(false)
    
    // Mark this message as seen
    setSeenMessages(prev => {
      const next = new Set(prev)
      next.add(lastAIMessage)
      return next
    })
  }, [lastUserMessage, lastAIMessage, seenMessages])

  useEffect(() => {
    // Only show suggestions if there's a new AI message
    if (lastAIMessage && conversationHistory.length > 0 && !seenMessages.has(lastAIMessage)) {
      generateSuggestions()
    }
  }, [lastAIMessage, generateSuggestions])

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation()
    generateSuggestions()
  }

  if (!visible || suggestions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="px-4 py-3 border-t border-[var(--surface-border)] bg-[var(--bg-secondary)]"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <span className="font-medium">Smart Suggestions</span>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-[var(--surface)] rounded transition-colors"
            title="Refresh suggestions"
          >
            <RefreshCw size={14} className="text-[var(--text-muted)]" />
          </button>
        </div>
        
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          <AnimatePresence>
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onSuggestionClick(suggestion.text)}
                className="flex items-start gap-2 p-3 text-left rounded-lg border border-[var(--surface-border)] 
                           bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 
                           transition-all duration-200 group"
              >
                <span className="text-lg flex-shrink-0">{suggestion.icon}</span>
                <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] 
                               transition-colors flex-1">
                  {suggestion.text}
                </span>
                <ArrowRight 
                  size={14} 
                  className="text-[var(--text-muted)] group-hover:text-[var(--accent)] 
                           transition-colors flex-shrink-0 mt-0.5" 
                />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
