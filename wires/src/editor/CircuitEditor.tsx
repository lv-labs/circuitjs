import { useEffect, useId, useMemo, useRef, useState } from "react"
import { PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { core } from "./core"
import type { CircuitDocument, Component, Entity, Target } from "./core"
import { useCircuitSession } from "./useCircuitSession"
import { CircuitSheet } from "./CircuitSheet"
import { ComponentProperties } from "./ComponentProperties"
import { EditorDialog } from "./EditorDialog"
import { ComponentSliderPanel } from "./ComponentSliderPanel"
import { componentSliders, hasSlider } from "./componentSliders"
import type { SliderAdjustment, SliderKind } from "./componentSliders"
import { captureCsv, captureWav, normalizedAudio } from "./capture"
const examples = new Map(
  Object.values(
    import.meta.glob<CircuitDocument>(
      [
        "../../../docs/new-simulator/examples/*.json",
        "!../../../docs/new-simulator/examples/worker-session.json",
      ],
      { eager: true, import: "default" }
    )
  ).map((document) => [document.title, document])
)
const exampleNames = [...examples.keys()].sort((a, b) => a.localeCompare(b))

const scopeTimeDivisions = [
  1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 0.001, 0.002, 0.005, 0.01, 0.02,
]
const scopeVoltageDivisions = [
  0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10,
]

function formatScope(value: number | null | undefined, unit = "") {
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

type PendingAdjustment = SliderAdjustment & { document: CircuitDocument }

function nextTraceName(
  probes: CircuitDocument["probes"],
  base: string,
  exclude?: string
) {
  const names = new Set(
    probes
      .filter(({ id }) => id !== exclude)
      .map((probe) => probe.label || "Wire")
  )
  if (!names.has(base)) return base
  let number = 2
  while (names.has(`${base} ${number}`)) number++
  return `${base} ${number}`
}

function ScopePane({
  id,
  channels,
  times,
  start,
  end,
  volts,
  hidden,
  cursor,
  onVolts,
  onToggleChannel,
  onRenameChannel,
  onCursor,
  onLeave,
  onRemove,
}: {
  id: number
  channels: {
    id: string
    label: string
    color: string
    values: number[]
    min: number | null
    max: number | null
    last?: number
  }[]
  times: number[]
  start: number
  end: number
  volts: string
  hidden: string[]
  cursor: number | null
  onVolts: (value: string) => void
  onToggleChannel: (id: string) => void
  onRenameChannel: (id: string) => void
  onCursor: (fraction: number) => void
  onLeave: () => void
  onRemove?: () => void
}) {
  const channelLabelId = useId()
  const width = 720,
    height = 200,
    left = 55,
    right = width - 17,
    top = 14,
    bottom = height - 28
  const plotWidth = right - left,
    plotHeight = bottom - top
  const visible = channels.filter((channel) => !hidden.includes(channel.id))
  const voltsPerDivision =
    volts === "auto" ? core.signals.autoScale(visible) : Number(volts)
  const x = (time: number) =>
    left + ((time - start) / Math.max(end - start, 1e-12)) * plotWidth
  const y = (value: number) =>
    Math.max(
      top - 2,
      Math.min(
        bottom + 2,
        top + plotHeight / 2 - (value / (voltsPerDivision * 8)) * plotHeight
      )
    )
  let readingIndex = times.length - 1
  if (cursor !== null && times.length) {
    const targetTime = start + cursor * (end - start)
    readingIndex = 0
    for (let i = 1; i < times.length; i++)
      if (
        Math.abs(times[i] - targetTime) <
        Math.abs(times[readingIndex] - targetTime)
      )
        readingIndex = i
  }
  const paths = visible.map((channel) => {
    const points = core.signals.envelope(
      times,
      channel.values,
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
  })
  let readings =
    readingIndex < 0
      ? "Place a Probe, then Run. Hover the plot for synchronized voltage readings."
      : `${cursor === null ? "Latest" : "Cursor"} t=${formatScope(times[readingIndex], "s")}  ·  ${visible.map((channel) => `${channel.label} ${formatScope(channel.values[readingIndex], "V")}`).join("  ·  ")}`
  if (readingIndex >= 0 && visible.length === 2)
    readings += `  ·  Δ (${visible[1].label} − ${visible[0].label}) ${formatScope(visible[1].values[readingIndex] - visible[0].values[readingIndex], "V")}`
  const emptyMessage = !channels.length
    ? "Place voltage probes on the input and output"
    : !visible.length
      ? "Enable a probe channel to plot it"
      : "Run or Step to capture waveforms"

  return (
    <section
      className="h-[252px] min-h-[226px] min-w-0 resize-y overflow-auto border"
      data-pane={id}
    >
      {id > 1 && (
        <div className="flex h-8 items-center gap-3 px-2 text-xs">
          <span>Pane {id}</span>
          <label className="ml-auto">
            Voltage{" "}
            <NativeSelect
              size="sm"
              aria-label={`Pane ${id} volts per division`}
              value={volts}
              onChange={(event) => onVolts(event.target.value)}
            >
              <NativeSelectOption value="auto">Auto</NativeSelectOption>
              {scopeVoltageDivisions.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {formatScope(value, "V")}/div
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button variant="outline" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
      <div
        className={
          id === 1
            ? "grid h-[calc(100%-26px)] min-h-[160px] grid-cols-[minmax(0,1fr)_145px]"
            : "grid h-[calc(100%-58px)] min-h-[160px] grid-cols-[minmax(0,1fr)_145px]"
        }
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full touch-none"
          role="img"
          aria-label={`Pane ${id} voltage waveforms`}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            onCursor(
              Math.max(
                0,
                Math.min(
                  1,
                  (event.clientX - rect.left - (rect.width * left) / width) /
                    ((rect.width * plotWidth) / width)
                )
              )
            )
          }}
          onPointerLeave={onLeave}
        >
          <rect width={width} height={height} fill="#101720" />
          {Array.from({ length: 11 }, (_, i) => {
            const gx = left + (plotWidth * i) / 10
            return (
              <g key={`x-${i}`}>
                <path d={`M${gx} ${top}V${bottom}`} stroke="#26313e" />
                {i % 2 === 0 && (
                  <text
                    x={gx}
                    y={height - 9}
                    fill="#8797ab"
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
                  stroke={i === 4 ? "#526071" : "#26313e"}
                />
                {i % 2 === 0 && (
                  <text
                    x={left - 8}
                    y={gy + 4}
                    fill="#8797ab"
                    textAnchor="end"
                    fontSize={10}
                  >
                    {formatScope((4 - i) * voltsPerDivision, "V")}
                  </text>
                )}
              </g>
            )
          })}
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
                    data-scope-trace={channel.id}
                    d={d}
                    fill="none"
                    stroke={channel.color}
                    strokeWidth={1.8}
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
            {readingIndex >= 0 && cursor !== null && (
              <path
                d={`M${x(times[readingIndex])} ${top}V${bottom}`}
                stroke="#d4deeb"
                strokeDasharray="3 3"
              />
            )}
          </g>
          {(!channels.length || !visible.length || !times.length) && (
            <text
              x={left + plotWidth / 2}
              y={top + plotHeight / 2}
              textAnchor="middle"
              fill="#a0afc2"
              fontSize={12}
            >
              {emptyMessage}
            </text>
          )}
        </svg>
        <div
          className="overflow-auto border-l px-2 py-1 text-xs"
          aria-label="Voltage probe channels"
        >
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1 border-b py-1.5"
              data-scope-channel={channel.id}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Checkbox
                  id={`${channelLabelId}-${channel.id}`}
                  checked={!hidden.includes(channel.id)}
                  onCheckedChange={() => onToggleChannel(channel.id)}
                />
                <label
                  htmlFor={`${channelLabelId}-${channel.id}`}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <span
                    className="h-[3px] w-3 shrink-0"
                    style={{ background: channel.color }}
                  />
                  <span className="truncate">{channel.label}</span>
                </label>
              </div>
              <span className="tabular-nums">
                {formatScope(channel.last, "V")}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Rename trace ${channel.label}`}
                onClick={() => onRenameChannel(channel.id)}
              >
                <PencilIcon aria-hidden="true" />
              </Button>
              <small className="col-span-3 text-muted-foreground">
                min {formatScope(channel.min, "V")} · max{" "}
                {formatScope(channel.max, "V")}
              </small>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[26px] overflow-auto border-t px-3 py-1 text-[10px] whitespace-nowrap text-muted-foreground">
        {readings}
      </div>
    </section>
  )
}

/** React editor shell and controls over the shared circuit editing/simulation core. */
export function CircuitEditor({
  initialDocument,
  autosave = true,
}: {
  initialDocument?: CircuitDocument
  autosave?: boolean
}) {
  const editor = useCircuitSession(initialDocument, autosave)
  const [selection, setSelection] = useState<Entity[]>([])
  const [tool, setTool] = useState("select")
  const [gridMode, setGridMode] = useState<"dots" | "lines" | "off">("lines")
  const [scopeOpen, setScopeOpen] = useState(false)
  const [scopeLayout, setScopeLayout] = useState<"stacked" | "side">("stacked")
  const [scopeTimeDivision, setScopeTimeDivision] = useState("0.0002")
  const [scopePanes, setScopePanes] = useState([
    { id: 1, volts: "auto", hidden: [] as string[] },
  ])
  const [scopeCursor, setScopeCursor] = useState<number | null>(null)
  const cursorFrame = useRef<number | null>(null)
  const cursorValue = useRef<number | null>(null)
  const nextScopePane = useRef(2)
  const [fitRequest, setFitRequest] = useState(0)
  const [editing, setEditing] = useState<Entity | null>(null)
  const [sliderPanel, setSliderPanel] = useState<"manual" | "placement" | null>(
    null
  )
  const sliderPanelOpen = sliderPanel !== null
  const sliderComponents = useMemo(
    () => editor.document.electrical.components.filter(hasSlider),
    [editor.document]
  )
  const [sliderAdjustment, setSliderAdjustment] =
    useState<PendingAdjustment | null>(null)
  const pendingSlider = useRef<PendingAdjustment | null>(null)
  const sliderPreviewFrame = useRef<number | null>(null)
  const sliderPreviewInFlight = useRef(false)
  const workspace = useRef<HTMLDivElement>(null)
  const [notice, setNotice] = useState("Ready")
  const fileInput = useRef<HTMLInputElement>(null)
  const documentRequest = useRef(0)
  const frame = core.simulation.presentationFrame(editor.simulation)
  const canStep =
    !!editor.simulation.accepted &&
    !editor.simulation.runRequested &&
    editor.simulation.status === "paused"
  const scopeInfo = core.geometry.scopeChannels(editor.document)
  useEffect(() => {
    const { electrical, probes } = editor.document
    const ids = {
      component: new Set(electrical.components.map(({ id }) => id)),
      junction: new Set(electrical.junctions.map(({ id }) => id)),
      wire: new Set(electrical.wires.map(({ id }) => id)),
      probe: new Set(probes.map(({ id }) => id)),
    }
    setSelection((current) => {
      const valid = current.filter(({ kind, id }) => ids[kind].has(id))
      return valid.length === current.length ? current : valid
    })
    if (
      pendingSlider.current &&
      pendingSlider.current.document !== editor.document
    ) {
      pendingSlider.current = null
      setSliderAdjustment(null)
    }
  }, [editor.document])
  useEffect(
    () => () => {
      pendingSlider.current = null
      if (sliderPreviewFrame.current !== null) {
        cancelAnimationFrame(sliderPreviewFrame.current)
        sliderPreviewFrame.current = null
      }
    },
    []
  )
  const editingComponent =
    editing?.kind === "component"
      ? editor.document.electrical.components.find(
          ({ id }) => id === editing.id
        )
      : undefined
  const editingProbe =
    editing?.kind === "probe"
      ? editor.document.probes.find(({ id }) => id === editing.id)
      : undefined
  const activeSliderAdjustment =
    sliderAdjustment?.document === editor.document ? sliderAdjustment : null

  function beginEdit(entity: Entity) {
    cancelSliderAdjustment()
    setEditing(entity)
    setSelection([entity])
  }
  function closeProperties() {
    setEditing(null)
  }
  function applyEdit(parameters: Component["parameters"]) {
    editor.session.transaction("Edit component", (draft) => {
      const component = draft.electrical.components.find(
        (item) => item.id === editingComponent?.id
      )
      if (!component) throw new Error("Component no longer exists")
      component.parameters = parameters
    })
    closeProperties()
    setNotice("Component updated")
  }
  function toggleComponent(id: string) {
    editor.session.transaction("Toggle component", (draft) => {
      const component = draft.electrical.components.find(
        (item) => item.id === id
      )
      if (!component) return
      const p = component.parameters as Record<string, any>
      if (component.kind === "switch") p.closed = !p.closed
      else if (component.kind === "logicInput")
        p.state = (p.state + 1) % (p.mode === "ternary" ? 3 : 2)
      else if (
        ["spdtSwitch", "dpdtSwitch", "mbbSwitch"].includes(component.kind)
      ) {
        const count =
          component.kind === "spdtSwitch"
            ? 3
            : component.kind === "mbbSwitch"
              ? 4
              : 2
        p.position = (p.position + 1) % count
      }
    })
  }
  function pressComponent(id: string) {
    const pressed = core.editing.momentaryDocument(editor.document, id)
    void editor.run.current
      ?.setDocument(pressed)
      .catch((cause) => setNotice(String(cause)))
  }
  function releaseComponent() {
    void editor.run.current
      ?.setDocument(editor.document)
      .catch((cause) => setNotice(String(cause)))
  }
  function clearSliderAdjustment() {
    pendingSlider.current = null
    setSliderAdjustment(null)
    if (sliderPreviewFrame.current !== null) {
      cancelAnimationFrame(sliderPreviewFrame.current)
      sliderPreviewFrame.current = null
    }
  }
  function cancelSliderAdjustment() {
    if (pendingSlider.current) {
      clearSliderAdjustment()
      void editor.run.current
        ?.setDocument(editor.session.document)
        .catch((cause) => setNotice(String(cause)))
    }
  }
  function setSliderPanelVisibility(open: boolean) {
    if (!open) {
      cancelSliderAdjustment()
      if (document.activeElement?.closest("[data-component-slider-panel]"))
        workspace.current
          ?.querySelector<SVGSVGElement>("svg[tabindex]")
          ?.focus()
    }
    setSliderPanel(open ? "manual" : null)
  }
  function previewSlider(kind: SliderKind, id: string, value: number) {
    const pending = pendingSlider.current
    if (pending && (pending.id !== id || pending.document !== editor.document))
      return
    const next = { document: editor.document, kind, id, value }
    pendingSlider.current = next
    setSliderAdjustment(next)
    scheduleSliderPreview()
  }
  function scheduleSliderPreview() {
    if (sliderPreviewFrame.current !== null || sliderPreviewInFlight.current)
      return
    sliderPreviewFrame.current = requestAnimationFrame(() => {
      sliderPreviewFrame.current = null
      const pending = pendingSlider.current
      const coordinator = editor.run.current
      if (!pending || !coordinator) return
      const preview = editor.session.document
      const source = preview.electrical.components.find(
        ({ id }) => id === pending.id
      )
      if (source?.kind !== pending.kind) return
      source.parameters[componentSliders[pending.kind].field] = pending.value
      sliderPreviewInFlight.current = true
      void coordinator
        .setDocument(preview)
        .catch((cause) => setNotice(String(cause)))
        .finally(() => {
          sliderPreviewInFlight.current = false
          if (pendingSlider.current && pendingSlider.current !== pending)
            scheduleSliderPreview()
        })
    })
  }
  function commitSlider(id: string, value: number) {
    const pending = pendingSlider.current
    if (!pending || pending.id !== id) return
    clearSliderAdjustment()
    if (pending.document !== editor.document) return
    const { field, historyLabel } = componentSliders[pending.kind]
    try {
      const changed = editor.session.transaction(historyLabel, (draft) => {
        const source = draft.electrical.components.find(
          (item) => item.id === id
        )
        if (source?.kind === pending.kind) source.parameters[field] = value
      })
      if (changed) return
    } catch (cause) {
      setNotice(String(cause))
    }
    void editor.run.current
      ?.setDocument(editor.session.document)
      .catch((cause) => setNotice(String(cause)))
  }
  function addProbe(target: Target) {
    const id = editor.session.addProbe(
      target,
      nextTraceName(editor.session.document.probes, "Wire")
    )
    setSelection([{ kind: "probe", id }])
    setScopeOpen(true)
  }
  function plotMeter(componentId: string) {
    const component = editor.document.electrical.components.find(
      (item) => item.id === componentId
    )
    if (!component) return
    const id = crypto.randomUUID()
    editor.session.transaction("Plot meter", (draft) => {
      const item = draft.electrical.components.find(
        (candidate) => candidate.id === componentId
      )
      if (!item) return
      const label = nextTraceName(
        draft.probes,
        core.catalog.definitions[item.kind].name
      )
      draft.probes.push(
        item.kind === "voltmeter"
          ? {
              id,
              kind: "voltage",
              label,
              positive: { kind: "pin", componentId, pinId: "a" },
              negative: { kind: "pin", componentId, pinId: "b" },
              reference: "pins",
            }
          : {
              id,
              kind: "voltage",
              label,
              positive: { kind: "pin", componentId, pinId: "in" },
              reference: "ground",
            }
      )
      ;(draft.layout.probes ||= {})[id] = { x: 0, y: -32 }
    })
    setSelection([{ kind: "probe", id }])
    setScopeOpen(true)
  }
  function saveDocument() {
    const data = JSON.stringify(editor.document, null, 2) + "\n"
    const name =
      editor.document.title.replace(/[^\w -]/g, "").trim() || "circuit"
    download(data, `${name}.json`, "application/json")
    setNotice("Circuit saved")
  }
  function download(data: BlobPart, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }))
    const anchor = window.document.createElement("a")
    anchor.href = url
    anchor.download = name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function downloadVoltageCapture(id: string, name: string) {
    const capture = await editor.run.current?.readCapture(id)
    if (!capture)
      throw new Error("Run the circuit to capture voltage data first")
    download(captureCsv(capture), `${name}.csv`, "text/csv")
  }
  async function downloadAudioCapture(id: string, name: string) {
    const capture = await editor.run.current?.readCapture(id)
    if (!capture) throw new Error("Run the circuit to capture audio first")
    download(captureWav(capture), `${name}.wav`, "audio/wav")
  }
  async function playAudioCapture(id: string) {
    const audio = new AudioContext()
    try {
      await audio.resume()
      const capture = await editor.run.current?.readCapture(id)
      if (!capture?.values.length)
        throw new Error("Run the circuit to capture audio first")
      const buffer = audio.createBuffer(
        1,
        capture.values.length,
        Math.round(1 / capture.timeStep)
      )
      buffer.copyToChannel(normalizedAudio(capture.values), 0)
      const source = audio.createBufferSource()
      source.buffer = buffer
      source.connect(audio.destination)
      source.onended = () => void audio.close()
      source.start()
    } catch (cause) {
      await audio.close()
      throw cause
    }
  }
  function componentActions({ id, kind }: Component) {
    if (kind === "variableVoltage" || kind === "potentiometer")
      return [
        {
          label: "Open sliders",
          run: () => {
            closeProperties()
            setSliderPanelVisibility(true)
          },
        },
      ]
    if (kind === "audioOutput")
      return [
        { label: "Play captured audio", run: () => playAudioCapture(id) },
        {
          label: "Download samples · CSV",
          run: () => downloadVoltageCapture(id, "audio-capture"),
        },
        {
          label: "Download audio · WAV",
          run: () => downloadAudioCapture(id, "audio-capture"),
        },
      ]
    if (kind === "dataExport")
      return [
        {
          label: "Download voltage data · CSV",
          run: () => downloadVoltageCapture(id, "voltage-data"),
        },
      ]
    if (kind === "voltmeter" || kind === "testPoint")
      return [
        {
          label: "Plot in oscilloscope",
          run: () => {
            plotMeter(id)
            closeProperties()
          },
        },
      ]
    return []
  }
  async function openFile(file?: File) {
    if (!file) return
    const request = ++documentRequest.current
    try {
      const content = await file.text()
      if (request === documentRequest.current)
        replaceDocument(
          JSON.parse(content) as CircuitDocument,
          `Opened ${file.name}`
        )
    } catch (cause) {
      if (request === documentRequest.current)
        setNotice(`Could not open circuit: ${String(cause)}`)
    }
  }
  function replaceDocument(document: CircuitDocument, message: string) {
    editor.session.replace(document)
    setSelection([])
    closeProperties()
    if (pendingSlider.current) cancelSliderAdjustment()
    setTool("select")
    setFitRequest((value) => value + 1)
    setNotice(message)
  }
  function newDocument() {
    documentRequest.current++
    replaceDocument(core.document.empty(), "New circuit")
  }
  function loadExample(name: string) {
    const example = examples.get(name)
    if (!example) return
    documentRequest.current++
    replaceDocument(example, `Loaded ${name}`)
  }
  const title = editor.document.title
  const error = editor.simulation.error?.message || editor.error
  function updateScopeCursor(value: number | null) {
    cursorValue.current = value
    if (value === null) {
      if (cursorFrame.current !== null)
        cancelAnimationFrame(cursorFrame.current)
      cursorFrame.current = null
      setScopeCursor(null)
    } else if (cursorFrame.current === null) {
      cursorFrame.current = requestAnimationFrame(() => {
        cursorFrame.current = null
        setScopeCursor(cursorValue.current)
      })
    }
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Circuit editor"
    >
      {editingComponent && (
        <ComponentProperties
          key={editingComponent.id}
          component={editingComponent}
          onApply={applyEdit}
          onClose={() => closeProperties()}
          frame={frame}
          actions={componentActions(editingComponent)}
        />
      )}
      {editingProbe && (
        <EditorDialog title="Rename trace" onClose={() => closeProperties()}>
          <form
            className="grid gap-3 text-sm"
            onSubmit={(event) => {
              event.preventDefault()
              const label = String(
                new FormData(event.currentTarget).get("label")
              ).trim()
              editor.session.transaction("Rename trace", (draft) => {
                const probe = draft.probes.find(
                  ({ id }) => id === editingProbe.id
                )
                if (probe)
                  probe.label =
                    label || nextTraceName(draft.probes, "Wire", probe.id)
              })
              closeProperties()
            }}
          >
            <label className="grid gap-1">
              Trace name
              <Input
                name="label"
                defaultValue={editingProbe.label || ""}
                placeholder="Wire"
                maxLength={80}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeProperties()}
              >
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </EditorDialog>
      )}
      <header className="flex flex-wrap items-center gap-2 border-b p-2">
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            void openFile(event.target.files?.[0])
            event.currentTarget.value = ""
          }}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {autosave && editor.savedLocally !== null && (
          <span className="text-xs text-muted-foreground">
            {editor.savedLocally
              ? "Saved locally"
              : "Save JSON to keep your work"}
          </span>
        )}
        {editor.simulation.runRequested ? (
          <Button size="sm" onClick={() => void editor.run.current?.pause()}>
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={
              !editor.simulation.accepted ||
              ["loading", "error", "empty"].includes(editor.simulation.status)
            }
            onClick={() => void editor.run.current?.run()}
          >
            Start
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={
            !editor.simulation.accepted ||
            editor.simulation.status === "loading"
          }
          onClick={() =>
            void editor.run.current
              ?.reset()
              .then(() => editor.run.current?.step(1))
              .catch(() => {})
          }
        >
          Reset
        </Button>
      </header>

      <div ref={workspace} className="relative flex min-h-0 flex-1 flex-col">
        <CircuitSheet
          document={editor.document}
          execute={editor.execute}
          undo={editor.session.undo}
          redo={editor.session.redo}
          selection={selection}
          onSelection={setSelection}
          tool={tool}
          onToolChange={setTool}
          onAddProbe={addProbe}
          onEdit={beginEdit}
          onToggleComponent={toggleComponent}
          onPressComponent={pressComponent}
          onReleaseComponent={releaseComponent}
          onSaveDocument={saveDocument}
          onOpenDocument={() => fileInput.current?.click()}
          onNewDocument={newDocument}
          onLoadExample={loadExample}
          exampleNames={exampleNames}
          canUndo={editor.session.canUndo}
          canRedo={editor.session.canRedo}
          gridMode={gridMode}
          onGridModeChange={setGridMode}
          scopeOpen={scopeOpen}
          onToggleScope={() => setScopeOpen((open) => !open)}
          sliderPanelOpen={sliderPanelOpen}
          onSliderPanelChange={setSliderPanelVisibility}
          onPlaceSlider={() =>
            setSliderPanel((current) => current ?? "placement")
          }
          sliderPreview={activeSliderAdjustment}
          canStep={canStep}
          onNotice={setNotice}
          onStepSimulation={() =>
            void editor.run.current
              ?.step(10)
              .catch((cause) => setNotice(String(cause)))
          }
          frame={frame}
          fitRequest={fitRequest}
        />
        <ComponentSliderPanel
          open={sliderPanelOpen}
          focusOnOpen={sliderPanel === "manual"}
          documentId={editor.document.id}
          persistOrder={autosave}
          components={sliderComponents}
          adjustment={activeSliderAdjustment}
          onPreview={previewSlider}
          onCommit={commitSlider}
          onCancelAdjustment={cancelSliderAdjustment}
          onClose={() => setSliderPanelVisibility(false)}
        />
      </div>
      <div className="border-y px-2 py-1 text-xs" role="status">
        {error || notice}
      </div>
      <div
        className="flex min-h-9 items-center gap-3 border-b px-2 text-xs"
        aria-label="Oscilloscope"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={scopeOpen}
          onClick={() => setScopeOpen((open) => !open)}
        >
          {scopeOpen ? "▾" : "▸"} Oscilloscope
        </Button>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {editor.scopeData.channels.length} voltage{" "}
          {editor.scopeData.channels.length === 1 ? "probe" : "probes"} ·{" "}
          {(
            editor.scopeData.stored ?? editor.scopeData.times.length
          ).toLocaleString()}{" "}
          samples ·{" "}
          {editor.simulation.status === "error" ||
          editor.simulation.status === "empty" ||
          editor.simulation.status === "disposed"
            ? "Waiting for valid circuit"
            : editor.simulation.status === "loading"
              ? "Resetting"
              : editor.simulation.runRequested
                ? "Running"
                : "Paused"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            editor.clearScope()
            updateScopeCursor(null)
          }}
        >
          Clear
        </Button>
      </div>
      {scopeOpen && (
        <div
          className="grid max-h-[48vh] gap-2 overflow-auto border-b p-2"
          data-layout={scopeLayout}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label>
              Time{" "}
              <NativeSelect
                size="sm"
                aria-label="Oscilloscope time per division"
                value={scopeTimeDivision}
                onChange={(event) => {
                  const value = event.target.value
                  setScopeTimeDivision(value)
                  updateScopeCursor(null)
                  editor.setScopeTime(Number(value))
                }}
              >
                {scopeTimeDivisions.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {formatScope(value, "s")}/div
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label>
              Pane 1 voltage{" "}
              <NativeSelect
                size="sm"
                aria-label="Pane 1 volts per division"
                value={scopePanes[0].volts}
                onChange={(event) =>
                  setScopePanes((panes) =>
                    panes.map((pane) =>
                      pane.id === 1
                        ? { ...pane, volts: event.target.value }
                        : pane
                    )
                  )
                }
              >
                <NativeSelectOption value="auto">Auto</NativeSelectOption>
                {scopeVoltageDivisions.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {formatScope(value, "V")}/div
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={scopePanes.length >= 4}
              onClick={() =>
                setScopePanes((panes) => [
                  ...panes,
                  {
                    id: nextScopePane.current++,
                    volts: "auto",
                    hidden: [],
                  },
                ])
              }
            >
              + Pane
            </Button>
            <NativeSelect
              size="sm"
              aria-label="Oscilloscope pane layout"
              value={scopeLayout}
              onChange={(event) =>
                setScopeLayout(event.target.value as typeof scopeLayout)
              }
            >
              <NativeSelectOption value="stacked">Stacked</NativeSelectOption>
              <NativeSelectOption value="side">Side by side</NativeSelectOption>
            </NativeSelect>
            <span className="min-w-0 flex-1 text-muted-foreground">
              Linked time/cursor · {formatScope(frame?.timeStep, "s")} sample
              interval · {editor.scopeData.capacity.toLocaleString()} sample
              buffer.{" "}
              {Math.max(0, scopeInfo.channels.length - 32)
                ? `First 32 probes shown (${scopeInfo.channels.length - 32} more). `
                : ""}
              {scopeInfo.unresolved.length
                ? `${scopeInfo.unresolved.length} unconnected probe target(s).`
                : ""}
            </span>
            {editor.simulation.runRequested ? (
              <Button
                size="sm"
                onClick={() => void editor.run.current?.pause()}
              >
                Ⅱ Pause
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={
                  !editor.simulation.accepted ||
                  ["error", "empty", "disposed", "loading"].includes(
                    editor.simulation.status
                  )
                }
                onClick={() => void editor.run.current?.run()}
              >
                ▶ Run
              </Button>
            )}
          </div>
          <div
            className={
              scopeLayout === "side"
                ? "grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-2"
                : "grid gap-2"
            }
          >
            {scopePanes.map((pane) => (
              <ScopePane
                key={pane.id}
                id={pane.id}
                channels={editor.scopeData.channels}
                times={editor.scopeData.times}
                start={editor.scopeData.start}
                end={editor.scopeData.end}
                volts={pane.volts}
                hidden={pane.hidden}
                cursor={scopeCursor}
                onVolts={(volts) =>
                  setScopePanes((items) =>
                    items.map((item) =>
                      item.id === pane.id ? { ...item, volts } : item
                    )
                  )
                }
                onToggleChannel={(channelId) =>
                  setScopePanes((items) =>
                    items.map((item) =>
                      item.id === pane.id
                        ? {
                            ...item,
                            hidden: item.hidden.includes(channelId)
                              ? item.hidden.filter((id) => id !== channelId)
                              : [...item.hidden, channelId],
                          }
                        : item
                    )
                  )
                }
                onRenameChannel={(id) => beginEdit({ kind: "probe", id })}
                onCursor={updateScopeCursor}
                onLeave={() => updateScopeCursor(null)}
                onRemove={
                  pane.id > 1
                    ? () =>
                        setScopePanes((items) =>
                          items.filter((item) => item.id !== pane.id)
                        )
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
