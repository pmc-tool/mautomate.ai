import type { MedusaContainer } from "@medusajs/framework/types"

import { DOMAINS_MODULE } from "."
import { buyDomain, transferInDomain } from "./domain-service"
import { isResellerConfigured } from "./provider"
import { DomainRoutingService } from "../platform/domain-routing"

/**
 * Register a domain AFTER the card payment has cleared.
 *
 * A domain is a real registrar invoice — we only spend that money once the
 * merchant's money is actually in. So the buy endpoint creates an order in
 * `awaiting_payment` and this runs from the payment webhook.
 *
 * Idempotent: an order already past awaiting_payment is a no-op, so a retried
 * webhook can never double-register (and double-charge us at the registrar).
 */
export async function fulfillDomainOrder(
  container: MedusaContainer,
  orderId: string
): Promise<{ ok: boolean; error?: string; domain?: string }> {
  const domains: any = container.resolve(DOMAINS_MODULE)

  const order = await domains.retrieveDomainOrder(orderId).catch(() => null)
  if (!order) return { ok: false, error: "order_not_found" }
  if (order.status !== "awaiting_payment") {
    // Already paid + processed (or cancelled) — nothing to do.
    return { ok: true, domain: order.domain_name }
  }

  await domains.updateDomainOrders({ id: order.id, status: "processing" })

  const tenantId = order.tenant_id
  const domainName = order.domain_name
  const years = Number(order.years ?? 1)
  const meta = (order.meta ?? {}) as Record<string, any>

  try {
    if (await isResellerConfigured(container)) {
      const isTransfer = order.action === "transfer"
      const reg = isTransfer
        ? await transferInDomain(container, {
            tenantId,
            domainName,
            authCode: meta.auth_code,
            years,
            privacy: !!meta.privacy,
            autoRenew: meta.auto_renew !== false,
            userId: meta.requested_by,
          })
        : await buyDomain(container, {
            tenantId,
            domainName,
            years,
            privacy: !!meta.privacy,
            autoRenew: meta.auto_renew !== false,
            userId: meta.requested_by,
          })
      if (!reg.ok) {
        await domains.updateDomainOrders({
          id: order.id,
          status: "failed",
          meta: { ...meta, error: reg.error, paid: true },
        })
        // The money is IN but the registrar failed — this must stay visible so
        // an operator refunds or retries. Never swallow it.
        return { ok: false, error: reg.error ?? "registration_failed" }
      }
    } else {
      // No registrar configured: the payment stands, an operator completes it.
      await domains.updateDomainOrders({
        id: order.id,
        meta: { ...meta, paid: true, manual_approval: true },
      })
    }

    const routing = new DomainRoutingService(container as any)
    const connected = await routing.connectCustomDomain(tenantId, domainName)

    await domains.updateDomainOrders({
      id: order.id,
      status: "success",
      meta: { ...meta, paid: true, connected: connected.ok },
    })

    const existing = await domains.listDomainModels({
      tenant_id: tenantId,
      domain_name: domainName,
    })
    if (!existing?.length) {
      await domains.createDomainModels([
        {
          tenant_id: tenantId,
          domain_name: domainName,
          tld: order.tld,
          status: "active",
          source: "registered",
          years,
          register_price: Number(order.price ?? 0),
          currency: "USD",
          auto_renew: meta.auto_renew !== false,
          privacy_enabled: !!meta.privacy,
          meta: { paid: true },
        },
      ] as any)
    }

    return { ok: true, domain: domainName }
  } catch (e: any) {
    await domains.updateDomainOrders({
      id: order.id,
      status: "failed",
      meta: { ...meta, paid: true, error: String(e?.message ?? e) },
    })
    return { ok: false, error: String(e?.message ?? e) }
  }
}
