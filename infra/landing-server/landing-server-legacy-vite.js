/**
 * mAutomate marketing-site server (brandtodoor.com apex).
 *
 * Serves the built Vite SPA from LANDING_DIR/dist with SEO-aware HTML:
 * per-route <title>/<meta>/JSON-LD are injected server-side so crawlers and
 * link unfurlers see correct metadata without executing JS. Dynamic bits are
 * proxied same-origin to the mAutomate console backend:
 *   GET  /api/blog-posts        -> backend /blog-posts
 *   GET  /api/blog-posts/:slug  -> backend /blog-posts/:slug
 *   POST /api/contact           -> backend /support/contact
 *   GET  /sitemap.xml           -> static routes + published blog slugs
 *   GET  /robots.txt
 * Unknown routes serve the SPA shell with a real 404 status.
 *
 * Env:  BACKEND_URL (default http://127.0.0.1:9500)  PORT (default 8500)
 *       LANDING_DIR (default /home/ratul/brandtodoor-landing)
 */
const http = require("http")
const fs = require("fs")
const path = require("path")

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:9500"
const PORT = parseInt(process.env.PORT || "8500", 10)
const DIR = process.env.LANDING_DIR || "/home/ratul/brandtodoor-landing"
const DIST = path.join(DIR, "dist")
const ORIGIN = "https://brandtodoor.com"

const STOREFRONT_PORT = parseInt(process.env.STOREFRONT_PORT || "8601", 10)
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "9500", 10)

/**
 * Raw streaming proxy for the partner portal. The portal UI lives in the
 * storefront Next app and its API in the control-plane backend; the root
 * domain (mautomate.ai) enters through this server, so /partners and its
 * API/auth paths pass straight through untouched.
 */
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
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".map": "application/json",
}

/** Per-route metadata mirrored from the SPA's usePageMeta calls. */
const ROUTE_META = {
  "/signup": {
    title: "Start your store — mAutomate",
    description: "Create your AI-powered store in minutes. Pick a plan or start a 14-day free trial — no credit card required.",
  },
  "/login": {
    title: "Log in to your store — mAutomate",
    description: "Sign in to your mAutomate store dashboard.",
  },
  "/": {
    title: "mAutomate — The AI-powered commerce platform",
    description:
      "Launch a store that runs itself. mAutomate's AI builds your storefront, runs your marketing, and answers your customers — you ship the product. 14-day free trial.",
  },
  "/pricing": {
    title: "Pricing — mAutomate plans from $29/month",
    description:
      "Simple pricing for an AI-run store: Launch $29/mo, Grow $79/mo, Scale $199/mo. Pay for work done, not seats. 14-day free trial on every plan, no card required.",
  },
  "/blog": {
    title: "Blog — Notes from the build | mAutomate",
    description:
      "What we're learning building an AI that runs real stores: shipped features, honest numbers, and the occasional wrong turn.",
  },
  "/about": {
    title: "About mAutomate — merchants first, AI second",
    description:
      "Why we built mAutomate: software gave everyone a store, nobody got the staff. Meet the AI team that builds, markets, and answers — with you in charge.",
  },
  "/faq": {
    title: "FAQ — mAutomate, the AI-powered commerce platform",
    description:
      "Answers about mAutomate: how the AI builds and runs your store, what AI actions cost, who owns your data, and how the 14-day free trial works.",
  },
  "/contact": {
    title: "Start your store — Contact mAutomate",
    description:
      "Tell us about your brand. Three questions, two minutes — a founder reads every note and replies within a working day.",
  },
  "/privacy": {
    title: "Privacy Policy — mAutomate",
    description:
      "How mAutomate handles personal data: what we collect from the contact form and newsletter, how merchant store data is treated, and your rights.",
  },
  "/terms": {
    title: "Terms of Service — mAutomate",
    description:
      "The terms for using mAutomate: trials and billing, AI actions, your responsibility for what ships, data ownership and export, and liability.",
  },
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  )

let SHELL_CACHE = null
function shell() {
  if (!SHELL_CACHE) SHELL_CACHE = fs.readFileSync(path.join(DIST, "index.html"), "utf8")
  return SHELL_CACHE
}

/** Rewrite the SPA shell's title/description/canonical/og tags for a route. */
function renderShell({ title, description, url, ogType = "website", jsonld = null }) {
  let html = shell()
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  const swap = (re, tag) => {
    html = re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}\n</head>`)
  }
  swap(/<meta name="description"[^>]*\/?>(?:<\/meta>)?/, `<meta name="description" content="${esc(description)}" />`)
  swap(/<link rel="canonical"[^>]*\/?>/, `<link rel="canonical" href="${esc(url)}" />`)
  swap(/<meta property="og:title"[^>]*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
  swap(/<meta property="og:description"[^>]*\/?>/, `<meta property="og:description" content="${esc(description)}" />`)
  swap(/<meta property="og:url"[^>]*\/?>/, `<meta property="og:url" content="${esc(url)}" />`)
  swap(/<meta property="og:type"[^>]*\/?>/, `<meta property="og:type" content="${esc(ogType)}" />`)
  swap(/<meta name="twitter:title"[^>]*\/?>/, `<meta name="twitter:title" content="${esc(title)}" />`)
  swap(/<meta name="twitter:description"[^>]*\/?>/, `<meta name="twitter:description" content="${esc(description)}" />`)
  if (jsonld) {
    html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n</head>`)
  }
  return html
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

