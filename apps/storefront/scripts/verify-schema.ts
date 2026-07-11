/**
 * Dependency-free checks for the CMS Phase 1 schema data/type layer.
 *
 * No test framework is installed in the storefront, so this runs the pure
 * schema functions directly under Node's native type stripping:
 *
 *   node --experimental-strip-types apps/storefront/scripts/verify-schema.ts
 *
 * (or `npm run verify:schema` from apps/storefront). Exits non-zero on any
 * failed assertion so it can gate CI later.
 *
 * The schema barrel (src/modules/cms/schema/index.ts) imports its block files
 * with extensionless specifiers, which Node's ESM resolver rejects. We register
 * a tiny in-process resolve hook (below) that appends `.ts` for extensionless
 * relative imports — the same thing the bundler does — so the REAL barrel and
 * getPanelSchema() are exercised, not a re-implementation.
 */

import { register } from "node:module"

/* --- resolve hook: let Node load the extensionless .ts import tree --- */
const resolveHook = `
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith("./") || spec.startsWith("../")) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
    const asFile = new URL(spec + ".ts", ctx.parentURL)
    if (existsSync(fileURLToPath(asFile))) return next(spec + ".ts", ctx)
    const asIndex = spec.replace(/\\/$/, "") + "/index.ts"
    if (existsSync(fileURLToPath(new URL(asIndex, ctx.parentURL)))) {
      return next(asIndex, ctx)
    }
  }
  return next(spec, ctx)
}
`
register("data:text/javascript," + encodeURIComponent(resolveHook), import.meta.url)

const {
  BLOCK_SCHEMAS,
  getBlockSchema,
  listBlockSchemas,
  getPanelSchema,
  resolveResponsive,
} = await import("../src/modules/cms/schema/index.ts")
const { UNIVERSAL_STYLE } = await import(
  "../src/modules/cms/schema/universal/style.ts"
)
const { UNIVERSAL_ADVANCED } = await import(
  "../src/modules/cms/schema/universal/advanced.ts"
)

let passed = 0
let failed = 0

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`  FAIL: ${name}`)
  }
}

/* --------------------------- resolveResponsive --------------------------- */

console.log("resolveResponsive:")

const full = { base: 1, tablet: 2, mobile: 3 }
check("desktop reads base", resolveResponsive(full, "desktop") === 1)
check("tablet reads tablet", resolveResponsive(full, "tablet") === 2)
check("mobile reads mobile", resolveResponsive(full, "mobile") === 3)

const baseOnly = { base: 10 }
check("base-only: desktop = base", resolveResponsive(baseOnly, "desktop") === 10)
check("base-only: tablet falls back to base", resolveResponsive(baseOnly, "tablet") === 10)
check("base-only: mobile falls back to base", resolveResponsive(baseOnly, "mobile") === 10)

const noTablet = { base: 10, mobile: 30 }
check("mobile override wins when tablet unset", resolveResponsive(noTablet, "mobile") === 30)
check("tablet falls back to base when unset", resolveResponsive(noTablet, "tablet") === 10)

const noMobile = { base: 10, tablet: 20 }
check("mobile falls back to tablet when mobile unset", resolveResponsive(noMobile, "mobile") === 20)

// Plain (non-responsive) scalars are returned unchanged for every device.
check("plain scalar unchanged (desktop)", resolveResponsive("center", "desktop") === "center")
check("plain scalar unchanged (tablet)", resolveResponsive("center", "tablet") === "center")
check("plain scalar unchanged (mobile)", resolveResponsive("center", "mobile") === "center")

/* --------------------------- universal schemas --------------------------- */

console.log("universal schemas:")

check("UNIVERSAL_STYLE is a non-empty array", Array.isArray(UNIVERSAL_STYLE) && UNIVERSAL_STYLE.length > 0)
check("UNIVERSAL_ADVANCED is a non-empty array", Array.isArray(UNIVERSAL_ADVANCED) && UNIVERSAL_ADVANCED.length > 0)
check(
  "every UNIVERSAL_STYLE field has name + type + label",
  UNIVERSAL_STYLE.every((f) => !!f.name && !!f.type && !!f.label)
)
check(
  "every UNIVERSAL_ADVANCED field carries a group (for accordions)",
  UNIVERSAL_ADVANCED.every((f) => !!f.group)
)

/* ----------------------------- getPanelSchema ---------------------------- */

console.log("getPanelSchema:")

const blockTypes = Object.keys(BLOCK_SCHEMAS)
check("registry is non-empty", blockTypes.length > 0)

for (const type of blockTypes) {
  const panel = getPanelSchema(type)
  check(
    `${type}: content is the block's own schema`,
    panel.content !== null && panel.content.type === type
  )
  check(`${type}: style is the shared UNIVERSAL_STYLE`, panel.style === UNIVERSAL_STYLE)
  check(`${type}: advanced is the shared UNIVERSAL_ADVANCED`, panel.advanced === UNIVERSAL_ADVANCED)
}

// Unknown block types still yield style/advanced so the tabs always render.
const unknown = getPanelSchema("does_not_exist")
check("unknown type: content is null", unknown.content === null)
check("unknown type: style still present", unknown.style === UNIVERSAL_STYLE)
check("unknown type: advanced still present", unknown.advanced === UNIVERSAL_ADVANCED)

// Existing exports must keep working.
check("getBlockSchema still resolves a known block", getBlockSchema(blockTypes[0])?.type === blockTypes[0])
check("listBlockSchemas returns every registered block", listBlockSchemas().length === blockTypes.length)

/* ------------------------------- report ---------------------------------- */

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
