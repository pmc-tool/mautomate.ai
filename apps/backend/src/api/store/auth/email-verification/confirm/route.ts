import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { isCustomerVerified, readVerificationToken } from "../_shared"

/**
 * Confirm a verification link. Public on purpose (the customer may open the
 * link on another device), but the token is a purpose-bound, expiring JWT and
 * the route sits behind the auth brute-force limiter. Idempotent: confirming
 * an already-verified customer succeeds.
 */
export const POST = async (
  req: MedusaRequest<{ token?: string }>,
  res: MedusaResponse
) => {
  const token = String((req.body as any)?.token ?? "").trim()
  if (!token) {
    res.status(400).json({ success: false, message: "Missing token" })
    return
  }

  const payload = readVerificationToken(token)
  if (!payload) {
    res.status(400).json({
      success: false,
      message: "This verification link is invalid or has expired.",
    })
    return
  }

  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const customer = await customerModule
    .retrieveCustomer(payload.customer_id)
    .catch(() => null)
  if (!customer) {
    res.status(400).json({
      success: false,
      message: "This verification link is invalid or has expired.",
    })
    return
  }

  if (!isCustomerVerified(customer)) {
    await customerModule.updateCustomers(customer.id, {
      metadata: {
        ...(customer.metadata ?? {}),
        email_verified_at: new Date().toISOString(),
      },
    })
  }

  res.json({ success: true })
}
