import { MedusaError } from "@medusajs/framework/utils"
import type CmsModuleService from "./service"

/**
 * CMS RBAC core — role resolution + the (role × path × method) access matrix.
 *
 * Lives in the module (not the API layer) so the `/admin/cms/*` middleware AND
 * the roles routes share ONE source of truth, and so the matrix is unit-testable
 * in isolation. The middleware stays a thin caller of `canCmsAccess`.
 *
 * Honest scope (phase-0-architecture.md §8): Medusa 2.17 has no native RBAC.
 * This is a 100% custom, API-layer-only guard. Client-side hiding is UX only.
 */

/* ------------------------------------------------------------------ */
/* Role const union                                                    */
/* ------------------------------------------------------------------ */

export const CMS_ROLES = ["admin", "editor", "viewer"] as const
export type CmsRole = (typeof CMS_ROLES)[number]

/**
 * THE FAIL-SAFE DEFAULT. A user with no explicit cms_user_role row is treated as
 * "admin" so we never lock out the existing admin (admin@medusa-test.com) or any
 * user before roles have been assigned. Only an explicit editor/viewer row
 * downgrades a user.
 */
export const DEFAULT_CMS_ROLE: CmsRole = "admin"

export const isCmsRole = (v: unknown): v is CmsRole =>
  typeof v === "string" && (CMS_ROLES as readonly string[]).includes(v)

/** Validate a role value from request input (422 on anything else). */
export function assertCmsRole(v: unknown): CmsRole {
  if (!isCmsRole(v)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid role "${String(v)}". Valid roles: ${CMS_ROLES.join(", ")}.`
    )
  }
  return v
}

/* ------------------------------------------------------------------ */
/* Role resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective CMS role for a core admin user id.
 *
 * CRITICAL FAIL-SAFE: returns "admin" whenever there is no explicit role row —
 * including when `user_id` is empty OR when the lookup itself throws (e.g. the
 * cms_user_role table does not exist yet, before the migration runs). The guard
 * must NEVER 403 a user just because role resolution failed; an explicit
 * editor/viewer row is the ONLY thing that downgrades.
 */
export async function getRoleForUser(
  service: CmsModuleService,
  userId: string | undefined | null
): Promise<CmsRole> {
  if (!userId) {
    return DEFAULT_CMS_ROLE
  }

  let rows: Array<{ role?: string }> = []
  try {
    rows = (await (service as any).listCmsUserRoles({ user_id: userId })) ?? []
  } catch {
    // Table missing / transient error ⇒ fail OPEN to admin (never lock out).
    return DEFAULT_CMS_ROLE
  }

  const explicit = rows?.[0]?.role
  return isCmsRole(explicit) ? explicit : DEFAULT_CMS_ROLE
}

/* ------------------------------------------------------------------ */
/* Access matrix (role × path × method)                                */
/* ------------------------------------------------------------------ */

/** HTTP methods that mutate state. Everything else is treated as a read. */
export function isWriteMethod(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase()
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS"
}

/**
 * Role-management area — admin-only for ALL methods (even listing who has which
 * role is sensitive). Matches phase-0-architecture.md §8.2
 * (`{ matcher:"/admin/cms/roles*", requireCmsRole(["cms_admin"]) }`).
 */
const ROLES_PREFIX = "/admin/cms/roles"

/** Global settings singletons — writes are admin-only (editor may still read). */
const SETTINGS_PREFIX = "/admin/cms/settings"

/**
 * Content areas an editor may WRITE (pages/sections/blog/media — which transitively
 * cover publish, revisions, schedule, preview-token as sub-paths). Any write to a
 * CMS path NOT on this allowlist is default-denied for editors.
 */
const EDITOR_WRITE_PREFIXES = [
  "/admin/cms/pages",
  "/admin/cms/sections",
  "/admin/cms/blog",
  "/admin/cms/media",
] as const

/** Segment-aware prefix match: `/admin/cms/roles` matches itself and `/.../roles/x`, not `/.../roles-x`. */
function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/")
}

/**
 * The single enforcement decision. Returns true iff `role` may perform a request
 * with the given (path, isWrite) against a `/admin/cms/*` route.
 *
 * Matrix:
 *   admin   → everything.
 *   viewer  → reads only (GET/HEAD/OPTIONS); 403 on every write; 403 on roles area.
 *   editor  → all reads EXCEPT the roles area; content writes (pages/sections/
 *             blog/media) only; 403 on settings writes, roles area, and any
 *             unrecognized CMS write path (default-deny).
 *
 * `path` is `req.path` (no query string), e.g. "/admin/cms/pages/123/publish".
 */
export function canCmsAccess(
  role: CmsRole,
  path: string,
  isWrite: boolean
): boolean {
  // admin: full access.
  if (role === "admin") {
    return true
  }

  // Role management is admin-only for ALL methods (read included).
  if (underPrefix(path, ROLES_PREFIX)) {
    return false
  }

  // Every other read is allowed for editor + viewer (settings GET, audit-log
  // GET, pages/blog/media reads, links search, etc.).
  if (!isWrite) {
    return true
  }

  // viewer: strictly read-only.
  if (role === "viewer") {
    return false
  }

  // editor writes:
  // settings writes are admin-only.
  if (underPrefix(path, SETTINGS_PREFIX)) {
    return false
  }
  // allow only the explicit content-write areas.
  if (EDITOR_WRITE_PREFIXES.some((p) => underPrefix(path, p))) {
    return true
  }
  // default-deny any other CMS write for non-admins.
  return false
}
