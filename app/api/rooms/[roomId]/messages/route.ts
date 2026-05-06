import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { publishRoomEvent } from '@/lib/realtime'

export async function GET(_: NextRequest, { params }: { params: { roomId: string } }) {
  const { db } = await connectToDatabase()
  const messages = await db.collection('room_messages').find({ roomId: params.roomId }).sort({ createdAt: 1 }).limit(200).toArray()
  return Response.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const { message } = await req.json()
  const { db } = await connectToDatabase()
  const doc = { ...message, id: message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, roomId: params.roomId, createdAt: Date.now() }
  await db.collection('room_messages').updateOne({ id: doc.id, roomId: params.roomId }, { $setOnInsert: doc }, { upsert: true })
  await db.collection('rooms').updateOne({ id: params.roomId }, { $set: { updatedAt: Date.now() } })
  publishRoomEvent(params.roomId, { type: 'message', message: doc })
  return Response.json(doc)
}
