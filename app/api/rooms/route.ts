import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

type UserGroupsDoc = { id: string; groups?: string[] }

type Member = { userId: string; username: string; joinedAt: number }

const roomKey = (ids: string[]) =>
  ids.filter((id, i, arr) => arr.indexOf(id) === i).sort().join(':')

export async function POST(req: NextRequest) {
  try {
    const { createdBy, memberUsernames = [], roomName } = await req.json()

    if (!createdBy || !Array.isArray(memberUsernames)) {
      return Response.json(
        { error: 'createdBy and memberUsernames are required' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()

    const users = await db
      .collection('users')
      .find({
        usernameLower: {
          $in: memberUsernames.map((u: string) =>
            u.trim().toLowerCase()
          ),
        },
      })
      .toArray()

    if (users.length !== memberUsernames.length) {
      return Response.json(
        { error: 'One or more usernames were not found' },
        { status: 404 }
      )
    }

    const creator: any = await db.collection('users').findOne({
      id: createdBy,
    })

    if (!creator) {
      return Response.json(
        { error: 'creator not found' },
        { status: 404 }
      )
    }

    const members: Member[] = [creator, ...users].map((u: any) => ({
      userId: u.id,
      username: u.username,
      joinedAt: Date.now(),
    }))

    const key = roomKey(members.map((m) => m.userId))

    const existing = await db.collection('rooms').findOne({
      memberKey: key,
    })

    if (existing) return Response.json(existing)

    const room = {
      id: `room_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      roomName: roomName || 'Shared AI Room',
      memberKey: key,
      members,
      typingUsers: [],
      createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db.collection('rooms').insertOne(room)

    const usersCollection =
      db.collection<UserGroupsDoc>('users')

    const memberIds = members.map((m) => m.userId)

    await usersCollection.updateMany(
      { id: { $in: memberIds } },
      { $addToSet: { groups: room.id } }
    )

    return Response.json(room)
  } catch (e) {
    console.error(e)

    return Response.json(
      { error: 'Failed to create room' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId')

  if (!userId) {
    return Response.json(
      { error: 'userId required' },
      { status: 400 }
    )
  }

  const { db } = await connectToDatabase()

  const rooms = await db
    .collection('rooms')
    .find({ 'members.userId': userId })
    .sort({ updatedAt: -1 })
    .toArray()

  return Response.json(rooms)
}
