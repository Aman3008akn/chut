import { NextRequest, NextResponse } from 'next/server'
import { getConversationsCollection } from '@/lib/mongodb'
import { getServerSession } from 'next-auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const collection = await getConversationsCollection()
    const conversations = await collection
      .find({ userEmail: session.user.email })
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
    const collection = await getConversationsCollection()

    await collection.updateOne(
      { id: conversation.id, userEmail: session.user.email },
      { $set: { ...conversation, userEmail: session.user.email, updatedAt: Date.now() } },
      { upsert: true }
    )

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
