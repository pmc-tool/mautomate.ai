import {
  StepResponse,
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/core-flows"

import { PLATFORM_MODULE } from "../../modules/platform"
import { EncryptedConfigService } from "../../modules/platform/secure-config"
import { CALL_CENTER_MODULE } from "../../modules/call-center"
import { provisionDefaultAgent } from "../../modules/call-center/default-agent"
import { provisionDefaultChatbot } from "../../modules/marketing/default-chatbot"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * bootstrap-tenant-store — the REAL commerce bootstrap for a shared-pooled
 * tenant (Phase 2). In the shared-pooled model Medusa's native tenant isolation
 * for commerce is the SALES CHANNEL + PUBLISHABLE KEY: each tenant gets its own
 * sales channel and key, and a storefront request carrying that key sees ONLY
 * that tenant's products. This step creates, for one tenant, inside the shared
 * control-plane instance:
 *   1. a sales channel (the tenant's store scope)
 *   2. a publishable key linked to it (the storefront credential)
 *   3. a DEDICATED, country-less region (currency only) tagged with the tenant id
 *   4. a starter product scoped to that sales channel priced in the tenant currency
 * and records the publishable key + sales-channel id + region id + currency on
 * the tenant row so the Host->tenant resolver can hand the storefront the right
 * credentials.
 *
 * Regions in Medusa carry a SINGLE currency and a country belongs to EXACTLY one
 * region, so on a shared pooled instance per-tenant regions with the same country
 * would collide. THEREFORE each tenant's region is created COUNTRY-LESS (currency
 * only) and tagged `metadata.tenant_id`. The storefront resolves the region by id
 * (tenant.meta.region_id), so country-less is fine for currency display. Supported
 * currencies are modeled at the TENANT level (tenant.meta.supported_currencies).
 *
 * This is what makes a second tenant REAL instead of dry-run. Compensation tears
 * the sales channel + key + dedicated region back down.
 */
type BootstrapInput = { tenant: any }

const bootstrapTenantStoreStep = createStep(
  "platform-bootstrap-tenant-store",
  async (input: BootstrapInput, { container }) => {
    const { tenant } = input

    // 1. sales channel (the tenant's store scope)
    const { result: channels } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          { name: `${tenant.name} Store`, description: `tenant:${tenant.id}` },
        ],
      },
    })
    const salesChannel = (channels as any[])[0]

    // 2. publishable key + link to the sales channel
    const { result: keys } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: `${tenant.slug} storefront`, type: "publishable", created_by: "platform" },
        ],
      },
    })
    const apiKey = (keys as any[])[0]
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: [salesChannel.id] },
    })

    // 3. DEDICATED country-less region for this tenant (currency only, tagged).
    // No `countries` — a country belongs to exactly one region and pooled tenants
    // would collide. The region is tagged with metadata.tenant_id so ownership is
    // provable and it is never shared with another tenant.
    const currency = (tenant.meta?.currency_code ?? "usd").toLowerCase()
    const regionModule: any = container.resolve(Modules.REGION)
    const [region] = await regionModule.createRegions([
      {
        name: `${tenant.name}`,
        currency_code: currency,
        metadata: { tenant_id: tenant.id },
      },
    ])

    // Enable a payment method on the region. The region module's own
    // `payment_providers` field is a silent no-op in this Medusa version (it does
    // NOT create the region_payment_provider link), so the link must be made via
    // the core-flows workflow. Without it the storefront checkout shows no
    // payment method and the "Place order" button can never become clickable.
    // pp_system_default (manual/offline) always works; the merchant adds real
    // gateways (bKash, Nagad, SSLCommerz, Stripe, ...) from the Payments step.
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: { payment_providers: ["pp_system_default"] },
      },
    })

    // Enable Cash on Delivery / bank transfer by DEFAULT so a brand-new store can
    // take orders the moment it opens. The storefront's payment-provider route
    // (api/store/payment-providers) returns ONLY the gateways a merchant has
    // enabled+configured in their per-tenant vault; without a default, a fresh
    // store's checkout has NO payment method and cannot complete an order. This
    // is the primary mechanism (the region link above is a native fallback).
    // Merchants add real gateways (bKash, Nagad, SSLCommerz, Stripe) on top, and
    // can disable COD, from the Payments step.
    try {
      const cfg = new EncryptedConfigService(container)
      await cfg.setConfig(tenant.id, "gateway.bank_transfer.config", {
        enabled: true,
        enabled_regions: ["*"],
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(`[bootstrap] could not enable default COD for ${tenant.id}: ${e?.message ?? e}`)
    }

    // 4. a starter product scoped to this sales channel, priced in the tenant
    // currency. Handle MUST be globally unique in Medusa; derive a deterministic,
    // slug-safe suffix from the tenant id so pooled tenants never collide.
    const sampleHandleSuffix = (tenant.id ?? crypto.randomUUID())
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-8)
      .toLowerCase()
    const sampleHandle = `${tenant.slug}-sample-${sampleHandleSuffix}`
    const __fps: any = container.resolve(Modules.FULFILLMENT)
    const __profiles = await __fps.listShippingProfiles({ type: "default" }, { take: 1 }).catch(() => [])
    const __profileId: string | undefined = __profiles?.[0]?.id
    const { result: products } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: `${tenant.name} — Sample Product`,
            handle: sampleHandle,
            status: "published" as any,
            // Tagged so it never counts as a real product: excluded from the
            // "Add products" setup check and the dashboard product KPI. The
            // storefront still renders it so a fresh store does not look empty;
            // the merchant replaces or removes it from the setup wizard.
            metadata: { is_sample: true, tenant_id: tenant.id },
            sales_channels: [{ id: salesChannel.id }],
            shipping_profile_id: __profileId,
            options: [{ title: "Default", values: ["Default"] }],
            variants: [
              {
                title: "Default",
                prices: [{ amount: 1000, currency_code: currency }],
                options: { Default: "Default" },
                metadata: { tenant_id: tenant.id },
              },
            ],
          },
        ],
      },
    })
    const product = (products as any[])[0]

    // 5. Stock: a dedicated location for this tenant, linked to the sales channel,
    // with inventory levels for the sample product's variant. WITHOUT this the
    // storefront cannot add anything to cart ("sales channel not associated with
    // any stock location for variant"). Best-effort — never fail provisioning.
    try {
      const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)
      const inventoryModule: any = container.resolve(Modules.INVENTORY)
      const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
      const createdLoc = await stockLocationModule.createStockLocations({
        name: `${tenant.name || tenant.slug} Warehouse`,
        metadata: { tenant_id: tenant.id },
      })
      const locId = Array.isArray(createdLoc) ? createdLoc[0]?.id : createdLoc?.id
      if (locId) {
        await linkSalesChannelsToStockLocationWorkflow(container).run({
          input: { id: locId, add: [salesChannel.id] },
        })
        const variantIds = ((product?.variants ?? []) as any[])
          .map((v) => v.id)
          .filter(Boolean)
        if (variantIds.length) {
          const { data: vlinks } = await query.graph({
            entity: "product_variant_inventory_item",
            filters: { variant_id: variantIds } as any,
            fields: ["inventory_item_id"],
          })
          const itemIds = (vlinks || [])
            .map((l: any) => l.inventory_item_id)
            .filter(Boolean)
          for (const itemId of itemIds) {
            await inventoryModule.createInventoryLevels([
              { inventory_item_id: itemId, location_id: locId, stocked_quantity: 1000000 },
            ])
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[provision] stock setup failed (non-blocking):", e)
    }

    // record the storefront credential + currency contract on the tenant
    const svc = container.resolve(PLATFORM_MODULE) as any
    await svc.updateTenants({
      id: tenant.id,
      publishable_key: apiKey.token,
      meta: {
        ...(tenant.meta ?? {}),
        sales_channel_id: salesChannel.id,
        region_id: region.id,
        currency_code: currency,
        supported_currencies: [currency],
        // Every new store opens on the platform default theme: the uploaded
        // Liquid Learts. Old compiled Learts is retired.
        active_theme: "learts-liquid",
        // The country the storefront sells in — drives the shipping-coverage
        // check and checkout. Seeded from the signup billing country so it is a
        // real value, not a silent "us"; the setup wizard lets the merchant
        // confirm or change it.
        default_country: String(tenant.billing_country || "us").toLowerCase(),
        bootstrapped: true,
      },
    })

    // Pre-trained default AI call-center agent so a non-technical merchant has a
    // working call center out of the box. Non-fatal — never block store creation.
    try {
      const cc: any = container.resolve(CALL_CENTER_MODULE)
      await provisionDefaultAgent(cc, tenant)
    } catch (e: any) {
      console.log(`[bootstrap] default agent skipped for ${tenant.id}: ${e?.message}`)
    }

    // Pre-trained default store assistant (web chat widget) so a new storefront
    // can answer a shopper about its catalog from the first minute. Creates the
    // bot (auto-reply, public key), its ACTIVE web_widget binding, seeds its
    // knowledge and trains it. Non-fatal — never block store creation.
    try {
      const bot = await provisionDefaultChatbot(container, tenant)
      console.log(
        `[bootstrap] default chatbot for ${tenant.id}: ${JSON.stringify(bot)}`
      )
    } catch (e: any) {
      console.log(
        `[bootstrap] default chatbot skipped for ${tenant.id}: ${e?.message}`
      )
    }

    return new StepResponse(
      {
        ...tenant,
        publishable_key: apiKey.token,
        sales_channel_id: salesChannel.id,
        sample_product_id: product?.id,
        region_id: region?.id,
        currency_code: currency,
      },
      {
        sales_channel_id: salesChannel.id,
        api_key_id: apiKey.id,
        product_id: product?.id,
        region_id: region?.id,
      }
    )
  },
  async (comp, { container }) => {
    if (!comp) return
    // best-effort teardown of the created commerce scaffolding
    try {
      const sc: any = container.resolve("salesChannel")
      await sc.deleteSalesChannels([comp.sales_channel_id])
    } catch {}
    try {
      const ak: any = container.resolve("apiKey")
      await ak.deleteApiKeys([comp.api_key_id])
    } catch {}
    // The region is now DEDICATED to this tenant (not shared) — safe to remove.
    try {
      if (comp.region_id) {
        const regionModule: any = container.resolve(Modules.REGION)
        await regionModule.deleteRegions([comp.region_id])
      }
    } catch {}
  }
)

export const bootstrapTenantStoreWorkflow = createWorkflow(
  "platform-bootstrap-tenant-store",
  (input: WorkflowData<BootstrapInput>) => {
    const result = bootstrapTenantStoreStep(input)
    return new WorkflowResponse(result)
  }
)

export default bootstrapTenantStoreWorkflow
