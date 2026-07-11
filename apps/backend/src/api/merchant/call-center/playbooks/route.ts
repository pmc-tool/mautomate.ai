import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"
import { listPlaybooks } from "../../../../modules/call-center/playbooks"

/**
 * GET /merchant/call-center/playbooks
 *
 * Tenant-scoped playbook list. Prefers DB rows owned by the merchant's tenant;
 * if the tenant has no DB playbooks yet, falls back to the compiled in-code
 * registry so the merchant UI can still browse the available conversation
 * scripts.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const [dbPlaybooks, count] = await cc.listAndCountPlaybooks(
      { tenant_id },
      { take: 200, order: { created_at: "DESC" } }
    )

    let playbooks = (dbPlaybooks ?? []).map((p: any) => ({
      id: p.id,
      name: p.name ?? p.use_case ?? p.id,
      use_case: p.use_case ?? null,
      status: p.status ?? "draft",
      version: p.current_version_id ?? null,
    }))

    if (playbooks.length === 0) {
      playbooks = listPlaybooks().map((p) => ({
        id: p.id,
        name: p.persona?.name ?? p.use_case,
        use_case: p.use_case,
        status: "published",
        version: p.version,
      }))
    }

    res.json({ playbooks, count: playbooks.length })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list playbooks",
    })
  }
}
