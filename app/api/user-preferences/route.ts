import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const userPrefs = await db.collection('userPreferences').findOne({
      userEmail: session.user.email
    })

    return NextResponse.json(userPrefs || {})
  } catch (error: any) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { displayName, profileImage, accentColor } = await req.json()
    const { db } = await connectToDatabase()

    await db.collection('userPreferences').updateOne(
      { userEmail: session.user.email },
      {
        $set: {
          userEmail: session.user.email,
          ...(displayName && { displayName }),
          ...(profileImage && { profileImage }),
          ...(accentColor && { accentColor }),
          updatedAt: Date.now()
        }
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving user preferences:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
