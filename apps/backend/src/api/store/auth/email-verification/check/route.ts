import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { isCustomerVerified, verificationRequired } from "../_shared"

/**
 * Does this authenticated customer still need to verify their email?
 * Consulted by the storefront's login flow right before it sets the session
 * cookie. Fail-open on lookup errors — verification must never be able to
 * lock every shopper out of a store.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ type: "unauthorized", message: "Unauthorized" })
    return
  }

  if (!verificationRequired()) {
    res.json({ required: false, verified: true })
    return
  }

  try {
    const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
    const customer = await customerModule.retrieveCustomer(actorId)
    res.json({ required: true, verified: isCustomerVerified(customer) })
  } catch {
    res.json({ required: false, verified: true })
  }
}
