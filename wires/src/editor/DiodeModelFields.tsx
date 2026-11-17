import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { core } from "./core"
import type { Component } from "./core"

export type CustomDiodeModel = {
  name: string
  mode: "simple" | "advanced"
  saturationCurrent: number
  breakdownVoltage: number
  forwardVoltage?: number
  forwardCurrent?: number
  seriesResistance?: number
  emissionCoefficient?: number
}
export type DiodeModel = string | CustomDiodeModel
export const isCustomDiode = (value: unknown): value is CustomDiodeModel =>
  value !== null && typeof value === "object" && "mode" in value && "name" in value

const fields: Record<string, string> = {
  saturationCurrent: "Saturation current · A",
  seriesResistance: "Series resistance · Ω",
  emissionCoefficient: "Emission coefficient",
  breakdownVoltage: "Breakdown voltage · V (0 = none)",
  forwardVoltage: "Forward voltage · V",
  forwardCurrent: "Current at that voltage · A",
}

export function DiodeModelFields({ kind, model, onChange, components }: {
  kind: string
  model: DiodeModel
  onChange: (model: DiodeModel) => void
  components: Component[]
}) {
  const [editing, setEditing] = useState(isCustomDiode(model))
  const available = new Map<string, DiodeModel>(core.catalog.diodeModels.map(name => [name, name]))
  for (const c of components) {
    if (core.catalog.diodeKind(c.kind) && isCustomDiode(c.parameters.model))
      available.set(c.parameters.model.name, c.parameters.model)
  }
  if (isCustomDiode(model)) available.set(model.name, model)
  const options = [...available.entries()].filter(([, value]) =>
    kind !== "zener" || core.catalog.resolveDiodeModel(value).breakdownVoltage > 0
  )
  function create(mode: CustomDiodeModel["mode"]) {
    const values = core.catalog.resolveDiodeModel(model)
    const current = 1
    const forwardVoltage = values.emissionCoefficient * .025865 * Math.log1p(current / values.saturationCurrent)
    let name = "Custom diode"
    for (let index = 2; available.has(name); index++) name = `Custom diode ${index}`
    onChange({ name, mode, saturationCurrent: values.saturationCurrent,
      breakdownVoltage: values.breakdownVoltage,
      ...(mode === "simple" ? {forwardVoltage, forwardCurrent: current} : {
        seriesResistance: values.seriesResistance, emissionCoefficient: values.emissionCoefficient,
      }),
    })
    setEditing(true)
  }
  return <fieldset className="grid gap-3 rounded border p-3">
    <legend className="px-1">Diode model</legend>
    <label className="grid gap-1">Model
      <NativeSelect className="w-full" value={isCustomDiode(model) ? model.name : model}
        onChange={event => { onChange(structuredClone(available.get(event.target.value)!)); setEditing(false) }}>
        {options.map(([name, value]) => <NativeSelectOption key={name} value={name}>
          {name}{isCustomDiode(value) ? " (custom)" : ""}
        </NativeSelectOption>)}
      </NativeSelect>
    </label>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => create("simple")}>Create simple model</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => create("advanced")}>Create advanced model</Button>
      {isCustomDiode(model) && <Button type="button" variant="outline" size="sm" onClick={() => setEditing(!editing)}>
        {editing ? "Hide model fields" : "Edit model"}
      </Button>}
    </div>
    {isCustomDiode(model) && <div className={editing ? "grid gap-3" : "hidden"}>
      <p className="text-xs text-muted-foreground">Changes apply to every diode, LED and zener using this model in this circuit. Rename it to create a separate model.</p>
      <label className="grid gap-1">Model name
        <Input name="diodeModelName" defaultValue={model.name} required maxLength={80} />
      </label>
      {["saturationCurrent", ...(model.mode === "simple" ? ["forwardVoltage", "forwardCurrent"] : ["seriesResistance", "emissionCoefficient"]), "breakdownVoltage"].map(key =>
        <label key={key} className="grid gap-1">{fields[key]}
          <Input name={`diodeModel-${key}`} defaultValue={String(model[key as keyof CustomDiodeModel])} required />
        </label>
      )}
    </div>}
  </fieldset>
}
