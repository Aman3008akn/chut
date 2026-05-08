import { NextRequest, NextResponse } from 'next/server'
import { getConversationsCollection, connectToDatabase } from '@/lib/mongodb'
import { getServerSession } from 'next-auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const teams = await db.collection('teams').find({ 'members.userId': session.user.email }).toArray()
    const teamIds = teams.map(t => t.id)

    const collection = await getConversationsCollection()
    const conversations = await collection
      .find({
        $or: [
          { userEmail: session.user.email },
          { teamId: { $in: teamIds } }
        ]
      })
      .sort({ updatedAt: -1 })
      .toArray()

    return NextResponse.json(conversations)
  } catch (error: any) {
    console.error('MongoDB GET error:', error)
    if (error.name === 'MongoServerSelectionError' || error.message.includes('SSL alert number 80')) {
      return NextResponse.json({ 
        error: 'Database Connection Failed (IP Whitelist Issue)', 
        hint: 'Please ensure your current IP is whitelisted in MongoDB Atlas Network Access.' 
      }, { status: 503 })
    }
    return NextResponse.json({ error: 'Database Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversation } = await req.json()
    const { db } = await connectToDatabase()
    const collection = await getConversationsCollection()

    // If it's a team conversation, verify membership
    if (conversation.teamId) {
      const team = await db.collection('teams').findOne({ 
        id: conversation.teamId, 
        'members.userId': session.user.email 
      })
      if (!team) {
        return NextResponse.json({ error: 'Access denied to this team' }, { status: 403 })
      }
      
      await collection.updateOne(
        { id: conversation.id },
        { $set: { ...conversation, updatedAt: Date.now() } },
        { upsert: true }
      )
    } else {
      await collection.updateOne(
        { id: conversation.id, userEmail: session.user.email },
        { $set: { ...conversation, userEmail: session.user.email, updatedAt: Date.now() } },
        { upsert: true }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('MongoDB POST error:', error)
    if (error.name === 'MongoServerSelectionError' || error.message.includes('SSL alert number 80')) {
      return NextResponse.json({ 
        error: 'Database Sync Failed (IP Whitelist Issue)', 
        hint: 'Please ensure your current IP is whitelisted in MongoDB Atlas Network Access.' 
      }, { status: 503 })
    }
    return NextResponse.json({ error: 'Database Sync Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const collection = await getConversationsCollection()
  await collection.deleteOne({ id, userEmail: session.user.email })

  return NextResponse.json({ success: true })
}
