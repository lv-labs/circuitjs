export function formatScope(value: number | null | undefined, unit = "") {
  if (value == null || !Number.isFinite(value)) return "—"
  if (Math.abs(value) < 1e-15) value = 0
  const [scale, prefix] = [
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ].find(([size]) => Math.abs(value) >= Number(size)) || [1, ""]
  return `${Number((value / Number(scale)).toPrecision(4))} ${prefix}${unit}`.trim()
}

/** Statistics of raw samples in the visible window (also in AC display mode). */
export function scopeMeasurements(values: number[]) {
  if (!values.length) return { mean: null, rms: null, peakToPeak: null }
  let mean = 0,
    meanSquare = 0,
    min = Infinity,
    max = -Infinity
  values.forEach((value, i) => {
    mean += (value - mean) / (i + 1)
    meanSquare += (value * value - meanSquare) / (i + 1)
    min = Math.min(min, value)
    max = Math.max(max, value)
  })
  return {
    mean,
    rms: Math.sqrt(Math.max(0, meanSquare)),
    peakToPeak: max - min,
  }
}

/** Crop a pane independently while acquisition retains the longest requested window. */
export function scopeWindow<T extends { values: number[] }>(
  channels: T[],
  times: number[],
  span: number
) {
  const end = Math.max(span, times.at(-1) || 0)
  const start = Math.max(0, end - span)
  const first = times.findIndex((time) => time >= start)
  const index = first < 0 ? times.length : first
  return {
    start,
    end,
    times: times.slice(index),
    channels: channels.map((channel) => {
      const values = channel.values.slice(index)
      let min = Infinity,
        max = -Infinity
      for (const value of values) {
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
      return {
        ...channel,
        values,
        min: values.length ? min : null,
        max: values.length ? max : null,
        last: values.at(-1),
      }
    }),
  }
}

/** One trace owns its vertical mapping, independent of other traces in its pane. */
export function traceDisplay(trace: {
  values: number[]
  min: number | null
  max: number | null
  scale?: number
  offset?: number
  coupling?: string
  kind?: string
}) {
  let mean = 0
  if (trace.coupling === "ac") {
    for (let i = 0; i < trace.values.length; i++)
      mean += (trace.values[i] - mean) / (i + 1)
  }
  const peak =
    trace.min === null || trace.max === null
      ? 0
      : Math.max(Math.abs(trace.min - mean), Math.abs(trace.max - mean))
  const target = peak / 3.5
  const power = target > 0 ? 10 ** Math.floor(Math.log10(target)) : 0
  const automatic =
    power > 0
      ? Math.max(
          1e-12,
          ([1, 2, 5, 10].find((step) => step * power >= target) || 10) * power
        )
      : trace.kind === "current"
        ? 0.001
        : 1
  const scale =
    Number.isFinite(trace.scale) && (trace.scale || 0) > 0
      ? trace.scale!
      : automatic
  return {
    mean,
    scale,
    automatic,
    offset: trace.offset || 0,
    unit: trace.kind === "current" ? "A" : "V",
  }
}

function sampleLowerBound(times: number[], time: number) {
  let low = 0,
    high = times.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (times[middle] < time) low = middle + 1
    else high = middle
  }
  return low
}
/** Select an actual acquisition sample once, in the hovered pane. */
export function nearestScopeSample(
  times: number[],
  time: number
): number | null {
  if (!times.length) return null
  const next = sampleLowerBound(times, time)
  if (next === 0) return times[0]
  if (next === times.length) return times[next - 1]
  return time - times[next - 1] <= times[next] - time
    ? times[next - 1]
    : times[next]
}
/** Other panes must show the identical sample, never a nearby substitute. */
export function scopeSampleIndex(times: number[], time: number) {
  const index = sampleLowerBound(times, time)
  return times[index] === time ? index : -1
}
