export type ScopeViewport = { x: number; y: number; scale: number; top: number }

/** Camera movement notifies scope placement without rerendering the editor shell. */
export function createScopeViewport() {
  let snapshot: ScopeViewport = { x: 150, y: 100, scale: 0.448, top: 0 }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    publish: (next: ScopeViewport) => {
      if (
        next.x === snapshot.x &&
        next.y === snapshot.y &&
        next.scale === snapshot.scale &&
        next.top === snapshot.top
      )
        return
      snapshot = next
      listeners.forEach((listener) => listener())
    },
  }
}
export type ScopeViewportStore = ReturnType<typeof createScopeViewport>
