import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json()
    const trimmed = String(username || '').trim()
    if (!trimmed || trimmed.length < 3) {
      return new Response(JSON.stringify({ error: 'Username must be at least 3 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    const usernameLower = trimmed.toLowerCase()
    const { db } = await connectToDatabase()
    const existing = await db.collection('users').findOne({ usernameLower })
    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }
    const user = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      username: trimmed,
      usernameLower,
      createdAt: Date.now(),
      avatarColor: ['#60a5fa', '#f472b6', '#34d399', '#f59e0b'][Math.floor(Math.random() * 4)],
      groups: [] as string[],
    }
    await db.collection('users').insertOne(user)
    return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create user' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
