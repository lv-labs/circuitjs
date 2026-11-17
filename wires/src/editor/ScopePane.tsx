import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { core } from "./core"
import { formatScope, traceDisplay, scopeSampleIndex } from "./scopeDisplay"
export type ScopeTrace = {
  id: string
  label: string
  color: string
  values: number[]
  min: number | null
  max: number | null
  last?: number
  kind?: string
  scale?: number
  offset?: number
  coupling?: string
}

export function ScopePane({
  id,
  channels,
  times,
  start,
  end,
  cursor,
  liveFraction,
  onHold,
  selectedTrace,
  onSelectTrace,
  onRenameChannel,
  onCursor,
  onLeave,
}: {
  id: string
  channels: ScopeTrace[]
  times: number[]
  start: number
  end: number
  cursor: number | null
  liveFraction?: number
  onHold: (fraction: number | null) => void
  selectedTrace?: string
  onSelectTrace: (id: string) => void
  onRenameChannel: (id: string) => void
  onCursor: (fraction: number) => void
  onLeave: () => void
}) {
  const pointerPosition = useRef(0)
  const heldPointer = useRef<number | null>(null)
  const plotRef = useRef<SVGSVGElement>(null)
  const [plotSize, setPlotSize] = useState({ width: 720, height: 200 })
  useEffect(() => {
    const element = plotRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setPlotSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const { width, height } = plotSize
  const left = 55,
    right = width - 17,
    top = 14,
    bottom = height - 28
  const plotWidth = Math.max(1, right - left),
    plotHeight = bottom - top
  const visible = channels
  const mappings = useMemo(
    () => new Map(channels.map((trace) => [trace.id, traceDisplay(trace)])),
    [channels]
  )
  const axis =
    channels.find((trace) => trace.id === selectedTrace) || channels[0]
  const axisMapping = axis && mappings.get(axis.id)
  const axisLabel = (division: number) =>
    axisMapping
      ? formatScope(
          (division - axisMapping.offset) * axisMapping.scale,
          axisMapping.unit
        )
      : ""
  const x = useCallback(
    (time: number) =>
      left + ((time - start) / Math.max(end - start, 1e-12)) * plotWidth,
    [left, start, end, plotWidth]
  )
  const y = useCallback(
    (value: number) =>
      Math.max(
        top - 2,
        Math.min(bottom + 2, top + plotHeight / 2 - (value / 8) * plotHeight)
      ),
    [top, bottom, plotHeight]
  )
  const cursorIndex = cursor === null ? -1 : scopeSampleIndex(times, cursor)
  function pointerFraction(element: SVGSVGElement, clientX: number) {
    const rect = element.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(
        1,
        (clientX - rect.left - (rect.width * left) / width) /
          ((rect.width * plotWidth) / width)
      )
    )
  }
  function releaseCursor(element: SVGSVGElement, pointerId: number) {
    if (heldPointer.current !== pointerId) return
    heldPointer.current = null
    onHold(null)
    onCursor(pointerPosition.current)
    if (element.hasPointerCapture(pointerId))
      element.releasePointerCapture(pointerId)
  }
  const paths = useMemo(
    () =>
      visible.map((channel) => {
        const mapping = mappings.get(channel.id)!
        const displayValue = (value: number) =>
          (value - mapping.mean) / mapping.scale + mapping.offset
        const points = core.signals.envelope(
          times,
          channel.values.map(displayValue),
          start,
          end,
          Math.floor(plotWidth)
        )
        return {
          channel,
          points,
          d: points
            .map(
              ([time, value], i) =>
                `${i ? "L" : "M"}${x(time).toFixed(2)} ${y(value).toFixed(2)}`
            )
            .join(" "),
        }
      }),
    [visible, times, start, end, plotWidth, x, y, mappings]
  )
  const emptyMessage = !channels.length
    ? "Add voltage or current traces from a component’s Add to scope menu"
    : !visible.length
      ? "Enable a probe channel to plot it"
      : "Run or Step to capture waveforms"

  return (
    <section
      className="group/scope h-full min-h-0 min-w-0 overflow-auto"
      data-pane={id}
    >
      <div className="relative h-full min-h-[160px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          ref={plotRef}
          className="h-full w-full touch-none"
          role="img"
          aria-label={`Pane ${id} voltage and current waveforms`}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            const trace =
              event.target instanceof Element
                ? event.target.closest<SVGElement>("[data-select-trace]")
                    ?.dataset.selectTrace
                : undefined
            if (trace) onSelectTrace(trace)
            heldPointer.current = event.pointerId
            pointerPosition.current = pointerFraction(
              event.currentTarget,
              event.clientX
            )
            onHold(pointerPosition.current)
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            pointerPosition.current = pointerFraction(
              event.currentTarget,
              event.clientX
            )
            if (heldPointer.current === null) onCursor(pointerPosition.current)
          }}
          onPointerUp={(event) =>
            releaseCursor(event.currentTarget, event.pointerId)
          }
          onPointerCancel={(event) =>
            releaseCursor(event.currentTarget, event.pointerId)
          }
          onLostPointerCapture={(event) =>
            releaseCursor(event.currentTarget, event.pointerId)
          }
          onPointerLeave={() => {
            if (heldPointer.current === null) onLeave()
          }}
        >
          {Array.from({ length: 11 }, (_, i) => {
            const gx = left + (plotWidth * i) / 10
            return (
              <g key={`x-${i}`}>
                <path d={`M${gx} ${top}V${bottom}`} stroke="var(--border)" />
                {i % 2 === 0 && (
                  <text
                    x={gx}
                    y={height - 9}
                    fill="var(--muted-foreground)"
                    textAnchor="middle"
                    fontSize={10}
                  >
                    {formatScope(start + ((end - start) * i) / 10, "s")}
                  </text>
                )}
              </g>
            )
          })}
          {Array.from({ length: 9 }, (_, i) => {
            const gy = top + (plotHeight * i) / 8
            return (
              <g key={`y-${i}`}>
                <path
                  d={`M${left} ${gy}H${right}`}
                  stroke={i === 4 ? "var(--muted-foreground)" : "var(--border)"}
                />
                {i % 2 === 0 && (
                  <text
                    x={left - 8}
                    y={gy + 4}
                    fill={axis?.color || "var(--muted-foreground)"}
                    textAnchor="end"
                    fontSize={10}
                  >
                    {axisLabel(4 - i)}
                  </text>
                )}
              </g>
            )
          })}
          {axis && (
            <path
              d={`M${left} ${top}V${bottom}`}
              stroke={axis.color}
              opacity={0.65}
            />
          )}
          <defs>
            <clipPath id={`scope-clip-${id}`}>
              <rect x={left} y={top} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>
          <g clipPath={`url(#scope-clip-${id})`}>
            {paths.map(({ channel, points, d }) => (
              <g key={channel.id}>
                {d && (
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                    className="cursor-pointer"
                    data-select-trace={channel.id}
                    onClick={() => onSelectTrace(channel.id)}
                  >
                    <title>Select {channel.label}</title>
                  </path>
                )}
                {d && (
                  <path
                    data-scope-trace={channel.id}
                    d={d}
                    fill="none"
                    stroke={channel.color}
                    strokeWidth={axis?.id === channel.id ? 2.2 : 1.6}
                    data-select-trace={channel.id}
                    className="cursor-pointer"
                    onClick={() => onSelectTrace(channel.id)}
                    strokeLinejoin="round"
                  />
                )}
                {points.length > 0 && (
                  <circle
                    cx={x(points.at(-1)![0])}
                    cy={y(points.at(-1)![1])}
                    r={2}
                    fill={channel.color}
                  />
                )}
              </g>
            ))}
            {cursorIndex >= 0 && cursor !== null && (
              <path
                data-scope-cursor-time={cursor}
                d={`M${liveFraction === undefined ? x(cursor) : left + liveFraction * plotWidth} ${top}V${bottom}`}
                stroke="var(--foreground)"
                strokeDasharray="3 3"
              />
            )}
          </g>
          {(!channels.length || !visible.length || !times.length) && (
            <text
              x={left + plotWidth / 2}
              y={top + plotHeight / 2}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize={12}
            >
              {emptyMessage}
            </text>
          )}
        </svg>
        <div className="pointer-events-none absolute top-1 right-3 flex w-fit max-w-[calc(100%-67px)] flex-wrap justify-end gap-x-3 gap-y-1 rounded bg-background/80 px-1 text-[10px]">
          {axisMapping && cursorIndex >= 0 && (
            <span
              className="font-medium tabular-nums"
              style={{ color: axis.color }}
              data-scope-cursor-value={axis.values[cursorIndex]}
              title={`${axis.label} at ${formatScope(cursor, "s")} · raw sample`}
            >
              Cursor {formatScope(axis.values[cursorIndex], axisMapping.unit)}
            </span>
          )}
          <span className="text-muted-foreground">
            {formatScope((end - start) / 10, "s")}/div
          </span>
          {axisMapping && (
            <span style={{ color: axis.color }}>
              {formatScope(axisMapping.scale, axisMapping.unit)}/div
              {axis.coupling === "ac" ? " AC" : ""}
            </span>
          )}
        </div>
        <div
          className="absolute bottom-8 left-[55px] flex max-h-[60%] max-w-[calc(100%-67px)] flex-col items-stretch gap-1 overflow-auto text-xs"
          aria-label="Scope traces"
        >
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="group/trace flex max-w-full min-w-0 items-center gap-1 rounded bg-background/80 px-1"
              data-scope-channel={channel.id}
              data-select-trace={channel.id}
            >
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer truncate rounded px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:font-semibold aria-pressed:underline aria-pressed:underline-offset-4"
                style={{ color: channel.color }}
                title={`Use ${channel.label} for the vertical axis`}
                aria-pressed={axis?.id === channel.id}
                onClick={() => onSelectTrace(channel.id)}
              >
                {channel.label}
              </button>
              <Button
                variant="ghost"
                size="icon-lg"
                className="shrink-0 text-muted-foreground opacity-40 transition-opacity group-focus-within/scope:opacity-100 group-hover/scope:opacity-100 hover:text-foreground [@media(hover:none)]:opacity-100"
                title="Trace settings"
                aria-label={`Properties for trace ${channel.label}`}
                onClick={() => {
                  onSelectTrace(channel.id)
                  onRenameChannel(channel.id)
                }}
              >
                <SettingsIcon className="size-5" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
