import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  res.json({ name: ctx.tenant.name, slug: ctx.tenant.slug, domain: `${ctx.tenant.slug}.mautomate.ai`, status: ctx.tenant.status })
}

/** PUT /merchant/settings { name } — merchant renames their store (slug/domain are fixed). */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const name = String((req.body as { name?: string })?.name ?? "").trim()
  if (!name) return res.status(400).json({ message: "name required" })
  await ctx.svc.updateTenants({ id: ctx.tenant.id, name: name.slice(0, 120) })
  res.json({ name: name.slice(0, 120) })
}
