import { NextResponse } from "next/server"

/**
 * Service worker (served at the origin root `/sw.js`).
 *
 * The SW body is tenant-AGNOSTIC — the same caching logic serves every store —
 * so it is emitted as a static string with the headers a service worker needs
 * (`Service-Worker-Allowed: /` to allow root scope). Per-tenant identity lives
 * entirely in the manifest + generated icons, not in the SW.
 *
 * Caching strategy (deliberately conservative to avoid stale commerce data):
 *   - Navigations (HTML documents): NETWORK-ONLY, with a minimal offline
 *     fallback. Store HTML carries live prices, cart state and CMS content, so
 *     it is never served from cache — the shopper always sees fresh data when
 *     online, and a friendly offline page when not.
 *   - Static assets (Next chunks, theme assets, images, fonts): cache-first
 *     with a background refresh (stale-while-revalidate). These are
 *     content-hashed or static, so caching them is safe and makes repeat views
 *     instant + offline-tolerant for the shell.
 *   - API / store / data endpoints (/api, /store, /umami, /tenant-config) and
 *     the PWA endpoints themselves are never intercepted — always live.
 */
export const dynamic = "force-static"

const SW = String.raw`
const VERSION = "v1"
const STATIC_CACHE = "b2d-static-" + VERSION

// Same-origin path prefixes that are safe to cache-first (static/immutable).
const STATIC_PREFIXES = [
  "/_next/static/",
  "/learts/",
  "/themes/",
  "/theme-assets/",
  "/bazaro/",
  "/cignet/",
  "/ekka/",
  "/exzo/",
  "/helendo/",
  "/rokon/",
  "/shofy/",
]
const STATIC_EXT = /\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|webp|svg|ico|avif)(?:\?|$)/i

// Endpoints that must ALWAYS hit the network (live commerce/data + PWA files).
const NEVER_CACHE_PREFIXES = [
  "/api/",
  "/store/",
  "/umami",
  "/tenant-config",
  "/pwa-icon",
]

self.addEventListener("install", function () {
  self.skipWaiting()
})

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(function (k) {
            return k.indexOf("b2d-static-") === 0 && k !== STATIC_CACHE
          })
          .map(function (k) {
            return caches.delete(k)
          })
      )
      await self.clients.claim()
    })()
  )
})

function isStatic(url) {
  for (var i = 0; i < STATIC_PREFIXES.length; i++) {
    if (url.pathname.indexOf(STATIC_PREFIXES[i]) === 0) return true
  }
  return STATIC_EXT.test(url.pathname)
}

function isNeverCache(url) {
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/sw.js")
    return true
  for (var i = 0; i < NEVER_CACHE_PREFIXES.length; i++) {
    if (url.pathname.indexOf(NEVER_CACHE_PREFIXES[i]) === 0) return true
  }
  return false
}

function offlineResponse() {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Offline</title><style>" +
    "html,body{height:100%;margin:0}" +
    "body{display:flex;align-items:center;justify-content:center;" +
    "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
    "background:#fff;color:#1f1f1f;text-align:center;padding:24px}" +
    ".c{max-width:380px}h1{font-size:20px;margin:0 0 8px}" +
    "p{margin:0 0 20px;color:#666;font-size:15px;line-height:1.5}" +
    "button{font:inherit;padding:10px 20px;border:0;border-radius:8px;" +
    "background:#111;color:#fff;cursor:pointer}" +
    "</style></head><body><div class=\"c\">" +
    "<h1>You're offline</h1>" +
    "<p>This page needs a connection to load. Check your network and try again.</p>" +
    '<button onclick="location.reload()">Retry</button>' +
    "</div></body></html>"
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

self.addEventListener("fetch", function (event) {
  const req = event.request
  if (req.method !== "GET") return

  let url
  try {
    url = new URL(req.url)
  } catch (e) {
    return
  }

  if (url.origin !== self.location.origin) return
  if (isNeverCache(url)) return

  // Navigations: network-only (fresh prices/cart/content), offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(function () {
        return offlineResponse()
      })
    )
    return
  }

  // Static assets: cache-first + background refresh (stale-while-revalidate).
  if (isStatic(url)) {
    event.respondWith(
      (async function () {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(req)
        const network = fetch(req)
          .then(function (res) {
            if (
              res &&
              res.status === 200 &&
              (res.type === "basic" || res.type === "default")
            ) {
              cache.put(req, res.clone())
            }
            return res
          })
          .catch(function () {
            return cached
          })
        return cached || network
      })()
    )
  }
})
`

export async function GET() {
  return new NextResponse(SW, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}
