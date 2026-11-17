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
import type { Component, Frame, LabelSettings } from "./core"
import { TransistorModelFields, isCustomTransistor } from "./TransistorModelFields"
import type { TransistorModel } from "./TransistorModelFields"
import { DiodeModelFields, isCustomDiode } from "./DiodeModelFields"
import type { DiodeModel } from "./DiodeModelFields"
import { ledColourPresets, ledHexToRgb, ledRgbToHex, normaliseLedHex } from "./ledColour"
import { EditorDialog } from "./EditorDialog"
import { format } from "./componentValue"
import { componentSliders, hasSlider, potPositionRange } from "./componentSliders"

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
  onResistance: "On resistance · Ω (0 = ideal)",
  linkLabel: "Label for linking switches",
  group: "Switch group · 0 = unlinked",
  momentary: "Momentary · returns when released",
  iecSymbol: "IEC symbol",
  throwCount: "Number of throws · 2 to 10",
  poleCount: "Number of poles · 1 to 8",
  drawCircle: "Draw circle",
  swapTerminals: "Swap source/drain or emitter/collector",
  bodyDiode: "Simulate body diode",
  bodyTerminal: "Body terminal",
  showBulk: "Show bulk",
  digitalSymbol: "Digital symbol",
  showBodyDiode: "Show body diode",
  inputCount: "Number of inputs · 1 to 8",
  propagationDelay: "Propagation delay · s",
  schmittInputs: "Schmitt inputs",
  invertInputs: "Invert inputs",
  red: "Red · 0 to 1",
  green: "Green · 0 to 1",
  blue: "Blue · 0 to 1",
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
  if (key === "model" && component.kind === "diode") return core.catalog.diodeModels
  if (key === "integration") return ["Backward Euler", "Trapezoidal"]
  if (key === "mode" && ["logicInput", "logicOutput"].includes(component.kind))
    return ["Logic (L/H)", "Numeric (0/1)", "Ternary (0/1/2)"]
  if (key === "state" && component.kind === "logicInput")
    return ["Low / 0", "High / 1", "Ternary 2"]
  if (key === "position") {
    if (component.kind === "mbbSwitch") return ["A", "A + B", "B", "A + B"]
    if (component.kind === "spdtSwitch") {
      const count=Number(component.parameters.throwCount??2)
      return [...Array.from({length:count},(_,i)=>i<2?["A","B"][i]:`Throw ${i+1}`),...((component.parameters.centerOff??false)&&count===2?["Off"]:[])]
    }
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
  components = [],
  onApply,
  label = {},
  onClose,
  frame,
  actions,
}: {
  component: Component
  components?: Component[]
  label?: LabelSettings
  onApply: (parameters: Component["parameters"], label: LabelSettings) => void
  onClose: () => void
  frame: Frame | null
  actions: { label: string; run: () => void | Promise<void> }[]
}) {
  const transistor = core.catalog.transistorKind(component.kind)
  const [transistorModel, setTransistorModel] = useState<TransistorModel>(() => (component.parameters.model ?? "default") as TransistorModel)
  const diode = core.catalog.diodeKind(component.kind)
  const [diodeParameters] = useState(() => diode ? core.catalog.diodeEditorParameters(component.kind, component.parameters) : null)
  const [diodeModel, setDiodeModel] = useState<DiodeModel>(() => diodeParameters?.model as DiodeModel)
  const initialLedColour = ledRgbToHex(diodeParameters ?? component.parameters)
  const [ledColour, setLedColour] = useState(initialLedColour)
  const normalisedLedColour = normaliseLedHex(ledColour)
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
      : core.catalog.switchKind(component.kind)
        ? { ...core.catalog.switchDefaults(component.kind), ...component.parameters }
      : component.kind === "text"
        ? { drawBar: false, ...component.parameters }
      : core.catalog.transistorKind(component.kind)
        ? { swapTerminals: false, drawCircle: false, ...component.parameters }
        : core.catalog.mosfetKind(component.kind)
          ? { ...core.catalog.mosfetOptions, bodyDiode: false, ...component.parameters }
      : core.catalog.gateKind(component.kind)
        ? { inputCount: 2, propagationDelay: 0, schmittInputs: false, invertInputs: false, ...component.parameters }
        : diodeParameters ?? component.parameters
  const fields = Object.entries(editableParameters)
    .filter(([key]) => !(component.kind === "spdtSwitch" && key === "centerOff") && key !== "waveform" && !((diode || transistor) && key === "model") && !(component.kind === "led" && ["red", "green", "blue"].includes(key)))
    .map(([key, value]) => ({
      key,
      value,
      caption:
        (component.kind === "potentiometer" && key === "position" ? "Wiper position · 0.001 to 0.999 (0.1–99.9%)" : undefined) ??
        (["switch", "pushSwitch"].includes(component.kind) && ["closed", "normallyClosed"].includes(key) ? "Contact state · at rest when momentary" : undefined) ??
        output?.fields[key]?.label ??
        labels[key] ??
        key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (first) => first.toUpperCase()),
      options: choices(component, key),
    }))
  const name = component.kind === "pushSwitch" ? "Switch" : core.catalog.definitions[component.kind]?.name ?? component.kind
  const pins = frame?.pinVoltages[component.id]
  const current = frame?.componentCurrents?.[component.id]
  const measurements = frame?.componentMeasurements?.[component.id]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const parameters = { ...(diodeParameters ?? component.parameters) }
      if (transistor) {
        let model = structuredClone(transistorModel)
        if (isCustomTransistor(model) && data.has("transistorModelName")) {
          model.name = String(data.get("transistorModelName")).trim()
          for (const key of Object.keys(core.catalog.transistorModelFields))
            model[key] = parseNumber(String(data.get(`transistorModel-${key}`)), core.catalog.transistorModelFields[key].label)
        }
        core.catalog.resolveTransistorModel(model)
        parameters.model = model
      }
      if (diode) {
        let model = structuredClone(diodeModel)
        if (isCustomDiode(model) && data.has("diodeModelName")) {
          model.name = String(data.get("diodeModelName")).trim()
          for (const key of ["saturationCurrent", "breakdownVoltage", ...(model.mode === "simple" ? ["forwardVoltage", "forwardCurrent"] : ["seriesResistance", "emissionCoefficient"])])
            (model as unknown as Record<string, unknown>)[key] = parseNumber(String(data.get(`diodeModel-${key}`)), key)
        }
        core.catalog.resolveDiodeModel(model)
        parameters.model = model
      }
      for (const { key, caption, value } of fields) {
        if (["switch", "pushSwitch"].includes(component.kind) && ["closed", "normallyClosed"].includes(key))
          parameters[key] = data.get(key) === "closed"
        else if (typeof value === "boolean") parameters[key] = data.has(key)
        else if (typeof value === "number")
          parameters[key] = parseNumber(String(data.get(key)), caption)
        else if (typeof value === "string")
          parameters[key] = String(data.get(key))
      }
      if (component.kind === "potentiometer" &&
          (Number(parameters.position) < potPositionRange.min || Number(parameters.position) > potPositionRange.max))
        throw new Error("Potentiometer position must be between 0.001 and 0.999 (0.1–99.9%).")
      if (component.kind === "led") {
        const rgb = ledHexToRgb(ledColour)
        // Keep full precision from existing documents when the colour is unchanged.
        if (normalisedLedColour !== initialLedColour) Object.assign(parameters, rgb)
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
      onApply(parameters, core.catalog.graphic(component.kind) ? label : {
        position: String(data.get("labelPosition")) as LabelSettings["position"],
        showValue: data.has("labelShowValue"),
        showDetails: data.has("labelShowDetails"),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <EditorDialog title={name} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 text-sm">
        {transistor && <TransistorModelFields key={typeof transistorModel === "string" ? transistorModel : transistorModel.name}
          model={transistorModel} onChange={setTransistorModel} components={components} />}
        {diode && <DiodeModelFields key={typeof diodeModel === "string" ? diodeModel : diodeModel.name}
          kind={component.kind} model={diodeModel} onChange={setDiodeModel} components={components} />}
        {component.kind === "led" && (
          <fieldset className="grid gap-3 rounded border p-3">
            <legend className="px-1">LED colour</legend>
            <div className="grid gap-1.5">
              <span>Preset colour</span>
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="LED colour presets">
                {ledColourPresets.map(preset => {
                  const selected = normalisedLedColour === preset.hex.toUpperCase()
                  return (
                    <Button key={preset.hex} type="button" variant="ghost" size="icon-lg"
                      aria-label={preset.name} aria-pressed={selected} title={preset.name}
                      className={selected ? "ring-2 ring-ring" : ""}
                      onClick={() => { setLedColour(preset.hex.toUpperCase()); setError("") }}>
                      <span aria-hidden="true" className="size-5 rounded-full border border-foreground/15"
                        style={{ background: preset.hex }} />
                    </Button>
                  )
                })}
              </div>
            </div>
            <label className="grid gap-1">
              Hex colour
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="size-8 shrink-0 rounded border"
                  style={{ backgroundColor: normalisedLedColour ?? "transparent" }} />
                <Input value={ledColour} placeholder="#FF0000" maxLength={7} required
                  spellCheck={false} autoComplete="off"
                  onChange={event => { setLedColour(event.target.value); setError("") }} />
              </div>
            </label>
          </fieldset>
        )}
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
          if (["switch", "pushSwitch"].includes(component.kind) && ["closed", "normallyClosed"].includes(key))
            return (
              <label key={key} className="grid gap-1">
                {caption}
                <NativeSelect name={key} defaultValue={value ? "closed" : "open"} className="w-full">
                  <NativeSelectOption value="open">Normally open</NativeSelectOption>
                  <NativeSelectOption value="closed">Normally closed</NativeSelectOption>
                </NativeSelect>
              </label>
            )
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
                      value={key === "model" ? label : optionValue(key, option)}
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
        {!core.catalog.graphic(component.kind) && (
          <fieldset className="grid gap-2 rounded border p-3">
            <legend className="px-1">Sheet label</legend>
            <label className="grid gap-1">
              Position
              <NativeSelect name="labelPosition" defaultValue={label.position ?? "auto"}>
                {(["auto", "left", "right", "above", "below"] as const).map((position) => (
                  <NativeSelectOption key={position} value={position}>
                    {position === "auto" ? "Automatic" : position[0].toUpperCase() + position.slice(1)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            {([
              ["labelShowValue", "Show value", label.showValue],
              ["labelShowDetails", "Show additional information", label.showDetails],
            ] as const).map(([name, caption, checked]) => (
              <div key={name} className="flex items-center gap-2">
                <Checkbox name={name} id={`${fieldId}-${name}`} defaultChecked={checked !== false} />
                <label htmlFor={`${fieldId}-${name}`}>{caption}</label>
              </div>
            ))}
          </fieldset>
        )}
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
