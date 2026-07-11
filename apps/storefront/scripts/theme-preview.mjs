#!/usr/bin/env node
/**
 * Generate a gallery preview thumbnail for a theme.
 *
 *   node scripts/theme-preview.mjs <id>
 *
 * Activates the theme via the admin API, screenshots the storefront home into
 * public/themes/<id>/preview.png, then reverts to the previously-active theme.
 * Both servers must be running. Requires puppeteer-core + a local Chrome.
 *
 * Env overrides:
 *   ADMIN_URL (default http://localhost:9000)
 *   STORE_URL (default http://localhost:8000)
 *   STORE_REGION (default bd)
 *   ADMIN_EMAIL / ADMIN_PASSWORD (default admin@medusa-test.com / supersecret)
 *   CHROME_PATH (default macOS Google Chrome)
 */
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const id = (process.argv[2] || "").trim()
if (!id) {
  console.error("Usage: node scripts/theme-preview.mjs <id>")
  process.exit(1)
}

let puppeteer
try {
  puppeteer = (await import("puppeteer-core")).default
} catch {
  console.error(
    "puppeteer-core is not installed. Install it (npm i -D puppeteer-core) or\n" +
      "take the screenshot manually: activate the theme in the admin gallery, open\n" +
      `the home page, and save a 1280x800 PNG to public/themes/${id}/preview.png`
  )
  process.exit(1)
}

const ADMIN = process.env.ADMIN_URL || "http://localhost:9000"
const STORE = process.env.STORE_URL || "http://localhost:8000"
const REGION = process.env.STORE_REGION || "bd"
const EMAIL = process.env.ADMIN_EMAIL || "admin@medusa-test.com"
const PASSWORD = process.env.ADMIN_PASSWORD || "supersecret"
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const out = resolve(__dirname, `../public/themes/${id}`)
await mkdir(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
})
try {
  const admin = await browser.newPage()
  await admin.goto(`${ADMIN}/app/login`, { waitUntil: "networkidle2" })
  await sleep(1200)
  await admin.type('input[name="email"]', EMAIL)
  await admin.type('input[name="password"]', PASSWORD)
  await admin.click('button[type="submit"]')
  await sleep(4000)

  const before = await admin.evaluate(async () => {
    const r = await fetch("/admin/cms/themes", { credentials: "include" })
    return (await r.json()).active
  })

  const setTheme = (themeId) =>
    admin.evaluate(async (t) => {
      const r = await fetch("/admin/cms/themes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t }),
      })
      return (await r.json()).active
    }, themeId)

  await setTheme(id)
  await sleep(2500)

  const sf = await browser.newPage()
  await sf.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await sf.goto(`${STORE}/${REGION}`, { waitUntil: "networkidle2" })
  await sleep(4000)
  await sf.screenshot({
    path: resolve(out, "preview.png"),
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  })
  console.log(`Saved public/themes/${id}/preview.png`)

  if (before && before !== id) {
    await setTheme(before)
    console.log(`Reverted active theme to "${before}".`)
  }
} finally {
  await browser.close()
}
