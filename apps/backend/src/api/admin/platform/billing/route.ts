import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { computeMetrics } from "../../../../modules/platform/observability/metrics"
import { allGateways } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"

/** GET /admin/platform/billing — revenue overview + gateway status. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const cfg = new EncryptedConfigService(req.scope)
  const [tenants, txns, usage] = await Promise.all([
    svc.listTenants({}), svc.listCreditTransactions({}), svc.listUsageEvents({}),
  ])
  const m = computeMetrics(
    (tenants || []).map((t: any) => ({ status: t.status, package: t.package, credit_balance: Number(t.credit_balance ?? 0) })),
    (txns || []).map((t: any) => ({ type: t.type, amount: Number(t.amount) })),
    (usage || []).map((u: any) => ({ action: u.action, units: Number(u.units ?? 0), credits: Number(u.credits ?? 0), vendor_cost_usd: u.vendor_cost_usd }))
  )
  const gateways = await Promise.all(
    allGateways(cfg).map(async (g: any) => ({
      name: g.name,
      configured: await g.isConfigured(),
      serves_bd: g.serves("BD"),
    }))
  )
  res.json({
    mrr_usd: m.mrr_usd,
    topup_revenue_usd: m.topup_revenue_usd,
    revenue_total_usd: m.revenue_total_usd,
    by_package: m.by_package,
    gateways,
    wired: false,
  })
}
