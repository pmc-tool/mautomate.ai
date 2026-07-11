import { model } from "@medusajs/framework/utils"
import CmsPage from "./page"
import CmsSectionTranslation from "./section-translation"

/**
 * cms_section — a single DRAFT block on a page, ordered by `rank`
 * (phase-0-architecture.md §2.4).
 *
 * `type` is a BLOCK_TYPES value validated app-side (model.text, so adding a
 * block type needs no migration). `enabled` is locale-invariant (toggling a
 * block affects every locale). `data` is the FULL default-locale (en) block
 * payload: structure + entity-ID refs + en text. Non-default-locale text
 * overrides live in cms_section_translation rows keyed off the stable
 * section_id, so reorder/delete never orphans a translation.
 *
 * Generated CRUD (model key CmsSection):
 *   createCmsSections / listCmsSections / listAndCountCmsSections /
 *   retrieveCmsSection / updateCmsSections / deleteCmsSections /
 *   softDeleteCmsSections / restoreCmsSections
 */
const CmsSection = model
  .define("cms_section", {
    id: model.id({ prefix: "cmssec" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // BLOCK_TYPES value, app-validated (no enum migration to add a type).
    type: model.text(),
    // Integer ordering within the page (lower = earlier).
    rank: model.number().default(0),
    // Locale-invariant on/off toggle.
    enabled: model.boolean().default(true),
    // Admin-only display label (optional).
    label: model.text().nullable(),
    // Full default-locale (en) block data: structure + ID refs + en text.
    data: model.json(),
    page: model.belongsTo(() => CmsPage, { mappedBy: "sections" }),
    translations: model.hasMany(() => CmsSectionTranslation, {
      mappedBy: "section",
    }),
  })
  .indexes([
    {
      name: "IDX_cms_section_page_rank",
      on: ["page_id", "rank"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsSection
