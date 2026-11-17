import { memo } from "react"
import * as symbols from "../../../packages/circuit-symbols/index.ts"
import type { SymbolProps } from "../../../packages/circuit-symbols/svg"
import type { CircuitDocument, Component, Frame } from "./core"
import { core } from "./core"
import { sliderField, setProperty } from "./componentSliders"
import type { SliderAdjustment } from "./componentSliders"
import { componentValue } from "./componentValue"
import { SheetLabel } from "./SheetLabel"

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
  const drawingScale =
    core.catalog.definitions[component.kind].drawingScale ?? 1
  return (
    <g
      transform={`scale(${drawingScale})`}
      style={{
        strokeWidth: `calc(var(--symbol-stroke, 6.25px) / ${drawingScale})`,
      }}
    >
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
    </g>
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
      strokeWidth={6.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {document.electrical.components.map((component) => {
        const pose = document.layout.components[component.id]
        const isSelected = selected.includes(component.id)
        const current = frame?.componentCurrents?.[component.id] ?? 0
        const measured = frame?.componentMeasurements?.[component.id] ?? {}
        const displayComponent =
          sliderPreview?.id === component.id &&
          sliderPreview.kind === component.kind
            ? structuredClone(component)
            : component
        if (displayComponent !== component && sliderPreview)
          setProperty(
            displayComponent.parameters,
            sliderField(sliderPreview),
            sliderPreview.value
          )
        const value = componentValue(displayComponent, {
          pinVoltages: frame?.pinVoltages[component.id],
          measurement: measured,
        })
        const parts = String(value ?? "").split(" · ")
        // Op-amp output limits are supplementary information rather than a value.
        const detailsOnly = component.kind === "opamp"
        const label = [
          ...(pose.label?.showValue !== false && !detailsOnly ? parts.slice(0, 1) : []),
          ...(pose.label?.showDetails !== false ? parts.slice(detailsOnly ? 0 : 1) : []),
        ].join(" · ")
        return (
          <g
            key={component.id}
            className={
              isSelected ? "text-blue-600 dark:text-blue-400" : undefined
            }
            style={
              {
                "--symbol-stroke": isSelected ? "9.375px" : "6.25px",
              } as React.CSSProperties
            }
          >
            <g
              data-symbol-body={component.id}
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
            {!core.catalog.graphic(component.kind) && label && (
              <SheetLabel pose={pose} kind={component.kind}>{label}</SheetLabel>
            )}
          </g>
        )
      })}
    </g>
  )
})
