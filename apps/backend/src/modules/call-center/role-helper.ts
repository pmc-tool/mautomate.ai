import { resolveTenantId } from "../../lib/tenant-context"
import { CALL_CENTER_MODULE } from "./index"

/**
 * Call-center RBAC core — role resolution + the (role × path × method) access
 * matrix.
 *
 * Mirrors the CMS role-helper structure, with ONE crucial difference: this
 * guard FAILS CLOSED. Where CMS treats "no explicit role row" as admin (fail
 * open), the call-center layer treats the ABSENCE of a live
 * `call_center_agent_role` row as NO access. A user must hold an explicit
 * `supervisor` or `agent` grant to reach any `/admin/call-center/*` route.
 *
 * Lives in the module (not the API layer) so the middleware AND the role
 * management routes share ONE source of truth, and so the matrix is
 * unit-testable in isolation.
 */

/* ------------------------------------------------------------------ */
/* Role const union                                                    */
/* ------------------------------------------------------------------ */

export const CALL_CENTER_ROLES = ["supervisor", "agent"] as const
export type CallCenterRole = (typeof CALL_CENTER_ROLES)[number]

/**
 * Default tenant for single-tenant runs. Every `call_center_agent_role` row is
 * scoped by `tenant_id`; without an explicit multi-tenant resolver we key every
 * lookup off this constant.
 */
export const CALL_CENTER_DEFAULT_TENANT =
  resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

export const isCallCenterRole = (v: unknown): v is CallCenterRole =>
  typeof v === "string" && (CALL_CENTER_ROLES as readonly string[]).includes(v)

/* ------------------------------------------------------------------ */
/* Role resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective call-center role for a core admin user id within a
 * tenant.
 *
 * CRITICAL FAIL-CLOSED: returns `null` whenever there is no explicit, live role
 * row — including when `userId` is empty OR when the lookup itself throws (e.g.
 * the table is not yet migrated). Unlike CMS, a resolution failure NEVER grants
 * access; only a live `supervisor`/`agent` row unlocks the routes.
 */
export async function getCallAgentRole(
  container: { resolve: (key: string) => any },
  userId: string | undefined | null,
  tenantId: string
): Promise<CallCenterRole | null> {
  if (!userId) {
    return null
  }

  let rows: Array<{ role?: string }> = []
  try {
    const service = container.resolve(CALL_CENTER_MODULE)
    rows =
      (await service.listAgentRoles({
        tenant_id: tenantId,
        user_id: userId,
      })) ?? []
  } catch {
    // Table missing / transient error ⇒ fail CLOSED (no access).
    return null
  }

  const explicit = rows?.[0]?.role
  return isCallCenterRole(explicit) ? explicit : null
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
 * Read areas an `agent` may GET — the day-to-day agent workspace: the console,
 * the live board, their calls, and the disposition catalogue.
 */
const AGENT_READ_PREFIXES = [
  "/admin/call-center/console",
  "/admin/call-center/live",
  "/admin/call-center/calls",
  "/admin/call-center/dispositions",
] as const

/**
 * Segment-aware prefix match: `/admin/call-center/calls` matches itself and
 * `/.../calls/x`, not `/.../calls-x`.
 */
function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/")
}

/** True iff `path` is an agent's allowed disposition WRITE. */
function isAgentDispositionWrite(path: string): boolean {
  // Recording an outcome: POST /admin/call-center/dispositions
  if (underPrefix(path, "/admin/call-center/dispositions")) {
    return true
  }
  // Attaching a disposition to a specific call:
  // POST /admin/call-center/calls/:id/disposition(s)
  if (
    path.startsWith("/admin/call-center/calls/") &&
    (path.endsWith("/disposition") || path.endsWith("/dispositions"))
  ) {
    return true
  }
  return false
}

/**
 * The single enforcement decision. Returns true iff `role` may perform a
 * request with the given `path`/`method` against a `/admin/call-center/*`
 * route.
 *
 * Matrix:
 *   supervisor → everything under /admin/call-center/* (campaigns, playbooks,
 *                settings, kill-switch, role management, all reads + writes).
 *   agent      → GET on console/live/calls/dispositions, plus posting a
 *                disposition; 403 on everything else (campaigns, playbooks,
 *                settings, kill-switch, role management).
 *   null       → NOTHING (fail closed).
 *
 * `path` is `req.path` (no query string), e.g. "/admin/call-center/calls/123".
 */
export function canCallCenterAccess(
  role: CallCenterRole | null,
  path: string,
  method: string
): boolean {
  // Fail closed: no role ⇒ no access.
  if (!role) {
    return false
  }

  // Only ever gate the call-center surface here.
  if (!underPrefix(path, "/admin/call-center")) {
    return false
  }

  // supervisor: full access to the whole surface.
  if (role === "supervisor") {
    return true
  }

  // agent:
  const isWrite = isWriteMethod(method)

  if (!isWrite) {
    // Reads limited to the agent workspace areas.
    return AGENT_READ_PREFIXES.some((p) => underPrefix(path, p))
  }

  // The only write an agent may perform is recording a disposition.
  return isAgentDispositionWrite(path)
}
