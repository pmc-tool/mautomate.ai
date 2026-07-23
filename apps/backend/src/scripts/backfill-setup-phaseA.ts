import { PLATFORM_MODULE } from "../modules/platform"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * backfill-setup-phaseA — bring EXISTING stores in line with the new setup model:
 *
 *   1. Tag every already-provisioned sample product with metadata.is_sample=true
 *      so it stops counting as a real product (the "Add products" check and the
 *      product KPI both exclude it). Samples are identified by the deterministic
 *      provisioning handle pattern "<slug>-sample-<suffix>".
 *   2. Seed tenant.meta.default_country (from billing_country, else "us") for any
 *      tenant that doesn't have it, so the store-country setup task reads done and
 *      the shipping-coverage check has a real target.
 *
 * Idempotent: skips products already tagged and tenants already seeded.
 *
 * Run: npx medusa exec ./src/scripts/backfill-setup-phaseA.ts
 */
export default async function backfillSetupPhaseA({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)
  const productModule: any = container.resolve(Modules.PRODUCT)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  // ---- 1. tag legacy sample products ----------------------------------------
  let taggedProducts = 0
  try {
    const { data: samples } = await query.graph({
      entity: "product",
      filters: {} as any,
      fields: ["id", "handle", "metadata"],
      pagination: { take: 5000, skip: 0 },
    })
    const toTag = (samples || []).filter(
      (p: any) =>
        typeof p.handle === "string" &&
        /-sample-/.test(p.handle) &&
        (p.metadata as any)?.is_sample !== true
    )
    for (const p of toTag) {
      await productModule.updateProducts(p.id, {
        metadata: { ...(p.metadata ?? {}), is_sample: true },
      })
      taggedProducts++
    }
  } catch (e: any) {
    logger.warn(`[backfill-setup] sample tagging failed: ${e?.message}`)
  }

  // ---- 2. seed default_country ----------------------------------------------
  let seededCountry = 0
  const tenants: any[] = await svc.listTenants({}, { take: 5000 })
  for (const tenant of tenants) {
    const meta = tenant.meta ?? {}
    if (String(meta.default_country || "").trim()) continue
    const country = String(tenant.billing_country || "us").toLowerCase()
    await svc.updateTenants({
      id: tenant.id,
      meta: { ...meta, default_country: country },
    })
    seededCountry++
  }

  logger.info(
    `[backfill-setup] tagged ${taggedProducts} sample product(s); seeded default_country on ${seededCountry} of ${tenants.length} tenant(s)`
  )
}