const server = http.createServer(async (req, res) => {
  // --- Retired test domain: brandtodoor.com serves a blank page, nothing else. ---
  // (mautomate.ai and every other host are unaffected.) RETIRED_HOSTS
  {
    const _h = String(req.headers.host || "").toLowerCase().split(":")[0]
    if (_h === "brandtodoor.com" || _h === "www.brandtodoor.com") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      })
      return res.end("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex, nofollow\"><title>brandtodoor.com</title></head><body></body></html>")
    }
  }

  // ---- Partner portal (mautomate.ai/partners): UI, assets, API, auth ----
  {
    const raw = req.url || "/"
    if (
      raw === "/partners" ||
      raw.startsWith("/partners/") ||
      raw.startsWith("/partners?") ||
      raw.startsWith("/_next/")
    ) {
      return proxyRaw(STOREFRONT_PORT, req, res)
    }
    if (raw.startsWith("/partner/") || raw.startsWith("/auth/partner/")) {
      return proxyRaw(BACKEND_PORT, req, res)
    }
  }

  const send = (code, type, body, extra) =>
    res.writeHead(code, { "content-type": type, ...(extra || {}) }).end(body)
  const sendHtml = (code, html) =>
    send(code, "text/html; charset=utf-8", html, { "cache-control": "no-cache" })

  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0])

    // ---- API proxies (same-origin, no CORS needed) ----
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
      return send(
        200,
        "text/plain; charset=utf-8",
        `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`
      )
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
          .map(
            (u) =>
              `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`
          )
          .join("\n") +
        `\n</urlset>\n`
      return send(200, "application/xml", xml, { "cache-control": "public, max-age=300" })
    }

    // ---- static assets from the Vite build ----
    const safe = path.normalize(url).replace(/^(\.\.[/\\])+/, "")
    const file = path.join(DIST, safe)
    if (
      file.startsWith(DIST) &&
      safe !== "/" &&
      fs.existsSync(file) &&
      fs.statSync(file).isFile()
    ) {
      const ext = path.extname(file).toLowerCase()
      const immutable = safe.startsWith("/assets/")
      return send(200, MIME[ext] || "application/octet-stream", fs.readFileSync(file), {
        "cache-control": immutable
          ? "public, max-age=31536000, immutable"
          : "public, max-age=300",
      })
    }

    // ---- SPA routes with server-injected metadata ----
    const normalized = url !== "/" && url.endsWith("/") ? url.slice(0, -1) : url

    if (ROUTE_META[normalized]) {
      const m = ROUTE_META[normalized]
      return sendHtml(
        200,
        renderShell({ ...m, url: `${ORIGIN}${normalized === "/" ? "/" : normalized}` })
      )
    }

    const postMatch = normalized.match(/^\/blog\/([A-Za-z0-9-_]+)$/)
    if (postMatch) {
      const data = await backendJson(`${BACKEND}/blog-posts/${postMatch[1]}`)
      if (data && data.post) {
        const p = data.post
        return sendHtml(
          200,
          renderShell({
            title: `${p.title} — mAutomate`,
            description: p.excerpt || "Notes from building an AI that runs real stores.",
            url: `${ORIGIN}/blog/${p.slug}`,
            ogType: "article",
            jsonld: {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: p.title,
              description: p.excerpt || undefined,
              datePublished: p.published_at,
              url: `${ORIGIN}/blog/${p.slug}`,
              author: { "@type": "Organization", name: "mAutomate" },
              publisher: { "@type": "Organization", name: "mAutomate" },
            },
          })
        )
      }
      // fall through to 404 shell
    }

    // ---- unknown route: SPA shell, real 404 status, noindex ----
    let nf = renderShell({
      title: "Page not found — mAutomate",
      description: "This page never launched. Everything worth seeing is one click away.",
      url: `${ORIGIN}${normalized}`,
    })
    nf = nf.replace("</head>", `<meta name="robots" content="noindex" />\n</head>`)
    return sendHtml(404, nf)
  } catch (e) {
    res.writeHead(500, { "content-type": "text/html" }).end("<h1>Temporarily unavailable</h1>")
  }
})

server.listen(PORT, "127.0.0.1", () =>
  console.log(`[b2d-landing] SPA on 127.0.0.1:${PORT} -> ${BACKEND} (dist: ${DIST})`)
)
