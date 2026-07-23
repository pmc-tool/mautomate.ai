/**
 * mAutomate marketing-site server (mautomate.ai) — serves the NEW Next.js
 * static export from LANDING_DIR (default /home/ratul/mautomate-landing/out).
 *
 * Preserves everything the previous (Vite) landing did:
 *   GET  /api/blog-posts, /api/blog-posts/:slug -> backend /blog-posts
 *   POST /api/contact                           -> backend /support/contact
 *   POST /api/newsletter                        -> recorded locally
 *   GET  /sitemap.xml  /robots.txt
 *   /partners, /partner/*, /auth/partner/*      -> storefront/backend (portal)
 *
 * The new landing is Next.js, so it uses /_next/* for its assets — which also
 * belong to the partner portal (a separate Next app in the storefront). We
 * disambiguate by filename: a /_next request that exists in the landing export
 * is served from disk; otherwise it is proxied to the storefront (the portal).
 * Landing and portal chunks are content-hashed, so they never collide.
 *
 * Env: BACKEND_URL (default http://127.0.0.1:9500), PORT (default 8500),
 *      LANDING_DIR (default /home/ratul/mautomate-landing/out),
 *      STOREFRONT_PORT (8601), BACKEND_PORT (9500)
 */
const http = require("http")
const fs = require("fs")
const path = require("path")

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:9500"
const PORT = parseInt(process.env.PORT || "8500", 10)
const DIR = process.env.LANDING_DIR || "/home/ratul/mautomate-landing"
const DIST = path.join(DIR, "out")
const ORIGIN = "https://mautomate.ai"
const STOREFRONT_PORT = parseInt(process.env.STOREFRONT_PORT || "8601", 10)
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "9500", 10)

function proxyRaw(port, req, res) {
  const upstream = http.request(
    { host: "127.0.0.1", port, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers)
      up.pipe(res)
    }
  )
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" })
    res.end("upstream unavailable")
  })
  req.pipe(upstream)
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
}

async function backendJson(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = ""
    req.on("data", (c) => {
      s += c
      if (s.length > 1e6) req.destroy()
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(s || "{}"))
      } catch {
        resolve({})
      }
    })
  })
}

// Resolve a request path to a file inside the Next export. Next (no trailing
// slash) emits `pricing.html`, `blog/slug.html`, plus `index.html`, `_next/*`,
// `assets/*`. Returns an absolute file path or null.
function resolveExportFile(urlPath) {
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "")
  const rel = safe === "/" ? "/index.html" : safe
  const candidates = []
  const p = path.join(DIST, rel)
  candidates.push(p) // exact file (assets, /_next, favicon, *.html)
  if (!path.extname(rel)) {
    candidates.push(p + ".html") // /pricing -> pricing.html
    candidates.push(path.join(p, "index.html")) // /pricing -> pricing/index.html
  }
  for (const c of candidates) {
    if (c.startsWith(DIST) && fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

function sendFile(res, file, { cache } = {}) {
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    "content-type": MIME[ext] || "application/octet-stream",
    "cache-control": cache || "public, max-age=300",
  })
  res.end(fs.readFileSync(file))
}

