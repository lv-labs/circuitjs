# Wires: React circuit editor

The active LV Labs editor uses React/TypeScript, shadcn Base Mira and an SVG sheet.
Circuit documents and editing operations come from `packages/circuit-core`; a
dedicated Java/GWT CircuitJS worker retains the original simulation models.

From the repository root, with Java 8, Node 24+ and pnpm 10.30.3:

```sh
pnpm deps:install
pnpm engine:build
pnpm dev
```

Open the URL Vite prints. `/editor.html` is the standalone example preview with
main-app autosave disabled. `pnpm build` builds the engine and React app; deployable
React files are in `wires/dist`. Original Falstad deployment remains separate.

`pnpm check` runs the computational suites, frontend production build, SSR render
and packaged-worker checks. It does not launch browser interaction verification.
For frontend-only work, `pnpm --dir wires build` uses the existing compiled engine;
`pnpm --dir wires typecheck` checks the app and tooling TypeScript projects.

See [editor integration](src/editor/README.md),
[current handoff](../docs/new-simulator/HANDOFF.md) and
[editor contract](../docs/new-simulator/EDITOR-CONTRACT.md). Per-symbol TSX metadata
and views live in `packages/circuit-symbols`; regenerate their headless catalog
with `pnpm --dir wires symbols:generate`. Reuse existing UI components under
`src/components/ui` and preserve the shell/style ownership in `src/App.tsx`.
