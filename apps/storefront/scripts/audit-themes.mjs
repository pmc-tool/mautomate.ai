#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/* Theme completeness audit — the single contract every theme must     */
/* satisfy to render identically in the LIVE storefront and the VISUAL  */
/* EDITOR. Run standalone (`node scripts/audit-themes.mjs`) or in CI /   */
/* prebuild; exits non-zero (and prints the gaps) if any theme is        */
/* incomplete, so a missing piece fails the build instead of surfacing   */
/* later as a per-theme bug.                                             */
/*                                                                      */
/* Static checks (fs + regex) so it needs no build step. `learts` is the */
/* BASE theme: it intentionally reuses the shared @modules block         */
/* renderers, the root layout chrome, and CanvasFooter, so the theme-    */
/* local requirements below are waived for it (BASE_THEME).              */
/* ------------------------------------------------------------------ */

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src")
const THEMES_DIR = join(SRC, "themes")
const CANVAS = join(SRC, "modules", "cms", "editor", "canvas-theme.tsx")

const BASE_THEME = "learts"

/** Read a file or "" if missing (never throws). */
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "")
/** Does theme <t>'s chrome dir contain a *FooterView.tsx? */
const hasFooterView = (t) =>
  existsSync(join(THEMES_DIR, t, "chrome")) &&
  readdirSync(join(THEMES_DIR, t, "chrome")).some((f) => /FooterView\.tsx$/.test(f))

/* Each check: label + a predicate over (idx = index.ts text, t = theme id). A
   theme is complete when every check passes. Waived checks for the base theme
   are marked `base:false`. */
const CHECKS = [
  { key: "id", base: true, ok: (idx) => /\bid:\s*["']/.test(idx) },
  { key: "name", base: true, ok: (idx) => /\bname:\s*["']/.test(idx) },
  { key: "tokens", base: true, ok: (idx) => /\btokens:\s*\{/.test(idx) },
  { key: "stylesheets", base: true, ok: (idx) => /stylesheets:|STYLESHEETS/.test(idx) },
  { key: "preview", base: true, ok: (idx) => /\bpreview:\s*["']/.test(idx) },
  { key: "defaultSections", base: true, ok: (idx) => /defaultSections:\s*\[/.test(idx) },
  // Bespoke chrome + interior templates — waived for the base theme.
  { key: "Header", base: false, ok: (idx) => /\bHeader:\s*\w/.test(idx) },
  { key: "Footer", base: false, ok: (idx) => /\bFooter:\s*\w/.test(idx) },
  {
    key: "templates(5)",
    base: false,
    ok: (idx) =>
      ["store", "product", "cart", "category", "login"].every((k) =>
        new RegExp(`\\b${k}:\\s*\\w`).test(idx)
      ),
  },
  // Editor-parity client views (async server blocks split into a client View).
  {
    key: "ProductTabsView",
    base: false,
    ok: (_idx, t) => existsSync(join(THEMES_DIR, t, "blocks", "ProductTabsView.tsx")),
  },
  {
    key: "CategoryShowcaseView",
    base: false,
    ok: (_idx, t) =>
      existsSync(join(THEMES_DIR, t, "blocks", "CategoryShowcaseView.tsx")),
  },
  { key: "FooterView", base: false, ok: (_idx, t) => hasFooterView(t) },
  // Editor canvas registry entry (theme id -> chrome + blocks).
  {
    key: "canvasEntry",
    base: true,
    ok: (_idx, t) => new RegExp(`^  ${t}:\\s*\\{`, "m").test(read(CANVAS)),
  },
]

const themes = readdirSync(THEMES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(THEMES_DIR, d.name, "index.ts")))
  .map((d) => d.name)
  .sort()

const gaps = []
for (const t of themes) {
  const idx = read(join(THEMES_DIR, t, "index.ts"))
  const isBase = t === BASE_THEME
  for (const c of CHECKS) {
    if (isBase && !c.base) continue // waived for the base theme
    if (!c.ok(idx, t)) gaps.push(`${t}: missing ${c.key}`)
  }
}

if (gaps.length) {
  console.error(`\nTheme contract audit FAILED — ${gaps.length} gap(s):`)
  for (const g of gaps) console.error(`  - ${g}`)
  console.error(
    `\nEvery theme must satisfy the contract so the visual editor and live` +
      ` storefront render identically. Fix the gaps above.\n`
  )
  process.exit(1)
}

console.log(
  `Theme contract audit passed — ${themes.length} themes complete ` +
    `(${themes.join(", ")}).`
)
