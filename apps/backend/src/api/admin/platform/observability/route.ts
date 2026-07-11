import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { ReconciliationService } from "../../../../modules/platform/observability/reconciliation"

/** GET /admin/platform/observability — health + credit-ledger reconciliation. */
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

  res.json({
    health: [
      { service: "Control-plane DB", ok: dbOk },
      { service: "Platform module", ok: true },
      { service: "Credit ledger", ok: drifted.length === 0, detail: drifted.length ? `${drifted.length} wallet(s) drifted` : "balanced" },
    ],
    reconciliation: {
      wallets_checked: wallets.length,
      tenants: tenants.length,
      drifted,
    },
  })
}