const server = http.createServer(async (req, res) => {
  // Retired test domain.
  {
    const h = String(req.headers.host || "").toLowerCase().split(":")[0]
    if (h === "brandtodoor.com" || h === "www.brandtodoor.com") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      })
      return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>brandtodoor.com</title></head><body></body></html>')
    }
  }

  const raw = req.url || "/"
  const send = (code, type, body, extra) =>
    res.writeHead(code, { "content-type": type, ...(extra || {}) }).end(body)

  // ---- Partner portal + its API/auth ----
  if (raw === "/partners" || raw.startsWith("/partners/") || raw.startsWith("/partners?")) {
    return proxyRaw(STOREFRONT_PORT, req, res)
  }
  if (raw.startsWith("/partner/") || raw.startsWith("/auth/partner/")) {
    return proxyRaw(BACKEND_PORT, req, res)
  }
  // /_next: serve the landing's asset if we have it; otherwise it belongs to
  // the partner portal (storefront).
  if (raw.startsWith("/_next/")) {
    const f = resolveExportFile(decodeURIComponent(raw.split("?")[0]))
    if (f) return sendFile(res, f, { cache: "public, max-age=31536000, immutable" })
    return proxyRaw(STOREFRONT_PORT, req, res)
  }

  try {
    const url = decodeURIComponent(raw.split("?")[0])

    // ---- API proxies (unchanged behaviour) ----
    if (url === "/api/contact" && req.method === "POST") {
      const body = await readBody(req)
      const r = await fetch(`${BACKEND}/support/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      return send(r.status, "application/json", JSON.stringify(d))
    }

    if (url === "/api/newsletter" && req.method === "POST") {
      const body = await readBody(req)
      const email = String(body.email || "").trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
        return send(400, "application/json", '{"message":"A valid email is required"}')
      }
      const file = path.join(DIR, "newsletter-subscribers.jsonl")
      const line = JSON.stringify({ email, at: new Date().toISOString() }) + "\n"
      try {
        const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
        if (!existing.includes(`"${email}"`)) fs.appendFileSync(file, line)
        return send(200, "application/json", '{"ok":true}')
      } catch {
        return send(500, "application/json", '{"message":"Could not save subscription"}')
      }
    }

    // Store signup: proxied same-origin to the backend so the browser never
    // depends on the api.mautomate.ai edge (and no CORS). Mirrors the old
    // landing's POST /platform/signup + GET /platform/signup/status flow.
    if (url === "/api/signup" && req.method === "POST") {
      const body = await readBody(req)
      const r = await fetch(`${BACKEND}/platform/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await r.text()
      return send(r.status, "application/json", d)
    }

    if (url === "/api/signup/status" && req.method === "GET") {
      const slug = new URLSearchParams(raw.split("?")[1] || "").get("slug") || ""
      const r = await fetch(
        `${BACKEND}/platform/signup/status?slug=${encodeURIComponent(slug)}`
      )
      const d = await r.text()
      return send(r.status, "application/json", d)
    }

    if (url.startsWith("/api/blog-posts") && req.method === "GET") {
      const rest = url.slice("/api/blog-posts".length)
      if (rest === "" || /^\/[A-Za-z0-9-_]+$/.test(rest)) {
        const r = await fetch(`${BACKEND}/blog-posts${rest}`)
        const d = await r.text()
        return send(r.status, "application/json", d)
      }
      return send(404, "application/json", '{"message":"Not found"}')
    }

    if (url.startsWith("/api/")) {
      return send(404, "application/json", '{"message":"Not found"}')
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return send(405, "text/plain; charset=utf-8", "Method not allowed")
    }

    // ---- robots.txt + sitemap.xml ----
    if (url === "/robots.txt") {
      return send(200, "text/plain; charset=utf-8", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`)
    }
    if (url === "/sitemap.xml") {
      const data = await backendJson(`${BACKEND}/blog-posts`)
      const posts = (data && data.posts) || []
      const today = new Date().toISOString().slice(0, 10)
      const urls = [
        { loc: `${ORIGIN}/`, priority: "1.0" },
        { loc: `${ORIGIN}/pricing`, priority: "0.9" },
        { loc: `${ORIGIN}/blog`, priority: "0.8" },
        { loc: `${ORIGIN}/faq`, priority: "0.8" },
        { loc: `${ORIGIN}/about`, priority: "0.7" },
        { loc: `${ORIGIN}/contact`, priority: "0.7" },
        { loc: `${ORIGIN}/privacy`, priority: "0.3" },
        { loc: `${ORIGIN}/terms`, priority: "0.3" },
        ...posts.map((p) => ({
          loc: `${ORIGIN}/blog/${p.slug}`,
          lastmod: (p.published_at || "").slice(0, 10) || today,
          priority: "0.6",
        })),
      ]
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`)
          .join("\n") +
        `\n</urlset>\n`
      return send(200, "application/xml", xml, { "cache-control": "public, max-age=300" })
    }

    // ---- serve the Next static export ----
    const file = resolveExportFile(url)
    if (file) {
      const isAsset = url.startsWith("/assets/") || url.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(url)
      return sendFile(res, file, {
        cache: isAsset ? "public, max-age=31536000, immutable" : "public, max-age=300",
      })
    }

    // ---- unknown route: the export's 404 page, real 404 status ----
    const nf = path.join(DIST, "404.html")
    if (fs.existsSync(nf)) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" })
      return res.end(fs.readFileSync(nf))
    }
    return send(404, "text/html; charset=utf-8", "<h1>Page not found</h1>")
  } catch (e) {
    res.writeHead(500, { "content-type": "text/html" }).end("<h1>Temporarily unavailable</h1>")
  }
})

server.listen(PORT, "127.0.0.1", () =>
  console.log(`[mautomate-landing] Next export on 127.0.0.1:${PORT} -> ${BACKEND} (dist: ${DIST})`)
)
