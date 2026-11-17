// The JS core remains framework-free. This file types the subset used by this editor.
// @ts-expect-error The existing portable JS package has no declaration file yet.
import * as implementation from "../../../packages/circuit-core/index.mjs"
export type Point = { x: number; y: number }
export type Orientation = { axis: "x" | "y" } | { rotate: number }
export type Entity = {
  kind: "component" | "wire" | "junction" | "probe"
  id: string
}
export type Target =
  | { kind: "pin"; componentId: string; pinId: string }
  | { kind: "junction"; junctionId: string }
  | { kind: "point"; point: Point }
  | { kind: "wire"; id: string; point: Point; segment: number }
export type SampleTerminal = { componentId: string; pinId: string }
export type SampleChannel = {
  id: string
  kind?: string
  componentId?: string
  positive?: SampleTerminal
  negative?: SampleTerminal | null
}
export type TraceSettings = {
  color?: string
  scale?: number
  offset?: number
  coupling?: string
  kind?: string
}
export type ScopeChannel = SampleChannel & TraceSettings & { label: string }
export type Hit = (Entity & { anchor?: boolean }) | Target
export type Component = {
  id: string
  kind: string
  parameters: Record<string, unknown>
}
export type LabelSettings = {
  position?: "auto" | "left" | "right" | "above" | "below"
  showValue?: boolean
  showDetails?: boolean
}
export type ScopePaneLayout = {
  mode: "docked" | "floating" | "sheet"
  timeDivision: number
  sheetScale?: number
  order?: number
  x: number
  y: number
  width: number
  height: number
  weight: number
}
export type ScopeDockNode =
  | { type: "scope"; id: string }
  | {
      type: "split"
      axis: "horizontal" | "vertical"
      ratio: number
      first: ScopeDockNode
      second: ScopeDockNode
    }
export type ScopeLayout = {
  version: 1
  open: boolean
  assignments: Record<string, string>
  activeTraces: Record<string, string>
  panes: Record<string, ScopePaneLayout>
  height: number
  dock?: ScopeDockNode | null
}
export type CircuitDocument = {
  schemaVersion: number
  id: string
  title: string
  electrical: {
    components: Component[]
    junctions: { id: string }[]
    wires: { id: string; from: Target; to: Target }[]
  }
  layout: {
    components: Record<
      string,
      Point & { rotation: number; mirror: boolean; label?: LabelSettings }
    >
    junctions: Record<string, Point>
    wires: Record<string, { bends: Point[] }>
    scopes?: ScopeLayout
    probes?: Record<string, Point>
  }
  probes: (TraceSettings & {
    id: string
    kind: string
    label?: string
    reference?: string
    positive?: Target
    negative?: Target
    componentId?: string
  })[]
  simulation: { timeStep: number }
}
export type Command =
  | {
      type: "addComponent"
      kind: string
      x: number
      y: number
      rotation: number
      mirror?: boolean
    }
  | { type: "reconnect"; junctionId: string; target: Target }
  | { type: "replace"; document: CircuitDocument }
  | {
      type: "transform"
      selection: Entity[]
      dx?: number
      dy?: number
      disconnect?: boolean
      rotation?: number
      orientations?: Orientation[]
    }
  | { type: "remove"; selection: Entity[] }
  | { type: "connect"; from: Target; to: Target; bends?: Point[] }
  | {
      type: "setParameters"
      componentId: string
      parameters: Record<string, unknown>
    }
