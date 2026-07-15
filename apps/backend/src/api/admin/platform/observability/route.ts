import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { ReconciliationService } from "../../../../modules/platform/observability/reconciliation"
import {
  checkProviders,
  failingProviders,
} from "../../../../modules/platform/observability/provider-health"

/**
 * GET /admin/platform/observability — health + credit-ledger reconciliation +
 * VENDOR health.
 *
 * The vendor block is the one that would have caught the outage that prompted it:
 * every internal check here was green while OpenAI sat at zero credit and the
 * voice agent answered two customers with silence. Green processes are not a
 * working product.
 *
 * `?force=1` skips the 60s probe cache (the refresh button).
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  let dbOk = true
  let wallets: any[] = []
  let tenants: any[] = []
  try {
    ;[wallets, tenants] = await Promise.all([svc.listCreditWallets({}), svc.listTenants({})])
  } catch { dbOk = false }

  let drifted: Array<{ tenant_id: string; drift: number }> = []
  try { drifted = await new ReconciliationService(req.scope).reconcileWallets() } catch { /* */ }

  // Never let a slow vendor take the console down — it exists to SHOW outages.
  const providers = await checkProviders(
    String((req.query as any)?.force ?? "") === "1"
  ).catch(() => [])
  const failing = failingProviders(providers)

  res.json({
    health: [
      { service: "Control-plane DB", ok: dbOk },
      { service: "Platform module", ok: true },
      { service: "Credit ledger", ok: drifted.length === 0, detail: drifted.length ? `${drifted.length} wallet(s) drifted` : "balanced" },
      // Vendors surface in the same list, so an operator glancing at "health"
      // cannot see all-green while the thing customers actually touch is dead.
      ...providers.map((p) => ({
        service: p.service,
        ok: p.severity === "ok",
        detail: p.detail,
      })),
    ],
    providers,
    provider_alerts: failing,
    reconciliation: {
      wallets_checked: wallets.length,
      tenants: tenants.length,
      drifted,
    },
  })
}
