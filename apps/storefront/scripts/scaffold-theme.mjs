#!/usr/bin/env node
/**
 * Scaffold a new storefront theme.
 *
 *   node scripts/scaffold-theme.mjs <id> "<Display Name>"
 *
 * Creates src/themes/<id>/ starting as a clone of Learts (so the theme is
 * functional immediately), then you restyle blocks one at a time. Prints the
 * registry + backend-catalog edits to wire it up.
 */
import { mkdir, writeFile, access } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const themesDir = resolve(__dirname, "../src/themes")

const [, , idArg, ...nameParts] = process.argv
const id = (idArg || "").trim()
const name = nameParts.join(" ").trim() || id

if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error(
    'Usage: node scripts/scaffold-theme.mjs <id> "<Display Name>"\n' +
      "  <id> must be kebab-case (e.g. nordic, bold-market)."
  )
  process.exit(1)
}

const dir = resolve(themesDir, id)
try {
  await access(dir)
  console.error(`Theme "${id}" already exists at ${dir}. Choose another id.`)
  process.exit(1)
} catch {
  // does not exist — good
}

const blocksTs = `/* ${name} theme — block map.
 *
 * Starts as a clone of Learts so the theme is functional immediately. Replace
 * entries with your own components under ./blocks/* as you restyle them; any
 * block you do not override keeps the Learts renderer.
 */
import type { ThemeBlockMap } from "../contract"
import { leartsBlocks } from "../learts/blocks"

export const ${camel(id)}Blocks: ThemeBlockMap = {
  ...leartsBlocks,
  // Override per block as you build them, e.g.:
  // hero_slider: HeroSlider,
}
`

const indexTs = `/* ${name} — storefront theme manifest. */
import type { ThemeManifest } from "../contract"
import { LEARTS_STYLESHEETS } from "../learts"
import { ${camel(id)}Blocks } from "./blocks"

export const ${camel(id)}Theme: ThemeManifest = {
  id: "${id}",
  name: "${name}",
  description: "TODO: describe the ${name} design.",
  preview: "/themes/${id}/preview.png",
  bodyClassName: "${id}-theme",
  // Keep the Learts base so interior commerce pages stay styled; add your own
  // override sheet under public/themes/${id}/${id}.css if you need one.
  stylesheets: [...LEARTS_STYLESHEETS],
  tokens: {
    colors: {
      primary: "#111111",
      dark: "#111111",
      border: "#e5e7eb",
      text: "#1a1a1a",
      heading: "#111111",
      bg: "#ffffff",
    },
    fonts: {
      body: "ui-sans-serif, system-ui, sans-serif",
      heading: "ui-sans-serif, system-ui, sans-serif",
    },
  },
  blocks: ${camel(id)}Blocks,
  // Header / Footer: add bespoke chrome under ./chrome/* and reference here.
}

export default ${camel(id)}Theme
`

await mkdir(resolve(dir, "blocks"), { recursive: true })
await writeFile(resolve(dir, "blocks.ts"), blocksTs)
await writeFile(resolve(dir, "index.ts"), indexTs)
await writeFile(
  resolve(dir, "blocks", ".gitkeep"),
  "# put this theme's bespoke block components here\n"
)

console.log(`\nScaffolded theme "${id}" at src/themes/${id}/\n`)
console.log("Next steps:\n")
console.log("1) Register it in src/themes/registry.ts:")
console.log(`     import { ${camel(id)}Theme } from "./${id}"`)
console.log(`     // add to THEMES:  [${camel(id)}Theme.id]: ${camel(id)}Theme,\n`)
console.log(
  "2) Mirror metadata in apps/backend/src/api/admin/cms/themes/_catalog.ts:"
)
console.log(
  `     { id: "${id}", name: "${name}", description: "…", preview: "/themes/${id}/preview.png" }\n`
)
console.log("3) Restyle blocks under src/themes/" + id + "/blocks/* and update blocks.ts.")
console.log("4) node scripts/theme-preview.mjs " + id + "   (generate the gallery thumbnail)")
console.log("5) npx tsc --noEmit, then activate it from the admin gallery.\n")

function camel(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
