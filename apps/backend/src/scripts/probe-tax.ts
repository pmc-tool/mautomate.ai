import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function probeTax2({ container }: { container: any }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "metadata"],
    pagination: { take: 3, skip: 0 },
  })
  console.log("OK categories fetch:", (cats || []).length)
  const sample = (cats || [])[0]
  if (sample) {
    const { data } = await query.graph({
      entity: "product_category",
      filters: { id: sample.id },
      fields: ["id", "products.id", "products.title", "products.handle", "products.thumbnail", "products.status", "products.variants.id", "products.collection.id", "products.collection.title"],
    })
    const prods = (data?.[0] as any)?.products || []
    console.log("OK category-side products walk:", prods.length, "products")
  } else {
    console.log("OK no categories exist yet - walk validated on empty set")
    await query.graph({
      entity: "product_category",
      filters: { id: "pcat_nonexistent" },
      fields: ["id", "products.id"],
    })
    console.log("OK walk query executes with products relation")
  }
  console.log("ALL TAX2 PROBES PASSED")
}
