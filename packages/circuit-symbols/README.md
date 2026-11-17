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
