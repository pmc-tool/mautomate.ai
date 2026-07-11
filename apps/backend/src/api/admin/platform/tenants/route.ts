import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../modules/platform/super-admin"

/**
 * GET /admin/platform/tenants — super-admin tenant list (audit-logged).
 *
 * Gated by the fail-closed requirePlatformSuperAdmin middleware (operator email
 * allowlist); every call writes an audit_log row via SuperAdminService. (MFA is
 * not yet implemented.)
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const admin = new SuperAdminService(req.scope)
  const actor = {
    id: (req as any).auth_context?.actor_id ?? "unknown",
    ip:
      (req.headers["x-forwarded-for"] as string | undefined) ??
      (req.socket as any)?.remoteAddress,
  }
  const tenants = await admin.listTenants(actor, req.query ?? {})
  res.json({ tenants })
}
