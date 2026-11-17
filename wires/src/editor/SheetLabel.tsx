import { useLayoutEffect, useRef } from "react"
import type { CircuitDocument } from "./core"

/** Keep labels upright and space them from the actual transformed artwork. */
export function SheetLabel({ pose, kind, children }: {
  pose: CircuitDocument["layout"]["components"][string]
  kind: string
  children: string
}) {
  const text = useRef<SVGTextElement>(null)
  useLayoutEffect(() => {
    const element = text.current
    const body = element?.parentElement?.querySelector<SVGGElement>("[data-symbol-body]")
    if (!element || !body) return
    const box = body.getBBox()
    const angle = pose.rotation * Math.PI / 180
    const points = [
      [box.x, box.y], [box.x + box.width, box.y],
      [box.x, box.y + box.height], [box.x + box.width, box.y + box.height],
    ].map(([x, y]) => {
      x *= pose.mirror ? -1 : 1
      return {
        x: pose.x + x * Math.cos(angle) - y * Math.sin(angle),
        y: pose.y + x * Math.sin(angle) + y * Math.cos(angle),
      }
    })
    const left = Math.min(...points.map(p => p.x))
    const right = Math.max(...points.map(p => p.x))
    const top = Math.min(...points.map(p => p.y))
    const bottom = Math.max(...points.map(p => p.y))
    const position = !pose.label?.position || pose.label.position === "auto"
      ? (["voltageSource", "voltageRail", "variableVoltage", "ammeter", "voltmeter", "ohmmeter", "wattmeter", "testPoint"].includes(kind) || right - left > bottom - top ? "above" : "right")
      : pose.label.position
    const gap = 25
    const height = element.getBBox().height
    let x = (left + right) / 2
    let y = (top + bottom) / 2
    let anchor = "middle"
    if (position === "left") { x = left - gap; anchor = "end" }
    if (position === "right") { x = right + gap; anchor = "start" }
    if (position === "above") y = top - gap - height / 2
    if (position === "below") y = bottom + gap + height / 2
    element.setAttribute("x", String(x))
    element.setAttribute("y", String(y))
    element.setAttribute("text-anchor", anchor)
  }, [pose, kind, children])
  return <text ref={text} dominantBaseline="central" fill="currentColor" stroke="none"
    fontSize={31.25} opacity={0.7} pointerEvents="none">{children}</text>
}
