type Listener = (event: any) => void

const roomListeners = new Map<string, Set<Listener>>()

export function publishRoomEvent(
  roomId: string,
  event: any
) {
  const listeners = roomListeners.get(roomId)

  if (!listeners) return

  for (const listener of listeners) {
    listener(event)
  }
}

export function subscribeRoomEvent(
  roomId: string,
  listener: Listener
) {
  const set =
    roomListeners.get(roomId) ?? new Set<Listener>()

  set.add(listener)

  roomListeners.set(roomId, set)

  return () => {
    const s = roomListeners.get(roomId)

    if (!s) return

    s.delete(listener)

    if (!s.size) {
      roomListeners.delete(roomId)
    }
  }
}