export type Frame = {
  time: number
  timeStep: number
  pinVoltages: Record<string, Record<string, number>>
  componentCurrents?: Record<string, number>
  componentMeasurements?: Record<
    string,
    Record<string, number | string | boolean | null | number[]>
  >
  sampleBatch?: {
    channels: { id: string }[]
    times: number[]
    values: Record<string, number[]>
  }
}
export type RunState = {
  status: string
  runRequested?: boolean
  accepted?: unknown
  error?: { message: string } | null
  frame?: Frame | null
}
export type Run = {
  setDocument(d: CircuitDocument): Promise<{ activated?: boolean }>
  getState(): RunState
  run(): unknown
  pause(): Promise<unknown>
  step(count?: number): Promise<unknown>
  reset(): Promise<unknown>
  setSampleChannels(channels: SampleChannel[]): unknown
  readCapture(
    id: string
  ): Promise<{ timeStep: number; startTime: number; values: number[] }>
  dispose(): void
}
export type Session = {
  document: CircuitDocument
  execute(command: Command): unknown
  addComponent(
    kind: string,
    x: number,
    y: number,
    rotation?: number,
    mirror?: boolean
  ): string
  addProbe(target: Target, label?: string): string
  transaction(label: string, edit: (document: CircuitDocument) => void): boolean
  replace(document: CircuitDocument): unknown
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
}
export type Drag = {
  update(dx: number, dy: number): CircuitDocument
  finish(options?: { normalize?: boolean; contacts?: boolean }): CircuitDocument
  cancel(): void
}
export const core = implementation as {
  geometry: {
    grid: number
    snap(n: number): number
    placementPose(
      kind: string,
      point: Point,
      rotation: number,
      mirror?: boolean
    ): Point
    flipPose(pose: { rotation: number; mirror: boolean }, axis: "x" | "y"): void
    bounds(
      d: CircuitDocument,
      component: Component
    ): { x: number; y: number; right: number; bottom: number }
    graphicSize(component: Component): { width: number; height: number }
    probePoint(
      d: CircuitDocument,
      probe: CircuitDocument["probes"][number]
    ): Point
    token(kind: string, id: string): string
    pin(d: CircuitDocument, ref: Target): Point
    route(
      d: CircuitDocument,
      w: CircuitDocument["electrical"]["wires"][number]
    ): Point[]
    referenceKey(ref: Target): string
    hit(
      d: CircuitDocument,
      p: Point,
      scale: number,
      ignoreProbes?: boolean
    ): Hit | null
    boxSelection(d: CircuitDocument, a: Point, b: Point): Set<string>
    zoom(
      camera: Point & { scale: number },
      p: Point,
      factor: number
    ): Point & { scale: number }
    probeVoltage(
      d: CircuitDocument,
      probe: CircuitDocument["probes"][number],
      frame: Frame
    ): number | undefined
    scopeChannels(d: CircuitDocument): {
      channels: ScopeChannel[]
      unresolved: string[]
    }
  }
  editing: {
    toggleSwitches(document: CircuitDocument, id: string): void
    replaceParameters(
      document: CircuitDocument,
      componentId: string,
      parameters: Record<string, unknown>
    ): void
    retargetProbe(
      document: CircuitDocument,
      id: string,
      target: Target
    ): CircuitDocument
    copySelection(d: CircuitDocument, selection: Set<string>): CircuitDocument
    pasteSelection(
      d: CircuitDocument,
      fragment: CircuitDocument,
      options?: { componentReferences?: boolean }
    ): Set<string>
    create(
      d: CircuitDocument,
      callback: (d: CircuitDocument) => void,
      options: { wireSections: boolean; componentReferences?: boolean }
    ): Session
    createDragSession(
      d: CircuitDocument,
      selection: Set<string>,
      options?: { wireId: string; segment: number }
    ): Drag
    applyCommand(d: CircuitDocument, command: Command): CircuitDocument
    transformSelection(
      d: CircuitDocument,
      selection: Set<string>,
      dx: number,
      dy: number,
      options: {
        disconnect?: boolean
        orientations?: Orientation[]
        contacts?: boolean
      }
    ): void
    junctionDots(d: CircuitDocument): { point: Point; degree: number }[]
    looseEndpoint(d: CircuitDocument, id: string): boolean
    reconnectTarget(
      d: CircuitDocument,
      id: string,
      p: Point,
      scale: number
    ): Target | null
    reconnect(d: CircuitDocument, id: string, target: Target): void
    momentaryDocument(d: CircuitDocument, id: string): CircuitDocument
    moveSegment(
      d: CircuitDocument,
      wireId: string,
      segment: number,
      dx: number,
      dy: number
    ): CircuitDocument
    normalizeWires(d: CircuitDocument): CircuitDocument
  }
  catalog: {
    switchKind(kind: string): boolean
    switchDefaults(kind: string): Record<string, unknown>
    switchPositionCount(component: Component): number
    momentary(component?: Component): boolean
    componentPins(component: Component): Record<string, [number, number]>
    gateKind(kind: string): boolean
    mosfetKind(kind: string): boolean
    mosfetOptions: Record<string, boolean>
    transistorModels: string[]
    transistorModelFields: Record<
      string,
      { label: string; default: number; positive?: boolean }
    >
    transistorKind(kind: string): boolean
    resolveTransistorModel(model: unknown): Record<string, number>
    diodeModels: string[]
    diodeModelSpecs: Record<
      string,
      {
        saturationCurrent: number
        seriesResistance: number
        emissionCoefficient: number
        breakdownVoltage: number
      }
    >
    diodeKind(kind: string): boolean
    resolveDiodeModel(model: unknown): {
      saturationCurrent: number
      seriesResistance: number
      emissionCoefficient: number
      breakdownVoltage: number
    }
    diodeEditorParameters(
      kind: string,
      parameters: Record<string, unknown>
    ): Record<string, unknown>
    simulationModels: Record<string, { sign: number | null }>
    definitions: Record<
      string,
      {
        prefix: string
        name: string
        drawingScale?: number
        pins: Record<string, [number, number]>
        parameters: Record<string, unknown>
      }
    >
    placementDefinitions: Record<
      string,
      {
        prefix: string
        name: string
        kind?: string
        pins?: Record<string, [number, number]>
        parameters: Record<string, unknown>
      }
    >
    outputSpecs: Record<
      string,
      {
        name: string
        fields: Record<
          string,
          { label: string; type: string; default: unknown; maxLength?: number }
        >
      }
    >
    waveformNames: Record<string, string>
    graphic(kind: string): boolean
    graphicSize(component: Component): { width: number; height: number }
  }
  simulation: {
    create(options: {
      workerFactory: unknown
      onState: (state: RunState) => void
      onFrame?: (frame: Frame) => void
      batchSteps?: number
      intervalMs?: number
    }): Run
    presentationFrame(s: RunState): Frame | null
  }
  browserTransport: { factory(options: { url: URL }): unknown }
  signals: {
    create(options?: { capacity?: number }): {
      setChannels(channels: ScopeChannel[]): unknown
      followState(state: RunState): void
      append(frame: Frame): boolean
      clear(): void
      readonly count: number
      window(span: number): {
        start: number
        end: number
        stored: number
        capacity: number
        times: number[]
        channels: (TraceSettings & {
          id: string
          label: string
          color: string
          values: number[]
          min: number | null
          max: number | null
          last?: number
        })[]
      }
    }
    color(id: string): string
    envelope(
      times: number[],
      values: number[],
      start: number,
      end: number,
      width: number
    ): [number, number][]
    autoScale(channels: { min: number | null; max: number | null }[]): number
  }
  document: {
    empty(): CircuitDocument
    validate(d: CircuitDocument): CircuitDocument
  }
}
