import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EncryptedConfigService } from "../../modules/platform/secure-config"
import {
  gatewaysForCountry,
  requiredCredentialKeys,
  vaultKey,
} from "../../modules/payments/registry"

/**
 * The single source of truth for "how ready is this store to sell?".
 *
 * Both GET /merchant/onboarding (the legacy 4-tick checklist) and
 * GET /merchant/setup/status (the richer wizard/progress engine) call this, so
 * the number the merchant sees on the overview card and the number the wizard
 * shows can never disagree.
 *
 * EVERY check is tenant-scoped and fails CLOSED (to `false`) — it never throws
 * and never blocks the dashboard. A tick is only ever green when the merchant
 * can genuinely sell through it. In particular:
 *   - a provisioned SAMPLE product (metadata.is_sample = true) is NOT a product;
 *   - "shipping" means a shopper in the store's own country can actually pick a
 *     delivery method, not merely that some option exists somewhere;
 *   - "payment" means a gateway is enabled AND fully credentialed;
 *   - "domain" means a custom domain that is VERIFIED, not merely typed in.
 */

export type SetupTaskKey =
  | "store_country"
  | "products"
  | "shipping"
  | "payment"
  | "logo"
  | "business_details"
  | "domain"

export type SetupTask = {
  key: SetupTaskKey
  label: string
  /** Plain-language reason this matters, for a non-technical merchant. */
  why: string
  /** Required tasks gate `ready_to_sell`; recommended ones do not. */
  required: boolean
  done: boolean
  /** Where the dashboard / wizard sends them to finish it. */
  cta_href: string
  /** When NOT done, the specific thing that is wrong (may be null). */
  blocker_detail?: string | null
}

export type SetupStatus = {
  tasks: SetupTask[]
  /** Completion over ALL tasks (required + recommended), 0-100. */
  percent: number
  /** Completion over REQUIRED tasks only, 0-100. */
  required_percent: number
  /** True once every required task is done — the store can take an order. */
  ready_to_sell: boolean
  missing_required: SetupTaskKey[]
  // ---- context (also surfaced by the legacy onboarding route) ----
  shipping_countries: string[]
  store_country: string
  pending_domain: string | null
  // ---- legacy boolean mirror for the existing SetupChecklist ----
  products: boolean
  shipping: boolean
  payment: boolean
  domain: boolean
}

type MerchantCtx = {
  tenant: any
  svc: any
}

/**
 * Compute the store's setup status. `ctx` is the resolved merchant context
 * (`resolveMerchant(req)`); pass it in so callers that already resolved it do
 * not do the work twice.
 */
