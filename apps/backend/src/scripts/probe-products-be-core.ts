import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Non-destructive probe for the be-core merchant products routes.
 * Validates (read-only, no writes):
 *  1. every workflow import used by the routes resolves from @medusajs/core-flows
 *  2. the widened LIST query.graph field list + filters + all order variants execute
 *  3. the FULL detail query.graph field list executes (on 1 product if any exists)
 *  4. the option-ownership and variant-usage field lists execute
 *  5. the variant->price_set link query executes
 *  6. the store currencies query executes
 *
 * Run: npx medusa exec ./src/scripts/probe-products-core.ts
 */
export default async function probeProductsCore({ container }: { container: any }) {
  const log = (msg: string) => console.log(`[probe-products-core] ${msg}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Workflow imports resolve.
  const coreFlows = await import("@medusajs/core-flows")
  const requiredWorkflows = [
    "createProductsWorkflow",
    "updateProductsWorkflow",
    "createProductOptionsWorkflow",
    "updateProductOptionsWorkflow",
    "deleteProductOptionsWorkflow",
    "setProductProductOptionsWorkflow",
  ]
  for (const name of requiredWorkflows) {
    if (typeof (coreFlows as any)[name] !== "function") {
      throw new Error(`workflow import missing from @medusajs/core-flows: ${name}`)
    }
  }
  log(`ok: ${requiredWorkflows.length} workflow imports resolve`)

  // Sanity: modules used by the routes resolve from the container.
  container.resolve(Modules.PRODUCT)
  container.resolve(Modules.PRICING)
  log("ok: product + pricing modules resolve")

  // 2. LIST field list + order variants + every filter key shape.
  const LIST_FIELDS = [
    "id",
    "title",
    "handle",
    "status",
    "thumbnail",
    "created_at",
    "updated_at",
    "collection.id",
    "collection.title",
    "type.id",
    "type.value",
    "tags.id",
    "tags.value",
    "sales_channels.id",
    "sales_channels.name",
    "variants.id",
    "variants.metadata",
  ]
  const { data: listData, metadata } = await query.graph({
    entity: "product",
    fields: LIST_FIELDS,
    pagination: { take: 1, skip: 0, order: { created_at: "DESC" } },
  })
  log(`ok: list field set executes (total products=${metadata?.count ?? 0})`)

  for (const order of [{ title: "ASC" }, { updated_at: "DESC" }, { created_at: "ASC" }]) {
    await query.graph({
      entity: "product",
      fields: ["id"],
      pagination: { take: 1, skip: 0, order },
    })
  }
  log("ok: order variants (title/created_at/updated_at) execute")

  await query.graph({
    entity: "product",
    fields: ["id"],
    filters: {
      q: "probe",
      status: ["draft"],
      type_id: ["ptyp_probe_none"],
      collection_id: ["pcol_probe_none"],
      tags: { id: ["ptag_probe_none"] },
      categories: { id: ["pcat_probe_none"] },
    },
    pagination: { take: 1, skip: 0 },
  })
  log("ok: list filter keys (q/status/type_id/collection_id/tags.id/categories.id) execute")

  // 3. FULL detail field list on the first product, when one exists.
  const FULL_FIELDS = [
    "id",
    "title",
    "subtitle",
    "handle",
    "description",
    "status",
    "thumbnail",
    "weight",
    "length",
    "height",
    "width",
    "mid_code",
    "hs_code",
    "origin_country",
    "material",
    "discountable",
    "external_id",
    "metadata",
    "created_at",
    "updated_at",
    "images.id",
    "images.url",
    "images.rank",
    "options.id",
    "options.title",
    "options.values.id",
    "options.values.value",
    "options.values.rank",
    "variants.id",
    "variants.title",
    "variants.sku",
    "variants.barcode",
    "variants.ean",
    "variants.upc",
    "variants.manage_inventory",
    "variants.allow_backorder",
    "variants.variant_rank",
    "variants.metadata",
    "variants.created_at",
    "variants.updated_at",
    "variants.options.id",
    "variants.options.value",
    "variants.options.option.id",
    "variants.options.option.title",
    "collection.id",
    "collection.title",
    "categories.id",
    "categories.name",
    "type.id",
    "type.value",
    "tags.id",
    "tags.value",
    "sales_channels.id",
    "sales_channels.name",
    "shipping_profile.id",
    "shipping_profile.name",
  ]
  const firstProduct = (listData || [])[0]
  if (firstProduct) {
    const { data: fullData } = await query.graph({
      entity: "product",
      filters: { id: firstProduct.id },
      fields: FULL_FIELDS,
    })
    if (!fullData?.[0]) {
      throw new Error("full detail query returned no product for an existing id")
    }
    log(`ok: full detail field set executes (product=${firstProduct.id})`)

    // 4b. variant-usage field list (used by option update/delete guards).
    await query.graph({
      entity: "product",
      filters: { id: firstProduct.id },
      fields: [
        "id",
        "variants.id",
        "variants.options.id",
        "variants.options.value",
        "variants.options.option_id",
      ],
    })
    log("ok: variant option-usage field set executes")

    // Tenancy link entity used for ownership checks.
    await query.graph({
      entity: "product_sales_channel",
      filters: { product_id: firstProduct.id },
      fields: ["product_id", "sales_channel_id"],
    })
    log("ok: product_sales_channel link query executes")

    // 5. variant -> price_set link (price loading path).
    const firstVariantId = fullData[0].variants?.[0]?.id
    if (firstVariantId) {
      await query.graph({
        entity: "product_variant_price_set",
        filters: { variant_id: [firstVariantId] },
        fields: ["variant_id", "price_set_id"],
      })
      log("ok: product_variant_price_set link query executes")
    } else {
      log("skip: product has no variants; price link query not exercised")
    }
  } else {
    log("skip: no products exist; detail/link queries not exercised")
  }

  // 4. Option ownership field list (works even with zero options: validates fields).
  await query.graph({
    entity: "product_option",
    fields: [
      "id",
      "title",
      "is_exclusive",
      "products.id",
      "values.id",
      "values.value",
      "values.rank",
    ],
    pagination: { take: 1, skip: 0 },
  })
  log("ok: product_option ownership field set executes")

  // 6. Store currencies query.
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.*"],
    pagination: { take: 1, skip: 0 },
  })
  const store = (stores || [])[0]
  if (!store) {
    throw new Error("no store found; currencies fallback would be default-only")
  }
  const codes = ((store.supported_currencies as any[]) || [])
    .map((c: any) => c?.currency_code)
    .filter(Boolean)
  log(`ok: store currencies query executes (store=${store.id}, currencies=[${codes.join(", ")}])`)

  log("ALL CHECKS PASSED (no writes performed)")
}