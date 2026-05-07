type Listener = (event: any) => void

const roomListeners = new Map<string, Listener[]>()

export function publishRoomEvent(roomId: string, event: any) {
  const listeners = roomListeners.get(roomId)
  if (!listeners || listeners.length === 0) return
  listeners.forEach((listener) => {
    listener(event)
  })
}

export function subscribeRoomEvent(roomId: string, listener: Listener) {
  const list = roomListeners.get(roomId) ?? []
  if (!list.includes(listener)) {
    list.push(listener)
  }
  roomListeners.set(roomId, list)

  return () => {
    const current = roomListeners.get(roomId)
    if (!current) return
    const next = current.filter((fn) => fn !== listener)
    if (next.length === 0) {
      roomListeners.delete(roomId)
      return
    }
    roomListeners.set(roomId, next)
  }
}
