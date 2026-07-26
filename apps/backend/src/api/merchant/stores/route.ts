import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateSlug } from "../../../modules/platform/abuse/quota"
import { PaddleGateway } from "../../../modules/platform/billing/paddle"
import { provisionTenantWorkflow } from "../../../workflows/platform/provision-tenant"
import {
  checkLimit,
  gatePayload,
  PLAN_LABEL,
} from "../../../modules/platform/entitlements"
import {
  listOwnedStores,
  resolveMerchant,
  tenantEntitlements,
} from "../_helpers"

const ROOT = "mautomate.ai"

/** Scale includes this many stores in the plan price; beyond it, each
 *  additional store is its own $49/mo Paddle subscription. */
const SCALE_INCLUDED_STORES = 3

/**
 * GET /merchant/stores — the stores this login owns plus whether one more can
 * be added (drives the switcher's "New store" affordance).
 *
 * POST /merchant/stores  { slug, name? }
 *
 * Start creating an ADDITIONAL store (multi-store M2). Paid-first rule: this
 * route never provisions anything — it validates (Scale plan, stores cap,
 * slug availability) and returns a Paddle checkout for the $49/mo add-on
 * subscription. The Paddle webhook (kind "addon_store") provisions the store
 * and links ownership ONLY after payment is confirmed, so an abandoned
 * checkout leaves nothing behind. Additional stores are NEVER trials.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  try {
    const grants = await listOwnedStores(ctx.svc, ctx.merchant.id)
    const rows = await Promise.all(
      grants.map((g) => ctx.svc.retrieveTenant(g.tenant_id).catch(() => null))
    )
    const stores = rows
      .filter(Boolean)
      .filter((t: any) => !["purged", "failed"].includes(t.status))
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        package: t.package,
        is_active: t.id === ctx.tenant.id,
      }))
    const ent = await tenantEntitlements(ctx)
    const max = ent.limits.stores
    res.json({
      stores,
      can_add: ent.plan === "scale" && (max === null || stores.length < max),
      max_stores: max,
      included_stores: SCALE_INCLUDED_STORES,
      next_store_included:
        ent.plan === "scale" && stores.length < SCALE_INCLUDED_STORES,
      addon_price_usd: 49,
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list stores" })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const b = (req.body ?? {}) as Record<string, any>

  try {
    // Gate 1: multi-store is a Scale capability (plan decision 2026-07-27).
    const ent = await tenantEntitlements(ctx)
    if (ent.plan !== "scale") {
      return res.status(403).json({
        message: `Multiple stores come with the ${PLAN_LABEL.scale} plan. Upgrade to add more stores.`,
        code: "entitlement_locked",
        feature: "multi_store",
        required_plan: "scale",
        required_plan_label: PLAN_LABEL.scale,
      })
    }

    // Gate 2: the hard ceiling across owned stores.
    const owned = await listOwnedStores(ctx.svc, ctx.merchant.id)
    const gate = checkLimit(ctx.tenant.id, ent, "stores", owned.length)
    if (!gate.allowed) return res.status(403).json(gatePayload(gate))

    // Validate the new store's address exactly like signup does.
    const slugCheck = validateSlug(String(b.slug ?? ""))
    if (!slugCheck.ok) {
      return res
        .status(400)
        .json({ message: `invalid store address (${slugCheck.reason})` })
    }
    const slug = slugCheck.slug
    const name = String(b.name || slug).slice(0, 60)

    const [taken, domainTaken] = await Promise.all([
      ctx.svc.listTenants({ slug }, { take: 1 }),
      ctx.svc.listTenantDomains({ domain: `${slug}.${ROOT}` }, { take: 1 }),
    ])
    if (taken?.length || domainTaken?.length) {
      return res.status(409).json({ message: `${slug}.${ROOT} is already taken` })
    }

    // INCLUDED stores (plan decision: Scale covers 3 in the $349): provision
    // immediately — the plan subscription already paid for it. The paid-first
    // rule applies to ADD-ON stores beyond the included allowance.
    if (owned.length < SCALE_INCLUDED_STORES) {
      const { result, errors } = await provisionTenantWorkflow(req.scope).run({
        input: { slug, name, package: "growth", trial_credits: 1500 },
        throwOnError: false,
      })
      if (errors?.length) {
        return res.status(500).json({
          message: errors
            .map((e: any) => String(e?.error?.message ?? e?.error ?? e))
            .join("; "),
        })
      }
      const tenantId = (result as any)?.tenant_id
      if (!tenantId) {
        return res.status(500).json({ message: "provisioning returned no tenant_id" })
      }
      await ctx.svc.createMerchantStores([
        { merchant_id: ctx.merchant.id, tenant_id: tenantId, role: "owner" },
      ])
      await ctx.svc
        .updateTenants({
          id: tenantId,
          status: "live",
          meta: { addon_store: true, included_with_plan: true, owner_merchant_id: ctx.merchant.id },
        })
        .catch(() => undefined)
      return res.status(201).json({
        store: { id: tenantId, slug, name },
        included: true,
        note: "Included with your Scale plan - the store is live now.",
      })
    }

    // Paid-first: hand back the checkout; the webhook does the rest.
    const gateway = new PaddleGateway()
    if (!gateway.isConfigured()) {
      return res
        .status(503)
        .json({ message: "Billing is not configured — contact support." })
    }
    const checkout = await gateway.createAddonStoreCheckout({
      payer_tenant_id: ctx.tenant.id,
      owner_merchant_id: ctx.merchant.id,
      slug,
      name,
    })
    if (!checkout.ok || !checkout.data) {
      return res
        .status(502)
        .json({ message: checkout.ok ? "No checkout returned." : checkout.error })
    }

    res.status(202).json({
      checkout_url: checkout.data.url,
      transaction_id: checkout.data.id,
      note: "Complete the checkout to create the store. It is provisioned the moment payment is confirmed.",
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to start store creation" })
  }
}
