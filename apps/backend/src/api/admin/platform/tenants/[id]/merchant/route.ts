import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"

/** GET /admin/platform/tenants/:id/merchant — list a tenant's merchant logins. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const merchants = await svc.listMerchants({ tenant_id: req.params.id })
  res.json({
    merchants: (merchants || []).map((m: any) => ({
      id: m.id, email: m.email, name: m.name, status: m.status, created_at: m.created_at,
    })),
  })
}

/** POST /admin/platform/tenants/:id/merchant { email, password, name } — create a merchant login. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const authService: any = req.scope.resolve(Modules.AUTH)
  const tenant = await svc.retrieveTenant(req.params.id).catch(() => null)
  if (!tenant) return res.status(404).json({ message: "tenant not found" })

  const b = (req.body ?? {}) as any
  const email = String(b.email ?? "").trim().toLowerCase()
  const password = String(b.password ?? "")
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ message: "valid email required" })
  if (password.length < 8) return res.status(400).json({ message: "password must be at least 8 characters" })

  const dup = await svc.listMerchants({ email })
  if (dup?.length) return res.status(409).json({ message: `a merchant with email "${email}" already exists` })

  const [merchant] = await svc.createMerchants([
    { tenant_id: tenant.id, email, name: b.name || null, status: "active" },
  ])
  try {
    const { authIdentity, error } = await authService.register("emailpass", { body: { email, password } })
    if (error || !authIdentity) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, typeof error === "string" ? error : "could not set password")
    }
    await authService.updateAuthIdentities({ id: authIdentity.id, app_metadata: { merchant_id: merchant.id, email } })
  } catch (e) {
    await svc.deleteMerchants([merchant.id]).catch(() => {})
    throw e
  }
  res.status(201).json({ merchant: { id: merchant.id, email: merchant.email, name: merchant.name, tenant_id: tenant.id } })
}
