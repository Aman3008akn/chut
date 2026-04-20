import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { connectToDatabase } from '@/lib/mongodb'

const ADMIN_EMAIL = 'declined8087@gmail.com'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (session?.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    
    // Get total conversations
    const totalConversations = await db.collection('conversations').countDocuments()
    
    // Get unique users
    const uniqueUsers = await db.collection('conversations').distinct('userEmail')
    const totalUsers = uniqueUsers.length
    
    // Get total messages (approximate - sum of all conversation messages)
    const conversations = await db.collection('conversations').find({}).toArray()
    let totalMessages = 0
    conversations.forEach(conv => {
      if (conv.messages && Array.isArray(conv.messages)) {
        totalMessages += conv.messages.length
      }
    })

    // Active today (users who had conversations in last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    const activeToday = await db.collection('conversations').countDocuments({
      updatedAt: { $gte: oneDayAgo }
    })

    return NextResponse.json({
      totalUsers,
      totalConversations,
      totalMessages,
      activeToday
    })
  } catch (error: any) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
