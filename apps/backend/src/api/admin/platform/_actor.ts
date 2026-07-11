import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"

/**
 * Build the audit Actor from a request already vetted by the
 * requirePlatformSuperAdmin guard (middlewares.ts), which attaches
 * `platform_actor` with the operator's verified email. Prefer the email for a
 * readable audit trail; fall back to the actor id.
 */
export const actorFromReq = (req: AuthenticatedMedusaRequest) => ({
  id:
    (req as any).platform_actor?.email ??
    (req as any).auth_context?.actor_id ??
    "unknown",
  ip:
    (req.headers["x-forwarded-for"] as string | undefined) ??
    (req.socket as any)?.remoteAddress,
})
