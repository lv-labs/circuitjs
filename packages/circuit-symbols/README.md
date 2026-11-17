# Circuit symbols

Each `src/<kind>.tsx` owns its React SVG view, stable kind, pin positions and
defaults. All 84 supported document models use these views on the sheet and in
placement previews. Views use metadata for lead endpoints. The core owns
world-coordinate transforms, and `svg.tsx` provides common SVG primitives.

Register a new symbol once in `index.ts`. Its export order also preserves the
shared catalog and reference editor's quick palette order. Keep optional
placement presets and output property constraints in the same symbol file.

From the repository root:

```sh
pnpm --dir wires symbols:generate
pnpm --dir wires symbols:check
node tools/test_symbol_authoring.mjs
```

The generator parses literal metadata with the TypeScript AST. It does not evaluate
TSX or load React. It writes marked generated sections of
`packages/circuit-core/catalog.js`; do not hand-edit those sections. This keeps
CommonJS, native ESM, classic browser scripts and workers compatible with their
existing loaders.

The views use React supplied by the `wires` host. There is no independent package
installation or runtime dependency from the core back into this directory.
The generated catalog preserves native device mappings and the existing defaults
shape. Native simulation post order is separate from display pin order.

The regression check covers the registry, generated definitions, SVG lead
endpoints, world pin positions across all rotations and reflections, and source
presets. Install `wires` dependencies before running it or the full computational
suite.

## Sheet units

The placement and visible grid are 50 units. Design new symbol artwork in
10-unit increments, with pins on the 50-unit grid where practical. The resistor
uses these sheet units directly.

Older symbol files have `metadata.drawingScale: 3.125` (50 / 16). Their SVG and
local pin metadata remain in original artwork coordinates. The sheet applies
this scale to the drawing; catalog generation applies it to electrical pin
coordinates. Stroke widths, sheet labels, wire markers and probes use sheet
units. When redrawing an older symbol in 50/10 units, remove `drawingScale` and
update its local pins and artwork together, then regenerate the catalog.

Text, box and line annotations use native sheet-unit dimensions. Their default
sizes have been increased to match the new grid. Saved circuit positions and
explicit annotation sizes are not automatically resized by this authoring change.
