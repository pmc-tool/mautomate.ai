import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { applyMarkup, normalizeDomain } from "../_shared"
import {
  searchDomains,
  transferInDomain,
} from "../../../../modules/domains/domain-service"
import { DOMAINS_MODULE } from "../../../../modules/domains"
import { isResellerConfigured } from "../../../../modules/domains/provider"
import { getLedger } from "../../../../modules/platform/credits/metering"

const FALLBACK_PRICE_USD = Number(process.env.DOMAIN_FALLBACK_PRICE_USD ?? "12")
const MANUAL_APPROVAL_ENABLED =
  process.env.DOMAIN_MANUAL_APPROVAL_ENABLED !== "0"

function splitDomain(domain: string): { sld: string; tld: string } {
  const idx = domain.lastIndexOf(".")
  if (idx === -1) return { sld: domain, tld: "" }
  return { sld: domain.slice(0, idx), tld: domain.slice(idx + 1) }
}

/**
 * POST /merchant/domains/transfer-in { domain, auth_code }
 *
 * Transfer a domain IN using its EPP/auth code. Credits are reserved for the
 * transfer price (registrar cost + reseller markup) up front, then committed on
 * success or released on failure — same discipline as the buy route.
 *
 * When the registrar is configured the transfer is submitted in real time via
 * transferInDomain (which requires a registrant profile — create one at
 * POST /merchant/domains/contacts first). When it is not configured we fall back
 * to a manual-approval flow: credits are collected and a pending transfer order +
 * domain row are recorded for a platform operator to complete at the registrar.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const domain = normalizeDomain(body.domain ?? body.domain_name)
  const authCode = String(body.auth_code ?? body.authCode ?? "")
  const years = Math.min(Math.max(Number(body.years ?? 1), 1), 10)
  const privacy = !!body.privacy
  const autoRenew = !!body.auto_renew

  if (!domain || !/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(domain)) {
    return res.status(400).json({ message: "enter a valid domain, e.g. example.com" })
  }
  if (!authCode) {
    return res.status(400).json({ message: "auth_code (EPP code) is required" })
  }

  const { tld } = splitDomain(domain)
  if (!tld) {
    return res.status(400).json({ message: "domain must include a TLD" })
  }

  const domainsModule: any = req.scope.resolve(DOMAINS_MODULE)

  // de-dup: a domain can belong to only one tenant.
  const clash = await domainsModule
    .listDomainModels({ domain_name: domain })
    .catch(() => [])
  const foreign = (clash || []).find((r: any) => r.tenant_id !== ctx.tenant.id)
  if (foreign) {
    return res.status(409).json({ message: `${domain} is already managed by another store` })
  }

  const configured = isResellerConfigured()
  let unitPriceUsd = FALLBACK_PRICE_USD

  if (configured) {
    const search = await searchDomains(req.scope, {
      tenantId: ctx.tenant.id,
      query: domain,
      tlds: [tld],
    })
    if (!search.ok) {
      return res.status(502).json({ message: search.error ?? "price lookup failed" })
    }
    const hit = (search.data?.results ?? []).find(
      (r: any) => `${r.domain}.${r.tld}` === domain || r.domain === domain
    )
    const rawPrice = hit?.price?.transfer ?? hit?.price?.register ?? 0
    unitPriceUsd = rawPrice > 0 ? rawPrice : FALLBACK_PRICE_USD
  }

  // Reseller markup applied to the registrar cost before charging.
  const totalUsd = applyMarkup(unitPriceUsd) * years

  const ledger = getLedger(req.scope)
  const reservationId = `domx_${ctx.tenant.id}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`

  const reserve = await ledger.reserve(
    ctx.tenant.id,
    "domain_purchase_usd" as any,
    totalUsd,
    { reservationId }
  )
  if (!reserve.ok) {
    return res.status(402).json({
      message: "insufficient credits",
      balance_credits: reserve.credits,
    })
  }

  try {
    if (configured) {
      const transfer = await transferInDomain(req.scope, {
        tenantId: ctx.tenant.id,
        domainName: domain,
        authCode,
        years,
        privacy,
        autoRenew,
        userId: ctx.merchant.id,
      })

      if (!transfer.ok) {
        await ledger.release(reservationId)
        return res.status(502).json({ message: transfer.error ?? "transfer failed" })
      }

      await ledger.commit(reservationId, totalUsd, { idempotencyKey: reservationId })

      return res.json({
        ok: true,
        manual_approval: false,
        order: transfer.data?.order ?? null,
        domain: transfer.data?.domain ?? null,
      })
    }

    // ---- manual-approval fallback ----------------------------------------
    if (!MANUAL_APPROVAL_ENABLED) {
      await ledger.release(reservationId)
      return res.status(503).json({
        message: "domain registrar is not configured and manual approval is disabled",
      })
    }

    const [order] = await domainsModule.createDomainOrders([
      {
        tenant_id: ctx.tenant.id,
        domain_name: domain,
        tld,
        action: "transfer",
        years,
        status: "processing",
        price: totalUsd,
        currency: "USD",
        meta: { manual_approval: true, requested_by: ctx.merchant.id },
        created_by_user_id: ctx.merchant.id,
      },
    ] as any)

    const existing = await domainsModule.listDomainModels({
      tenant_id: ctx.tenant.id,
      domain_name: domain,
    })
    if (!existing?.length) {
      await domainsModule.createDomainModels([
        {
          tenant_id: ctx.tenant.id,
          domain_name: domain,
          tld,
          status: "pending_transfer",
          source: "transferred",
          years,
          currency: "USD",
          auto_renew: autoRenew,
          privacy_enabled: privacy,
          meta: {
            manual_approval: true,
            requested_by: ctx.merchant.id,
            auth_code: authCode,
          },
        },
      ] as any)
    }

    await ledger.commit(reservationId, totalUsd, { idempotencyKey: reservationId })

    return res.json({
      ok: true,
      manual_approval: true,
      order,
      domain: { domain_name: domain, tld, status: "pending_transfer" },
      note:
        "Your transfer request is pending manual approval by the platform team. " +
        "We will submit it at the registrar using the auth code you provided.",
    })
  } catch (e: any) {
    await ledger.release(reservationId).catch(() => undefined)
    return res.status(500).json({ message: e?.message ?? "domain transfer failed" })
  }
}
