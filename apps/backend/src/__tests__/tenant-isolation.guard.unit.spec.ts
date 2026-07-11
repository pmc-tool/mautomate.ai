/**
 * TENANT-ISOLATION BUILD-TIME GUARD (static source scan -- NO DB, NO server)
 * =========================================================================
 *
 * This spec makes the pooled multi-tenant isolation invariants (closed by the
 * P0 + P1 work) SELF-ENFORCING. It reads the source with `fs` and asserts three
 * structural invariants purely by regex. It never boots Medusa, opens a DB, or
 * makes a network call, so it is safe to run anywhere (`npm run test:isolation`).
 *
 * If a future change silently reintroduces a cross-tenant leak (drops a
 * `tenant_id`, or wires a CMS read/write route without a tenant resolver) this
 * test FAILS in CI and names the exact offending file(s).
 *
 * The three invariants:
 *
 *   1. Every store-owned model declares `tenant_id`.
 *      Scan: cms models + contact models. Exceptions live in
 *      MODEL_TENANT_ID_ALLOWLIST (the translation child tables, which inherit
 *      tenant via their parent FK).
 *
 *   2. CMS store READS are tenant-scoped.
 *      Scan: route.ts files under src/api/store/cms. Any route that calls a
 *      listCms / listAndCountCms / retrieveCms method MUST also reference the
 *      `cmsTenantId` resolver.
 *
 *   3. CMS WRITES use `requireWriteTenant`.
 *      Scan: route.ts files under src/api/admin/cms and src/api/cms. Any route
 *      that calls a createCms / updateCms / deleteCms / softDeleteCms /
 *      publishSnapshot write MUST also reference `requireWriteTenant`. Pure GET
 *      reader routes (no write call) are ignored. Exceptions live in
 *      WRITE_TENANT_EXEMPT / WRITE_TENANT_KNOWN_GAPS.
 *
 * HOW TO ADD A LEGITIMATE EXCEPTION: add the SRC-relative path to the correct
 * allowlist below WITH a comment explaining why. That keeps every exception
 * visible and code-reviewed instead of silently slipping through.
 */

import fs from "fs"
import path from "path"

// src/ root -- robust regardless of the cwd jest is invoked from
// (this file lives at src/__tests__/, so "../" is src/).
const SRC = path.resolve(__dirname, "..")

// ---------------------------------------------------------------------------
// small fs helpers (sync, no deps)
// ---------------------------------------------------------------------------

function walk(dir: string, match: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, match))
    else if (entry.isFile() && match(full)) out.push(full)
  }
  return out
}

function read(file: string): string {
  return fs.readFileSync(file, "utf8")
}

// Strip block + line comments so a doc-comment mentioning a method name cannot
// masquerade as a real call.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

// SRC-relative, forward-slash path used for allowlist matching + messages.
function rel(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/")
}

function fail(invariant: string, explanation: string, files: string[]): never {
  throw new Error(
    `\n${invariant} VIOLATION -- ${explanation}\n` +
      files.map((f) => `  - src/${f}`).join("\n") +
      `\n`
  )
}

// ---------------------------------------------------------------------------
// detection regexes
// ---------------------------------------------------------------------------

// A tenant-owned model must declare a `tenant_id` field.
const HAS_TENANT_ID = /\btenant_id\b/

