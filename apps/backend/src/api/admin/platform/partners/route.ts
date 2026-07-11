import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"

/** GET /admin/platform/partners — reseller/agency accounts. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const partners = await svc.listPartners({}, { order: { created_at: "DESC" }, take: 500 })
  res.json({ partners: partners || [] })
}

/** POST /admin/platform/partners — create a partner. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const b = (req.body ?? {}) as any
  if (!b.name) return res.status(400).json({ message: "name required" })
  const code = (b.referral_code || b.name).toString().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
  const [row] = await svc.createPartners([{
    name: b.name, email: b.email || null, company: b.company || null,
    tier: ["bronze", "silver", "gold"].includes(b.tier) ? b.tier : "bronze",
    commission_pct: Number.isFinite(+b.commission_pct) ? +b.commission_pct : 20,
    status: "active", referral_code: code || null,
  }])
  res.status(201).json(row)
}
