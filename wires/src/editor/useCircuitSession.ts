import { useCallback, useEffect, useRef, useState } from "react"
import switchedRc from "../../../docs/new-simulator/examples/switched-rc.json"
import { core } from "./core"
import type { CircuitDocument, Command, Run, RunState } from "./core"

const editingOptions = { wireSections: true, componentReferences: false }

export function useCircuitSession(
  initialDocument = switchedRc as CircuitDocument,
  autosave = true
) {
  const [document, setDocument] = useState(() => {
    try {
      const saved =
        autosave && localStorage.getItem("circuit-editor-prototype.v1")
      if (saved)
        return core.editing.create(JSON.parse(saved), () => {}, editingOptions)
          .document
    } catch {
      // Start from the example if the saved document is unavailable.
    }
    return core.editing.create(initialDocument, () => {}, editingOptions)
      .document
  })
  const [session] = useState(() =>
    core.editing.create(document, setDocument, editingOptions)
  )
  const [simulation, setSimulation] = useState<RunState>({ status: "loading" })
  const [scope] = useState(() => core.signals.create({ capacity: 20000 }))
  const [scopeData, setScopeData] = useState(() => scope.window(0.002))
  const scopeSpan = useRef(0.002)
  const [error, setError] = useState("")
  const [savedLocally, setSavedLocally] = useState<boolean | null>(null)
  const run = useRef<Run | null>(null)
  useEffect(() => {
    let active = true
    const coordinator = core.simulation.create({
      // Match experiments/engine/editor.js: advance ten solver steps every 16 ms.
      // The core default is intentionally larger for headless consumers.
      batchSteps: 10,
      intervalMs: 16,
      workerFactory: core.browserTransport.factory({
        url: new URL(
          `${import.meta.env.BASE_URL}engine/revision-worker.js`,
          location.href
        ),
      }),
      onFrame: (frame) => {
        if (active && scope.append(frame))
          setScopeData(scope.window(scopeSpan.current))
      },
      onState: (state) => {
        if (!active) return
        const samples = scope.count
        scope.followState(state)
        if (scope.count !== samples)
          setScopeData(scope.window(scopeSpan.current))
        setSimulation(state)
      },
    })
    run.current = coordinator
    return () => {
      active = false
      coordinator.dispose()
      run.current = null
    }
  }, [scope])
  useEffect(() => {
    let current = true
    const channels = core.geometry.scopeChannels(document).channels.slice(0, 32)
    scope.setChannels(channels)
    setScopeData(scope.window(scopeSpan.current))
    const coordinator = run.current
    coordinator?.setSampleChannels(
      channels.map(({ id, positive, negative }) => ({ id, positive, negative }))
    )
    void coordinator
      ?.setDocument(document)
      .then((result) => {
        if (
          current &&
          result.activated &&
          coordinator.getState().status === "paused"
        )
          return coordinator.step(1)
      })
      .catch(() => {
        /* Coordinator publishes diagnostics. */
      })
    return () => {
      current = false
    }
  }, [document, scope])
  useEffect(() => {
    if (!autosave) return
    try {
      localStorage.setItem(
        "circuit-editor-prototype.v1",
        JSON.stringify(document)
      )
      setSavedLocally(true)
    } catch {
      setSavedLocally(false)
    }
  }, [autosave, document])
  const execute = useCallback(
    (command: Command) => {
      try {
        const result = session.execute(command)
        setError("")
        return result
      } catch (cause) {
        setError(String(cause))
      }
    },
    [session]
  )
  const setScopeTime = useCallback(
    (seconds: number) => {
      scopeSpan.current = seconds * 10
      setScopeData(scope.window(scopeSpan.current))
    },
    [scope]
  )
  const clearScope = useCallback(() => {
    scope.clear()
    setScopeData(scope.window(scopeSpan.current))
  }, [scope])
  return {
    document,
    session,
    execute,
    simulation,
    run,
    error,
    savedLocally,
    scopeData,
    setScopeTime,
    clearScope,
  }
}
