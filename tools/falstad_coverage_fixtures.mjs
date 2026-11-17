import { catalog, document } from "../packages/circuit-core/index.mjs"

export const signalGenerators = ["sweepSource", "antennaSource", "amSource", "fmSource", "noiseSource"]
export const logicModels = ["xnorGate", "schmittTrigger", "invertingSchmittTrigger"]
const activeModels = {
  scr: { driven: "anode", returned: "cathode", voltage: 12, resistance: 200 },
  diac: { driven: "a", returned: "b", voltage: 50, resistance: 1000 },
  triac: { driven: "mt2", returned: "mt1", voltage: 12, resistance: 200 },
  varactor: { driven: "cathode", returned: "anode", voltage: 5, resistance: 1000 },
  triode: { driven: "plate", returned: "cathode", voltage: 100, resistance: 1000 },
}

export const coverageKinds = [
  ...signalGenerators,
  ...logicModels,
  "sparkGap", "memristor", "tunnelDiode", "fuse", "photoresistor", "thermistor",
  ...Object.keys(activeModels),
]

export function coverageCircuit(kind, parameters = {}) {
  const d = document.empty()
  function add(id, model, overrides = {}) {
    const defaults = structuredClone(catalog.definitions[model].parameters)
    d.electrical.components.push({ id, kind: model, modelVersion: 1, parameters: { ...defaults, ...overrides } })
    d.layout.components[id] = { x: d.electrical.components.length * 128, y: 128, rotation: 0, mirror: false }
  }
  function wire(a, pinA, b, pinB) {
    const id = "wire-" + d.electrical.wires.length
    d.electrical.wires.push({
      id,
      from: { kind: "pin", componentId: a, pinId: pinA },
      to: { kind: "pin", componentId: b, pinId: pinB },
    })
    d.layout.wires[id] = { bends: [] }
  }
  function supply(id, voltage) {
    add(id, "voltageRail", { waveform: { kind: "dc", voltage } })
  }

  add("part", kind, parameters)
  add("ground", "ground")
  const active = activeModels[kind]
  add("load", "resistor", { resistance: active?.resistance ?? 1000 })
  if (signalGenerators.includes(kind)) {
    wire("part", "p", "load", "a")
    wire("load", "b", "ground", "g")
  } else if (logicModels.includes(kind)) {
    supply("drive", 5)
    for (const pin of Object.keys(catalog.definitions[kind].pins)) {
      if (pin !== "out") wire("drive", "p", "part", pin)
    }
    wire("part", "out", "load", "a")
    wire("load", "b", "ground", "g")
  } else if (active) {
    supply("drive", active.voltage)
    wire("drive", "p", "load", "a")
    wire("load", "b", "part", active.driven)
    wire("part", active.returned, "ground", "g")
    if (kind === "scr" || kind === "triac") {
      supply("gateDrive", 5)
      add("gateLimit", "resistor", { resistance: 100 })
      wire("gateDrive", "p", "gateLimit", "a")
      wire("gateLimit", "b", "part", "gate")
    }
    if (kind === "triode") wire("part", "grid", "ground", "g")
  } else {
    supply("drive", kind === "tunnelDiode" ? 0.08 : 5)
    const [a, b] = Object.keys(catalog.definitions[kind].pins)
    wire("drive", "p", "part", a)
    wire("part", b, "load", "a")
    wire("load", "b", "ground", "g")
  }
  return document.validate(d)
}
