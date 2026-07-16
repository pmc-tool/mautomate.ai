import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * tenant-stamp-repair (scheduled sweep, every 5 minutes).
 *
 * The per-store uniqueness indexes (handles, SKUs, barcodes, group names)
 * key on metadata->>'tenant_id'. The merchant API and bootstrap stamp rows
 * at creation; this sweep is the CATCH-ALL for every other write path
 * (core workflows creating inventory items from variants, imports, future
 * admin tooling) so no row lingers unstamped for more than a few minutes.
 *
 * Derivation chain (the platform's isolation rule):
 *   product        <- its sales channel's owning tenant
 *   product_variant<- its product
 *   inventory_item <- its variant (via the variant/inventory link)
 *
 * Unstamped rows are NOT a safety hole while they wait: they live in the
 * '' namespace bucket which is STRICTER (globally unique), never looser.
 */
export default async function tenantStampRepairJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    const productRes = await pg.raw(`
      UPDATE product p
      SET metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', t.id)
      FROM product_sales_channel psc
      JOIN tenant t ON (t.meta->>'sales_channel_id') = psc.sales_channel_id
      WHERE psc.product_id = p.id
        AND p.deleted_at IS NULL
        AND (p.metadata->>'tenant_id') IS NULL
    `)

    const variantRes = await pg.raw(`
      UPDATE product_variant v
      SET metadata = coalesce(v.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', p.metadata->>'tenant_id')
      FROM product p
      WHERE v.product_id = p.id
        AND v.deleted_at IS NULL
        AND (p.metadata->>'tenant_id') IS NOT NULL
        AND (v.metadata->>'tenant_id') IS NULL
    `)

    const inventoryRes = await pg.raw(`
      UPDATE inventory_item ii
      SET metadata = coalesce(ii.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', v.metadata->>'tenant_id')
      FROM product_variant_inventory_item pvii
      JOIN product_variant v ON v.id = pvii.variant_id
      WHERE pvii.inventory_item_id = ii.id
        AND ii.deleted_at IS NULL
        AND (v.metadata->>'tenant_id') IS NOT NULL
        AND (ii.metadata->>'tenant_id') IS NULL
    `)

    // Registered customers: derive the owning store from the tenant-prefixed
    // auth identity ("<tenant_id>:email" — see namespaceCustomerAuthIdentity
    // in api/middlewares.ts). Covers rows the create-time stamp missed.
    const customerRes = await pg.raw(`
      UPDATE customer c
      SET metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', t.id)
      FROM auth_identity ai
      JOIN provider_identity pi ON pi.auth_identity_id = ai.id AND pi.provider = 'emailpass'
      JOIN tenant t ON t.id = split_part(pi.entity_id, ':', 1)
      WHERE position(':' in pi.entity_id) > 0
        AND (ai.app_metadata->>'customer_id') = c.id
        AND c.deleted_at IS NULL
        AND (c.metadata->>'tenant_id') IS NULL
    `)

    const total =
      (productRes?.rowCount ?? 0) +
      (variantRes?.rowCount ?? 0) +
      (inventoryRes?.rowCount ?? 0) +
      (customerRes?.rowCount ?? 0)
    if (total > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[tenancy] stamp repair: products=${productRes?.rowCount ?? 0} variants=${variantRes?.rowCount ?? 0} inventory=${inventoryRes?.rowCount ?? 0} customers=${customerRes?.rowCount ?? 0}`
      )
    }
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger.error("[tenancy] stamp repair failed:", e as any)
    } catch {
      // Logger unavailable — swallow so the scheduler is never disrupted.
    }
  }
}

export const config = {
  name: "tenant-stamp-repair",
  schedule: "*/5 * * * *",
}
