import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { publishRoomEvent } from '@/lib/realtime'

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const { userId, username, state } = await req.json()
  const { db } = await connectToDatabase()
  const op = state ? { $addToSet: { typingUsers: { userId, username, at: Date.now() } } } : { $pull: { typingUsers: { userId } } }
  await db.collection('rooms').updateOne({ id: params.roomId }, { ...op, $set: { updatedAt: Date.now() } })
  publishRoomEvent(params.roomId, { type: 'typing', userId, username, state })
  return Response.json({ success: true })
}
