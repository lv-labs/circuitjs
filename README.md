# LV Labs Circuit Simulator

This repository is a pared-down LV Labs fork of CircuitJS for the deployed browser simulator.

## Upstream

This project is based on CircuitJS by Paul Falstad and Iain Sharp.

- Original project: [sharpie7/circuitjs1](https://github.com/sharpie7/circuitjs1)
- Original README: [upstream README](https://github.com/sharpie7/circuitjs1/blob/master/README.md)
- Hosted originals:
  - [falstad.com circuit simulator](http://www.falstad.com/circuit/)
  - [lushprojects CircuitJS](http://lushprojects.com/circuitjs/)

Thanks to Paul Falstad, Iain Sharp, and the wider CircuitJS contributor community for the original simulator and all the work that made this fork possible.

## What This Fork Is

This fork keeps the browser simulator and LV Labs customizations, while removing repo baggage that is not part of the deployed web app workflow.

Removed from this fork:

- Electron packaging files
- local websocket automation helpers
- test harness files
- local dev server scripts and container/dev-environment helpers
- old IDE project metadata

## Build

Requirements:

- Java 8
- Gradle 8.7 via `./gradlew`

Build the production site:

```bash
./gradlew makeSite --console plain
```

This writes the deployable output to `site/`.

If you only want the compiled web assets in `war/`:

```bash
./gradlew compileGwt --console plain
```

## Local Preview

The active new editor is the React app in `wires/`, backed by the retained
CircuitJS worker and `packages/circuit-core`. Start with the
[current handoff](docs/new-simulator/HANDOFF.md) and
[React editor README](wires/src/editor/README.md).

```bash
pnpm deps:install
pnpm engine:build
pnpm dev
```

These commands require Java 8, Node 24+ and pnpm 10.30.3. Root scripts orchestrate
the existing app; its dependencies and lockfile remain in `wires/`.
`pnpm build` builds the engine plus React; `pnpm check` runs all computational
checks, builds React and checks SSR/worker packaging. `pnpm verify` performs a
fresh engine build followed by those checks. No browser interaction checks or
deployment are performed by these commands.

`pnpm --dir wires build` produces the React deployment in `wires/dist/`.
Worker entry points live in `packages/circuit-runtime`; development-only engine
verification pages live in `tools/engine-harness` and are assembled into
`build/engine-site`. The intermediate JavaScript editor has been removed.
The original Falstad interface and its existing build/deployment remain available
through `makeSite`; this cleanup does not change that deployment workflow.
See [upstream architecture](docs/new-simulator/UPSTREAM-ARCHITECTURE.md) for the
proposed next steps; no submodule or repository split has been made.

After `makeSite`:

```bash
cd site
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment

The simplest deployment flow for this fork is:

1. Run `./gradlew makeSite --console plain`
2. Deploy the contents of `site/`

This repo also includes a GitHub Actions workflow for Cloudflare Pages deployment.

## License

This fork remains free software under the GNU General Public License, version 2 or any later version, as stated in the original source headers.

- Full license text: [COPYING.txt](COPYING.txt)
- Source for this fork is provided in this repository

If you distribute this fork or a modified version of it, you should preserve the existing copyright and license notices and continue to provide source code under the GPL.
