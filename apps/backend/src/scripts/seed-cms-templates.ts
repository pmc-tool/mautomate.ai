import { CMS_MODULE } from "../modules/cms"
import { getBlockDefinition, validateBlockData } from "../modules/cms/registry"

/**
 * Seed the GLOBAL (tenant_id NULL) starter template catalog — every store's
 * library ships with these. Idempotent: upserts by (tenant_id NULL, name).
 * Block data = each block's registry defaultData() with neutral copy and a
 * live countdown date.
 */
export default async function ({ container }: any) {
  const cms: any = container.resolve(CMS_MODULE)
  const def = (t: string): Record<string, unknown> => {
    const d = (getBlockDefinition(t) as any)?.defaultData?.() ?? {}
    return JSON.parse(JSON.stringify(d).split("Forever Finds").join("our store"))
  }
  const block = (t: string, over: Record<string, unknown> = {}) => ({
    block_type: t,
    ...def(t),
    ...over,
  })
  const week = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  const CATALOG = [
    { name: "Complete Home Page", category: "Pages", scope: "page", blocks: [
      block("hero_slider"), block("brand_strip"), block("promo_banner_grid"),
      block("product_tabs"), block("deal_of_day", { countdown_to: week }),
      block("category_showcase"), block("testimonials"), block("instagram_grid"),
      block("newsletter"),
    ]},
    { name: "Minimal Home", category: "Pages", scope: "page", blocks: [
      block("hero_slider"), block("product_tabs"), block("newsletter"),
    ]},
    { name: "Deals Landing Page", category: "Pages", scope: "page", blocks: [
      block("deal_of_day", { countdown_to: week }), block("product_tabs"), block("newsletter"),
    ]},
    { name: "Brand Story Page", category: "Pages", scope: "page", blocks: [
      block("image_with_text"), block("rich_text"), block("testimonials"), block("newsletter"),
    ]},
    { name: "Hero + Brand Strip", category: "Hero", scope: "section", blocks: [
      block("hero_slider"), block("brand_strip"),
    ]},
    { name: "Featured Products", category: "Commerce", scope: "section", blocks: [block("product_tabs")] },
    { name: "Deal of the Day", category: "Commerce", scope: "section", blocks: [
      block("deal_of_day", { countdown_to: week }),
    ]},
    { name: "Category Grid", category: "Commerce", scope: "section", blocks: [block("category_showcase")] },
    { name: "Testimonials + Newsletter", category: "Trust", scope: "section", blocks: [
      block("testimonials"), block("newsletter"),
    ]},
    { name: "Instagram Feed", category: "Content", scope: "section", blocks: [block("instagram_grid")] },
  ]

  for (const t of CATALOG) {
    // Validate every block before writing — never seed broken data.
    for (const b of t.blocks) {
      const { block_type, ...data } = b as any
      const v = validateBlockData(block_type, data)
      if (!v.valid) {
        console.log("SKIP-INVALID", t.name, block_type, JSON.stringify(v.errors))
      }
    }
    const existing = await cms.listCmsTemplates({ tenant_id: null, name: t.name }, { take: 1 }).catch(() => [])
    if (existing?.length) {
      await cms.updateCmsTemplates({ id: existing[0].id, category: t.category, scope: t.scope, data: { blocks: t.blocks } })
      console.log("UPDATED", t.name)
    } else {
      await cms.createCmsTemplates({ tenant_id: null, name: t.name, category: t.category, scope: t.scope, data: { blocks: t.blocks } })
      console.log("SEEDED", t.name)
    }
  }
  const all = await cms.listCmsTemplates({ tenant_id: null }, { take: 100 })
  console.log("GLOBAL TOTAL:", all.length)
}
