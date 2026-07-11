import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../../modules/platform"

/**
 * GET /platform/pricing — PUBLIC list of active subscription packages.
 *
 * The marketing site + signup read this so the plans shown to customers ALWAYS
 * match the operator's packages (platform_package), the same source the console
 * edits. No auth: it exposes only public plan info (name, price, credits, limits).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const rows = await svc
    .listPlatformPackages({ active: true }, { order: { sort: "ASC" } })
    .catch(() => [])
  res.json({
    tiers: (rows as any[]).map((p) => ({
      key: p.key,
      name: p.name,
      price_usd: Number(p.price_usd ?? 0),
      included_credits: Number(p.included_credits ?? 0),
      products_limit: p.products_limit ?? null,
      seats_limit: p.seats_limit ?? null,
      domains_limit: p.domains_limit ?? null,
      sort: Number(p.sort ?? 0),
    })),
  })
}
