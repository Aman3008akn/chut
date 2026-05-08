'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, Clock, MessageSquare, Zap, 
  TrendingUp, Calendar, Hash, Timer 
} from 'lucide-react'

interface Message {
  role: string
  content: string
  timestamp?: number
}

interface Conversation {
  id: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface AnalyticsData {
  totalConversations: number
  totalMessages: number
  totalWords: number
  avgResponseTime: number
  messagesToday: number
  messagesThisWeek: number
  mostActiveDay: string
  avgMessageLength: number
  codeSnippets: number
  questionsAsked: number
}

interface ConversationAnalyticsProps {
  conversations: Conversation[]
  currentMessages: Message[]
  onClose?: () => void
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function countCodeSnippets(messages: Message[]): number {
  let count = 0
  messages.forEach(msg => {
    const codeBlocks = msg.content.match(/```[\s\S]*?```/g)
    if (codeBlocks) count += codeBlocks.length
    const inlineCode = msg.content.match(/`[^`]+`/g)
    if (inlineCode) count += inlineCode.length
  })
  return count
}

function countQuestions(messages: Message[]): number {
  let count = 0
  messages.forEach(msg => {
    if (msg.role === 'user') {
      const questions = msg.content.match(/\?/g)
      if (questions) count += questions.length
    }
  })
  return count
}

function getMostActiveDay(conversations: Conversation[]): string {
  const dayCounts: Record<string, number> = {}
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  conversations.forEach(conv => {
    const day = days[new Date(conv.createdAt).getDay()]
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })
  
  let maxDay = 'Today'
  let maxCount = 0
  Object.entries(dayCounts).forEach(([day, count]) => {
    if (count > maxCount) {
      maxCount = count
      maxDay = day
    }
  })
  
  return maxDay
}

export default function ConversationAnalytics({
  conversations,
  currentMessages,
  onClose,
}: ConversationAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)

  const allMessages = useMemo(() => {
    const messages = currentMessages || []
    conversations.forEach(conv => {
      messages.push(...conv.messages)
    })
    return messages
  }, [conversations, currentMessages])

  useEffect(() => {
    const now = Date.now()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)

    const todayMessages = allMessages.filter(m => 
      (m.timestamp || now) >= todayStart.getTime()
    )
    
    const weekMessages = allMessages.filter(m => 
      (m.timestamp || now) >= weekStart.getTime()
    )

    const totalWords = allMessages.reduce((sum, m) => sum + countWords(m.content), 0)
    const avgMessageLength = allMessages.length > 0 
      ? Math.round(totalWords / allMessages.length) 
      : 0

    setAnalytics({
      totalConversations: conversations.length,
      totalMessages: allMessages.length,
      totalWords,
      avgResponseTime: 2.5, // Placeholder - can be calculated from timestamps
      messagesToday: todayMessages.length,
      messagesThisWeek: weekMessages.length,
      mostActiveDay: getMostActiveDay(conversations),
      avgMessageLength,
      codeSnippets: countCodeSnippets(allMessages),
      questionsAsked: countQuestions(allMessages),
    })
  }, [conversations, allMessages])

  if (!analytics) return null

  const stats = [
    {
      label: 'Total Conversations',
      value: analytics.totalConversations,
      icon: MessageSquare,
      color: 'text-blue-500',
    },
    {
      label: 'Total Messages',
      value: analytics.totalMessages,
      icon: Hash,
      color: 'text-green-500',
    },
    {
      label: 'Words Written',
      value: analytics.totalWords.toLocaleString(),
      icon: TrendingUp,
      color: 'text-purple-500',
    },
    {
      label: 'Messages Today',
      value: analytics.messagesToday,
      icon: Calendar,
      color: 'text-orange-500',
    },
    {
      label: 'This Week',
      value: analytics.messagesThisWeek,
      icon: Clock,
      color: 'text-pink-500',
    },
    {
      label: 'Avg Words/Message',
      value: analytics.avgMessageLength,
      icon: Timer,
      color: 'text-cyan-500',
    },
    {
      label: 'Code Snippets',
      value: analytics.codeSnippets,
      icon: Zap,
      color: 'text-yellow-500',
    },
    {
      label: 'Questions Asked',
      value: analytics.questionsAsked,
      icon: MessageSquare,
      color: 'text-indigo-500',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose || (() => {})}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-2xl 
                   shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--surface-border)] 
                        px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
              <BarChart3 size={24} className="text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Conversation Analytics</h2>
              <p className="text-sm text-[var(--text-secondary)]">Your usage statistics and insights</p>
            </div>
          </div>
          <button
            onClick={onClose || (() => {})}
            className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
          >
            <span className="text-2xl text-[var(--text-secondary)]">×</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon size={16} className={stat.color} />
                  <span className="text-xs text-[var(--text-secondary)]">{stat.label}</span>
                </div>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Most Active Day */}
          <div className="p-4 bg-gradient-to-r from-[var(--accent)]/10 to-transparent border border-[var(--surface-border)] 
                          rounded-xl mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-[var(--accent)]" />
              <span className="text-sm text-[var(--text-secondary)]">Most Active Day</span>
            </div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {analytics.mostActiveDay}
            </div>
          </div>

          {/* Tips */}
          <div className="p-4 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl">
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">💡 Insights</h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              {analytics.totalWords > 1000 && (
                <li>• You've written over {analytics.totalWords.toLocaleString()} words - that's impressive!</li>
              )}
              {analytics.questionsAsked > 10 && (
                <li>• You're a curious learner with {analytics.questionsAsked} questions asked!</li>
              )}
              {analytics.codeSnippets > 5 && (
                <li>• You're a coder! {analytics.codeSnippets} code snippets shared.</li>
              )}
              {analytics.messagesToday > 5 && (
                <li>• Very active today with {analytics.messagesToday} messages!</li>
              )}
              {analytics.totalConversations > 3 && (
                <li>• You have {analytics.totalConversations} conversations - great organization!</li>
              )}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
