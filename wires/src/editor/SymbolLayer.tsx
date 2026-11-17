import { memo } from "react"
import * as symbols from "../../../packages/circuit-symbols/index.ts"
import type { SymbolProps } from "../../../packages/circuit-symbols/svg"
import type { CircuitDocument, Component, Frame } from "./core"
import { core } from "./core"
import { componentSliders } from "./componentSliders"
import type { SliderAdjustment } from "./componentSliders"
import { componentValue } from "./componentValue"

export function SymbolBody({
  component,
  pose,
  current = 0,
  measured = {},
}: {
  component: Component
  pose: NonNullable<SymbolProps["pose"]>
  current?: number
  measured?: SymbolProps["measured"]
}) {
  if (!Object.hasOwn(symbols, component.kind))
    throw new Error(`Unsupported React symbol: ${component.kind}`)
  const View = symbols[component.kind as keyof typeof symbols]
  return (
    <View
      parameters={component.parameters}
      pose={pose}
      current={current}
      measured={measured}
      graphicSize={
        core.catalog.graphic(component.kind)
          ? core.geometry.graphicSize(component)
          : undefined
      }
    />
  )
}

export const SymbolLayer = memo(function SymbolLayer({
  document,
  selected,
  frame,
  sliderPreview,
}: {
  document: CircuitDocument
  selected: string[]
  frame?: Frame | null
  sliderPreview?: SliderAdjustment | null
}) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {document.electrical.components.map((component) => {
        const pose = document.layout.components[component.id]
        const isSelected = selected.includes(component.id)
        const current = frame?.componentCurrents?.[component.id] ?? 0
        const measured = frame?.componentMeasurements?.[component.id] ?? {}
        const bounds = core.geometry.bounds(document, component)
        const side = pose.rotation % 180 !== 0 || component.kind === "ground"
        const labelX = pose.x + (side ? 31 : 0)
        const labelY = pose.y + (side ? -28 : 31)
        const displayComponent =
          sliderPreview?.id === component.id &&
          sliderPreview.kind === component.kind
            ? {
                ...component,
                parameters: {
                  ...component.parameters,
                  [componentSliders[sliderPreview.kind].field]:
                    sliderPreview.value,
                },
              }
            : component
        const value = componentValue(displayComponent, {
          pinVoltages: frame?.pinVoltages[component.id],
          measurement: measured,
        })
        return (
          <g
            key={component.id}
            className={
              isSelected ? "text-blue-600 dark:text-blue-400" : undefined
            }
            strokeWidth={isSelected ? 3 : undefined}
          >
            {isSelected && (
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.right - bounds.x}
                height={bounds.bottom - bounds.y}
                rx={7}
                fill="currentColor"
                fillOpacity={0.04}
                stroke="currentColor"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <g
              transform={`translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.mirror ? -1 : 1} 1)`}
            >
              <SymbolBody
                component={displayComponent}
                pose={pose}
                current={current}
                measured={measured}
              />
            </g>
            {/* Sheet labels are positioned outside the symbol's pose transform. */}
            {!core.catalog.graphic(component.kind) && (
              <text
                x={labelX}
                y={labelY + 16}
                textAnchor={side ? "start" : "middle"}
                fill="currentColor"
                stroke="none"
                fontSize={10}
                opacity={0.7}
              >
                {value}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
})
