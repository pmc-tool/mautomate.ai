import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant, domainEntitlement } from "../../_helpers"
import {
  buyDomain,
  mutateDnsRecord,
  searchDomains,
} from "../../../../modules/domains/domain-service"
import { DOMAINS_MODULE } from "../../../../modules/domains"
import {
  getResellerConfig,
  isResellerConfigured,
} from "../../../../modules/domains/provider"
import { DomainRoutingService } from "../../../../modules/platform/domain-routing"
import { CloudflareSaaSClient } from "../../../../modules/platform/provider/cloudflare/client"
import { getLedger } from "../../../../modules/platform/credits/metering"
import { CREDIT_USD } from "../../../../modules/platform/pricing/price-book"
import { applyMarkup } from "../_shared"

const FALLBACK_PRICE_USD = Number(process.env.DOMAIN_FALLBACK_PRICE_USD ?? "12")
const MANUAL_APPROVAL_ENABLED =
  process.env.DOMAIN_MANUAL_APPROVAL_ENABLED !== "0"

function normalizeDomain(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
}

function splitDomain(domain: string): { sld: string; tld: string } {
  const idx = domain.lastIndexOf(".")
  if (idx === -1) return { sld: domain, tld: "" }
  return { sld: domain.slice(0, idx), tld: domain.slice(idx + 1) }
}

function isApexDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/\.$/, "")
  const labels = host.split(".")
  const twoPart = new Set(["co.uk", "com.bd", "com.au", "co.in", "com.br"])
  const suffix2 = labels.slice(-2).join(".")
  if (twoPart.has(suffix2)) return labels.length === 3
  return labels.length === 2
}

function relativeHost(domain: string, fullName: string): string {
  const suffix = `.${domain}`
  const name = fullName.trim().toLowerCase().replace(/\.$/, "")
  if (name === domain) return "@"
  if (name.endsWith(suffix)) return name.slice(0, -suffix.length)
  return name
}

async function addCloudflareDnsRecords(
  container: any,
  tenantId: string,
  domain: string,
  instructions: { kind: string; name: string; value: string }[]
) {
  for (const rec of instructions) {
    if (rec.kind === "cname") {
      await mutateDnsRecord(container, {
        tenantId,
        domainName: domain,
        op: "add",
        record: {
          type: "CNAME",
          host: isApexDomain(domain) ? "www" : "@",
          value: rec.value,
          ttl: 3600,
        },
      })
    } else if (rec.kind === "txt") {
      await mutateDnsRecord(container, {
        tenantId,
        domainName: domain,
        op: "add",
        record: {
          type: "TXT",
          host: relativeHost(domain, rec.name),
          value: rec.value,
          ttl: 3600,
        },
      })
    }
  }
}

function creditsForUsd(usd: number): number {
  return Math.ceil((usd / CREDIT_USD) * 10) / 10
}

