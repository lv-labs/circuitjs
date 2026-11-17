import { core } from "./core"
import type { CircuitDocument, Entity, Point } from "./core"

/** Choose among selected symbol centres and their transformed electrical pins. */
export function moveAnchor(
  document: CircuitDocument,
  selection: Entity[],
  pointer: Point
): Point {
  const candidates: Point[] = []
  for (const item of selection) {
    if (item.kind !== "component") continue
    const component = document.electrical.components.find(
      ({ id }) => id === item.id
    )
    if (!component) continue
    candidates.push(document.layout.components[item.id])
    for (const pinId of Object.keys(
      core.catalog.componentPins(component)
    ))
      candidates.push(
        core.geometry.pin(document, {
          kind: "pin",
          componentId: item.id,
          pinId,
        })
      )
  }
  return candidates.reduce<Point>(
    (nearest, point) =>
      Math.hypot(point.x - pointer.x, point.y - pointer.y) <
      Math.hypot(nearest.x - pointer.x, nearest.y - pointer.y)
        ? point
        : nearest,
    candidates[0] ?? pointer
  )
}
