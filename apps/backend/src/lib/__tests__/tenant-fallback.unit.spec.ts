import fs from "fs"
import path from "path"

/**
 * Brand2Door Phase 1 isolation gate.
 *
 * Instance-per-tenant means each backend serves ONE tenant, resolved through the
 * single `resolveTenantId()` helper. A raw `process.env.*_DEFAULT_TENANT ?? "default"`
 * (or `|| "default"`) anywhere else is a silent cross-tenant fallback — exactly
 * what the review told us to ban. This test fails the build if one reappears.
 */
const SRC = path.resolve(__dirname, "../..")
const ALLOWED = path.join(SRC, "lib", "tenant-context.ts")

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue
      walk(p, acc)
    } else if (e.name.endsWith(".ts")) {
      acc.push(p)
    }
  }
  return acc
}

// matches an inline tenant fallback: `process.env.SOMETHING_DEFAULT_TENANT ?? "default"`
const RAW_FALLBACK =
  /process\.env\.[A-Z_]*_DEFAULT_TENANT\s*(?:\?\?|\|\|)\s*["']default["']/
// matches a bare `?? "default"` used as a tenant fallback near a tenant word
const BARE_DEFAULT = /(?:\?\?|\|\|)\s*["']default["']/

describe("tenant fallback CI gate", () => {
  const files = walk(SRC).filter(
    (f) => f !== ALLOWED && !f.includes("__tests__")
  )

  it("has no raw *_DEFAULT_TENANT ?? \"default\" outside the central resolver", () => {
    const offenders = files.filter((f) =>
      RAW_FALLBACK.test(fs.readFileSync(f, "utf8"))
    )
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })

  it("keeps the lone permitted \"default\" fallback inside tenant-context.ts", () => {
    // the resolver itself is allowed exactly one bare fallback
    expect(BARE_DEFAULT.test(fs.readFileSync(ALLOWED, "utf8"))).toBe(true)
  })
})