/**
 * POST /merchant/domains/buy
 *
 * Purchase/register a domain. When a registrar is configured the domain is
 * registered in real time, credits are charged, and the tenant custom-domain
 * row is created. When no registrar is configured we fall back to a manual
 * approval flow: credits are collected, a pending manual order is created, the
 * tenant custom-domain is connected with DNS instructions, and a platform
 * operator must complete registration at the registrar and then approve the
 * order.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  // Gate BEFORE any registrar work so a trial can't buy a domain it
  // couldn't connect anyway.
  const ent = await domainEntitlement(ctx)
  if (!ent.ok) {
    return res.status(403).json({ message: ent.message, upgrade_required: true })
  }

  const body = (req.body ?? {}) as any
  const domainName = normalizeDomain(body.domain_name)
  const years = Math.min(Math.max(Number(body.years ?? 1), 1), 10)
  const privacy = !!body.privacy
  const autoRenew = !!body.auto_renew

  if (!domainName || !/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(domainName)) {
    return res.status(400).json({ message: "enter a valid domain, e.g. shop.example.com" })
  }

  const { tld } = splitDomain(domainName)
  if (!tld) {
    return res.status(400).json({ message: "domain must include a TLD" })
  }

  const configured = isResellerConfigured()
  let unitPriceUsd = 0

  if (configured) {
    const search = await searchDomains(req.scope, {
      tenantId: ctx.tenant.id,
      query: domainName,
      tlds: [tld],
    })
    if (!search.ok) {
      return res.status(502).json({ message: search.error ?? "availability lookup failed" })
    }
    const hit = (search.data?.results ?? []).find(
      (r: any) => `${r.domain}.${r.tld}` === domainName
    )
    if (!hit || !hit.available) {
      return res.status(400).json({ message: "domain is not available for registration" })
    }
    unitPriceUsd = hit.price?.register ?? 0
    if (!unitPriceUsd || unitPriceUsd <= 0) {
      return res.status(400).json({ message: "price unavailable for this domain" })
    }
  } else {
    unitPriceUsd = FALLBACK_PRICE_USD
  }

  const totalUsd = applyMarkup(unitPriceUsd) * years
  const creditsNeeded = creditsForUsd(totalUsd)

  const ledger = getLedger(req.scope)
  const reservationId = `dom_${ctx.tenant.id}_${Date.now()}_${Math.random()
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
      required_credits: creditsNeeded,
      balance_credits: reserve.credits,
    })
  }

  try {
    if (configured) {
      const reg = await buyDomain(req.scope, {
        tenantId: ctx.tenant.id,
        domainName,
        years,
        privacy,
        autoRenew,
        userId: ctx.merchant.id,
      })

      if (!reg.ok) {
        await ledger.release(reservationId)
        return res.status(502).json({ message: reg.error ?? "registration failed" })
      }

      const routing = new DomainRoutingService(req.scope as any)
      const connected = await routing.connectCustomDomain(ctx.tenant.id, domainName)
      if (!connected.ok) {
        await ledger.release(reservationId)
        return res.status(502).json({ message: connected.error ?? "could not activate domain on tenant" })
      }

      // Best-effort DNS seeding at the registrar.
      await addCloudflareDnsRecords(
        req.scope,
        ctx.tenant.id,
        domainName,
        connected.instructions
      ).catch(() => undefined)

      await ledger.commit(reservationId, totalUsd, { idempotencyKey: reservationId })

      return res.json({
        ok: true,
        domain: reg.data?.domain,
        order: reg.data?.order,
        instructions: connected.instructions,
        manual_approval: false,
      })
    }

    // ---- manual-approval fallback ----------------------------------------
    if (!MANUAL_APPROVAL_ENABLED) {
      await ledger.release(reservationId)
      return res.status(503).json({
        message: "domain registrar is not configured and manual approval is disabled",
      })
    }

    const domainsModule: any = req.scope.resolve(DOMAINS_MODULE)

    const [order] = await domainsModule.createDomainOrders([
      {
        tenant_id: ctx.tenant.id,
        domain_name: domainName,
        tld,
        action: "register",
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
      domain_name: domainName,
    })
    if (!existing?.length) {
      await domainsModule.createDomainModels([
        {
          tenant_id: ctx.tenant.id,
          domain_name: domainName,
          tld,
          status: "pending_register",
          source: "registered",
          years,
          register_price: totalUsd,
          currency: "USD",
          auto_renew: autoRenew,
          privacy_enabled: privacy,
          meta: { manual_approval: true, requested_by: ctx.merchant.id },
        },
      ] as any)
    }

    const routing = new DomainRoutingService(req.scope as any)
    const connected = await routing.connectCustomDomain(ctx.tenant.id, domainName)
    if (!connected.ok) {
      await ledger.release(reservationId)
      return res.status(502).json({ message: connected.error ?? "could not activate domain on tenant" })
    }

    await ledger.commit(reservationId, totalUsd, { idempotencyKey: reservationId })

    return res.json({
      ok: true,
      order,
      domain: { domain_name: domainName, tld, status: "pending_register" },
      manual_approval: true,
      instructions: connected.instructions,
      note:
        "Your domain request is pending manual approval by the platform team. " +
        "Set the DNS records above at your registrar once the domain is registered.",
    })
  } catch (e: any) {
    await ledger.release(reservationId).catch(() => undefined)
    return res.status(500).json({ message: e?.message ?? "domain purchase failed" })
  }
}
