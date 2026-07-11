import { resolveTenantId } from "../../lib/tenant-context"
import { MARKETING_MODULE } from "./index"

/**
 * Marketing RBAC core — role resolution + the (role × path × method) access
 * matrix.
 *
 * Mirrors the call-center role-helper structure, and like it this guard FAILS
 * CLOSED: the ABSENCE of a live `marketing_agent_role` row means NO access. A
 * user must hold an explicit `admin`, `manager` or `agent` grant to reach any
 * `/admin/marketing/*` route.
 *
 * Lives in the module (not the API layer) so the middleware AND the role
 * management routes share ONE source of truth, and so the matrix is
 * unit-testable in isolation.
 */

/* ------------------------------------------------------------------ */
/* Role const union                                                    */
/* ------------------------------------------------------------------ */

export const MARKETING_ROLES = ["admin", "manager", "agent"] as const
export type MarketingRole = (typeof MARKETING_ROLES)[number]

/**
 * Default tenant for single-tenant runs. Every `marketing_agent_role` row is
 * scoped by `tenant_id`; without an explicit multi-tenant resolver we key every
 * lookup off this constant.
 */
export const MARKETING_DEFAULT_TENANT =
  resolveTenantId("MARKETING_DEFAULT_TENANT")

export const isMarketingRole = (v: unknown): v is MarketingRole =>
  typeof v === "string" && (MARKETING_ROLES as readonly string[]).includes(v)

/* ------------------------------------------------------------------ */
/* Role resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective marketing role for a core admin user id within a
 * tenant.
 *
 * CRITICAL FAIL-CLOSED: returns `null` whenever there is no explicit, live role
 * row — including when `userId` is empty OR when the lookup itself throws (e.g.
 * the table is not yet migrated). A resolution failure NEVER grants access;
 * only a live `admin`/`manager`/`agent` row unlocks the routes.
 */
export async function getMarketingRole(
  container: { resolve: (key: string) => any },
  userId: string | undefined | null,
  tenantId: string
): Promise<MarketingRole | null> {
  if (!userId) {
    return null
  }

  let rows: Array<{ role?: string }> = []
  try {
    const service = container.resolve(MARKETING_MODULE)
    rows =
      (await service.listMarketingAgentRoles({
        tenant_id: tenantId,
        user_id: userId,
      })) ?? []
  } catch {
    // Table missing / transient error ⇒ fail CLOSED (no access).
    return null
  }

  const explicit = rows?.[0]?.role
  return isMarketingRole(explicit) ? explicit : null
}

/* ------------------------------------------------------------------ */
/* Access matrix (role × path × method)                                */
/* ------------------------------------------------------------------ */

/** HTTP methods that mutate state. Everything else is treated as a read. */
function isWriteMethod(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase()
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS"
}

/**
 * Segment-aware prefix match: `/admin/marketing/posts` matches itself and
 * `/.../posts/x`, not `/.../posts-x`.
 */
function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/")
}

/**
 * Write areas an `agent` may POST to — inbox replies and composing post drafts.
 * Reads (GET) are allowed everywhere under /admin/marketing for an agent.
 */
const AGENT_WRITE_PREFIXES = [
  "/admin/marketing/posts",
  "/admin/marketing/inbox",
  "/admin/marketing/messages",
] as const

/** Role-management surface — reserved for `admin` only. */
const ROLE_MANAGEMENT_PREFIX = "/admin/marketing/access"

/**
 * The single enforcement decision. Returns true iff `role` may perform a
 * request with the given `path`/`method` against a `/admin/marketing/*` route.
 *
 * Matrix:
 *   admin   → everything under /admin/marketing/* (incl. role management).
 *   manager → everything EXCEPT role management (/admin/marketing/access).
 *   agent   → GET everywhere under /admin/marketing, plus POST to inbox
 *             replies and post drafts (/posts, /inbox, /messages); 403 on
 *             everything else.
 *   null    → NOTHING (fail closed).
 *
 * `path` is `req.path` (no query string), e.g. "/admin/marketing/posts/123".
 */
export function canMarketingAccess(
  role: MarketingRole | null,
  path: string,
  method: string
): boolean {
  // Fail closed: no role ⇒ no access.
  if (!role) {
    return false
  }

  // Only ever gate the marketing surface here.
  if (!underPrefix(path, "/admin/marketing")) {
    return false
  }

  // admin: full access to the whole surface.
  if (role === "admin") {
    return true
  }

  // manager: everything except role management.
  if (role === "manager") {
    return !underPrefix(path, ROLE_MANAGEMENT_PREFIX)
  }

  // agent:
  const isWrite = isWriteMethod(method)

  if (!isWrite) {
    // Reads allowed across the whole marketing surface.
    return true
  }

  // Writes limited to inbox replies and composing post drafts.
  return AGENT_WRITE_PREFIXES.some((p) => underPrefix(path, p))
}
