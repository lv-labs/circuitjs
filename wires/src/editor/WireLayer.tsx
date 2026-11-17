import { memo } from "react"
import { core } from "./core"
import type { CircuitDocument, Entity, Frame, Target } from "./core"
export const WireLayer = memo(function WireLayer({
  document,
  selection,
  frame,
}: {
  document: CircuitDocument
  selection: Entity[]
  frame?: Frame | null
}) {
  const dots = core.editing.junctionDots(document)
  function voltage(start: Target) {
    if (!frame) return undefined
    const visited = new Set<string>()
    const queue: Target[] = [start]
    for (let index = 0; index < queue.length; index++) {
      const ref = queue[index]
      const key = core.geometry.referenceKey(ref)
      if (visited.has(key)) continue
      visited.add(key)
      if (ref.kind === "pin") return frame.pinVoltages[ref.componentId]?.[ref.pinId]
      for (const wire of document.electrical.wires) {
        if (core.geometry.referenceKey(wire.from) === key) queue.push(wire.to)
        else if (core.geometry.referenceKey(wire.to) === key) queue.push(wire.from)
      }
    }
    return undefined
  }
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2}>
      {document.electrical.wires.map((w) => {
        const isSelected = selection.some((s) => s.kind === "wire" && s.id === w.id)
        const value = voltage(w.from)
        const tint = !Number.isFinite(value) ? "currentColor" : Math.abs(value!) < 1e-6 ? "#8f9fb3" : value! > 0 ? "#91d6ba" : "#e8b17b"
        return (
          <polyline
            key={w.id}
            className={isSelected ? "text-blue-600 dark:text-blue-400" : undefined}
            stroke={isSelected ? undefined : tint}
            strokeWidth={isSelected ? 3 : undefined}
            points={core.geometry
              .route(document, w)
              .map((p) => `${p.x},${p.y}`)
              .join(" ")}
          />
        )
      })}
      {dots.map(({ point }) => (
        <circle
          key={`${point.x},${point.y}`}
          cx={point.x}
          cy={point.y}
          r={4}
          fill="currentColor"
          stroke="none"
        />
      ))}
      {document.electrical.junctions.filter((junction) =>
        document.electrical.wires.filter((wire) => wire.from.kind === "junction" && wire.from.junctionId === junction.id || wire.to.kind === "junction" && wire.to.junctionId === junction.id).length === 1
      ).map(({ id }) => {
        const point = document.layout.junctions[id]
        return <rect key={`loose-${id}`} x={point.x - 3} y={point.y - 3} width={6} height={6} fill="var(--background)" stroke="currentColor" />
      })}
      {selection.filter(({ kind }) => kind === "junction").map(({ id }) => {
        const point = document.layout.junctions[id]
        return point && (
          <circle
            key={id}
            cx={point.x}
            cy={point.y}
            r={4}
            className="text-blue-600 dark:text-blue-400"
            fill="currentColor"
            stroke="none"
          />
        )
      })}
    </g>
  )
})
