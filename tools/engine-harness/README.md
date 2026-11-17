# Engine verification harness

Development-only engine demos, reference traces and browser verification scripts.
This is not an application frontend and is not shipped in the React bundle.
The active editor is `wires/`; the original Falstad app remains in `src/` and `war/`.

Node regression tests import `packages/circuit-core/index.mjs` directly. The three
small `document-adapter`, `simulation-coordinator` and `revision-client` browser
adapters remain for the HTML demos/verification page. They contain no old editor
implementation. Symbol orientation, capture exports and slider-property tests now
exercise active React modules; the prototype copies are removed.

`pnpm engine:build` (or `tools/build_engine_cached.py`) assembles these files,
`packages/circuit-runtime`, core and compiled GWT assets in `build/engine-site`.
Run `python3 tools/verify_engine.py` for browser engine checks only when requested.
The removed prototype-specific `--editor`/`--screenshot` modes no longer apply.
