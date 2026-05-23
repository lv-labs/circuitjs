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
