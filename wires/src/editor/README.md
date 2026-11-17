# React editor slice

`CircuitEditor` is independently mountable; `App.tsx` belongs to the application
shell and was left untouched by this work:

```tsx
import { CircuitEditor } from '@/editor/CircuitEditor'

// Place inside your own layout:
<CircuitEditor />
```

`initialDocument` optionally accepts a schema-v1 document. It is an initial value;
remount with a different React key to start a different document/session. A valid
autosave takes precedence by default. Set `autosave={false}` to mount a fixture
without reading or writing the main app’s saved circuit. The standalone
`/editor.html` Vite entry uses this option for its divider and RC examples. Run `pnpm --dir wires dev`, then append `/editor.html`
to the URL printed by Vite.

- `useCircuitSession.ts`: committed editing/history session and worker lifecycle.
- `CircuitSheet.tsx`: camera and gesture state, separate uncommitted previews.
- `WireLayer.tsx`, `SymbolLayer.tsx`: SVG views, memoized independently of readings.
- `core.ts`: typed boundary for the subset of the existing JS API consumed here.
- `../../../packages/circuit-symbols/src` from the editor source directory:
  authoritative per-symbol metadata and SVG views.

Scroll to pan, use Ctrl/⌘ scroll to zoom, and use middle-button or Space + drag
to pan. Shift adds to the selection. A left-to-right box selects enclosed items
and a right-to-left box selects touched items. Use G for connected drag, M for
detached move, R/Shift+R to rotate, and X/Y to flip. Ctrl/⌘ Z undoes an edit and
Shift + Ctrl/⌘ Z redoes it.

Press A to open Add, then choose a component and click to place it. Placement
stays active until Escape or a tool change. Use W to enter wire mode and click a
pin, junction, or existing wire to start. Click blank space to add bends, click a
target to attach, or use Enter or a double-click to finish a loose end. Click a
loose end to start a route from it or drag it onto a new target to reconnect it.

Use Ctrl/⌘ C to copy within the editor, Ctrl/⌘ V to preview a paste, and Ctrl/⌘ D
to preview a duplicate. Click to place or press Escape to cancel. The File menu
includes schema-v1 example circuits. E or a double-click opens properties for
a component or probe label. Component dialogs include live readings and the
actions available for that part. Run controls and the oscilloscope use the
retained worker.

The React sheet shows component values and saves circuits without reference
designators. New voltage probes get names such as Wire and Wire 2. Use the
pencil in the oscilloscope legend or edit a probe label on the sheet to name its
trace.

The **Sliders** panel opens when you place a variable voltage source or
potentiometer. Reopen it from **View → Sliders** or **Open sliders** in the
component's properties. Change the row name with the **Slider label** field
in those properties. Drag the floating panel by its title. Drag a row by
its grip or focus the grip and press Up or Down to reorder it. The main editor
remembers the order per circuit in browser storage. Slider changes preview live
and commit on release. The potentiometer wiper follows the slider on the sheet.
The panel and the editor's visible controls use shadcn
Base Mira.

Committed edits reach history. Momentary switches and sliders can also
preview updates in simulation. Simulation uses the retained
revision coordinator and classic worker. `scripts/engine-assets.ts` serves the
worker/imports under `/engine/` in dev and copies them into the production bundle.
Compile the engine first (`makeEngineSite` or `tools/build_engine_cached.py`).
Missing compiled worker assets produce a build error. Static deployment must
serve `dist/engine` with JavaScript MIME types, including nested worker assets.

Checks:

```sh
pnpm --dir wires build
pnpm --dir wires exec node scripts/test-editor-render.mjs
pnpm --dir wires exec node scripts/test-worker-assets.mjs
node tools/check_core.mjs
```

The worker-assets check requires a fresh Vite build; it executes the actual
packaged classic bootstrap and relative imports in a DOM-free VM, checking divider
and RC measurements. The render check uses React SSR. Neither certifies browser
pointer behavior. Browser interaction verification remains pending.

The [parity inventory](../../../docs/new-simulator/REACT-PARITY.md) records the
reference behavior, migrated features, and remaining checks. The Add menu lists
the reference catalog and disables unsupported entries. All 84 supported
models use their authored TSX views for both placement and the sheet.
