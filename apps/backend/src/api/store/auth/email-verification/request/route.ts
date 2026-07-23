import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "../../../../../modules/platform"
import { storeTenant } from "../../../_tenant"
import {
  isCustomerVerified,
  sendVerificationEmail,
  signVerificationToken,
  storefrontBaseForTenant,
} from "../_shared"

/**
 * Send (or re-send) the verification email to the authenticated customer.
 * Registered behind authenticate("customer") + the auth brute-force limiter
 * in api/middlewares.ts. Always answers 200 with { sent } — delivery failures
 * are logged, never thrown into the signup flow.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ type: "unauthorized", message: "Unauthorized" })
    return
  }

  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const customer = await customerModule
    .retrieveCustomer(actorId)
    .catch(() => null)
  if (!customer?.email) {
    res.status(404).json({ type: "not_found", message: "Customer not found" })
    return
  }

  if (isCustomerVerified(customer)) {
    res.json({ sent: false, already_verified: true })
    return
  }

  const tenant = await storeTenant(req)
  const tenantId =
    tenant?.id ?? ((customer.metadata?.tenant_id as string) || null)

  const token = signVerificationToken(customer.id, tenantId, customer.email)
  if (!token) {
    // No JWT_SECRET — verification cannot be enforced on this deployment.
    res.json({ sent: false })
    return
  }

  const base = await storefrontBaseForTenant(req.scope, tenantId)
  const verifyUrl = `${base}/verify-account?token=${encodeURIComponent(token)}`

  let shopName = "our store"
  if (tenantId) {
    try {
      const platform: any = req.scope.resolve(PLATFORM_MODULE)
      const t = await platform.retrieveTenant(tenantId).catch(() => null)
      if (t?.name) shopName = t.name
    } catch {
      // keep the generic name
    }
  }

  try {
    await sendVerificationEmail({
      to: customer.email,
      verifyUrl,
      shopName,
    })
    res.json({ sent: true })
  } catch (e: any) {
    try {
      const logger: any = req.scope.resolve("logger")
      logger?.error?.(
        `[email-verification] delivery failed (swallowed): ${e?.message ?? e}`
      )
    } catch {
      // logging is best-effort
    }
    res.json({ sent: false })
  }
}