// A CMS content READ (generated MedusaService accessors).
const CMS_READ_CALL = /\.(?:list|listAndCount|retrieve)Cms[A-Za-z]*\s*\(/

// A CMS content WRITE (generated MedusaService mutators) or snapshot publish.
const CMS_WRITE_CALL =
  /\.(?:create|update|delete|softDelete|restore|upsert)Cms[A-Za-z]*\s*\(|\bpublishSnapshot\s*\(/

const HAS_CMS_TENANT_RESOLVER = /\bcmsTenantId\b/
const HAS_WRITE_TENANT_RESOLVER = /\brequireWriteTenant\b/

// --- call-center / telephony (P0+P1) detection ---
// A query.graph over a tenant-owned commerce entity.
const CC_SENSITIVE_ENTITY = /entity:\s*["'](?:order|product|customer)["']/
// Any token that proves the surrounding method is sales-channel scoped (or an
// explicit, reviewed opt-out marker `// isolation-ok: <reason>`).
const CC_SCOPE_TOKEN =
  /sales_channel_id|tenantSalesChannelId|customerHasOrderInSc|assertOrderInTenant|isolation-ok:/
// The trust anchor in tool-execute: tenant must come from the call row.
const CC_CALL_TENANT_ANCHOR = /call\.tenant_id/

// ---------------------------------------------------------------------------
// ALLOWLISTS -- every entry MUST carry a reason. Reviewers gate these.
// ---------------------------------------------------------------------------

// INVARIANT 1: models intentionally WITHOUT their own tenant_id column.
const MODEL_TENANT_ID_ALLOWLIST: string[] = [
  // Child translation tables: 1:N off a tenant-scoped parent (page / section /
  // blog_post). They carry no tenant_id of their own -- tenant is inherited
  // through the parent FK, and every query joins/filters via the parent. Adding
  // a redundant tenant_id here would be a denormalization footgun.
  "modules/cms/models/page-translation.ts",
  "modules/cms/models/section-translation.ts",
  "modules/cms/models/blog-post-translation.ts",
]

// INVARIANT 3: write routes that legitimately do NOT need requireWriteTenant
// because they do not mutate per-tenant CMS *content* -- they manage the
// operator identity/RBAC plane, which is a separate trust domain.
const WRITE_TENANT_EXEMPT: string[] = [
  // Deletes a platform ADMIN USER account + its cms_user_role rows. Operator-
  // only surface (the /admin/cms guard requires actor_type "user"; merchants
  // cannot reach it). Guarded by the self-delete + last-admin invariants. The
  // cms_user_role row is operator RBAC state, not tenant content.
  "api/admin/cms/users/[id]/route.ts",
  // Assigns admin RBAC roles (cms_user_role). Operator-only, guarded by
  // assertAdminActor + the last-admin invariant. RBAC assignment, not content.
  "api/admin/cms/roles/[user_id]/route.ts",
]

// INVARIANT 3: KNOWN, DOCUMENTED RESIDUAL GAPS. These operator-only /admin/cms
// content editors DO write tenant-owned content (cms_section / cms_media, both
// of which carry tenant_id) but currently scope by resource id instead of
// calling requireWriteTenant. They are NOT reachable by merchants (operator-
// only surface), so they are not part of the merchant cross-tenant vector that
// P0/P1 closed -- but they SHOULD adopt requireWriteTenant + an ownership
// assertion. Tracked here so the exception is explicit and reviewed, not
// silent. REMOVE the entry once the route is hardened.
const WRITE_TENANT_KNOWN_GAPS: string[] = [
  // P2: sections/[id], media/[id] and pages/[id]/sections/reorder were hardened
  // with requireWriteTenant + ownership checks in the final sweep, so they are no
  // longer exempt — the guard now fully enforces them.
]

const WRITE_TENANT_ALLOWLIST = [
  ...WRITE_TENANT_EXEMPT,
  ...WRITE_TENANT_KNOWN_GAPS,
]

// ---------------------------------------------------------------------------
// the guard
// ---------------------------------------------------------------------------

describe("tenant-isolation guard (static source scan)", () => {
  it("INVARIANT 1: every store-owned model declares tenant_id", () => {
    const modelFiles = [
      ...walk(path.join(SRC, "modules/cms/models"), (f) => f.endsWith(".ts")),
      ...walk(path.join(SRC, "modules/contact/models"), (f) =>
        f.endsWith(".ts")
      ),
    ]

    // Guard the guard: if the scan finds nothing, the paths drifted.
    expect(modelFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of modelFiles) {
      const r = rel(file)
      if (MODEL_TENANT_ID_ALLOWLIST.includes(r)) continue
      if (!HAS_TENANT_ID.test(read(file))) violations.push(r)
    }

    if (violations.length) {
      fail(
        "INVARIANT 1",
        "model(s) missing a `tenant_id` field (add tenant_id, or add to " +
          "MODEL_TENANT_ID_ALLOWLIST with a reason):",
        violations
      )
    }
    expect(violations).toHaveLength(0)
  })

  it("INVARIANT 2: CMS store reads reference cmsTenantId", () => {
    const routes = walk(path.join(SRC, "api/store/cms"), (f) =>
      f.endsWith("route.ts")
    )
    expect(routes.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of routes) {
      const src = stripComments(read(file))
      if (CMS_READ_CALL.test(src) && !HAS_CMS_TENANT_RESOLVER.test(src)) {
        violations.push(rel(file))
      }
    }

    if (violations.length) {
      fail(
        "INVARIANT 2",
        "store CMS route reads content but never references `cmsTenantId` " +
          "(an un-scoped read leaks other tenants' content):",
        violations
      )
    }
    expect(violations).toHaveLength(0)
  })

  it("INVARIANT 3: CMS write routes reference requireWriteTenant", () => {
    const routes = [
      ...walk(path.join(SRC, "api/admin/cms"), (f) => f.endsWith("route.ts")),
      ...walk(path.join(SRC, "api/cms"), (f) => f.endsWith("route.ts")),
    ]
    expect(routes.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of routes) {
      const r = rel(file)
      const src = stripComments(read(file))
      if (!CMS_WRITE_CALL.test(src)) continue // pure reader -- not our concern
      if (HAS_WRITE_TENANT_RESOLVER.test(src)) continue // correctly scoped
      if (WRITE_TENANT_ALLOWLIST.includes(r)) continue // reviewed exception
      violations.push(r)
    }

    if (violations.length) {
      fail(
        "INVARIANT 3",
        "CMS write route mutates content but never references " +
          "`requireWriteTenant` (a write scoped off a spoofable publishable key " +
          "is a cross-tenant write leak). Wire requireWriteTenant, or add to " +
          "WRITE_TENANT_EXEMPT / WRITE_TENANT_KNOWN_GAPS with a reason:",
        violations
      )
    }
    expect(violations).toHaveLength(0)
  })

  it("INVARIANT 4: every call-center model declares tenant_id", () => {
    const modelFiles = walk(
      path.join(SRC, "modules/call-center/models"),
      (f) => f.endsWith(".ts")
    )
    // Guard the guard: paths must resolve to real files.
    expect(modelFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of modelFiles) {
      const r = rel(file)
      if (MODEL_TENANT_ID_ALLOWLIST.includes(r)) continue
      if (!HAS_TENANT_ID.test(read(file))) violations.push(r)
    }

    if (violations.length) {
      fail(
        "INVARIANT 4",
        "call-center model(s) missing a `tenant_id` field (every call-center " +
          "row is tenant-scoped):",
        violations
      )
    }
    expect(violations).toHaveLength(0)
  })

  it("INVARIANT 5: call-center commerce gateway reads/writes are sales-channel scoped", () => {
    // The gateway is the ONLY door the voice agent has to commerce data. Split
    // the adapter into method chunks (2-space-indent method boundaries) and
    // require any method that queries order/product/customer to also carry a
    // sales-channel scope token (or an explicit `// isolation-ok:` opt-out).
    // This is the firewall against a future unscoped method slipping in.
    const file = path.join(
      SRC,
      "modules/call-center/gateway/medusa-adapter.ts"
    )
    expect(fs.existsSync(file)).toBe(true)
    const src = read(file)
    const chunks = src.split(
      /\n(?=  (?:private |protected |public )?(?:async )?[A-Za-z0-9_]+\s*\()/
    )

    const violations: string[] = []
    for (const chunk of chunks) {
      if (!CC_SENSITIVE_ENTITY.test(chunk)) continue
      if (CC_SCOPE_TOKEN.test(chunk)) continue
      const m = chunk.match(
        /^\s*(?:private |protected |public )?(?:async )?([A-Za-z0-9_]+)\s*\(/
      )
      violations.push(`medusa-adapter.ts#${m ? m[1] : "unknown-method"}`)
    }

    if (violations.length) {
      fail(
        "INVARIANT 5",
        "call-center gateway method queries order/product/customer without a " +
          "sales-channel scope token (add sales_channel_id scoping / a via-" +
          "orders helper, or an `// isolation-ok: <reason>` marker):",
        violations
      )
    }
    expect(violations).toHaveLength(0)
  })

  it("INVARIANT 6: telephony tool-execute derives tenant from the call row", () => {
    // The runtime hands us a call_id; the AUTHORITATIVE tenant must be resolved
    // from that call row (call.tenant_id), never trusted solely from the
    // request body — else a caller could name another tenant and act on it.
    const file = path.join(SRC, "api/telephony/tool-execute/route.ts")
    expect(fs.existsSync(file)).toBe(true)
    const src = stripComments(read(file))
    if (!CC_CALL_TENANT_ANCHOR.test(src)) {
      fail(
        "INVARIANT 6",
        "tool-execute must set ctx.tenantId from the call row (call.tenant_id) " +
          "as the trust anchor, not from the request body alone:",
        [rel(file)]
      )
    }
    expect(CC_CALL_TENANT_ANCHOR.test(src)).toBe(true)
  })

  it("allowlisted files still exist (stale-allowlist guard)", () => {
    const stale: string[] = []
    for (const r of [...MODEL_TENANT_ID_ALLOWLIST, ...WRITE_TENANT_ALLOWLIST]) {
      if (!fs.existsSync(path.join(SRC, r))) stale.push(r)
    }
    if (stale.length) {
      fail(
        "STALE ALLOWLIST",
        "allowlist entries point at files that no longer exist (remove them):",
        stale
      )
    }
    expect(stale).toHaveLength(0)
  })
})
