import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Message, Conversation } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function formatTime(ts: number) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts))
}

export function isComplexQuery(text: string): boolean {
  return text.length > 60 || /explain|how|why|difference|compare|summarize/i.test(text)
}

export function isExtremelyHardQuery(text: string): boolean {
  const intense = [
    /analyze|research|detailed breakdown|technical|step by step|comprehensive|mathematical|scientific|philosophy|economic/i,
    /\?.{120,}/, // Very long questions with a question mark
  ]
  return text.length > 250 || intense.some((r) => r.test(text))
}

export function isResearchQuery(text: string): boolean {
  const keywords = /deep research|research mode|in depth|comprehensive|thorough analysis|full report|detailed report/i
  return keywords.test(text)
}

export function getConversationTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user")
  if (!first) return "New Chat"
  return first.content.slice(0, 45) + (first.content.length > 45 ? "…" : "")
}

export function saveConversations(convos: any[]) {
  try {
    localStorage.setItem("nexus_convos", JSON.stringify(convos))
  } catch {}
}

export function loadConversations(): any[] {
  try {
    const raw = localStorage.getItem("nexus_convos")
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function parseFollowUps(content: string): { cleanContent: string; followUps: string[] } {
  const lines = content.split("\n")
  const followUps: string[] = []
  const cleanLines = lines.filter((line) => {
    if (line.trim().startsWith("FOLLOW_UP:")) {
      const q = line.replace("FOLLOW_UP:", "").trim()
      if (q) followUps.push(q)
      return false
    }
    return true
  })
  return { cleanContent: cleanLines.join("\n").trim(), followUps }
}