import { useId, useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { core } from "./core"
import type { Component, Frame } from "./core"
import { EditorDialog } from "./EditorDialog"
import { format } from "./componentValue"
import { componentSliders, hasSlider } from "./componentSliders"

const labels: Record<string, string> = {
  label: "Slider label",
  resistance: "Resistance · Ω",
  capacitance: "Capacitance · F",
  initialVoltage: "Initial voltage · V",
  maxReverseVoltage: "Maximum reverse voltage · V",
  inductance: "Inductance · H",
  initialCurrent: "Initial current · A",
  ratio: "Turns ratio · secondary / primary",
  coupling: "Coupling · greater than 0, less than 1",
  turns1: "First primary turns · signed",
  turns2: "Second primary turns · signed",
  turns3: "Secondary turns · signed",
  impedance: "Characteristic impedance · Ω",
  delay: "Delay · s",
  forwardVoltage: "Forward voltage at 1 A · V",
  maxCurrent: "Full-brightness current · A",
  breakdownVoltage: "Breakdown voltage · V",
  current: "Current a → b · A",
  maxVoltage: "Compliance voltage · V (0 = ideal)",
  onResistance: "On resistance · Ω",
  offResistance: "Off resistance · Ω",
  threshold: "Threshold · V",
  highVoltage: "High level · V",
  lowVoltage: "Low level · V",
  slewRate: "Slew rate · V/ns",
  gain: "Open-loop gain",
  minOutput: "Minimum output · V",
  maxOutput: "Maximum output · V",
  initialState: "Q starts high",
  positiveEdge: "Positive-edge clock",
  invertReset: "Active-low reset",
  negativeEdge: "Falling-edge clock",
  edgeTriggered: "Edge-triggered register",
  modulus: "Modulus · 0 = 16, or 1 to 16",
  inverted: "Invert control",
}

const waveformLabels: Record<string, string> = {
  voltage: "DC voltage · V",
  amplitude: "Amplitude · V peak",
  frequency: "Frequency · Hz",
  offset: "DC offset · V",
  phase: "Phase · degrees",
  dutyCycle: "Duty cycle · %",
}
const scales: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
}

function parseNumber(input: string, label: string) {
  const match =
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([pnuµmkKMG]?)$/.exec(
      input.trim()
    )
  const value = match ? Number(match[1]) * (scales[match[2]] ?? 1) : NaN
  if (!Number.isFinite(value))
    throw new Error(
      `${label} requires a finite number. You can use p, n, u, m, k, M or G.`
    )
  return value
}

function choices(component: Component, key: string): string[] | undefined {
  if (key === "integration") return ["Backward Euler", "Trapezoidal"]
  if (key === "mode" && ["logicInput", "logicOutput"].includes(component.kind))
    return ["Logic (L/H)", "Numeric (0/1)", "Ternary (0/1/2)"]
  if (key === "state" && component.kind === "logicInput")
    return ["Low / 0", "High / 1", "Ternary 2"]
  if (key === "position") {
    if (component.kind === "mbbSwitch") return ["A", "A + B", "B", "A + B"]
    if (component.kind === "spdtSwitch") return ["A", "B", "Off"]
    if (component.kind === "dpdtSwitch") return ["A", "B"]
  }
}

function optionValue(key: string, index: number) {
  if (key === "integration") return ["backwardEuler", "trapezoidal"][index]
  if (key === "mode") return ["logic", "numeric", "ternary"][index]
  return String(index)
}

