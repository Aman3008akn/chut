import { NextRequest } from 'next/server'
import { subscribeRoomEvent } from '@/lib/realtime'

export async function GET(_: NextRequest, { params }: { params: { roomId: string } }) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`))
      const unsub = subscribeRoomEvent(params.roomId, (payload) => {
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(payload)}\n\n`))
      })
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`))
      }, 15000)
      ;(controller as any)._cleanup = () => { clearInterval(ping); unsub() }
    },
    cancel(controller: any) { controller?._cleanup?.() }
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
