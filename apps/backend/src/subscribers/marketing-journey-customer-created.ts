import {
  logUnresolvedTenant,
  tenantForCustomer,
} from "../lib/marketing-event-tenant"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { getCommerceGateway } from "../modules/marketing/gateway"
import { enrollForTrigger } from "../modules/marketing/journey/enrollment-service"

/**
 * customer.created -> enroll the new customer into any active
 * "customer.created" journey (e.g. a welcome series).
 *
 * Resolves the customer via the commerce gateway to obtain their email and
 * name, then hands them to the journey enrollment engine, which finds the active
 * journeys wired to this trigger and drops an enrollment row per journey.
 *
 * MASTER GATE (inert by default — this deploys to a LIVE store):
 *   - no-op unless MARKETING_ENABLED === "1".
 *
 * Guarantees (mirrors marketing-cart-recovered.ts):
 *   - NEVER throws. A marketing hiccup must not fail customer creation nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged.
 *
 * TENANT ATTRIBUTION (A-6): the owning tenant is derived PER EVENT from the
 * entity's sales channel (lib/marketing-event-tenant.ts), never pinned at module
 * load. In the pooled backend a module-load `resolveTenantId()` has no request
 * context and collapses to the shared "default" tenant, which would attribute
 * every store's events to one tenant. FAIL-CLOSED: if the tenant cannot be
 * proven, the handler does nothing and says so in the log.
 *
 * A brand-new customer with neither a `metadata.tenant_id` marker nor an order
 * is genuinely un-attributable in a pooled DB: this handler skips it rather
 * than enrolling a stranger into another store's welcome journey.
 */

export default async function marketingJourneyCustomerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Master kill-switch: inert unless explicitly enabled.
  if (process.env.MARKETING_ENABLED !== "1") {
    return
  }

  const customerId = data?.id
  if (!customerId) {
    return
  }

  try {
    // The owning tenant: the customer's own tenant marker, else the sales channel
    // of an order it placed. Fail-closed when neither exists.
    const tenantId = await tenantForCustomer(container, customerId)
    if (!tenantId) {
      logUnresolvedTenant(container, "customer.created", "customer", customerId)
      return
    }

    const gateway = getCommerceGateway(container)
    const customer = await gateway.getCustomer(tenantId, customerId)
    if (!customer) {
      return
    }

    const name =
      [customer.first_name, customer.last_name]
        .filter((part) => Boolean(part && part.trim()))
        .join(" ")
        .trim() || null

    await enrollForTrigger(container, {
      tenantId,
      event: "customer.created",
      contactRef: {
        email: customer.email,
        customerId,
        name,
      },
    })
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] customer.created journey handler error (swallowed) for customer ${customerId}: ${
          (e as any)?.message ?? e
        }`
      )
    } catch {
      // ignore — logging must not throw either.
    }
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