export function ComponentProperties({
  component,
  onApply,
  onClose,
  frame,
  actions,
}: {
  component: Component
  onApply: (parameters: Component["parameters"]) => void
  onClose: () => void
  frame: Frame | null
  actions: { label: string; run: () => void | Promise<void> }[]
}) {
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const fieldId = useId()
  const source = component.parameters.waveform as
    Record<string, unknown> | undefined
  const [waveform, setWaveform] = useState(String(source?.kind ?? "dc"))
  const [waveValues, setWaveValues] = useState(() => ({
    voltage: String(source?.voltage ?? 0),
    amplitude: String(
      source?.amplitude ?? Math.abs(Number(source?.voltage ?? 1))
    ),
    frequency: String(source?.frequency ?? 1000),
    offset: String(source?.offset ?? 0),
    phase: String((Number(source?.phase ?? 0) * 180) / Math.PI),
    dutyCycle: String(Number(source?.dutyCycle ?? 0.5) * 100),
  }))
  const waveFields: (keyof typeof waveValues)[] =
    waveform === "dc"
      ? ["voltage"]
      : ["amplitude", "frequency", "offset", "phase"]
  if (waveform === "square" || waveform === "pulse")
    waveFields.push("dutyCycle")
  const output = core.catalog.outputSpecs[component.kind]
  const editableParameters =
    component.kind === "potentiometer"
      ? { label: "", ...component.parameters }
      : component.parameters
  const fields = Object.entries(editableParameters)
    .filter(([key]) => key !== "waveform")
    .map(([key, value]) => ({
      key,
      value,
      caption:
        output?.fields[key]?.label ??
        labels[key] ??
        key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (first) => first.toUpperCase()),
      options: choices(component, key),
    }))
  const name = core.catalog.definitions[component.kind]?.name ?? component.kind
  const pins = frame?.pinVoltages[component.id]
  const current = frame?.componentCurrents?.[component.id]
  const measurements = frame?.componentMeasurements?.[component.id]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const parameters = { ...component.parameters }
      for (const { key, caption, value } of fields) {
        if (typeof value === "boolean") parameters[key] = data.has(key)
        else if (typeof value === "number")
          parameters[key] = parseNumber(String(data.get(key)), caption)
        else if (typeof value === "string")
          parameters[key] = String(data.get(key))
      }
      if (source) {
        const values: Record<string, unknown> = { kind: waveform }
        for (const key of waveFields) {
          const value = parseNumber(waveValues[key], waveformLabels[key])
          values[key] =
            key === "phase"
              ? (value * Math.PI) / 180
              : key === "dutyCycle"
                ? value / 100
                : value
        }
        parameters.waveform = values
      }
      if (
        component.kind === "logicInput" &&
        parameters.state === 2 &&
        parameters.mode !== "ternary"
      )
        throw new Error("Ternary state requires ternary mode.")
      onApply(parameters)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <EditorDialog title={name} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 text-sm">
        {source && (
          <>
            <label className="grid gap-1">
              Waveform
              <NativeSelect
                className="w-full"
                value={waveform}

                onChange={(event) => {
                  setWaveform(event.target.value)
                  setError("")
                }}
              >
                {Object.entries(core.catalog.waveformNames).map(
                  ([kind, name]) => (
                    <NativeSelectOption key={kind} value={kind}>
                      {name}
                    </NativeSelectOption>
                  )
                )}
              </NativeSelect>
            </label>
            {waveFields.map((key, index) => (
              <label key={key} className="grid gap-1">
                {waveformLabels[key]}
                <Input
                  required
                  data-primary={index === 0 ? "" : undefined}
                  value={waveValues[key]}

                  onChange={(event) =>
                    setWaveValues({ ...waveValues, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </>
        )}
        {fields.map(({ key, value, caption, options }, index) => {
          const primary = index === 0 && !source ? "" : undefined
          if (typeof value === "boolean")
            return (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  name={key}
                  id={`${fieldId}-${key}`}
                  defaultChecked={value}
                />
                <label htmlFor={`${fieldId}-${key}`}>{caption}</label>
              </div>
            )
          if (typeof value !== "number" && typeof value !== "string")
            return null
          return (
            <label key={key} className="grid gap-1">
              {caption}
              {options ? (
                <NativeSelect
                  className="w-full"
                  name={key}
                  defaultValue={String(value)}
                >
                  {options.map((label, option) => (
                    <NativeSelectOption
                      key={option}
                      value={optionValue(key, option)}
                    >
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : key === "label" && hasSlider(component) ? (
                <Input
                  name={key}
                  defaultValue={String(value)}
                  placeholder={componentSliders[component.kind].defaultLabel}
                  maxLength={output?.fields[key]?.maxLength}
                  data-primary={primary}
                />
              ) : typeof value === "string" ? (
                <Textarea
                  name={key}
                  defaultValue={value}
                  maxLength={output?.fields[key]?.maxLength}
                  rows={["text", "lookup"].includes(key) ? 5 : 2}
                />
              ) : (
                <Input
                  name={key}
                  defaultValue={value}
                  required
                  data-primary={primary}
                />
              )}
            </label>
          )
        })}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {(pins || current !== undefined || measurements) && (
          <Collapsible className="rounded border px-2 py-1">
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                />
              }
            >
              Live readings
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 text-xs">
                {Object.entries(pins ?? {}).map(([pin, value]) => (
                  <Reading
                    key={pin}
                    name={`Pin ${pin}`}
                    value={format(value, "V")}
                  />
                ))}
                {current !== undefined && (
                  <Reading name="Current" value={format(current, "A")} />
                )}
                {Object.entries(measurements ?? {}).map(([key, value]) => (
                  <Reading key={key} name={key} value={String(value)} />
                ))}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map(({ label, run }) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  setActionError("")
                  try {
                    await run()
                  } catch (cause) {
                    setActionError(
                      cause instanceof Error ? cause.message : String(cause)
                    )
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {actionError && (
          <p role="alert" className="text-destructive">
            {actionError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>
    </EditorDialog>
  )
}

function Reading({ name, value }: { name: string; value: string }) {
  return (
    <>
      <dt>{name}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  )
}
