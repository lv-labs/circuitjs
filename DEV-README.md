# Local Dev Quickstart

This repo can be worked on locally with a very simple two-terminal setup:

## Fastest option: hot reload dev server

From the project root:

```bash
./dev-server.sh
```

Then open:

```text
http://localhost:8000/circuitjs.html
```

What it does:

- serves the built site from `site/`
- watches `war/` and `src/com/lushprojects/circuitjs1/public/`
- rebuilds when you change HTML or CSS
- refreshes the browser automatically after a successful rebuild

This is the closest local workflow to an Astro-style dev server in this repo.

## 1. Build the site

From the project root:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 1.8)
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME="$PWD/.gradle-home"
./gradlew compileGwt makeSite
```

This generates the static site into `site/`.

## 2. Start a local server

Open a new terminal, go to the built site, and serve it:

```bash
cd /Users/luke/Documents/lv-labs/circuit-lab/site
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/circuitjs.html
```

## 3. Make CSS/HTML changes

Useful files to start with:

- `src/com/lushprojects/circuitjs1/public/style.css`
- `war/circuitjs.html`
- `war/about.html`

After making changes, rebuild from the project root:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 1.8)
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME="$PWD/.gradle-home"
./gradlew compileGwt makeSite
```

Then refresh the browser tab.

## Optional shortcut

The repo also has a helper script:

```bash
./test.sh
```

That script builds the site and starts a server on port `8000`.

## Which command should I use?

- Use `./dev-server.sh` if you want auto-refresh while editing HTML/CSS.
- Use `./test.sh` if you just want a simple build + static server.
- Use `python3 -m http.server 8000` inside `site/` if you already rebuilt and only need a bare server.

## Notes

- Java 8 is required for this older GWT toolchain.
- The first Gradle run may take longer because it downloads dependencies.
- There is no watch mode set up yet, so the normal loop is: edit, rebuild, refresh.

## GitHub Pages deploy

This repo already includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that builds the site and publishes `site/` to GitHub Pages.

To deploy it:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 1.8)
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME="$PWD/.gradle-home"
./gradlew compileGwt makeSite
```

Then in GitHub:

- Go to `Settings` -> `Pages`
- Under `Source`, choose `GitHub Actions`
- Push to `master`, or run the `Deploy to GitHub Pages` workflow manually from the `Actions` tab

The published site will open at the repo Pages URL, and `index.html` redirects to `circuitjs.html`.
