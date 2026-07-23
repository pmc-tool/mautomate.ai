import { readFileSync } from "fs"
import { CMS_MODULE } from "../modules/cms"
import { getBlockDefinition, validateBlockData } from "../modules/cms/registry"

/**
 * Seed the GLOBAL template catalog from a merged JSON file (produced by the
 * catalog authoring run). Reads /tmp/template-catalog.json:
 *   [{ name, category, scope, blocks: [{ block_type, override }] }]
 * Each block = registry defaultData() with `override` shallow-merged on top.
 * "__WEEK__" strings become now+7d ISO. Every block is validated with the real
 * registry validator; a template with ANY invalid block is skipped and counted.
 * Upserts by (tenant_id NULL, name). Also normalizes legacy seed categories.
 */
const CATEGORY_REMAP: Record<string, string> = {
  "Featured Products": "Products",
  "Deal of the Day": "Deals",
  "Category Grid": "Products",
  "Testimonials + Newsletter": "Trust",
  "Instagram Feed": "Content",
}

export default async function ({ container }: any) {
  const cms: any = container.resolve(CMS_MODULE)
  const week = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const raw = readFileSync("/tmp/template-catalog.json", "utf8")
  const catalog: any[] = JSON.parse(raw.split("__WEEK__").join(week))

  let seeded = 0
  let updated = 0
  let skipped = 0
  const names = new Set<string>()

  for (const t of catalog) {
    if (!t?.name || names.has(t.name)) {
      console.log("SKIP-DUP-OR-NAMELESS", t?.name)
      skipped++
      continue
    }
    names.add(t.name)

    const blocks: any[] = []
    const errors: string[] = []
    for (const b of t.blocks ?? []) {
      const type = b.block_type
      const def = (getBlockDefinition(type) as any)?.defaultData?.()
      if (!def) {
        errors.push(`${type}: unknown block type`)
        continue
      }
      const data = { ...JSON.parse(JSON.stringify(def)), ...(b.override ?? {}) }
      // Validate CONTENT only. `style` / `elementStyles` are sibling appearance
      // bags (stripMeta removes them before Liquid ever sees them), so they must
      // not be handed to a content validator.
      const v = validateBlockData(type, data)
      if (!v.valid) {
        errors.push(`${type}: ${v.errors.join("; ")}`)
        continue
      }
      const block: Record<string, unknown> = { block_type: type, ...data }
      if (b.style && Object.keys(b.style).length) block.style = b.style
      if (b.advanced && Object.keys(b.advanced).length) block.advanced = b.advanced
      if (b.elementStyles && Object.keys(b.elementStyles).length) {
        block.elementStyles = b.elementStyles
      }
      blocks.push(block)
    }
    if (errors.length || blocks.length === 0) {
      console.log("SKIP-INVALID", t.name, JSON.stringify(errors))
      skipped++
      continue
    }

    const existing = await cms
      .listCmsTemplates({ tenant_id: null, name: t.name }, { take: 1 })
      .catch(() => [])
    if (existing?.length) {
      await cms.updateCmsTemplates({
        id: existing[0].id,
        category: t.category,
        scope: t.scope === "page" ? "page" : "section",
        data: { blocks },
      })
      updated++
    } else {
      await cms.createCmsTemplates({
        tenant_id: null,
        name: t.name,
        category: t.category,
        scope: t.scope === "page" ? "page" : "section",
        data: { blocks },
      })
      seeded++
    }
  }

  // Normalize legacy seed categories to the library taxonomy.
  for (const [name, category] of Object.entries(CATEGORY_REMAP)) {
    const rows = await cms
      .listCmsTemplates({ tenant_id: null, name }, { take: 1 })
      .catch(() => [])
    if (rows?.length && rows[0].category !== category) {
      await cms.updateCmsTemplates({ id: rows[0].id, category })
      console.log("REMAPPED", name, "->", category)
    }
  }

  const all = await cms.listCmsTemplates({ tenant_id: null }, { take: 500 })
  console.log(
    `RESULT seeded=${seeded} updated=${updated} skipped=${skipped} globalTotal=${all.length}`
  )
  if (skipped > 0) {
    console.log("WARNING: skipped templates present — inspect SKIP lines above")
  }
}
