import { defaultScopeLayout } from "./scopeLayout"
import { createScopeViewport } from "./scopeViewport"
import { TraceProperties } from "./TraceProperties"
import { ScopeWorkspace } from "./ScopeWorkspace"
import { scopeWindow } from "./scopeDisplay"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { core } from "./core"
import type {
  CircuitDocument,
  Component,
  Entity,
  Target,
  LabelSettings,
} from "./core"
import { useCircuitSession } from "./useCircuitSession"
import { CircuitSheet } from "./CircuitSheet"
import { ComponentProperties } from "./ComponentProperties"
import { ComponentSliderPanel } from "./ComponentSliderPanel"
import { PropertySliderDialog, numericProperties } from "./PropertySliders"
import type { PropertySlider } from "./PropertySliders"
import {
  componentSliders,
  clampSliderValue,
  hasSlider,
  sliderField,
  setProperty,
} from "./componentSliders"
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
  const [scopeViewport] = useState(createScopeViewport)
  const scopeOpen = editor.document.layout.scopes?.open ?? false
  function setScopeOpen(change: boolean | ((open: boolean) => boolean)) {
    editor.session.transaction("Scope panel", (draft) => {
      const scopes = (draft.layout.scopes ||= defaultScopeLayout())
      scopes.open = typeof change === "function" ? change(scopes.open) : change
    })
  }
  const saveScopeLayout = useCallback(
    (
      layout: Omit<
        NonNullable<CircuitDocument["layout"]["scopes"]>,
        "version" | "open"
      >
    ) => {
      editor.session.transaction("Scope layout", (draft) => {
        draft.layout.scopes = {
          ...layout,
          version: 1,
          open: draft.layout.scopes?.open ?? false,
        }
      })
    },
    [editor.session]
  )
  const [scopePropertiesSpan, setScopePropertiesSpan] = useState(0.002)
  const [scopeCursor, setScopeCursor] = useState<number | null>(null)
  const cursorFrame = useRef<number | null>(null)
  const cursorValue = useRef<number | null>(null)
  const [fitRequest, setFitRequest] = useState(0)
  const [editing, setEditing] = useState<Entity | null>(null)
  const [editingPropertySlider, setEditingPropertySlider] = useState<
    PropertySlider | undefined
  >(undefined)
  const [sliderComponentId, setSliderComponentId] = useState<string | null>(
    null
  )
  const [propertySlidersByDocument, setPropertySlidersByDocument] = useState<
    Record<string, PropertySlider[]>
  >(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("circuit-editor.property-sliders.v1") ?? "{}"
      )
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {}
      return Object.fromEntries(
        Object.entries(saved).map(([id, entries]) => [
          id,
          Array.isArray(entries)
            ? entries.filter(
                (entry) =>
                  entry &&
                  typeof entry.id === "string" &&
                  typeof entry.componentId === "string" &&
                  typeof entry.field === "string" &&
                  typeof entry.label === "string" &&
                  [entry.min, entry.max, entry.step].every(
                    (value) =>
                      typeof value === "number" && Number.isFinite(value)
                  ) &&
                  entry.min < entry.max &&
                  entry.step > 0
              )
            : [],
        ])
      )
    } catch {
      return {}
    }
  })
  const propertySliders = propertySlidersByDocument[editor.document.id] ?? []
  function updatePropertySliders(
    update: PropertySlider[] | ((current: PropertySlider[]) => PropertySlider[])
  ) {
    setPropertySlidersByDocument((current) => {
      const sliders =
        typeof update === "function"
          ? update(current[editor.document.id] ?? [])
          : update
      const next = { ...current, [editor.document.id]: sliders }
      if (autosave) {
        try {
          localStorage.setItem(
            "circuit-editor.property-sliders.v1",
            JSON.stringify(next)
          )
        } catch {
          /* Keep controls available in this session. */
        }
      }
      return next
    })
  }
  const sliderComponent = editor.document.electrical.components.find(
    ({ id }) => id === sliderComponentId
  )
  const [sliderPanel, setSliderPanel] = useState<"manual" | "placement" | null>(
    null
  )
  const sliderComponents = useMemo(
    () => editor.document.electrical.components.filter(hasSlider),
    [editor.document]
  )
  const sliderPanelRequired =
    sliderComponents.length > 0 ||
    propertySliders.some((slider) =>
      editor.document.electrical.components.some(
        (component) =>
          component.id === slider.componentId &&
          numericProperties(component.parameters).some(
            ([field]) => field === slider.field
          )
      )
    )
  const sliderPanelOpen = sliderPanelRequired || sliderPanel !== null
  const [sliderAdjustment, setSliderAdjustment] =
    useState<PendingAdjustment | null>(null)
  const pendingSlider = useRef<PendingAdjustment | null>(null)
  const sliderPreviewFrame = useRef<number | null>(null)
  const sliderPreviewInFlight = useRef(false)
  const lastSliderPreviewAt = useRef(-Infinity)
  const workspace = useRef<HTMLDivElement>(null)
  const [, setNotice] = useState("Ready")
  const fileInput = useRef<HTMLInputElement>(null)
  const documentRequest = useRef(0)
  const frame = core.simulation.presentationFrame(editor.simulation)
  const canStep =
    !!editor.simulation.accepted &&
    !editor.simulation.runRequested &&
    editor.simulation.status === "paused"

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

  function beginEdit(entity: Entity, span = 0.002) {
    setScopePropertiesSpan(span)
    cancelSliderAdjustment()
    setEditing(entity)
    setSelection([entity])
  }
  function closeProperties() {
    setEditing(null)
  }
  function applyEdit(
    parameters: Component["parameters"],
    label: LabelSettings
  ) {
    editor.session.transaction("Edit component", (draft) => {
      const component = draft.electrical.components.find(
        (item) => item.id === editingComponent?.id
      )
      if (!component) throw new Error("Component no longer exists")
      core.editing.replaceParameters(draft, component.id, parameters)
      draft.layout.components[component.id].label = label
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
      if (core.catalog.switchKind(component.kind))
        core.editing.toggleSwitches(draft, id)
      else if (component.kind === "logicInput")
        p.state = (p.state + 1) % (p.mode === "ternary" ? 3 : 2)
    })
  }
  function pressComponent(id: string) {
    const pressed = core.editing.momentaryDocument(editor.document, id)
    void editor.run.current
      ?.setDocument(pressed)
      .catch((cause) => setNotice(String(cause)))
  }
  function releaseComponent(id: string) {
    const component = editor.document.electrical.components.find(
      (c) => c.id === id
    )
    if (component && core.catalog.switchPositionCount(component) > 2)
      editor.session.transaction("Release momentary switch", (draft) => {
        core.editing.toggleSwitches(draft, id)
        core.editing.toggleSwitches(draft, id)
      })
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
    if (!open && sliderPanelRequired) return
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
    value = clampSliderValue(kind, componentSliders[kind].field, value)
    const next = { document: editor.document, kind, id, value }
    pendingSlider.current = next
    scheduleSliderPreview()
  }
  function previewPropertySlider(
    component: Component,
    field: string,
    value: number
  ) {
    const pending = pendingSlider.current
    if (
      pending &&
      (pending.id !== component.id ||
        sliderField(pending) !== field ||
        pending.document !== editor.document)
    )
      return
    value = clampSliderValue(component.kind, field, value)
    const next = {
      document: editor.document,
      kind: component.kind,
      id: component.id,
      field,
      value,
    }
    pendingSlider.current = next
    scheduleSliderPreview()
  }
  function scheduleSliderPreview() {
    if (sliderPreviewFrame.current !== null) return
    sliderPreviewFrame.current = requestAnimationFrame((now) => {
      sliderPreviewFrame.current = null
      const pending = pendingSlider.current
      const coordinator = editor.run.current
      if (!pending || !coordinator) return
      // Keep the sheet responsive at display cadence; only the latest control
      // value needs to reach the solver. Never build a queue of mouse events.
      setSliderAdjustment(pending)
      if (sliderPreviewInFlight.current) return
      const state = coordinator.getState()
      if (
        !["running", "paused", "error"].includes(state.status) ||
        now - lastSliderPreviewAt.current < 1000 / 30
      ) {
        scheduleSliderPreview()
        return
      }
      // An idle coordinator has no outstanding step. Updating during a step
      // invalidates its old revision and discards otherwise valid scope samples.
      const preview = editor.session.document
      const source = preview.electrical.components.find(
        ({ id }) => id === pending.id
      )
      if (source?.kind !== pending.kind) return
      setProperty(source.parameters, sliderField(pending), pending.value)
      lastSliderPreviewAt.current = now
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
    const field = sliderField(pending)
    value = clampSliderValue(pending.kind, field, value)
    const historyLabel =
      hasSlider(pending) && !pending.field
        ? componentSliders[pending.kind].historyLabel
        : `Adjust ${field}`
    try {
      const changed = editor.session.transaction(historyLabel, (draft) => {
        const source = draft.electrical.components.find(
          (item) => item.id === id
        )
        if (source?.kind === pending.kind)
          setProperty(source.parameters, field, value)
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
  function plotComponent(componentId: string, pin?: string) {
    const component = editor.document.electrical.components.find(
      ({ id }) => id === componentId
    )
    if (!component) return
    if (pin === "__current") {
      editor.session.transaction("Add current to scope", (draft) => {
        draft.probes.push({
          id: crypto.randomUUID(),
          kind: "current",
          componentId,
          label: nextTraceName(
            draft.probes,
            `${core.catalog.definitions[component.kind].name} current`
          ),
        })
      })
      setScopeOpen(true)
      return
    }
    const pins = Object.keys(core.catalog.componentPins(component))
    const positive = pin ?? pins[0]
    if (!positive) return
    const negative = pin ? undefined : pins[1]
    const id = crypto.randomUUID()
    editor.session.transaction("Add voltage to scope", (draft) => {
      draft.probes.push({
        id,
        kind: "voltage",
        label: nextTraceName(
          draft.probes,
          `${core.catalog.definitions[component.kind].name} ${positive}${negative ? ` − ${negative}` : ""}`
        ),
        positive: { kind: "pin", componentId, pinId: positive },
        ...(negative
          ? {
              negative: { kind: "pin" as const, componentId, pinId: negative },
              reference: "pins",
            }
          : { reference: "ground" }),
      })
    })
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
  function updateScopeCursor(value: number | null, immediate = false) {
    cursorValue.current = value
    if (value === null || immediate) {
      if (cursorFrame.current !== null)
        cancelAnimationFrame(cursorFrame.current)
      cursorFrame.current = null
      setScopeCursor(value)
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
          components={editor.document.electrical.components}
          label={editor.document.layout.components[editingComponent.id].label}
          onApply={applyEdit}
          onClose={() => closeProperties()}
          frame={frame}
          actions={componentActions(editingComponent)}
        />
      )}
      {editingProbe && (
        <TraceProperties
          key={editingProbe.id}
          probe={editingProbe}
          channel={scopeWindow(
            editor.scopeData.channels,
            editor.scopeData.times,
            scopePropertiesSpan
          ).channels.find((c) => c.id === editingProbe.id)}
          span={scopePropertiesSpan}
          onClose={closeProperties}
          onApply={(settings) => {
            editor.session.transaction("Trace properties", (draft) => {
              const trace = draft.probes.find(
                (probe) => probe.id === editingProbe.id
              )
              if (trace)
                Object.assign(trace, settings, {
                  label:
                    settings.label ||
                    nextTraceName(draft.probes, "Wire", trace.id),
                })
            })
            closeProperties()
          }}
          onDelete={() => {
            editor.execute({
              type: "remove",
              selection: [{ kind: "probe", id: editingProbe.id }],
            })
            closeProperties()
          }}
        />
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
          onConfigureSlider={(id) => {
            cancelSliderAdjustment()
            setEditingPropertySlider(undefined)
            setSliderComponentId(id)
          }}
          onPlotComponent={plotComponent}
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
          sliderPanelRequired={sliderPanelRequired}
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
          onViewportChange={scopeViewport.publish}
        />
        <ComponentSliderPanel
          open={sliderPanelOpen}
          dismissible={!sliderPanelRequired}
          focusOnOpen={sliderPanel === "manual"}
          documentId={editor.document.id}
          persistOrder={autosave}
          components={sliderComponents}
          adjustment={activeSliderAdjustment}
          onPreview={previewSlider}
          onCommit={commitSlider}
          onCancelAdjustment={cancelSliderAdjustment}
          onClose={() => setSliderPanelVisibility(false)}
          propertySliders={propertySliders}
          allComponents={editor.document.electrical.components}
          onPropertyPreview={previewPropertySlider}
          onEditPropertySlider={(config) => {
            cancelSliderAdjustment()
            setEditingPropertySlider(config)
            setSliderComponentId(config.componentId)
          }}
          onRemovePropertySlider={(id) => {
            cancelSliderAdjustment()
            updatePropertySliders((current) =>
              current.filter((slider) => slider.id !== id)
            )
          }}
        />
        {sliderComponent && (
          <PropertySliderDialog
            key={`${editor.document.id}:${sliderComponent.id}:${editingPropertySlider?.id ?? "new"}`}
            existing={editingPropertySlider}
            component={sliderComponent}
            onClose={() => setSliderComponentId(null)}
            onSave={(slider) => {
              updatePropertySliders((current) =>
                editingPropertySlider
                  ? current.map((item) =>
                      item.id === slider.id ? slider : item
                    )
                  : [...current, slider]
              )
              setSliderComponentId(null)
              setSliderPanelVisibility(true)
            }}
          />
        )}
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
          {editor.scopeData.channels.length}{" "}
          {editor.scopeData.channels.length === 1 ? "trace" : "traces"} ·{" "}
          {editor.simulation.status === "error" ||
          editor.simulation.status === "empty" ||
          editor.simulation.status === "disposed"
            ? error || "Waiting for valid circuit"
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
      <ScopeWorkspace
        key={editor.document.id}
        channels={editor.scopeData.channels}
        times={editor.scopeData.times}
        cursor={scopeCursor}
        open={scopeOpen}
        sheet={workspace}
        viewport={scopeViewport}
        savedLayout={editor.document.layout.scopes}
        onLayoutChange={saveScopeLayout}
        onDockOpen={() => setScopeOpen(true)}
        onTimeWindow={editor.setScopeTime}
        onDeleteScope={(ids) =>
          editor.execute({
            type: "remove",
            selection: ids.map((id) => ({ kind: "probe", id })),
          })
        }
        onTraceSettings={(id, patch) =>
          editor.session.transaction("Scope trace settings", (draft) => {
            const trace = draft.probes.find((probe) => probe.id === id)
            if (trace) Object.assign(trace, patch)
          })
        }
        onCursorCommit={(time) => updateScopeCursor(time, true)}
        onLeave={() => updateScopeCursor(null)}
        onProperties={(id, span) => beginEdit({ kind: "probe", id }, span)}
      />
    </section>
  )
}
