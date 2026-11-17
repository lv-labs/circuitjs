import {
  memo,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import type { PointerEvent } from "react"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { core } from "./core"
import { symbolBodyHit } from "./symbolHit"
import { moveAnchor } from "./moveAnchor"
import type {
  CircuitDocument,
  Component,
  Command,
  Drag,
  Entity,
  Frame,
  Hit,
  Orientation,
  Point,
  Target,
} from "./core"
import { SymbolBody, SymbolLayer } from "./SymbolLayer"
import { WireLayer } from "./WireLayer"
import { ComponentMenu } from "./ComponentMenu"
import { hasSlider } from "./componentSliders"
import type { SliderAdjustment } from "./componentSliders"

type Gesture =
  | {
      kind: "drag"
      origin: Point
      original: CircuitDocument
      selection: Entity[]
      drag?: Drag
      wireRoute?: { wireId: string; segment: number }
      collapseTo?: Entity
      probeAnchor?: string
      reconnectTo?: Target
      detached: boolean
      keyboard: boolean
      dx: number
      dy: number
      orientations: Orientation[]
    }
  | { kind: "pan"; origin: Point; camera: Point }
  | { kind: "box"; origin: Point; prior: Entity[] }
type Placement =
  | { kind: "component"; symbol: string; rotation: number; mirror: boolean }
  | {
      kind: "paste"
      base: CircuitDocument
      tokens: Set<string>
      entities: Entity[]
      anchor: Point
      orientations: Orientation[]
    }
type WireDraft = {
  from: Target
  points: Point[]
  lastClick?: Point & { time: number }
}

function entityFromHit(hit: Hit | null): Entity | null {
  if (!hit) return null
  if (hit.kind === "pin") return { kind: "component", id: hit.componentId }
  if ("junctionId" in hit) return { kind: "junction", id: hit.junctionId }
  if ("id" in hit) return { kind: hit.kind, id: hit.id }
  return null
}

function pasteDocument(
  placement: Extract<Placement, { kind: "paste" }>,
  point: Point,
  contacts: boolean
) {
  const draft = structuredClone(placement.base)
  core.editing.transformSelection(
    draft,
    placement.tokens,
    point.x - placement.anchor.x,
    point.y - placement.anchor.y,
    { orientations: placement.orientations, contacts }
  )
  return draft
}

export const CircuitSheet = memo(function CircuitSheet({
  document,
  execute,
  undo,
  redo,
  selection,
  onSelection,
  tool,
  onToolChange,
  onAddProbe,
  onEdit,
  onConfigureSlider,
  onPlotComponent,
  onToggleComponent,
  onPressComponent,
  onReleaseComponent,
  onSaveDocument,
  onOpenDocument,
  onNewDocument,
  onLoadExample,
  exampleNames,
  canUndo,
  canRedo,
  gridMode,
  onGridModeChange,
  scopeOpen,
  onToggleScope,
  sliderPanelOpen,
  sliderPanelRequired,
  onSliderPanelChange,
  onPlaceSlider,
  sliderPreview,
  onStepSimulation,
  canStep,
  onNotice,
  frame,
  fitRequest,
  onViewportChange,
}: {
  document: CircuitDocument
  execute: (c: Command) => unknown
  undo: () => void
  redo: () => void
  selection: Entity[]
  onSelection: (s: Entity[]) => void
  tool: string
  onToolChange: (tool: string) => void
  onAddProbe: (target: Target) => void
  onConfigureSlider: (id: string) => void
  onPlotComponent: (id: string, pin?: string) => void
  onEdit: (entity: Entity) => void
  onToggleComponent: (id: string) => void
  onPressComponent: (id: string) => void
  onReleaseComponent: (id: string) => void
  onSaveDocument: () => void
  onOpenDocument: () => void
  onNewDocument: () => void
  onLoadExample: (name: string) => void
  exampleNames: string[]
  canUndo: boolean
  canRedo: boolean
  gridMode: "dots" | "lines" | "off"
  onGridModeChange: (mode: "dots" | "lines" | "off") => void
  scopeOpen: boolean
  onToggleScope: () => void
  sliderPanelOpen: boolean
  sliderPanelRequired: boolean
  onSliderPanelChange: (open: boolean) => void
  onPlaceSlider: () => void
  sliderPreview: SliderAdjustment | null
  onStepSimulation: () => void
  canStep: boolean
  onNotice: (message: string) => void
  frame?: Frame | null
  fitRequest: number
  onViewportChange?: (camera: {
    x: number
    y: number
    scale: number
    top: number
  }) => void
}) {
  const [crosshairMode, setCrosshairMode] = useState<"off" | "small" | "full">(
    () => {
      try {
        const saved = localStorage.getItem("circuit-editor.crosshairs.v1")
        return saved === "small" || saved === "full" ? saved : "off"
      } catch {
        return "off"
      }
    }
  )
  const [crosshairPointer, setCrosshairPointer] = useState<Point | null>(null)
  useEffect(() => {
    try {
      localStorage.setItem("circuit-editor.crosshairs.v1", crosshairMode)
    } catch {
      // Keep the preference for this session when storage is unavailable.
    }
  }, [crosshairMode])
  const svg = useRef<SVGSVGElement>(null),
    gesture = useRef<Gesture | null>(null)
  const clipboard = useRef<CircuitDocument | null>(null)
  const [itemMenu, setItemMenu] = useState<{
    x: number
    y: number
    entity: Entity
    target: Target
  } | null>(null)
  const [componentMenuOpen, setComponentMenuOpen] = useState(false)
  const [componentMenuPosition, setComponentMenuPosition] =
    useState<Point | null>(null)
  const clientPointer = useRef<Point | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [hasClipboard, setHasClipboard] = useState(false)
  const lastBodyClick = useRef<{
    id: string
    time: number
    x: number
    y: number
  } | null>(null)
  const spacePan = useRef(false)
  const pressedPush = useRef<string | null>(null)
  const [pressedSwitch, setPressedSwitch] = useState<string | null>(null)
  const selectedComponents = useMemo(
    () =>
      selection
        .filter((item) => item.kind === "component")
        .map((item) => item.id),
    [selection]
  )
  const [camera, setCamera] = useState({ x: 150, y: 100, scale: 0.448 })
  const viewportOffset = useRef({ x: 0, y: 0 })
  const publishViewport = useEffectEvent(() => {
    const offset = viewportOffset.current
    onViewportChange?.({
      x: camera.x + offset.x,
      y: camera.y + offset.y,
      scale: camera.scale,
      top: offset.y,
    })
  })
  // Read geometry only when the SVG actually resizes, never during pan/zoom.
  useLayoutEffect(() => {
    const element = svg.current
    if (!element || !onViewportChange) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const parent = element.parentElement!.getBoundingClientRect()
      viewportOffset.current = {
        x: rect.left - parent.left,
        y: rect.top - parent.top,
      }
      publishViewport()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [onViewportChange])
  useLayoutEffect(() => {
    publishViewport()
  }, [camera, onViewportChange])
  const [preview, setPreview] = useState<CircuitDocument | null>(null)
  const [box, setBox] = useState<{ a: Point; b: Point } | null>(null)
  const [route, setRoute] = useState<WireDraft | null>(null)
  const [hover, setHover] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const pointer = useRef<Point | null>(null)
  const pasted = useMemo(
    () =>
      placement?.kind === "paste"
        ? pasteDocument(placement, cursor, false)
        : null,
    [placement, cursor]
  )
  const effective = useMemo(
    () =>
      pressedSwitch &&
      document.electrical.components.some(({ id }) => id === pressedSwitch)
        ? core.editing.momentaryDocument(document, pressedSwitch)
        : document,
    [document, pressedSwitch]
  )
  const grid = useId(),
    shown = preview || pasted || effective
  const releaseMomentary = useEffectEvent((id: string) =>
    onReleaseComponent(id)
  )
  useEffect(() => {
    // A committed edit (including toolbar undo) invalidates any in-flight preview.
    gesture.current = null
    setPreview(null)
    setBox(null)
    setRoute(null)
    setHover(null)
    setPlacement((current) => (current?.kind === "paste" ? null : current))
    lastBodyClick.current = null
    pressedPush.current = null
    setPressedSwitch(null)
  }, [document])
  useEffect(() => {
    const element = svg.current!
    const surface = element.parentElement!
    const wheel = (event: WheelEvent) => {
      const target = event.target
      if (
        !(target instanceof Element) ||
        (!element.contains(target) && !target.closest("[data-sheet-scope]"))
      )
        return
      event.preventDefault()
      if (gesture.current && gesture.current.kind !== "pan") return
      if (!event.ctrlKey && !event.metaKey) {
        setCamera((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }))
        return
      }
      const bounds = element.getBoundingClientRect()
      setCamera((current) =>
        core.geometry.zoom(
          current,
          { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
          Math.exp(-event.deltaY * 0.008)
        )
      )
    }
    surface.addEventListener("wheel", wheel, { passive: false })
    return () => surface.removeEventListener("wheel", wheel)
  }, [])
  const scopePanPointer = useRef<number | null>(null)
  const startScopePan = useEffectEvent((event: globalThis.PointerEvent) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest("[data-sheet-scope]")
    )
      return
    if (
      event.button !== 1 &&
      !(event.button === 0 && (tool === "pan" || spacePan.current))
    )
      return
    if (gesture.current || pressedPush.current) return
    event.preventDefault()
    event.stopPropagation()
    const element = svg.current!
    element.focus({ preventScroll: true })
    scopePanPointer.current = event.pointerId
    gesture.current = {
      kind: "pan",
      origin: local(event.clientX, event.clientY),
      camera,
    }
    element.parentElement!.setPointerCapture(event.pointerId)
  })
  const moveScopePan = useEffectEvent((event: globalThis.PointerEvent) => {
    if (scopePanPointer.current !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const active = gesture.current
    if (active?.kind !== "pan") return
    const screen = local(event.clientX, event.clientY)
    pointer.current = screen
    clientPointer.current = { x: event.clientX, y: event.clientY }
    setCamera((current) => ({
      ...current,
      x: active.camera.x + screen.x - active.origin.x,
      y: active.camera.y + screen.y - active.origin.y,
    }))
  })
  useEffect(() => {
    const surface = svg.current!.parentElement!
    const down = (event: globalThis.PointerEvent) => startScopePan(event)
    const move = (event: globalThis.PointerEvent) => moveScopePan(event)
    const end = (event: globalThis.PointerEvent) => {
      if (scopePanPointer.current !== event.pointerId) return
      scopePanPointer.current = null
      if (gesture.current?.kind === "pan") gesture.current = null
      event.stopPropagation()
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId)
    }
    surface.addEventListener("pointerdown", down, true)
    surface.addEventListener("pointermove", move, true)
    surface.addEventListener("pointerup", end, true)
    surface.addEventListener("pointercancel", end, true)
    surface.addEventListener("lostpointercapture", end, true)
    return () => {
      surface.removeEventListener("pointerdown", down, true)
      surface.removeEventListener("pointermove", move, true)
      surface.removeEventListener("pointerup", end, true)
      surface.removeEventListener("pointercancel", end, true)
      surface.removeEventListener("lostpointercapture", end, true)
    }
  }, [])
  useEffect(() => {
    const up = (event: globalThis.KeyboardEvent) => {
      if (event.key === " ") spacePan.current = false
    }
    const blur = () => {
      spacePan.current = false
      if (pressedPush.current) releaseMomentary(pressedPush.current)
      pressedPush.current = null
      setPressedSwitch(null)
      lastBodyClick.current = null
      if (gesture.current?.kind === "drag") gesture.current.drag?.cancel()
      gesture.current = null
      setPreview(null)
      setBox(null)
      setPlacement((current) => (current?.kind === "paste" ? null : current))
    }
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])
  function local(clientX: number, clientY: number) {
    const r = svg.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }
  function world(p: Point) {
    return {
      x: (p.x - camera.x) / camera.scale,
      y: (p.y - camera.y) / camera.scale,
    }
  }
  const snapped = (p: Point) => ({
    x: core.geometry.snap(p.x),
    y: core.geometry.snap(p.y),
  })
  function changeTool(next: string) {
    if (gesture.current?.kind === "drag") gesture.current.drag?.cancel()
    lastBodyClick.current = null
    if (pressedPush.current) onReleaseComponent(pressedPush.current)
    pressedPush.current = null
    setPressedSwitch(null)
    gesture.current = null
    setPreview(null)
    setBox(null)
    setRoute(null)
    setHover(null)
    setPlacement(null)
    onToolChange(next)
  }
  function cancel() {
    changeTool("select")
  }
  function selectForCommand() {
    if (selection.length) return selection
    const hit = pointer.current
      ? entityFromHit(selectionHit(world(pointer.current)))
      : null
    if (!hit) return []
    onSelection([hit])
    return [hit]
  }
  function copyItems(): boolean {
    if (gesture.current || route || placement) return false
    const chosen = selectForCommand()
    if (!chosen.length) return false
    const fragment = core.editing.copySelection(
      document,
      new Set(chosen.map(({ kind, id }) => core.geometry.token(kind, id)))
    )
    if (
      !fragment.electrical.components.length &&
      !fragment.electrical.junctions.length &&
      !fragment.electrical.wires.length
    )
      return false
    clipboard.current = fragment
    setHasClipboard(true)
    return true
  }
  function pasteItems() {
    const fragment = clipboard.current
    if (!fragment || gesture.current || route || placement) return
    const points = [
      ...Object.values(fragment.layout.components),
      ...Object.values(fragment.layout.junctions),
    ]
    const anchor = snapped(
      points.reduce((min, point) => ({
        x: Math.min(min.x, point.x),
        y: Math.min(min.y, point.y),
      }))
    )
    const base = structuredClone(document)
    const tokens = core.editing.pasteSelection(base, fragment, {
      componentReferences: false,
    })
    const entities = [...tokens].map((token): Entity => {
      const [kind, id] = JSON.parse(token)
      return { kind, id }
    })
    if (pointer.current) setCursor(snapped(world(pointer.current)))
    cancel()
    setPlacement({
      kind: "paste",
      base,
      tokens,
      entities,
      anchor,
      orientations: [],
    })
    svg.current?.focus()
  }
  function fit() {
    const bounds: { x: number; y: number; right: number; bottom: number }[] =
      document.electrical.components.map((component) =>
        core.geometry.bounds(document, component)
      )
    const points = [
      ...document.electrical.junctions.map(
        ({ id }) => document.layout.junctions[id]
      ),
      ...document.electrical.wires.flatMap((wire) =>
        core.geometry.route(document, wire)
      ),
      ...bounds.flatMap((b) => [
        { x: b.x, y: b.y },
        { x: b.right, y: b.bottom },
      ]),
      ...document.probes.flatMap((probe) =>
        document.layout.probes?.[probe.id]
          ? [core.geometry.probePoint(document, probe)]
          : []
      ),
    ]
    const rect = svg.current?.getBoundingClientRect()
    if (!rect) return
    if (!points.length) {
      setCamera({ x: rect.width / 2, y: rect.height / 2, scale: 0.32 })
      return
    }
    const left = Math.min(...points.map((p) => p.x)),
      right = Math.max(...points.map((p) => p.x))
    const top = Math.min(...points.map((p) => p.y)),
      bottom = Math.max(...points.map((p) => p.y))
    const scale = Math.max(
      0.064,
      Math.min(
        0.416,
        (rect.width - 150) / (right - left + 50),
        (rect.height - 150) / (bottom - top + 50)
      )
    )
    setCamera({
      scale,
      x: rect.width / 2 - ((left + right) / 2) * scale,
      y: rect.height / 2 - ((top + bottom) / 2) * scale,
    })
  }
  const resetForDocument = useEffectEvent(() => cancel())
  const fitRequested = useEffectEvent(() => fit())
  useEffect(() => {
    resetForDocument()
    const handle = requestAnimationFrame(fitRequested)
    return () => cancelAnimationFrame(handle)
  }, [fitRequest])
  useEffect(() => {
    const sheet = svg.current
    if (!sheet) return
    let size = sheet.getBoundingClientRect()
    const observer = new ResizeObserver(() => {
      const next = sheet.getBoundingClientRect()
      const dx = (next.width - size.width) / 2
      const dy = (next.height - size.height) / 2
      const firstVisible = !size.width && !!next.width
      size = next
      if (firstVisible) fitRequested()
      else if (dx || dy)
        setCamera((current) => ({
          ...current,
          x: current.x + dx,
          y: current.y + dy,
        }))
    })
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [])
  function zoom(factor: number) {
    const rect = svg.current?.getBoundingClientRect()
    if (rect)
      setCamera((current) =>
        core.geometry.zoom(
          current,
          { x: rect.width / 2, y: rect.height / 2 },
          factor
        )
      )
  }
  function changeHistory(action: () => void) {
    cancel()
    action()
  }
  function removeSelection() {
    if (gesture.current || placement?.kind === "paste") return
    const chosen = selectForCommand()
    if (chosen.length) execute({ type: "remove", selection: chosen })
  }
  function beginTransform(detached: boolean) {
    if (gesture.current || route || placement?.kind === "paste") return
    cancel()
    const chosen = selectForCommand()
    if (!chosen.length) return
    const point = pointer.current ? world(pointer.current) : cursor
    const hit = selectionHit(point)
    const wire =
      chosen.length === 1 && chosen[0].kind === "wire" ? chosen[0] : null
    startDrag(
      point,
      chosen,
      true,
      detached,
      !detached && wire
        ? {
            wireId: wire.id,
            segment:
              hit?.kind === "wire" && "segment" in hit && hit.id === wire.id
                ? hit.segment
                : 0,
          }
        : undefined
    )
    const moving = gesture.current as Gesture | null
    if (
      moving?.kind === "drag" &&
      chosen.some(({ kind }) => kind === "component")
    ) {
      moving.origin = moveAnchor(document, chosen, point)
      setCursor(snapped(point))
      updateDragPosition(moving, point)
    }
    svg.current?.focus()
  }
  function beginPlacement(symbol: string) {
    cancel()
    if (pointer.current) setCursor(snapped(world(pointer.current)))
    const reverseOpAmp = symbol === "opampPlusTop"
    setPlacement({
      kind: "component",
      symbol,
      rotation: reverseOpAmp ? 180 : 0,
      mirror: reverseOpAmp,
    })
    svg.current?.focus()
  }
  const shortcut = useEffectEvent((event: globalThis.KeyboardEvent) => {
    const target = event.target
    if (
      event.defaultPrevented ||
      event.altKey ||
      componentMenuOpen ||
      itemMenu !== null ||
      !(target instanceof Element)
    )
      return
    const key = event.key.toLowerCase()
    const command = event.ctrlKey || event.metaKey
    // Scope editing owns Delete etc.; sheet navigation remains available over sheet scopes.
    if (
      target.closest("[data-sheet-scope]") &&
      !target.closest(
        "input, textarea, select, button, [role=menu], [role=dialog], [contenteditable=true]"
      ) &&
      !command
    ) {
      if (key === " ") {
        event.preventDefault()
        spacePan.current = true
        return
      }
      if (["+", "=", "-", "0"].includes(key)) {
        event.preventDefault()
        if (key === "0") fit()
        else zoom(key === "-" ? 1 / 1.2 : 1.2)
        return
      }
    }
    const sliderHistoryShortcut =
      command && key === "z" && target.closest("[data-component-slider-panel]")
    if (
      (!sliderHistoryShortcut &&
        target.closest(
          "input, textarea, select, [role=checkbox], [role=menu], [role=dialog], [data-component-slider-panel], [data-scope-workspace]"
        )) ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return
    const sheet = svg.current
    if (
      !sheet ||
      (target !== window.document.body &&
        !sheet.closest("section")?.contains(target))
    )
      return
    if (command) {
      if (!["s", "o", "z", "c", "d", "v"].includes(key)) return
      event.preventDefault()
      if (event.repeat) return
      if (key === "s") onSaveDocument()
      if (key === "o") onOpenDocument()
      if (key === "z") changeHistory(event.shiftKey ? redo : undo)
      if (key === "c") copyItems()
      if (key === "v" || (key === "d" && copyItems())) pasteItems()
      return
    }

    if (key === " " || key === "enter") {
      if (target.closest("button, a")) return
      if (key === " ") {
        event.preventDefault()
        spacePan.current = true
      } else if (route) {
        event.preventDefault()
        connect(targetAtPointer())
      }
      return
    }
    if (key === "escape") {
      event.preventDefault()
      cancel()
      onSelection([])
      return
    }
    if (key === "delete" || key === "backspace") {
      event.preventDefault()
      removeSelection()
      return
    }
    if (event.repeat) return
    if (key === "a" && !event.shiftKey) {
      event.preventDefault()
      cancel()
      const rect = svg.current?.getBoundingClientRect()
      setComponentMenuPosition(
        clientPointer.current ??
          (rect
            ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
            : null)
      )
      setComponentMenuOpen(true)
      return
    }
    if (key === "m" || key === "g") {
      beginTransform(key === "m")
      return
    }
    if (key === "r") {
      orient({ rotate: event.shiftKey ? 90 : -90 })
      return
    }
    if (key === "x" || key === "y") {
      orient({ axis: key })
      return
    }
    if (gesture.current || placement?.kind === "paste") return
    if (key === "e") {
      event.preventDefault()
      cancel()
      const entity = selectForCommand().find(
        (item) => item.kind === "component" || item.kind === "probe"
      )
      if (entity) onEdit(entity)
      return
    }
    if (key === "0") fit()
    if (["+", "=", "-"].includes(key)) zoom(key === "-" ? 1 / 1.2 : 1.2)
    if (key === "w") changeTool("wire")
    if (key === "h") changeTool("pan")
    if (key === "1") cancel()
    if (key === "p") beginPlacement("ground")
  })
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => shortcut(event)
    window.document.addEventListener("keydown", listener)
    return () => window.document.removeEventListener("keydown", listener)
  }, [])

  function place(point: Point) {
    if (!placement) return
    const { x, y } = snapped(point)
    if (placement.kind === "component") {
      const id = execute({
        type: "addComponent",
        kind: placement.symbol,
        rotation: placement.rotation,
        mirror: placement.mirror,
        x,
        y,
      })
      if (typeof id === "string") {
        onSelection([{ kind: "component", id }])
        const kind =
          core.catalog.placementDefinitions[placement.symbol].kind ??
          placement.symbol
        if (hasSlider({ kind })) onPlaceSlider()
      }
    } else {
      const next = pasteDocument(placement, { x, y }, true)
      const added = execute({ type: "replace", document: next })
      if (
        added &&
        next.electrical.components.some(
          (component) =>
            hasSlider(component) &&
            placement.tokens.has(core.geometry.token("component", component.id))
        )
      )
        onPlaceSlider()
      onSelection(placement.entities)
      setPlacement(null)
    }
  }
  function startDrag(
    p: Point,
    chosen: Entity[],
    keyboard = false,
    detached = false,
    wireRoute?: { wireId: string; segment: number },
    collapseTo?: Entity
  ) {
    const hit = selectionHit(p)
    const probeAnchor =
      chosen.length === 1 &&
      chosen[0].kind === "probe" &&
      hit?.kind === "probe" &&
      "anchor" in hit &&
      hit.anchor &&
      hit.id === chosen[0].id
        ? hit.id
        : undefined
    gesture.current = {
      kind: "drag",
      probeAnchor,
      origin: snapped(p),
      original: document,
      selection: chosen,
      keyboard,
      detached,
      wireRoute,
      collapseTo,
      orientations: [],
      dx: 0,
      dy: 0,
      drag: detached
        ? undefined
        : core.editing.createDragSession(
            document,
            new Set(chosen.map((s) => core.geometry.token(s.kind, s.id))),
            wireRoute
          ),
    }
  }
  function finish(shift = false) {
    const g = gesture.current
    if (g?.kind === "drag") {
      const loose =
        g.selection.length === 1 &&
        g.selection[0].kind === "junction" &&
        core.editing.looseEndpoint(g.original, g.selection[0].id)
          ? g.selection[0].id
          : null
      if (!g.dx && !g.dy && !g.orientations.length && g.collapseTo)
        onSelection([g.collapseTo])
      if (
        !g.dx &&
        !g.dy &&
        !g.orientations.length &&
        loose &&
        !g.keyboard &&
        !shift
      ) {
        cancel()
        setRoute({
          from: { kind: "junction", junctionId: loose },
          points: [g.original.layout.junctions[loose]],
        })
        return
      }
      if (g.probeAnchor) {
        if (g.reconnectTo && (g.dx || g.dy)) {
          const next = structuredClone(g.original)
          core.editing.retargetProbe(next, g.probeAnchor, g.reconnectTo)
          execute({ type: "replace", document: next })
        }
        g.drag?.cancel()
        gesture.current = null
        setPreview(null)
        setHover(null)
        return
      }
      if (g.dx || g.dy || g.orientations.length) {
        if (loose && g.drag && g.reconnectTo) {
          try {
            const next = g.drag.finish({ normalize: false })
            core.editing.reconnect(next, loose, g.reconnectTo)
            execute({ type: "replace", document: next })
          } catch (cause) {
            onNotice(String(cause))
          }
        } else
          execute({
            type: "replace",
            document: g.drag
              ? g.drag.finish({ contacts: !g.wireRoute })
              : core.editing.applyCommand(g.original, {
                  type: "transform",
                  selection: g.selection,
                  dx: g.dx,
                  dy: g.dy,
                  disconnect: true,
                  orientations: g.orientations,
                }),
          })
      }
    }
    if (g?.kind === "drag" && !g.dx && !g.dy && !g.orientations.length)
      g.drag?.cancel()
    gesture.current = null
    setPreview(null)
    setBox(null)
  }
  function selectionHit(point: Point): Hit | null {
    const hit = core.geometry.hit(document, point, camera.scale)
    // Keep electrical contacts and probe handles available over artwork.
    if (hit && ["pin", "junction", "probe"].includes(hit.kind)) return hit
    const id =
      svg.current &&
      symbolBodyHit(
        svg.current,
        point.x * camera.scale + camera.x,
        point.y * camera.scale + camera.y
      )
    return id ? { kind: "component", id } : hit
  }
  function target(p: Point, ignoreProbes = false): Target {
    const hit = core.geometry.hit(document, p, camera.scale, ignoreProbes)
    if (
      hit &&
      (hit.kind === "pin" ||
        (hit.kind === "junction" && "junctionId" in hit) ||
        (hit.kind === "wire" && "point" in hit))
    )
      return hit as Target
    return { kind: "point", point: snapped(p) }
  }
  function targetAtPointer() {
    return target(pointer.current ? world(pointer.current) : cursor)
  }
  function targetPoint(to: Target): Point {
    if (to.kind === "pin") return core.geometry.pin(document, to)
    if (to.kind === "wire") return to.point
    if (to.kind === "junction") return document.layout.junctions[to.junctionId]
    return to.point
  }
  function startRoute(from: Target) {
    setRoute({ from, points: [targetPoint(from)] })
  }
  function connect(to: Target) {
    if (!route) return
    const bends = route.points.slice(1)
    if (to.kind === "point") {
      const end = snapped(to.point)
      while (bends.at(-1)?.x === end.x && bends.at(-1)?.y === end.y) bends.pop()
    }
    execute({
      type: "connect",
      from: route.from,
      to,
      bends,
    })
    setRoute(null)
  }
  function componentClick(id: string, point: Point) {
    const kind = document.electrical.components.find((c) => c.id === id)?.kind
    // Switch operation takes priority over double-click property editing.
    if (core.catalog.switchKind(kind || "") || kind === "logicInput") {
      lastBodyClick.current = null
      onToggleComponent(id)
      return
    }
    const prior = lastBodyClick.current
    if (
      prior &&
      prior.id === id &&
      Date.now() - prior.time < 450 &&
      Math.hypot(point.x - prior.x, point.y - prior.y) < 8
    ) {
      cancel()
      onEdit({ kind: "component", id })
      return
    }
    lastBodyClick.current = { id, time: Date.now(), x: point.x, y: point.y }
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.focus()
    const screen = local(e.clientX, e.clientY),
      p = world(screen)
    clientPointer.current = { x: e.clientX, y: e.clientY }
    pointer.current = screen
    setCrosshairPointer(e.pointerType === "touch" ? null : screen)
    setCursor(snapped(p))
    if (e.button === 2 || pressedPush.current) return
    if (gesture.current?.kind === "drag" && gesture.current.keyboard) {
      if (e.button === 0) {
        updateDragPosition(gesture.current, p)
        finish()
      }
      return
    }
    if (e.button === 1 || tool === "pan" || spacePan.current) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      gesture.current = { kind: "pan", origin: screen, camera }
      return
    }
    if (e.button !== 0) return
    if (placement) {
      place(p)
      return
    }
    const hit = selectionHit(p)
    if (
      tool === "select" &&
      !e.shiftKey &&
      hit?.kind === "component" &&
      core.catalog.momentary(document.electrical.components.find(
        (component) => component.id === hit.id
      ))
    ) {
      onSelection([{ kind: "component", id: hit.id }])
      pressedPush.current = hit.id
      setPressedSwitch(hit.id)
      onPressComponent(hit.id)
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (tool === "probe") {
      const endpoint = target(p)
      if (endpoint.kind !== "point") onAddProbe(endpoint)
      else onNotice("Place the voltage probe on a wire, pin or junction.")
      return
    }
    if (route) {
      const endpoint = target(p)
      const last = route.lastClick
      const time = performance.now()
      if (
        endpoint.kind !== "point" ||
        (last &&
          time - last.time < 450 &&
          Math.hypot(screen.x - last.x, screen.y - last.y) < 8)
      )
        connect(endpoint)
      else
        setRoute({
          ...route,
          points: [...route.points, snapped(p)],
          lastClick: { ...screen, time },
        })
      return
    }
    if (tool === "wire") {
      const endpoint = target(p)
      if (endpoint.kind !== "point") startRoute(endpoint)
      else onNotice("Start a wire on a pin, junction or existing wire.")
      return
    }
    if (hit?.kind === "pin") {
      startRoute(hit)
      return
    }
    if (tool !== "select") return
    e.currentTarget.setPointerCapture(e.pointerId)
    const entity = entityFromHit(hit)
    if (entity) {
      const exists = selection.some(
        (s) => s.kind === entity.kind && s.id === entity.id
      )
      const chosen = e.shiftKey
        ? exists
          ? selection.filter(
              (s) => s.kind !== entity.kind || s.id !== entity.id
            )
          : [...selection, entity]
        : exists
          ? selection
          : [entity]
      onSelection(chosen)
      if (!e.shiftKey || !exists)
        startDrag(
          p,
          chosen,
          false,
          false,
          hit?.kind === "wire" && "segment" in hit
            ? { wireId: hit.id, segment: hit.segment }
            : undefined,
          !e.shiftKey && exists && selection.length > 1 ? entity : undefined
        )
    } else {
      if (!e.shiftKey) onSelection([])
      gesture.current = {
        kind: "box",
        origin: p,
        prior: e.shiftKey ? selection : [],
      }
      setBox({ a: p, b: p })
    }
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    const screen = local(e.clientX, e.clientY),
      p = world(screen)
    clientPointer.current = { x: e.clientX, y: e.clientY }
    pointer.current = screen
    setCrosshairPointer(e.pointerType === "touch" ? null : screen)
    setCursor(snapped(p))
    const g = gesture.current
    if (g?.kind === "pan")
      setCamera({
        ...camera,
        x: g.camera.x + screen.x - g.origin.x,
        y: g.camera.y + screen.y - g.origin.y,
      })
    if (g?.kind === "box") setBox({ a: g.origin, b: p })
    if (g?.kind === "drag") updateDragPosition(g, p)
    else if (!g && !placement && !pressedPush.current) {
      const endpoint = target(p)
      setHover(endpoint.kind === "point" ? null : targetPoint(endpoint))
    } else setHover(null)
  }
  function updateDragPosition(g: Extract<Gesture, { kind: "drag" }>, p: Point) {
    const symbolMove =
      g.keyboard && g.selection.some(({ kind }) => kind === "component")
    g.dx = symbolMove
      ? core.geometry.snap(p.x) - g.origin.x
      : core.geometry.snap(p.x - g.origin.x)
    g.dy = symbolMove
      ? core.geometry.snap(p.y) - g.origin.y
      : core.geometry.snap(p.y - g.origin.y)
    if (g.probeAnchor) {
      const to = target(p, true)
      g.reconnectTo = to.kind === "point" ? undefined : to
      const next = structuredClone(g.original)
      const probe = next.probes.find(({ id }) => id === g.probeAnchor)!
      if (g.reconnectTo) core.editing.retargetProbe(next, g.probeAnchor, to)
      else {
        const id = "__probe_preview__"
        next.electrical.junctions.push({ id })
        next.layout.junctions[id] = snapped(p)
        probe.positive = { kind: "junction", junctionId: id }
      }
      setHover(g.reconnectTo ? targetPoint(to) : null)
      setPreview(next)
      return
    }
    const item = g.selection.length === 1 ? g.selection[0] : null
    const loose =
      item?.kind === "junction" &&
      core.editing.looseEndpoint(g.original, item.id)
    if (loose && g.drag && (g.dx || g.dy)) {
      g.reconnectTo =
        core.editing.reconnectTarget(g.original, item.id, p, camera.scale) ||
        undefined
      const origin = g.original.layout.junctions[item.id]
      const end = g.reconnectTo ? targetPoint(g.reconnectTo) : snapped(p)
      setHover(g.reconnectTo ? end : null)
      setPreview(g.drag.update(end.x - origin.x, end.y - origin.y))
      return
    }
    g.reconnectTo = undefined
    setHover(null)
    updateDragPreview(g)
  }
  function updateDragPreview(g: Extract<Gesture, { kind: "drag" }>) {
    if (g.drag) {
      setPreview(g.drag.update(g.dx, g.dy))
      return
    }
    const draft = structuredClone(g.original)
    core.editing.transformSelection(
      draft,
      new Set(g.selection.map(({ kind, id }) => core.geometry.token(kind, id))),
      g.dx,
      g.dy,
      { disconnect: g.detached, orientations: g.orientations }
    )
    setPreview(draft)
  }
  function orient(operation: Orientation) {
    if (placement?.kind === "component") {
      const next = { ...placement }
      if ("axis" in operation) core.geometry.flipPose(next, operation.axis)
      else next.rotation = (next.rotation + operation.rotate + 360) % 360
      setPlacement(next)
      return
    }
    if (placement?.kind === "paste") {
      setPlacement({
        ...placement,
        orientations: [...placement.orientations, operation],
      })
      return
    }
    const g = gesture.current
    if (g) {
      if (g.kind !== "drag" || !g.keyboard || g.wireRoute) return
      g.drag?.cancel()
      g.drag = undefined
      g.detached = true
      g.orientations.push(operation)
      updateDragPreview(g)
      return
    }
    const chosen = selectForCommand()
    if (chosen.some(({ kind }) => kind === "component"))
      execute({
        type: "transform",
        selection: chosen,
        orientations: [operation],
      })
  }
  const routePoints = route
    ? (() => {
        const anchors = [...route.points, hover ?? cursor]
        const points = [anchors[0]]
        for (const point of anchors.slice(1)) {
          const previous = points.at(-1)!
          if (previous.x !== point.x && previous.y !== point.y)
            points.push({ x: point.x, y: previous.y })
          points.push(point)
        }
        return points
      })()
    : []
  const crossing = box !== null && box.b.x < box.a.x
  const componentDefinition =
    placement?.kind === "component"
      ? core.catalog.placementDefinitions[placement.symbol]
      : undefined
  const placePose =
    placement?.kind === "component"
      ? core.geometry.placementPose(
          componentDefinition?.kind || placement.symbol,
          cursor,
          placement.rotation,
          placement.mirror
        )
      : null
  const previewComponent: Component | null = componentDefinition
    ? {
        id: "placement-preview",
        kind:
          placement?.kind === "component"
            ? componentDefinition.kind || placement.symbol
            : "",
        parameters: componentDefinition.parameters,
      }
    : null
  const crosshairWorld = crosshairPointer
    ? snapped(world(crosshairPointer))
    : null
  const crosshairScreen = crosshairWorld
    ? {
        x: crosshairWorld.x * camera.scale + camera.x,
        y: crosshairWorld.y * camera.scale + camera.y,
      }
    : null
  return (
    <>
      <div className="flex min-h-9 items-center gap-3 border-b px-2 py-1">
        <Menubar className="h-8 rounded-none border-0 p-0">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onNewDocument}>New circuit</MenubarItem>
              <MenubarItem onClick={onOpenDocument}>Open…</MenubarItem>
              <MenubarItem onClick={onSaveDocument}>Save as…</MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Open example</MenubarSubTrigger>
                <MenubarSubContent>
                  {exampleNames.map((name) => (
                    <MenubarItem key={name} onClick={() => onLoadExample(name)}>
                      {name}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                disabled={!canUndo}
                onClick={() => changeHistory(undo)}
              >
                Undo
              </MenubarItem>
              <MenubarItem
                disabled={!canRedo}
                onClick={() => changeHistory(redo)}
              >
                Redo
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled={!selection.length} onClick={copyItems}>
                Copy
              </MenubarItem>
              <MenubarItem
                disabled={!hasClipboard || !!placement || !!route}
                onClick={pasteItems}
              >
                Paste
              </MenubarItem>
              <MenubarItem
                disabled={!selection.length}
                onClick={() => {
                  if (copyItems()) pasteItems()
                }}
              >
                Duplicate
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                disabled={!selection.length}
                onClick={() => beginTransform(true)}
              >
                Move
              </MenubarItem>
              <MenubarItem
                disabled={!selection.length}
                onClick={() => beginTransform(false)}
              >
                Drag connected
              </MenubarItem>
              <MenubarItem
                disabled={!selection.length}
                onClick={() => orient({ rotate: -90 })}
              >
                Rotate
              </MenubarItem>
              <MenubarItem
                disabled={!selection.length}
                onClick={() => orient({ axis: "x" })}
              >
                Flip X
              </MenubarItem>
              <MenubarItem
                disabled={!selection.length}
                onClick={() => orient({ axis: "y" })}
              >
                Flip Y
              </MenubarItem>
              <MenubarItem
                disabled={!selection.length}
                onClick={removeSelection}
              >
                Delete
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                onClick={() => {
                  changeTool("select")
                  svg.current?.focus()
                }}
              >
                Select tool
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  changeTool("wire")
                  svg.current?.focus()
                }}
              >
                Wire tool
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  changeTool("pan")
                  svg.current?.focus()
                }}
              >
                Pan tool
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  changeTool("probe")
                  svg.current?.focus()
                }}
              >
                Probe tool
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => zoom(1.2)}>Zoom in</MenubarItem>
              <MenubarItem onClick={() => zoom(1 / 1.2)}>Zoom out</MenubarItem>
              <MenubarItem onClick={fit}>Fit circuit</MenubarItem>
              <MenubarItem onClick={onToggleScope}>
                {scopeOpen ? "Hide oscilloscope" : "Show oscilloscope"}
              </MenubarItem>
              <MenubarCheckboxItem
                checked={sliderPanelOpen}
                disabled={sliderPanelRequired}
                onCheckedChange={onSliderPanelChange}
                closeOnClick
              >
                Sliders
              </MenubarCheckboxItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Cursor crosshairs</MenubarSubTrigger>
                <MenubarSubContent>
                  {(["off", "small", "full"] as const).map((mode) => (
                    <MenubarCheckboxItem
                      key={mode}
                      checked={crosshairMode === mode}
                      onCheckedChange={() => setCrosshairMode(mode)}
                      closeOnClick
                    >
                      {mode === "off"
                        ? "Off"
                        : mode === "small"
                          ? "Small"
                          : "Full sheet"}
                    </MenubarCheckboxItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem onClick={() => onGridModeChange("dots")}>
                Grid: dots {gridMode === "dots" ? "✓" : ""}
              </MenubarItem>
              <MenubarItem onClick={() => onGridModeChange("lines")}>
                Grid: lines {gridMode === "lines" ? "✓" : ""}
              </MenubarItem>
              <MenubarItem onClick={() => onGridModeChange("off")}>
                Grid: off {gridMode === "off" ? "✓" : ""}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled={!canStep} onClick={onStepSimulation}>
                Step simulation (10)
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <ComponentMenu
            open={componentMenuOpen}
            position={componentMenuPosition}
            onOpenChange={(open) => {
              if (open) {
                cancel()
                setComponentMenuPosition(null)
              }
              setComponentMenuOpen(open)
            }}
            onChoose={(choice) => {
              if (
                choice === "wire" ||
                choice === "select" ||
                choice === "probe"
              )
                changeTool(choice)
              else beginPlacement(choice)
              setComponentMenuOpen(false)
              requestAnimationFrame(() => svg.current?.focus())
            }}
          />
        </Menubar>
        {(tool === "wire" || route) && (
          <span role="status" className="text-xs">
            {route
              ? "Click to add bends · click a pin, wire or junction to attach · double-click empty space or Enter to finish · Esc cancels"
              : "Click a pin, wire or junction to start · Esc cancels"}
          </span>
        )}
        {placement && (
          <span role="status" className="text-xs">
            Click to place · R rotates · X/Y flips · Esc cancels
          </span>
        )}
      </div>
      <MenubarMenu
        open={!!itemMenu}
        onOpenChange={(open) => {
          if (!open) setItemMenu(null)
        }}
      >
        <MenubarContent
          anchor={
            itemMenu
              ? {
                  getBoundingClientRect: () =>
                    new DOMRect(itemMenu.x, itemMenu.y, 0, 0),
                }
              : undefined
          }
          alignOffset={0}
          sideOffset={0}
          finalFocus={() => {
            svg.current?.focus()
            return false
          }}
        >
          <MenubarItem
            disabled={
              itemMenu?.entity.kind !== "component" &&
              itemMenu?.entity.kind !== "probe"
            }
            onClick={() => itemMenu && onEdit(itemMenu.entity)}
          >
            Edit
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => beginTransform(false)}>
            Drag (G)
          </MenubarItem>
          <MenubarItem onClick={() => beginTransform(true)}>
            Move (M)
          </MenubarItem>
          <MenubarItem onClick={() => orient({ rotate: 90 })}>
            Rotate clockwise
          </MenubarItem>
          <MenubarItem onClick={() => orient({ rotate: -90 })}>
            Rotate counterclockwise
          </MenubarItem>
          <MenubarItem onClick={() => orient({ axis: "x" })}>
            Flip X
          </MenubarItem>
          <MenubarItem onClick={() => orient({ axis: "y" })}>
            Flip Y
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={copyItems}>Copy</MenubarItem>
          <MenubarItem
            onClick={() => {
              if (copyItems()) removeSelection()
            }}
          >
            Cut
          </MenubarItem>
          <MenubarItem
            onClick={() => {
              if (copyItems()) pasteItems()
            }}
          >
            Duplicate
          </MenubarItem>
          <MenubarItem onClick={removeSelection}>Delete</MenubarItem>
          {itemMenu?.entity.kind === "component" &&
            (() => {
              const component = document.electrical.components.find(
                ({ id }) => id === itemMenu.entity.id
              )
              if (!component) return null
              const pins = Object.keys(core.catalog.componentPins(component))
              return (
                <>
                  <MenubarSeparator />
                  <MenubarItem onClick={() => onConfigureSlider(component.id)}>
                    Add property slider…
                  </MenubarItem>
                  {!!pins.length && (
                    <MenubarSub>
                      <MenubarSubTrigger>Add to scope</MenubarSubTrigger>
                      <MenubarSubContent>
                        {core.catalog.simulationModels[component.kind]?.sign !=
                          null && (
                          <MenubarItem
                            onClick={() =>
                              onPlotComponent(component.id, "__current")
                            }
                          >
                            Current through component
                          </MenubarItem>
                        )}
                        {pins.length >= 2 && (
                          <MenubarItem
                            onClick={() => onPlotComponent(component.id)}
                          >
                            Voltage across {pins[0]} → {pins[1]}
                          </MenubarItem>
                        )}
                        {pins.map((pin) => (
                          <MenubarItem
                            key={pin}
                            onClick={() => onPlotComponent(component.id, pin)}
                          >
                            Pin {pin} voltage to ground
                          </MenubarItem>
                        ))}
                      </MenubarSubContent>
                    </MenubarSub>
                  )}
                </>
              )
            })()}
          {itemMenu && ["wire", "junction"].includes(itemMenu.entity.kind) && (
            <>
              <MenubarSeparator />
              <MenubarItem onClick={() => onAddProbe(itemMenu.target)}>
                Add voltage to scope
              </MenubarItem>
            </>
          )}
          {itemMenu?.entity.kind === "probe" && (
            <MenubarItem
              onClick={() => {
                if (!scopeOpen) onToggleScope()
              }}
            >
              Show in scope
            </MenubarItem>
          )}
        </MenubarContent>
      </MenubarMenu>
      <svg
        ref={svg}
        tabIndex={0}
        aria-label="Circuit sheet. Select and drag; G connected move, M detached move, R rotate, X/Y flip, W wire, Escape cancel and clear selection."
        className="min-h-[450px] w-full flex-1 touch-none outline-none"
        onContextMenu={(e) => {
          e.preventDefault()
          cancel()
          const screen = local(e.clientX, e.clientY)
          pointer.current = screen
          const point = world(screen)
          const entity = entityFromHit(selectionHit(point))
          if (!entity) return
          if (
            !selection.some(
              (item) => item.kind === entity.kind && item.id === entity.id
            )
          )
            onSelection([entity])
          setItemMenu({
            x: e.clientX,
            y: e.clientY,
            entity,
            target: target(point),
          })
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerLeave={() => {
          setHover(null)
          setCrosshairPointer(null)
        }}
        onPointerCancel={cancel}
        onDoubleClick={(e) => {
          if (placement || tool !== "select" || route) return
          const point = world(local(e.clientX, e.clientY))
          const hit = selectionHit(point)
          if (hit?.kind !== "component" && hit?.kind !== "probe") return
          if (hit.kind === "probe") {
            e.preventDefault()
            cancel()
            onEdit(hit)
          }
        }}
        onLostPointerCapture={() => {
          if (pressedPush.current) {
            onReleaseComponent(pressedPush.current)
            pressedPush.current = null
            setPressedSwitch(null)
          }
          if (
            gesture.current &&
            !(gesture.current.kind === "drag" && gesture.current.keyboard)
          )
            cancel()
        }}
        onPointerUp={(e) => {
          if (pressedPush.current) {
            onReleaseComponent(pressedPush.current)
            pressedPush.current = null
            setPressedSwitch(null)
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId)
            return
          }
          const active = gesture.current
          if (active?.kind === "box") {
            const end = world(local(e.clientX, e.clientY))
            const picked = core.geometry.boxSelection(
              document,
              active.origin,
              end
            )
            for (const { kind, id } of active.prior)
              picked.add(core.geometry.token(kind, id))
            onSelection(
              [...picked].map((token) => {
                const [kind, id] = JSON.parse(token)
                return { kind, id }
              })
            )
            cancel()
          } else if (!(
            gesture.current?.kind === "drag" && gesture.current.keyboard
          )) {
            if (
              active?.kind === "drag" &&
              !active.dx &&
              !active.dy &&
              !active.orientations.length &&
              !e.shiftKey &&
              tool === "select" &&
              (active.collapseTo ?? active.selection[0])?.kind ===
                "component" &&
              (active.collapseTo || active.selection.length === 1)
            ) {
              const point = local(e.clientX, e.clientY)
              componentClick(
                (active.collapseTo ?? active.selection[0]).id,
                point
              )
            } else if (lastBodyClick.current) {
              lastBodyClick.current = null
            }
            finish(e.shiftKey)
          }
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        <defs>
          <pattern
            id={grid}
            width={core.geometry.grid * camera.scale}
            height={core.geometry.grid * camera.scale}
            x={camera.x}
            y={camera.y}
            patternUnits="userSpaceOnUse"
          >
            {gridMode === "lines" ? (
              <path
                d={`M${core.geometry.grid * camera.scale} 0H0V${core.geometry.grid * camera.scale}`}
                fill="none"
                stroke="currentColor"
                opacity={0.16}
              />
            ) : (
              <circle cx={0} cy={0} r={1} fill="currentColor" opacity={0.18} />
            )}
          </pattern>
        </defs>
        {gridMode !== "off" && (
          <rect width="100%" height="100%" fill={`url(#${grid})`} />
        )}
        <g
          transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}
        >
          <WireLayer document={shown} selection={selection} frame={frame} />
          <SymbolLayer
            document={shown}
            frame={frame}
            sliderPreview={sliderPreview}
            selected={selectedComponents}
          />
          {shown.probes
            .filter(
              (probe) =>
                probe.kind === "voltage" &&
                probe.positive &&
                shown.layout.probes?.[probe.id]
            )
            .map((probe) => {
              const anchor = core.geometry.pin(shown, probe.positive!)
              const label = core.geometry.probePoint(shown, probe)
              // The rounded label is an inner rectangle expanded by its radius.
              // Project onto that shape to find the shortest connector.
              const radius = 12.5
              const inner = {
                x: Math.max(
                  label.x - 15.625 + radius,
                  Math.min(anchor.x, label.x - 15.625 + 350 - radius)
                ),
                y: Math.max(
                  label.y - 43.75 + radius,
                  Math.min(anchor.y, label.y - 43.75 + 81.25 - radius)
                ),
              }
              const dx = anchor.x - inner.x
              const dy = anchor.y - inner.y
              const distance = Math.hypot(dx, dy)
              const attachment =
                distance <= radius
                  ? anchor
                  : {
                      x: inner.x + (dx * radius) / distance,
                      y: inner.y + (dy * radius) / distance,
                    }
              const active = selection.some(
                (item) => item.kind === "probe" && item.id === probe.id
              )
              const voltage = frame
                ? core.geometry.probeVoltage(shown, probe, frame)
                : undefined
              return (
                <g
                  key={probe.id}
                  fill="none"
                  stroke="currentColor"
                  className={active ? "text-primary" : "text-amber-500"}
                >
                  <path
                    d={`M${anchor.x} ${anchor.y}L${attachment.x} ${attachment.y}`}
                  />
                  <circle
                    cx={anchor.x}
                    cy={anchor.y}
                    r={9.375}
                    fill="currentColor"
                  />
                  <rect
                    x={label.x - 15.625}
                    y={label.y - 43.75}
                    width={350}
                    height={81.25}
                    rx={12.5}
                    fill="var(--background)"
                  />
                  <text
                    x={label.x}
                    y={label.y + 12.5}
                    fill="currentColor"
                    stroke="none"
                    fontSize={37.5}
                  >
                    {probe.label || "Wire"} ·{" "}
                    {voltage === undefined ? "—" : `${voltage.toFixed(3)} V`}
                  </text>
                </g>
              )
            })}
          {placement?.kind === "component" && previewComponent && placePose && (
            <g
              transform={`translate(${placePose.x} ${placePose.y}) rotate(${placement.rotation}) scale(${placement.mirror ? -1 : 1} 1)`}
              pointerEvents="none"
              fill="none"
              stroke="currentColor"
              strokeWidth={6.25}
              opacity={0.65}
            >
              <SymbolBody component={previewComponent} pose={placement} />
            </g>
          )}
          {hover && (
            <circle
              cx={hover.x}
              cy={hover.y}
              r={10 / camera.scale}
              fill="var(--primary)"
              fillOpacity={0.1}
              stroke="var(--primary)"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {route && (
            <polyline
              points={routePoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={6.25}
              strokeDasharray="15.625 9.375"
            />
          )}
          {box && (
            <rect
              x={Math.min(box.a.x, box.b.x)}
              y={Math.min(box.a.y, box.b.y)}
              width={Math.abs(box.b.x - box.a.x)}
              height={Math.abs(box.b.y - box.a.y)}
              className={
                crossing
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-blue-600 dark:text-blue-400"
              }
              fill="currentColor"
              fillOpacity={0.1}
              stroke="currentColor"
              strokeDasharray={crossing ? "5 3" : undefined}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </g>
        {crosshairMode !== "off" && crosshairScreen && (
          <g
            aria-hidden="true"
            pointerEvents="none"
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.3}
          >
            <line
              x1={crosshairMode === "full" ? 0 : crosshairScreen.x - 20}
              x2={crosshairMode === "full" ? "100%" : crosshairScreen.x + 20}
              y1={crosshairScreen.y}
              y2={crosshairScreen.y}
            />
            <line
              x1={crosshairScreen.x}
              x2={crosshairScreen.x}
              y1={crosshairMode === "full" ? 0 : crosshairScreen.y - 20}
              y2={crosshairMode === "full" ? "100%" : crosshairScreen.y + 20}
            />
          </g>
        )}
      </svg>
    </>
  )
})
