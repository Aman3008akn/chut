import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { name, description, userId, action, teamId, usernameToAdd } = await req.json()

    const { db } = await connectToDatabase()

    if (action === 'add_member_by_username') {
      if (!teamId || !userId || !usernameToAdd) {
        return new Response(JSON.stringify({ error: 'teamId, userId, and usernameToAdd are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      const normalized = String(usernameToAdd).trim().toLowerCase()
      const targetUser = await db.collection('users').findOne({ usernameLower: normalized })
      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'Username not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
      }

      const team = await db.collection('teams').findOne({ id: teamId })
      if (!team) {
        return new Response(JSON.stringify({ error: 'Team not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
      }

      const existing = (team.members || []).some((m: any) => m.userId === targetUser.id)
      if (existing) {
        return new Response(JSON.stringify({ error: 'User already in group' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
      }


      await db.collection('teams').updateOne(
        { id: teamId, 'members.userId': { $ne: targetUser.id } },
        {
          $push: { members: { userId: targetUser.id, username: targetUser.username, role: 'member', joinedAt: Date.now() } },
          $set: { updatedAt: Date.now() },
        }
      )

      const owner = await db.collection('users').findOne({ id: userId })
      if (owner) {
        const ids = [userId, targetUser.id].sort()
        const memberKey = ids.join(':')
        const roomExists = await db.collection('rooms').findOne({ memberKey })
        if (!roomExists) {
          const room = {
            id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            roomName: `${owner.username} + ${targetUser.username}`,
            memberKey,
            members: [
              { userId: owner.id, username: owner.username, joinedAt: Date.now() },
              { userId: targetUser.id, username: targetUser.username, joinedAt: Date.now() }
            ],
            typingUsers: [],
            createdBy: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          await db.collection('rooms').insertOne(room)
          const usersCollection: any = db.collection('users')
          const roomMemberIds = ids
          await usersCollection.updateMany({ id: { $in: roomMemberIds } }, { $addToSet: { groups: room.id } })
        }
      }
      const updated = await db.collection('teams').findOne({ id: teamId })
      return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (!name || !userId) {
      return new Response(
        JSON.stringify({ error: 'Team name and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const team = {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: description || '',
      ownerId: userId,
      members: [
        {
          userId,
          username: 'owner',
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
