import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createProductOptionsWorkflow,
  updateProductOptionsWorkflow,
  deleteProductOptionsWorkflow,
  setProductProductOptionsWorkflow,
} from "@medusajs/core-flows"

export default async function probeBeCore2({ container }: { container: any }) {
  const failures: string[] = []
  const ok = (m: string) => console.log(`OK ${m}`)
  for (const [name, wf] of Object.entries({
    createProductsWorkflow,
    createProductOptionsWorkflow,
    updateProductOptionsWorkflow,
    deleteProductOptionsWorkflow,
    setProductProductOptionsWorkflow,
  })) {
    if (typeof wf !== "function") failures.push(`missing workflow export ${name}`)
    else ok(`workflow export ${name}`)
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data } = await query.graph({
      entity: "store",
      fields: ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
    })
    ok(`store currencies graph (${data?.[0]?.supported_currencies?.length ?? 0} currencies)`)
  } catch (e: any) {
    failures.push(`store currencies graph: ${e.message}`)
  }
  try {
    await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "status", "thumbnail", "collection.id", "collection.title", "type.id", "type.value", "tags.id", "tags.value", "sales_channels.id", "sales_channels.name", "variants.id", "created_at", "updated_at"],
      pagination: { take: 1, skip: 0 },
    })
    ok("list route field graph")
  } catch (e: any) {
    failures.push(`list field graph: ${e.message}`)
  }
  if (failures.length) { console.log("FAILURES:", JSON.stringify(failures)); process.exit(1) }
  console.log("ALL BE-CORE2 PROBES PASSED")
}
