# React editor implementation contract

Updated 2026-11-17. These are current user-facing behavior requirements, not a
claim of complete browser verification. Read [HANDOFF.md](HANDOFF.md) for current
checks and [REACT-PARITY.md](REACT-PARITY.md) for remaining parity work.

## Editor and symbols

Use React/TypeScript, shadcn Base Mira controls and an SVG sheet. Preserve the
accepted shell, styling and interaction behavior. The sheet fills the workspace;
E/double-click opens component or probe properties. Keep Start/Stop/Reset as the
always-visible simulation controls. Do not reintroduce the retired JavaScript UI.

One authored `packages/circuit-symbols/src/<kind>.tsx` file owns each symbol's
metadata and SVG. Generate plain-data catalog sections for the core; do not add
React/TSX or DOM dependencies to it or the worker. Stable kind and pin identities,
explicit graph connectivity and native engine post order/current conventions
must survive renderer changes. Pin offsets may be fractional grid positions;
use the authored metadata instead of assuming every pin is on the 50-unit grid.

G/pointer drag retains connections; M and rotation/X/Y flips detach and leave
wires behind. Commands create explicit contacts atomically; rendering/load does
not join crossings. Keep undo/redo exact. The sheet omits component reference
designators. Right-click selects the item unless it is already in the selection,
then exposes the shared edit/transform/clipboard/delete/probe commands. Suppress
sheet shortcuts while menus or text inputs own focus. Clipboard copies probes
with selected electrical anchors, not as independent disconnected objects.

## Sliders

Variable voltage and potentiometer placement opens one draggable Sliders panel;
View and component properties reopen it. Built-in and numeric property controls
share a keyed reorderable list, grip dragging/keyboard Up/Down and saved per-circuit
ordering. Property controls support nested numeric fields, label/range/step,
edit-in-place and removal with active-preview cancellation. Configuration is local
per circuit ID; built-in labels are saved in circuit JSON. Property slider configs
are not yet portable saved-document data.

Preview the latest value at animation-frame cadence, send at most 30 solver
updates/second and keep one update in flight. Wait for an idle coordinator before
submitting so an in-flight sample batch is not discarded by a new revision.
Release commits the exact final value once; cancellation or a history no-op
restores the committed simulation document. Pot position controls use .001–.999
to keep both track sections resistive. The wiper artwork follows preview state.

## Scopes

Preserve the accepted simplified interface; do not restore removed toolbars or side legends.

- **Acquisition:** signed voltage/current channels sampled at every solver step,
  up to 32 channels; 10 steps / 16 ms coordinator cadence remains unchanged.
  Every new probe gets its own scope, with combine/separate available.
- **Ownership:** pane owns time/div; each trace owns independent automatic/manual
  V/div or A/div, vertical position, colour, name and coupling. Click its name or
  waveform to select the vertical axis, which follows that trace's colour, units,
  scale and offset. AC subtracts the visible mean for drawing; statistics stay raw.
- **Presentation:** full-width plot, vertically stacked trace names at bottom-left,
  larger discoverable trace-properties gears. Top-right annotations are ordered
  cursor value → time scale → vertical scale. Trace properties has colour swatches,
  automatic/manual scale, position/coupling and collapsed mean/RMS/peak-to-peak/
  min/max measurements. No status strip, acquisition info, side legend, pane scale
  row, standalone time selector, Add pane/layout dropdown or duplicate Pause button.
- **Pane menu:** right-click for Time scale, named trace submenus (vertical scale,
  position and axis selection), combine/separate, dock/undock, placement mode,
  row/column dock presets and Delete scope.
- **Docking:** nested horizontal/vertical splits support mixed layouts, e.g. one
  pane left and two stacked right. Drag grips to pane edges to split, drag out to
  undock, or drag back to dock. Both divider orientations resize. The whole bottom
  panel is capped at 50% of viewport height; larger layouts scroll internally.
- **Undocked modes:** floating panels stay in pixels, with sliders' 12px margins /
  48px toolbar clearance, and snap to edges/other floating scopes/sliders with 12px
  spacing. Sheet scopes snap position and size to the 50-unit world grid, scale
  with symbols and retain initial appearance on placement. Both move/resize by
  their grips/corners. Wheel/trackpad, middle-drag, Space+drag and pan-tool navigation
  work over sheet scopes. Hiding the dock leaves undocked scopes visible.
- **Selection/deletion:** select a scope, then Backspace/Delete or its menu removes
  that scope's probes in one undoable operation; electrical components remain.
- **Cursor contract (latest user choice):** hovering holds a fixed plot position and
  reads new samples as simulation advances. Click-and-hold latches one exact sample,
  which moves across the plot; release resumes hover sampling. All panes use the
  identical sample timestamp regardless of time scale. A pane hides the cursor
  when that sample falls outside its visible sample window. Cursor value reports
  the selected trace's raw value at that sample. Pointer state is transient.
- **Persistence:** optional version-1 `layout.scopes` saves combined assignments,
  selected axes, pane time scales/modes/geometry, sheet reference zoom, dock split
  tree/ratios/order and bottom height/open state. Per-probe metadata saves trace
  settings. Save/Open/autosave and Undo/Redo use the document model. Drag previews
  remain local and commit on release; camera updates do not enter circuit history.
  Older circuits without workspace metadata retain defaults; old row-only layouts
  convert to a horizontal dock. Core validation checks the saved representation.

### Meter design

The authored ammeter uses a radius-50 body, pins at ±100 sheet units, 64-unit A text
and upright 36-unit +/− marks at x=±80, y=−30. Voltmeter and ohmmeter match it;
wattmeter keeps four pins at x=±100, y=±50 and a 100×160 body. All four plus test
points show live readings above by default, respecting label overrides. Meter modes
include RMS/average, voltage extrema/peak-to-peak/binary and open resistance. Test
point artwork was not resized. Old saved wire coordinates are not automatically
migrated after pin changes; regenerate catalog metadata from the authored TSX.

### Source map

`ScopeWorkspace.tsx` owns grouping, interactions and docking; `scopeDock.ts` owns
split-tree operations; `ScopePane.tsx` draws traces/axes/labels; `ScopeContextMenu.tsx`
and `TraceProperties.tsx` own settings. `scopeDisplay.ts` shares sample windows,
statistics and vertical mappings; `scopeLayout.ts` stages/synchronizes saved layout;
`scopeViewport.ts` isolates camera updates. `core.ts` types optional workspace data;
`packages/circuit-core/document.js` validates it. Preserve this separation and the
sampling/worker boundary when adding features.

## Performance boundaries

Publish camera changes through `scopeViewport.ts`, not editor-shell state. Retain
memoized scope windows/grouping/plots, offscreen sheet-plot culling and panel-snap
measurement at gesture boundaries/resize. Navigation improvement was user feedback,
not a measured performance benchmark. Worker sampling and numerical behavior must
stay independent of display cadence. Browser pointer/cursor/layout verification
remains pending; do not infer it from headless checks.
