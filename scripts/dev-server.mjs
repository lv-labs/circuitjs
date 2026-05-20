#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const siteRoot = path.join(repoRoot, "site");
const gradlew = path.join(repoRoot, "gradlew");

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";
const javaHome = process.env.JAVA_HOME;
const env = {
  ...process.env,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(repoRoot, ".gradle-home"),
};

if (javaHome) {
  env.PATH = `${path.join(javaHome, "bin")}:${process.env.PATH || ""}`;
}

const watchers = [];
const clients = new Set();
let buildTimer = null;
let buildRunning = false;
let buildQueued = false;
let lastBuildOk = true;

function sendReload() {
  for (const client of clients) {
    client.write("event: reload\n");
    client.write(`data: ${Date.now()}\n\n`);
  }
}

function sendStatus(status) {
  for (const client of clients) {
    client.write("event: status\n");
    client.write(`data: ${status}\n\n`);
  }
}

function inferBuildCommand(changedPath) {
  if (!changedPath) {
    return ["compileGwt", "makeSite", "--console", "plain"];
  }

  const rel = path.relative(repoRoot, changedPath);
  if (rel.startsWith(`war${path.sep}`) && !rel.endsWith(".java")) {
    return ["makeSite", "--console", "plain"];
  }

  return ["compileGwt", "makeSite", "--console", "plain"];
}

function runBuild(changedPath) {
  if (buildRunning) {
    buildQueued = true;
    return;
  }

  const args = inferBuildCommand(changedPath);
  buildRunning = true;
  sendStatus(`building:${args.join(" ")}`);
  console.log(`[dev-server] rebuilding via ./gradlew ${args.join(" ")}`);

  const child = spawn(gradlew, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    buildRunning = false;
    lastBuildOk = code === 0;

    if (lastBuildOk) {
      console.log("[dev-server] rebuild complete, reloading browser");
      sendStatus("ready");
      sendReload();
    } else {
      console.error(`[dev-server] rebuild failed with exit code ${code}`);
      sendStatus("error");
    }

    if (buildQueued) {
      buildQueued = false;
      scheduleBuild();
    }
  });
}

function scheduleBuild(changedPath) {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => runBuild(changedPath), 250);
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

async function watchDir(rootDir) {
  if (!existsSync(rootDir)) {
    return;
  }

  const files = await walk(rootDir);
  const dirs = new Set([rootDir, ...files.map((file) => path.dirname(file))]);

  for (const dir of dirs) {
    try {
      const watcher = import("node:fs").then(({ watch }) =>
        watch(dir, (eventType, filename) => {
          if (!filename) {
            scheduleBuild();
            return;
          }

          const changedPath = path.join(dir, filename.toString());
          if (!existsSync(changedPath) && eventType === "rename") {
            scheduleBuild(changedPath);
            return;
          }

          scheduleBuild(changedPath);
        }),
      );
      watchers.push(await watcher);
    } catch (error) {
      console.warn(`[dev-server] could not watch ${dir}: ${error.message}`);
    }
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".xml":
      return "application/xml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function injectReload(html) {
  const snippet = `
<script>
(() => {
  const events = new EventSource("/__dev_reload");
  events.addEventListener("reload", () => window.location.reload());
})();
</script>
`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${snippet}</body>`);
  }

  return `${html}${snippet}`;
}

function safeJoinSite(urlPath) {
  const cleaned = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleaned === "/" ? "/circuitjs.html" : cleaned;
  const resolved = path.resolve(siteRoot, `.${relativePath}`);

  if (!resolved.startsWith(siteRoot)) {
    return null;
  }

  return resolved;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (req.url === "/__dev_reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("event: status\n");
    res.write(`data: ${lastBuildOk ? "ready" : "error"}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const filePath = safeJoinSite(req.url);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const stats = statSync(filePath);
  if (stats.isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (filePath.endsWith(".html")) {
    const html = await readFile(filePath, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(injectReload(html));
    return;
  }

  res.writeHead(200, { "Content-Type": contentType(filePath) });
  createReadStream(filePath).pipe(res);
});

process.on("SIGINT", () => {
  for (const watcher of watchers) {
    watcher.close();
  }
  server.close(() => process.exit(0));
});

await watchDir(path.join(repoRoot, "war"));
await watchDir(path.join(repoRoot, "src", "com", "lushprojects", "circuitjs1", "public"));

server.listen(port, host, () => {
  console.log(`[dev-server] serving ${siteRoot}`);
  console.log(`[dev-server] watching war/ and src/com/lushprojects/circuitjs1/public/`);
  console.log(`[dev-server] open http://${host}:${port}/circuitjs.html`);
});
