export type Role = 'user' | 'assistant'
export type MessageStatus = 'thinking' | 'researching' | 'searching' | 'streaming' | 'done' | 'error'

export interface SearchSource {
  title: string
  url: string
  snippet?: string
}

export interface ResearchStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done'
}

export interface ToolCall {
  id: string
  name: string
  args: any
}

export interface ToolResult {
  callId: string
  output: any
}

export interface Message {
  id: string
  role: Role
  content: string
  status?: MessageStatus
  researchSteps?: ResearchStep[]
  thinkingSteps?: ResearchStep[]
  isDeepResearch?: boolean
  timestamp: number
  thinkingStart?: number
  thinkingTime?: number
  imageUrl?: string // Base64 encoded image or URL
  isWebSearch?: boolean
  searchSources?: SearchSource[]
  webSearchQueries?: string[]
  senderName?: string
  senderId?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  teamId?: string
}
