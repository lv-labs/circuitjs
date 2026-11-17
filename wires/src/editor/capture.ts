export type Capture = {
  values: number[]
  timeStep: number
  startTime: number
}

function validate(capture: Capture) {
  if (
    !capture ||
    !Array.isArray(capture.values) ||
    capture.values.length > 1_000_000 ||
    !capture.values.every(Number.isFinite) ||
    !Number.isFinite(capture.timeStep) ||
    capture.timeStep <= 0 ||
    !Number.isFinite(capture.startTime)
  ) throw new Error("Invalid capture")
}

export function captureCsv(capture: Capture) {
  validate(capture)
  return "time_s,voltage_V\n" + capture.values.map((value, index) => `${capture.startTime + index * capture.timeStep},${value}`).join("\n") + "\n"
}

export function normalizedAudio(values: number[]) {
  if (!values.length) return new Float32Array()
  let scale = 0
  for (const value of values) scale = Math.max(scale, Math.abs(value))
  if (!scale) return new Float32Array(values.length)
  const mean = values.reduce((sum, value) => sum + value / scale / values.length, 0)
  let peak = 0
  for (const value of values) peak = Math.max(peak, Math.abs(value / scale - mean))
  return Float32Array.from(values, (value) => peak ? (value / scale - mean) / peak * .2 : 0)
}

export function captureWav(capture: Capture) {
  validate(capture)
  const rate = Math.round(1 / capture.timeStep)
  const values = normalizedAudio(capture.values)
  const buffer = new ArrayBuffer(44 + values.length * 2)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index))
  }
  text(0, "RIFF"); view.setUint32(4, 36 + values.length * 2, true)
  text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, "data"); view.setUint32(40, values.length * 2, true)
  values.forEach((value, index) => view.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767)), true))
  return buffer
}
