export default async ({ container }) => {
  const {
    ContainerRegistrationKeys,
    Modules,
  } = require("@medusajs/framework/utils")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve(Modules.PRODUCT)
  const out = {}

  // 1. product_category exposes rank + metadata + relations via query.graph
  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "rank",
      "metadata",
      "parent_category.id",
      "parent_category.name",
      "parent_category.metadata",
      "category_children.id",
      "category_children.rank",
      "category_children.is_active",
      "category_children.metadata",
    ],
    pagination: { take: 3, skip: 0 },
  })
  out.categories_sampled = (cats || []).length
  out.category_has_rank = cats?.[0] ? "rank" in cats[0] : null
  const sampleCat = (cats || [])[0]

  // 2. Products are filterable by category_id and expose the relations the
  //    detail products table needs.
  if (sampleCat) {
    const prods = await productModule.listProducts(
      { category_id: [sampleCat.id] },
      { take: 3, relations: ["variants", "collection", "sales_channels"] }
    )
    out.category_products_sampled = (prods || []).length
    out.product_row_shape_ok = prods?.[0]
      ? {
          has_variants: Array.isArray(prods[0].variants),
          has_collection_rel: "collection" in prods[0],
          has_sales_channels_rel: "sales_channels" in prods[0],
        }
      : "no products in sampled category"
  }

  // 3. Option registry aggregation: options + values relations load.
  const someProducts = await productModule.listProducts(
    {},
    { take: 5, relations: ["options", "options.values"] }
  )
  const titles = new Set()
  let valuesRelOk = false
  for (const p of someProducts || []) {
    for (const o of p.options || []) {
      if (o.title) titles.add(o.title)
      if (Array.isArray(o.values)) valuesRelOk = true
    }
  }
  out.distinct_option_titles_in_sample = titles.size
  out.option_values_relation_ok = valuesRelOk

  // 4. Collections carry a metadata field (tenant tag + editable metadata).
  const cols = await productModule.listProductCollections({}, { take: 2 })
  out.collections_sampled = (cols || []).length
  out.collection_has_metadata_field = cols?.[0] ? "metadata" in cols[0] : null

  // 5. product_sales_channel link is queryable (tenant scoping backbone).
  const { data: scLinks } = await query.graph({
    entity: "product_sales_channel",
    fields: ["product_id", "sales_channel_id"],
    pagination: { take: 1, skip: 0 },
  })
  out.product_sales_channel_link_ok = Array.isArray(scLinks)

  return out
}