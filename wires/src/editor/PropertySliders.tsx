import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { EditorDialog } from "./EditorDialog"
import { core } from "./core"
import type { Component } from "./core"

export type PropertySlider = {
  id: string
  componentId: string
  field: string
  label: string
  min: number
  max: number
  step: number
}

export function numericProperties(
  parameters: Component["parameters"],
  prefix = ""
): [string, number][] {
  return Object.entries(parameters).flatMap(([key, value]) => {
    const path = prefix + key
    if (typeof value === "number" && Number.isFinite(value))
      return [[path, value] as [string, number]]
    if (value && typeof value === "object" && !Array.isArray(value))
      return numericProperties(value as Component["parameters"], path + ".")
    return []
  })
}

export function PropertySliderDialog({
  component,
  existing,
  onSave,
  onClose,
}: {
  component: Component
  existing?: PropertySlider
  onSave: (slider: PropertySlider) => void
  onClose: () => void
}) {
  const fields = numericProperties(component.parameters)
  const [field, setField] = useState(existing?.field ?? fields[0]?.[0] ?? "")
  const value = fields.find(([key]) => key === field)?.[1] ?? 0
  const [error, setError] = useState("")
  const span = Math.abs(value) || 1
  const defaults = existing?.field === field ? existing : undefined
  return (
    <EditorDialog
      title={existing ? "Edit property slider" : "Add property slider"}
      onClose={onClose}
    >
      {fields.length ? (
        <form
          key={field}
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const min = Number(data.get("min")),
              max = Number(data.get("max")),
              step = Number(data.get("step"))
            if (
              ![min, max, step].every(Number.isFinite) ||
              min >= max ||
              step <= 0
            ) {
              setError("Enter a minimum below the maximum and a positive step.")
              return
            }
            onSave({
              id: existing?.id ?? crypto.randomUUID(),
              componentId: component.id,
              field,
              label: String(data.get("label")).trim() || field,
              min,
              max,
              step,
            })
          }}
        >
          <p className="text-xs text-muted-foreground">
            {core.catalog.definitions[component.kind].name} · {component.id}
          </p>
          <label className="grid gap-1 text-sm">
            Property
            <NativeSelect
              value={field}
              onChange={(event) => {
                setField(event.target.value)
                setError("")
              }}
            >
              {fields.map(([key]) => (
                <NativeSelectOption key={key} value={key}>
                  {key}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            Label
            <Input
              name="label"
              defaultValue={
                existing?.label ??
                `${core.catalog.definitions[component.kind].name} · ${field}`
              }
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm">
              Minimum
              <Input
                required
                type="number"
                step="any"
                name="min"
                defaultValue={defaults?.min ?? Math.min(0, value - span)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Maximum
              <Input
                required
                type="number"
                step="any"
                name="max"
                defaultValue={defaults?.max ?? Math.max(0, value + span)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Step
              <Input
                required
                type="number"
                step="any"
                name="step"
                defaultValue={defaults?.step ?? span / 100}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Use the property's base units. Values must satisfy the component's
            property rules.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {existing ? "Save changes" : "Add slider"}
            </Button>
          </div>
        </form>
      ) : (
        <p>This item has no numeric properties.</p>
      )}
    </EditorDialog>
  )
}
