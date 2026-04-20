import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { connectToDatabase } from '@/lib/mongodb'

const ADMIN_EMAIL = 'declined8087@gmail.com'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (session?.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const config = await db.collection('siteConfig').findOne({})
    console.log('Fetched config from database:', config)

    return NextResponse.json({ config: config || {} })
  } catch (error: any) {
    console.error('Error fetching site config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (session?.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { config } = await req.json()
    console.log('Saving config to database:', config)
    
    // Remove _id field as it's immutable
    const { _id, ...configWithoutId } = config
    
    const { db } = await connectToDatabase()

    const result = await db.collection('siteConfig').updateOne(
      {},
      { $set: { ...configWithoutId, updatedAt: Date.now() } },
      { upsert: true }
    )

    console.log('Database update result:', result)
    return NextResponse.json({ success: true, updated: result.modifiedCount > 0 || result.upsertedCount > 0 })
  } catch (error: any) {
    console.error('Error saving site config:', error)
    return NextResponse.json({ error: 'Failed to save config', details: error.message }, { status: 500 })
  }
}
