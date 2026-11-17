import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import type { Plugin } from "vite"
// Host the existing classic worker and its relative imports in both dev and dist.
export function engineAssets(root: string): Plugin {
  const mappings: [string, string][] = [
    ["core/", resolve(root, "../packages/circuit-core")],
    [
      "circuitjsworker/",
      resolve(root, "../build/engine-worker/circuitjsworker"),
    ],
    ["", resolve(root, "../experiments/engine")],
  ]
  const required = resolve(
    root,
    "../build/engine-worker/circuitjsworker/engine-worker.js"
  )
  return {
    name: "circuit-engine-assets",
    buildStart() {
      if (!existsSync(required))
        this.error(
          "Compiled worker missing. Build makeEngineSite or run tools/build_engine_cached.py first."
        )
    },
    configureServer(server) {
      server.middlewares.use("/engine", (req, res, next) => {
        const name = (req.url || "").split("?")[0].replace(/^\//, "")
        const entry = mappings.find(([prefix]) => name.startsWith(prefix))!
        const file = resolve(entry[1], name.slice(entry[0].length))
        if (
          !file.startsWith(entry[1] + sep) ||
          !file.endsWith(".js") ||
          !existsSync(file)
        )
          return next()
        res.setHeader("Content-Type", "text/javascript")
        res.end(readFileSync(file))
      })
    },
    writeBundle(options) {
      const out = resolve(options.dir!, "engine")
      mkdirSync(out, { recursive: true })
      for (const [prefix, source] of mappings.filter(([prefix]) => prefix))
        cpSync(source, resolve(out, prefix), { recursive: true })
      for (const name of [
        "revision-worker.js",
        "document-adapter.js",
        "revision-protocol.js",
      ])
        cpSync(resolve(root, "../experiments/engine", name), resolve(out, name))
    },
  }
}
