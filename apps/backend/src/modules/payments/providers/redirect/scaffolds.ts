import { MedusaError } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

/**
 * Scaffolded gateways.
 *
 * A gateway lives here when it is REGISTERED (so its `pp_<id>_<id>` provider id
 * exists, can be enabled on a region, and can collect credentials) but its
 * create-session / verify integration is intentionally NOT wired to real code
 * yet. Each throws a clear, actionable error at runtime rather than shipping an
 * unverified money-handling path. To finish one: add a real provider file next
 * to `sslcommerz.ts` (override `createSession` + `mapWebhook`) and repoint the
 * gateway's `index.ts` at it.
 */
abstract class ScaffoldRedirectProvider extends RedirectGatewayProvider {
  protected async createSession(
    _creds: GatewayCredentials,
    _input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    return this.notCertified()
  }

  protected async mapWebhook(
    _creds: GatewayCredentials,
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

/**
 * Nagad — Bangladesh MFS checkout. Left as a scaffold on purpose.
 *
 * Nagad's PGW has no public developer portal; integration is an RSA-heavy flow
 * (encrypt each request's sensitiveData with Nagad's PG public key, sign it with
 * the merchant private key, decrypt responses with the merchant private key)
 * documented only in a merchant-only onboarding PDF, with an unverified
 * production base URL. Shipping that blind against real money is the exact
 * failure mode we avoid, so it throws a clear message until it can be certified
 * against a live sandbox with the merchant's onboarding material.
 */
export class NagadProvider extends ScaffoldRedirectProvider {
  static identifier = "nagad"
  protected gatewayId(): string {
    return "nagad"
  }

  protected async createSession(): Promise<RedirectSession> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Nagad checkout is not yet available: it requires configuration against Nagad's onboarding material (PG public key, merchant private key, production endpoint) and sandbox certification. Contact support to enable it."
    )
  }
}

export default NagadProvider
