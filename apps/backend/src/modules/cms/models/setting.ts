import { model } from "@medusajs/framework/utils"

/**
 * cms_setting — per-tenant singletons keyed by (tenant_id, key).
 *
 * One row per (tenant, key) where key is header|topbar|footer|theme|
 * seo_defaults|active_theme, enforced by a unique partial index on
 * (tenant_id, key). `data` is a locale-map JSON ({ en: {...}, bn?: {...sparse} })
 * for the 5 per-locale singletons; the `active_theme` row is locale-invariant
 * ({ value: "<theme-id>" }) and selects which compiled storefront theme is live.
 *
 * tenant_id scopes every store's chrome/branding to itself (pooled multi-tenant)
 * so one store's logo/theme change never leaks to another.
 */
const CmsSetting = model
  .define("cms_setting", {
    id: model.id({ prefix: "cmsset" }).primaryKey(),
    tenant_id: model.text().nullable(),
    key: model.enum([
      "header",
      "topbar",
      "footer",
      "theme",
      "seo_defaults",
      "active_theme",
    ]),
    data: model.json(),
    published_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_cms_setting_tenant_key_unique",
      on: ["tenant_id", "key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsSetting
