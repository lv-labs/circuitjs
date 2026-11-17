import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { core } from "./core"
import type { Component } from "./core"

export type CustomTransistorModel = { name: string } & Record<string, string | number>
export type TransistorModel = string | CustomTransistorModel
export const isCustomTransistor = (value: unknown): value is CustomTransistorModel =>
  value !== null && typeof value === "object" && "name" in value && "saturationCurrent" in value && !("mode" in value)

export function TransistorModelFields({ model, onChange, components }: {
  model: TransistorModel
  onChange: (model: TransistorModel) => void
  components: Component[]
}) {
  const [editing, setEditing] = useState(isCustomTransistor(model))
  const available = new Map<string, TransistorModel>(core.catalog.transistorModels.map(name => [name, name]))
  for (const c of components)
    if (core.catalog.transistorKind(c.kind) && isCustomTransistor(c.parameters.model))
      available.set(c.parameters.model.name, c.parameters.model)
  if (isCustomTransistor(model)) available.set(model.name, model)
  function create() {
    let name = "Custom transistor"
    for (let index = 2; available.has(name); index++) name = `Custom transistor ${index}`
    onChange({ name, ...core.catalog.resolveTransistorModel(model) })
    setEditing(true)
  }
  return <fieldset className="grid gap-3 rounded border p-3">
    <legend className="px-1">Transistor model</legend>
    <label className="grid gap-1">Model
      <NativeSelect className="w-full" value={isCustomTransistor(model) ? model.name : model}
        onChange={event => { onChange(structuredClone(available.get(event.target.value)!)); setEditing(false) }}>
        {[...available.entries()].map(([name, value]) => <NativeSelectOption key={name} value={name}>
          {name}{isCustomTransistor(value) ? " (custom)" : ""}
        </NativeSelectOption>)}
      </NativeSelect>
    </label>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={create}>Create model</Button>
      {isCustomTransistor(model) && <Button type="button" variant="outline" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Hide model fields" : "Edit model"}</Button>}
    </div>
    {isCustomTransistor(model) && <div className={editing ? "grid gap-3" : "hidden"}>
      <p className="text-xs text-muted-foreground">Changes apply to every transistor using this model in this circuit. Rename it to create a separate model.</p>
      <label className="grid gap-1">Model name
        <Input name="transistorModelName" defaultValue={model.name} required maxLength={80} />
      </label>
      {Object.entries(core.catalog.transistorModelFields).map(([key, field]) =>
        <label key={key} className="grid gap-1">{field.label}
          <Input name={`transistorModel-${key}`} defaultValue={String(model[key])} required />
        </label>
      )}
    </div>}
  </fieldset>
}
