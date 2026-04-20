import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { name, description, userId } = await req.json()

    if (!name || !userId) {
      return new Response(
        JSON.stringify({ error: 'Team name and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { db } = await connectToDatabase()

    const team = {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: description || '',
      ownerId: userId,
      members: [
        {
          userId,
          role: 'owner',
          joinedAt: Date.now(),
        },
      ],
      conversations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db.collection('teams').insertOne(team)

    return new Response(JSON.stringify(team), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error creating team:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create team' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { db } = await connectToDatabase()

    const teams = await db
      .collection('teams')
      .find({
        'members.userId': userId,
      })
      .toArray()

    return new Response(JSON.stringify(teams), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error fetching teams:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch teams' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
