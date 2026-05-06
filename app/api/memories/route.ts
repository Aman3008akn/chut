import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

/**
 * GET /api/memories?userId=xxx
 * Fetch all memories for a user
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const memories = await db
      .collection('memories')
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray()

    return NextResponse.json(memories)
  } catch (error: any) {
    console.error('[Memories GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

/**
 * POST /api/memories
 * Save or update a memory
 * Body: { userId, key, value, category, source, confidence }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, key, value, category, source, confidence } = body

    if (!userId || !key || !value) {
      return NextResponse.json({ error: 'userId, key, and value required' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('memories')

    // Check if this memory key already exists for user
    const existing = await collection.findOne({ userId, key })

    const now = Date.now()

    if (existing) {
      // Update existing memory
      await collection.updateOne(
        { userId, key },
        {
          $set: {
            value,
            category: category || existing.category,
            source: source || existing.source,
            confidence: Math.max(confidence || 0, existing.confidence || 0),
            updatedAt: now,
          },
        }
      )
      return NextResponse.json({
        action: 'updated',
        memory: { ...existing, value, updatedAt: now },
      })
    } else {
      // Create new memory
      const memory = {
        userId,
        key,
        value,
        category: category || 'other',
        source: source || '',
        confidence: confidence || 0.8,
        createdAt: now,
        updatedAt: now,
      }
      await collection.insertOne(memory)
      return NextResponse.json({ action: 'created', memory })
    }
  } catch (error: any) {
    console.error('[Memories POST]', error.message)
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 })
  }
}

/**
 * DELETE /api/memories?userId=xxx&key=yyy
 * Delete a specific memory, or all memories if no key
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const key = req.nextUrl.searchParams.get('key')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('memories')

    if (key) {
      await collection.deleteOne({ userId, key })
      return NextResponse.json({ deleted: key })
    } else {
      const result = await collection.deleteMany({ userId })
      return NextResponse.json({ deletedCount: result.deletedCount })
    }
  } catch (error: any) {
    console.error('[Memories DELETE]', error.message)
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}
