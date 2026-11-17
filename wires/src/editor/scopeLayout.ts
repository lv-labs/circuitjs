import { useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { ScopeLayout } from "./core"

export function defaultScopeLayout(): ScopeLayout {
  return {
    version: 1,
    open: false,
    assignments: {},
    activeTraces: {},
    panes: {},
    height: 260,
    dock: null,
  }
}
type Arrangement = Omit<ScopeLayout, "version" | "open">
function arrangement(saved?: ScopeLayout): Arrangement {
  const source = saved || defaultScopeLayout()
  return {
    assignments: source.assignments,
    activeTraces: source.activeTraces,
    panes: source.panes,
    height: source.height,
    dock: source.dock || null,
  }
}

/** Keep pointer previews local; synchronize committed layouts and external Undo/Open. */
export function useScopeLayout(
  saved: ScopeLayout | undefined,
  dragging: boolean,
  onCommit: (layout: Arrangement) => void
) {
  const incoming = useMemo(() => arrangement(saved), [saved])
  const signature = useMemo(() => JSON.stringify(incoming), [incoming])
  const external = useRef(signature)
  const sent = useRef<string | null>(null)
  const [draft, setDraft] = useState(() => incoming)
  const next = useMemo(() => JSON.stringify(draft), [draft])
  useEffect(() => {
    if (signature !== external.current) {
      external.current = signature
      if (signature !== sent.current) {
        sent.current = null
        setDraft(incoming)
        return
      }
    }
    if (dragging || next === signature || next === sent.current) return
    sent.current = next
    onCommit(draft)
  }, [signature, incoming, draft, next, dragging, onCommit])
  const setters = useMemo(() => {
    function field<Key extends keyof Arrangement>(
      key: Key
    ): Dispatch<SetStateAction<Arrangement[Key]>> {
      return (change) =>
        setDraft((current) => {
          const value =
            typeof change === "function"
              ? (change as (value: Arrangement[Key]) => Arrangement[Key])(
                  current[key]
                )
              : change
          return value === current[key] ? current : { ...current, [key]: value }
        })
    }
    return {
      setAssignments: field("assignments"),
      setActiveTraces: field("activeTraces"),
      setLayouts: field("panes"),
      setHeight: field("height"),
      setDock: field("dock"),
    }
  }, [])
  return { ...draft, ...setters }
}
