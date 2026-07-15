/**
 * Static host + API proxy for the Brand2Door operator console SPA.
 * Serves the built dist/ (SPA fallback to index.html) and proxies /admin/* +
 * /auth/* to the control-plane backend, so the SPA is same-origin.
 * Env: BACKEND_URL (default http://127.0.0.1:9500), PORT (default 8700).
 */
const http = require("http")
const fs = require("fs")
const path = require("path")
const { URL } = require("url")

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:9500"
const PORT = parseInt(process.env.PORT || "8700", 10)
const DIST = path.join(__dirname, "dist")
const B = new URL(BACKEND)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
}

function proxy(req, res) {
  const opts = {
    hostname: B.hostname,
    port: B.port || 80,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: B.host },
  }
  const up = http.request(opts, (r) => {
    res.writeHead(r.statusCode, r.headers)
    r.pipe(res)
  })
  up.on("error", () => {
    res.writeHead(502, { "content-type": "application/json" }).end('{"message":"backend unreachable"}')
  })
  req.pipe(up)
}

function serveFile(res, file) {
  const ext = path.extname(file)
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end("not found")
    const cache = ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
    res
      .writeHead(200, {
        "content-type": MIME[ext] || "application/octet-stream",
        "cache-control": cache,
      })
      .end(buf)
  })
}

function resolveAsset(urlPath) {
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "")
  if (safe === "/") return path.join(DIST, "index.html")

  const asset = path.join(DIST, safe)
  if (fs.existsSync(asset)) {
    const stat = fs.statSync(asset)
    if (stat.isFile()) return asset
    if (stat.isDirectory()) {
      const index = path.join(asset, "index.html")
      if (fs.existsSync(index) && fs.statSync(index).isFile()) return index
    }
  }

  // Try appending .html for clean paths like /control/overview
  const htmlAsset = asset + ".html"
  if (fs.existsSync(htmlAsset) && fs.statSync(htmlAsset).isFile()) return htmlAsset

  return null
}

http
  .createServer((req, res) => {
    const url = req.url.split("?")[0]
    if (url === "/healthz") return void res.writeHead(200).end("ok")
    if (url.startsWith("/admin/") || url.startsWith("/auth/")) return void proxy(req, res)

    const asset = resolveAsset(url)
    if (asset) return serveFile(res, asset)

    // SPA fallback
    serveFile(res, path.join(DIST, "index.html"))
  })
  .listen(PORT, "127.0.0.1", () =>
    // eslint-disable-next-line no-console
    console.log(`[console] 127.0.0.1:${PORT} -> ${BACKEND}`)
  )
