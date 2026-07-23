import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../../../modules/platform"

/**
 * GET /admin/platform/mobile-app-orders?status=&kind=
 *
 * Super-admin management surface for the white-label shopper-app pipeline
 * (build + paid publish orders). This is the dedicated ops queue that replaces
 * the old behaviour of dumping these into the support inbox — the
 * `mobile_app_order` record is now the source of truth.
 *
 * Gated fail-closed by the requirePlatformSuperAdmin middleware on
 * /admin/platform/* (operator email allowlist). Newest first. Optional
 * status/kind filters. The store NAME is resolved from the tenant record (the
 * same source the rest of the platform console uses).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const platform: any = req.scope.resolve(PLATFORM_MODULE)

  const filter: Record<string, unknown> = {}
  const status = req.query.status ? String(req.query.status).trim() : ""
  const kind = req.query.kind ? String(req.query.kind).trim() : ""
  if (status) filter.status = status
  if (kind && (kind === "build" || kind === "publish")) filter.kind = kind

  const orders =
    (await platform.listMobileAppOrders(filter, {
      order: { created_at: "DESC" },
      take: 500,
    })) ?? []

  // Resolve the store name for every order's tenant from the tenant record —
  // the same tenant.name source used elsewhere in the platform console.
  const tenantIds = Array.from(
    new Set(orders.map((o: any) => o.tenant_id).filter(Boolean))
  )
  const nameById: Record<string, string> = {}
  if (tenantIds.length) {
    const tenants =
      (await platform
        .listTenants({ id: tenantIds })
        .catch(() => [])) ?? []
    for (const t of tenants) {
      nameById[t.id] = t.name ?? t.slug ?? t.id
    }
  }

  res.json({
    orders: orders.map((o: any) => ({
      id: o.id,
      tenant_id: o.tenant_id,
      store_name: nameById[o.tenant_id] ?? o.tenant_id,
      kind: o.kind,
      tier: o.tier ?? null,
      regular_price_usd: o.regular_price_usd ?? null,
      expected_amount_usd: o.expected_amount_usd ?? null,
      amount_paid_usd: o.amount_paid_usd ?? null,
      status: o.status,
      download_url: o.download_url ?? null,
      config_snapshot: o.config_snapshot ?? null,
      created_at: o.created_at,
    })),
    count: orders.length,
  })
}
