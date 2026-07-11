import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../../../modules/platform"

/**
 * GET /platform/signup/status?slug=… — public provisioning status for the
 * landing to poll after a 202 signup. Returns provisioning | live | failed, and
 * the admin/store URLs once the store exists.
 */
const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

const cors = (res: MedusaResponse) => {
  res.setHeader("Access-Control-Allow-Origin", `https://${ROOT}`)
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

export const OPTIONS = async (_req: MedusaRequest, res: MedusaResponse) => {
  cors(res)
  res.status(204).end()
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  cors(res)
  const slug = String((req.query.slug as string) ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
  if (!slug) return res.status(400).json({ message: "slug required" })

  const svc = req.scope.resolve(PLATFORM_MODULE) as any
  const [tenant] = await svc.listTenants({ slug }, { take: 1 }).catch(() => [])

  // Not created yet (workflow's createTenantStep hasn't run) → still provisioning.
  const status = tenant?.status ?? "provisioning"
  res.json({
    status: status === "live" ? "live" : status === "failed" ? "failed" : "provisioning",
    store_url: `https://${slug}.${ROOT}`,
    admin_url: `https://${slug}.${ROOT}/app`,
    merchant_login_url: `https://merchant.${ROOT}`,
    name: tenant?.name ?? null,
  })
}
