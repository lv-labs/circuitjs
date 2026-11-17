import { core } from "./core"
import type { Component } from "./core"

export function format(value: number, unit = "") {
  if (!Number.isFinite(value)) return "—"
  if (Math.abs(value) < 1e-15) value = 0
  const scale = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ].find(([size]) => Math.abs(value) >= Number(size)) || [1, ""]
  return `${Number((value / Number(scale[0])).toPrecision(4))} ${scale[1]}${unit}`.trim()
}
function isSource(c: Component) {
  return c.kind === "voltageSource" || c.kind === "voltageRail"
}
function logicLevel(p: Record<string, any>, voltage: number) {
  if (!Number.isFinite(voltage)) return "—"
  if (p.mode === "ternary")
    return voltage > p.threshold * 1.5
      ? "2"
      : voltage > p.threshold * 0.5
        ? "1"
        : "0"
  return p.mode === "numeric"
    ? voltage < p.threshold
      ? "0"
      : "1"
    : voltage < p.threshold
      ? "L"
      : "H"
}
function outputReading(c: Component, measured: Record<string, any>) {
  if (measured.text !== undefined) return String(measured.text)
  if (["dataExport", "audioOutput"].includes(c.kind))
    return `${measured.samples || 0} samples`
  if (c.kind === "stopTrigger") return measured.stopped ? "Stopped" : "Armed"
  if (["dcMotor", "threePhaseMotor"].includes(c.kind))
    return format(Number(measured.speed), "rad/s")
  if (c.kind === "lamp") return format(Number(measured.temperature), "K")
  if (c.kind === "variableVoltage")
    return format(Number((c.parameters as any).voltage), "V")
  if (
    ["voltmeter", "testPoint"].includes(c.kind) &&
    (c.parameters as any).mode === 5
  )
    return String(measured.value)
  const unit: Record<string, string> = {
    voltmeter: "V",
    testPoint: "V",
    ohmmeter: "Ω",
    ammeter: "A",
    wattmeter: "W",
  }
  return unit[c.kind]
    ? measured.value === null
      ? c.kind === "ohmmeter"
        ? `∞ ${unit[c.kind]}`
        : "—"
      : format(Number(measured.value), unit[c.kind])
    : ""
}
export function componentValue(
  c: Component,
  live?: {
    pinVoltages?: Record<string, number>
    measurement?: Record<string, any>
  }
) {
  const p = c.parameters as Record<string, any>
  if (core.catalog.outputSpecs[c.kind])
    return c.kind === "variableVoltage"
      ? format(p.voltage, "V")
      : c.kind === "lamp"
        ? `${format(p.nominalPower, "W")} · ${format(p.nominalVoltage, "V")}`
        : c.kind === "labeledNode"
          ? p.name
          : core.catalog.graphic(c.kind)
            ? "Annotation"
            : core.catalog.definitions[c.kind].name
  if (c.kind === "pushSwitch")
    return p.normallyClosed ? "Normally closed" : "Normally open"
  if (c.kind === "mbbSwitch") return ["A", "A + B", "B", "A + B"][p.position]
  if (c.kind === "customTransformer")
    return `${p.turns1},${p.turns2}:${p.turns3} · ${format(p.inductance, "H")}`
  if (c.kind === "transmissionLine")
    return `${format(p.impedance, "Ω")} · ${format(p.delay, "s")}`
  if (c.kind === "resistor") return format(p.resistance, "Ω")
  if (c.kind === "transformer" || c.kind === "tappedTransformer")
    return `1:${p.ratio} · ${format(p.inductance, "H")}`
  if (["spdtSwitch", "dpdtSwitch"].includes(c.kind))
    return p.position === 2 ? "Off" : p.position === 0 ? "A" : "B"
  if (c.kind === "led") return format(p.forwardVoltage, "V")
  if (c.kind === "zener") return `${format(p.breakdownVoltage, "V")} Zener`
  if (c.kind === "inductor") return format(p.inductance, "H")
  if (c.kind === "currentSource") return format(p.current, "A")
  if (c.kind === "potentiometer")
    return `${format(p.resistance, "Ω")} · ${Number((p.position * 100).toPrecision(4))}%`
  if (["analogSwitch", "analogSpdtSwitch"].includes(c.kind))
    return `${format(p.onResistance, "Ω")} · ${format(p.threshold, "V")}${p.inverted ? " inverted" : ""}`
  if (["capacitor", "polarizedCapacitor"].includes(c.kind))
    return format(p.capacitance, "F")
  if (isSource(c))
    return p.waveform.kind !== "dc"
      ? `${format(p.waveform.amplitude, "V")} pk · ${format(p.waveform.frequency, "Hz")} · ${format(p.waveform.offset, "V")} offset`
      : format(p.waveform.voltage, "V")
  if (c.kind === "switch") return p.closed ? "Closed" : "Open"
  if (c.kind === "output")
    return p.showVoltage && Number.isFinite(live?.pinVoltages?.in)
      ? format(live!.pinVoltages!.in!, "V")
      : p.showVoltage
        ? "Shows voltage"
        : "Marker only"
  if (c.kind === "logicOutput")
    return `${Number.isFinite(live?.pinVoltages?.in) ? `${logicLevel(p, live!.pinVoltages!.in!)} · ${format(live!.pinVoltages!.in!, "V")}` : p.mode === "numeric" ? "Numeric" : p.mode === "ternary" ? "Ternary" : "Logic"} · ${format(p.threshold, "V")}`
  if (c.kind === "logicInput")
    return `${p.mode === "logic" ? (p.state === 0 ? "L" : "H") : p.state} · ${format(p.highVoltage, "V")} / ${format(p.lowVoltage, "V")}`
  if (["dFlipFlop", "jkFlipFlop", "tFlipFlop"].includes(c.kind))
    return `${format(p.highVoltage, "V")} · Q starts ${p.initialState ? "high" : "low"}${c.kind === "jkFlipFlop" && p.positiveEdge ? " · rising edge" : ""}`
  if (["counter", "latch", "halfAdder", "fullAdder"].includes(c.kind))
    return `${format(p.highVoltage, "V")}${["counter", "latch"].includes(c.kind) ? ` · starts ${p.initialValue}` : ""}${c.kind === "counter" && p.modulus ? ` · mod ${p.modulus}` : ""}`
  if (c.kind === "opamp")
    return `${format(p.minOutput, "V")} … ${format(p.maxOutput, "V")}`
  const reading = outputReading(c, live?.measurement || {})
  return reading
}
