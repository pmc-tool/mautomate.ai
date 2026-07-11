import { MedusaContainer } from "@medusajs/framework/types"

import { CommerceGateway } from "./commerce-gateway"
import { MedusaCommerceGateway } from "./medusa-adapter"

/**
 * Gateway factory — the single entrypoint the call-center core (and API routes)
 * use to obtain a `CommerceGateway`. Callers do:
 *
 *   import { getCommerceGateway } from "../../modules/call-center/gateway"
 *   const gateway = getCommerceGateway(req.scope)
 *
 * Today this always returns the Medusa-backed adapter. Swapping in a non-Medusa
 * backend later is a one-line change here (pick a different adapter class) with
 * NO change at any call site, since callers only ever see the `CommerceGateway`
 * interface.
 */
export function getCommerceGateway(
  container: MedusaContainer
): CommerceGateway {
  return new MedusaCommerceGateway(container)
}

// Re-export the platform-agnostic contract + DTOs so callers import everything
// they need from this single barrel.
export * from "./commerce-gateway"
export { MedusaCommerceGateway } from "./medusa-adapter"
