import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateInventoryItemsWorkflow,
  deleteInventoryItemWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { getVariantInventoryLinks } from "../../_inventory"
import { getTenantInventoryContext } from "../route"

/**
 * Build the full detail payload for a tenant-visible inventory item: item
 * attributes, per-location levels (restricted to tenant locations, with level
 * ids for downstream adjust/delete), and the linked variants with product
 * context. Returns null if the item is not tenant-visible.
 */
export async function buildDetail(req: MedusaRequest, ctx: any, id: string) {
  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIdSet.has(id)) return null

  const inventoryModule: any = req.scope.resolve(Modules.INVENTORY)
  const item = await inventoryModule.retrieveInventoryItem(id).catch(() => null)
  if (!item) return null

  const levels = await inventoryModule.listInventoryLevels(
    { inventory_item_id: id, location_id: Array.from(tctx.tenantLocationIds) },
    { take: 1000 }
  )

  const location_levels = (levels || []).map((l: any) => ({
    id: l.id,
    location_id: l.location_id,
    location_name: tctx.locNameById.get(l.location_id) ?? null,
    stocked_quantity: Number(l.stocked_quantity) || 0,
    reserved_quantity: Number(l.reserved_quantity) || 0,
    incoming_quantity: Number(l.incoming_quantity) || 0,
    available_quantity:
      Number(l.available_quantity ?? (l.stocked_quantity ?? 0) - (l.reserved_quantity ?? 0)) || 0,
  }))

  const variantIds = tctx.itemToVariants[id] || []
  let variants: any[] = []
  if (variantIds.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product_variant",
      filters: { id: variantIds } as any,
      fields: ["id", "title", "product_id", "product.title"],
    })
    variants = (data || []).map((v: any) => ({
      id: v.id,
      title: v.title,
      product_id: v.product_id ?? v.product?.id ?? null,
      product_title: v.product?.title ?? null,
    }))
  }

  const stocked_quantity = location_levels.reduce((s, l) => s + l.stocked_quantity, 0)
  const reserved_quantity = location_levels.reduce((s, l) => s + l.reserved_quantity, 0)

  return {
    id: item.id,
    title: item.title ?? variants[0]?.title ?? null,
    sku: item.sku ?? null,
    thumbnail: null,
    requires_shipping: item.requires_shipping,
    origin_country: item.origin_country ?? null,
    hs_code: item.hs_code ?? null,
    mid_code: item.mid_code ?? null,
    material: item.material ?? null,
    weight: item.weight ?? null,
    length: item.length ?? null,
    height: item.height ?? null,
    width: item.width ?? null,
    metadata: item.metadata ?? null,
    reserved_quantity,
    stocked_quantity,
    variant_titles: variants.map((v: any) => v.title).filter(Boolean),
    location_levels,
    variants,
  }
}

/**
 * GET /merchant/inventory-items/[id]
 *
 * One inventory item plus per-location levels and linked variants. Fail-closed:
 * 404 unless the item is tenant-visible.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const detail = await buildDetail(req, ctx, id)
  if (!detail) return res.status(404).json({ message: "inventory item not found" })

  res.json({ item: detail })
}

const UpdateInventoryItemSchema = z.object({
  title: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  requires_shipping: z.boolean().optional(),
  origin_country: z.string().optional().nullable(),
  hs_code: z.string().optional().nullable(),
  mid_code: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  weight: z.number().min(0).optional().nullable(),
  length: z.number().min(0).optional().nullable(),
  height: z.number().min(0).optional().nullable(),
  width: z.number().min(0).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
})

/**
 * POST /merchant/inventory-items/[id]
 *
 * Updates item attributes/metadata via updateInventoryItemsWorkflow. Fail-closed
 * ownership guard first.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIdSet.has(id)) {
    return res.status(404).json({ message: "inventory item not found" })
  }

  const parsed = UpdateInventoryItemSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  await updateInventoryItemsWorkflow(req.scope).run({
    input: { updates: [{ id, ...(parsed.data as any) }] },
  })

  const detail = await buildDetail(req, ctx, id)
  res.json({ item: detail })
}

/**
 * DELETE /merchant/inventory-items/[id]
 *
 * Deletes an inventory item via deleteInventoryItemWorkflow. Guarded twice: it
 * must be tenant-visible, and it must have NO variant links (the item is managed
 * through its product otherwise) -> 400 with a message. The workflow itself also
 * refuses deletion when reserved quantity exists.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const tctx = await getTenantInventoryContext(req, ctx)
  if (!tctx.itemIdSet.has(id)) {
    return res.status(404).json({ message: "inventory item not found" })
  }

  // Variant-link guard: never delete an item that backs a product variant.
  const { itemToVariant } = await getVariantInventoryLinks(
    req,
    Object.values(tctx.itemToVariants).flat()
  )
  if (itemToVariant[id]) {
    return res.status(400).json({
      message:
        "Cannot delete an inventory item that is linked to a product variant. Delete the variant instead.",
    })
  }

  try {
    await deleteInventoryItemWorkflow(req.scope).run({ input: [id] })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "failed to delete inventory item" })
  }

  res.status(200).json({ id, object: "inventory_item", deleted: true })
}