export async function computeSetupStatus(
  req: MedusaRequest,
  ctx: MerchantCtx
): Promise<SetupStatus> {
  const tenantId = ctx.tenant.id
  const meta = (ctx.tenant.meta ?? {}) as Record<string, any>
  const scId = meta?.sales_channel_id

  // ---- store country (the storefront's selling country) --------------------
  // `default_country` is SEEDED at provisioning (from the signup country) purely
  // so the wizard can prefill the right value and the shipping check has a real
  // target. But the TASK is only done once the merchant has EXPLICITLY confirmed
  // it — otherwise a brand-new store would show "Confirm your store country" as
  // already ticked, which is exactly the pre-filled-by-default behaviour we are
  // removing. The confirmation flag is set by PATCH /merchant/setup when the
  // basics step is saved.
  const storeCountry = String(
    meta?.default_country || process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"
  ).toLowerCase()
  const hasStoreCountry = meta?.country_confirmed === true

  // ---- products (excluding the provisioned sample) --------------------------
  // The link table is the fact of the matter; read it directly. A product whose
  // metadata.is_sample = 'true' is the demo we ship with the store — it must NOT
  // satisfy this check, or a brand-new store would read "done" with nothing real
  // to sell.
  let hasProducts = false
  try {
    if (scId) {
      const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const rows = await pg
        .select("psc.product_id")
        .from("product_sales_channel as psc")
        .join("product as p", "p.id", "psc.product_id")
        .where("psc.sales_channel_id", scId)
        .whereNull("p.deleted_at")
        .whereRaw("coalesce(p.metadata->>'is_sample','') <> 'true'")
        .limit(1)
      hasProducts = Array.isArray(rows) && rows.length > 0
    }
  } catch {
    hasProducts = false
  }

  // ---- shipping (a shopper in the store's country can pick a method) --------
  // MUST be tenant-scoped: the shipping/service-zone/geo-zone tables are GLOBAL
  // in the pooled backend, so counting every country any store ships to would
  // tell a brand-new store its delivery is done just because ANOTHER store
  // covers the same country. Scope through the store's OWN tenant-tagged stock
  // locations — the exact query the tenant-config endpoint uses to decide which
  // countries the storefront may offer at checkout, so this tick agrees with
  // what a shopper actually sees.
  let hasShipping = false
  let shippingCountries: string[] = []
  try {
    const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = await pg
      .select("gz.country_code")
      .from("stock_location as sl")
      .join("location_fulfillment_set as lfs", "lfs.stock_location_id", "sl.id")
      .join("fulfillment_set as fs", "fs.id", "lfs.fulfillment_set_id")
      .join("service_zone as sz", "sz.fulfillment_set_id", "fs.id")
      .join("geo_zone as gz", "gz.service_zone_id", "sz.id")
      .join("shipping_option as so", "so.service_zone_id", "sz.id")
      .whereRaw("sl.metadata->>'tenant_id' = ?", [tenantId])
      .whereNull("sl.deleted_at")
      .whereNull("sz.deleted_at")
      .whereNull("gz.deleted_at")
      .whereNull("so.deleted_at")
      .whereNotExists(function (this: any) {
        // A return option is not a delivery option.
        this.select(pg.raw("1"))
          .from("shipping_option_rule as sor")
          .whereRaw("sor.shipping_option_id = so.id")
          .andWhere("sor.attribute", "is_return")
          .andWhereRaw("sor.value::text like '%true%'")
          .whereNull("sor.deleted_at")
      })

    shippingCountries = Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .map((r: any) => String(r.country_code || "").toLowerCase())
          .filter(Boolean)
      )
    ).sort()

    hasShipping = shippingCountries.includes(storeCountry)
  } catch {
    hasShipping = false
  }

  // ---- payment (a gateway enabled AND fully configured) ---------------------
  let hasPayment = false
  try {
    const cfg = new EncryptedConfigService(req.scope)
    const gateways = gatewaysForCountry((ctx.tenant.billing_country as string) || "*")
    for (const g of gateways) {
      const config = await cfg
        .getConfig<{ enabled?: boolean }>(tenantId, `gateway.${g.id}.config`, {
          enabled: false,
        })
        .catch(() => null)
      if (!config?.enabled) continue
      let ready = true
      for (const key of requiredCredentialKeys(g)) {
        const cred = g.credentials.find((c: any) => c.key === key)
        if (!cred) {
          ready = false
          break
        }
        const k = vaultKey(g.id, key)
        const v = cred.secret
          ? await cfg.getSecret(tenantId, k).catch(() => undefined)
          : await cfg.getConfig<string>(tenantId, k, "").catch(() => "")
        if (!v || !String(v).trim()) {
          ready = false
          break
        }
      }
      if (ready) {
        hasPayment = true
        break
      }
    }
  } catch {
    hasPayment = false
  }

  // ---- custom domain (VERIFIED, not merely typed in) ------------------------
  let hasDomain = false
  let pendingDomain: string | null = null
  try {
    const domains = await ctx.svc
      .listTenantDomains({ tenant_id: tenantId })
      .catch(() => [])
    const custom = (domains || []).filter((d: any) => d.type !== "free")
    hasDomain = custom.some(
      (d: any) => String(d.verification_status ?? "") === "verified"
    )
    if (!hasDomain) {
      pendingDomain = custom[0]?.domain ?? null
    }
  } catch {
    hasDomain = false
  }

  // ---- brand / business details (recommended) -------------------------------
  const hasLogo = !!String(meta?.logo_url || "").trim()
  const biz = (meta?.business ?? {}) as Record<string, any>
  const hasBusinessDetails = !!(
    String(biz?.type || "").trim() || String(biz?.category || "").trim()
  )

  // ---- assemble -------------------------------------------------------------
  const shipsElsewhere = shippingCountries.length > 0 && !hasShipping

  const tasks: SetupTask[] = [
    {
      key: "store_country",
      label: "Confirm your store country",
      why: "Sets where you sell, so delivery and checkout work.",
      required: true,
      done: hasStoreCountry,
      cta_href: "/dashboard/setup?step=basics",
      blocker_detail: hasStoreCountry
        ? null
        : `Using ${storeCountry.toUpperCase()} by default — confirm it's right.`,
    },
    {
      key: "products",
      label: "Add your first product",
      why: "Give customers something real to buy.",
      required: true,
      done: hasProducts,
      cta_href: "/dashboard/products",
      blocker_detail: hasProducts ? null : "Your store has no real products yet.",
    },
    {
      key: "shipping",
      label: "Set up delivery",
      why: "Let shoppers in your country choose how they receive orders.",
      required: true,
      done: hasShipping,
      cta_href: "/dashboard/setup?step=delivery",
      blocker_detail: hasShipping
        ? null
        : shipsElsewhere
        ? `You deliver to ${shippingCountries
            .map((c) => c.toUpperCase())
            .join(", ")}, but your store sells in ${storeCountry.toUpperCase()}. No shopper there can check out.`
        : "No delivery option covers your store country yet.",
    },
    {
      key: "payment",
      label: "Enable payments",
      why: "Connect a method so you can actually get paid.",
      required: true,
      done: hasPayment,
      cta_href: "/dashboard/settings",
      blocker_detail: hasPayment ? null : "No payment method is enabled and configured.",
    },
    {
      key: "logo",
      label: "Add your logo",
      why: "Make the store look like your brand.",
      required: false,
      done: hasLogo,
      cta_href: "/dashboard/setup?step=brand",
      blocker_detail: null,
    },
    {
      key: "business_details",
      label: "Add business details",
      why: "Tell customers who they're buying from.",
      required: false,
      done: hasBusinessDetails,
      cta_href: "/dashboard/setup?step=basics",
      blocker_detail: null,
    },
    {
      key: "domain",
      label: "Connect your domain",
      why: "Use your own web address instead of a subdomain.",
      required: false,
      done: hasDomain,
      cta_href: "/dashboard/domains",
      blocker_detail:
        !hasDomain && pendingDomain
          ? `${pendingDomain} was added but isn't verified yet — finish the DNS step.`
          : null,
    },
  ]

  const requiredTasks = tasks.filter((t) => t.required)
  const requiredDone = requiredTasks.filter((t) => t.done)
  const allDone = tasks.filter((t) => t.done)
  const readyToSell = requiredTasks.every((t) => t.done)

  // Cache readiness on the tenant so unauthenticated surfaces (the storefront's
  // tenant-config, a future owner-only "not ready" banner) can tell whether the
  // store can take an order WITHOUT recomputing. Write only on change so a
  // dashboard load is not a write on every request. Best-effort — never blocks.
  if ((meta as any).ready_to_sell !== readyToSell) {
    try {
      await ctx.svc.updateTenants({
        id: tenantId,
        meta: { ...meta, ready_to_sell: readyToSell },
      })
    } catch {
      /* cache refresh is best-effort */
    }
  }

  return {
    tasks,
    percent: Math.round((allDone.length / tasks.length) * 100),
    required_percent: Math.round((requiredDone.length / requiredTasks.length) * 100),
    ready_to_sell: readyToSell,
    missing_required: requiredTasks.filter((t) => !t.done).map((t) => t.key),
    shipping_countries: shippingCountries,
    store_country: storeCountry,
    pending_domain: pendingDomain,
    products: hasProducts,
    shipping: hasShipping,
    payment: hasPayment,
    domain: hasDomain,
  }
}
