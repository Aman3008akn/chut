import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { teamId, inviterId, inviteeEmail } = await req.json()

    if (!teamId || !inviterId || !inviteeEmail) {
      return new Response(
        JSON.stringify({ error: 'teamId, inviterId, and inviteeEmail are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { db } = await connectToDatabase()

    const team = await db.collection('teams').findOne({ id: teamId })

    if (!team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if inviter is owner or admin
    const inviter = team.members.find((m: any) => m.userId === inviterId)
    if (!inviter || (inviter.role !== 'owner' && inviter.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Only owners and admins can invite members' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create invitation
    const invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teamId,
      inviterId,
      inviteeEmail,
      status: 'pending',
      createdAt: Date.now(),
    }

    await db.collection('invitations').insertOne(invitation)

    return new Response(JSON.stringify(invitation), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error creating invitation:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create invitation' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Accept invitation
export async function PUT(req: NextRequest) {
  try {
    const { invitationId, userId } = await req.json()

    if (!invitationId || !userId) {
      return new Response(
        JSON.stringify({ error: 'invitationId and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { db } = await connectToDatabase()

    const invitation = await db.collection('invitations').findOne({ id: invitationId })

    if (!invitation) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Invitation already used or expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Update invitation status
    await db.collection('invitations').updateOne(
      { id: invitationId },
      { $set: { status: 'accepted', acceptedAt: Date.now() } }
    )

    // Add user to team
    await db.collection('teams').updateOne(
      { id: invitation.teamId },
      {
        $push: {
          members: {
            userId,
            role: 'member',
            joinedAt: Date.now(),
          },
        },
        $set: { updatedAt: Date.now() },
      }
    )

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to accept invitation' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
