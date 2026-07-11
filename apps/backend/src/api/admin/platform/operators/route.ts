import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/** GET /admin/platform/operators — the current super-admin allowlist. */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const operators = (process.env.PLATFORM_SUPERADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean)
  res.json({ operators })
}
