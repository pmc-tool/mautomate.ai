import { model } from "@medusajs/framework/utils"

/**
 * theme — the IDENTITY of a theme ("aurora").
 *
 * Stable forever. An upgrade is a new VERSION of the same theme, never a new
 * theme, because a merchant's settings and their chosen theme are keyed on
 * this handle: mint a new one and every store on it silently loses its look.
 *
 * Themes are PLATFORM-owned (uploaded by the super admin), so there is no
 * tenant_id: a theme belongs to the library, not to a store. A store's CHOICE
 * of theme lives on the tenant (meta.active_theme).
 */
const Theme = model
  .define("theme", {
    id: model.id({ prefix: "thm" }).primaryKey(),
    /** The handle from theme.json — unique across the platform. */
    handle: model.text(),
    name: model.text(),
    author: model.text().nullable(),
    description: model.text().nullable(),
    /** What a merchant gets when they apply this theme from the library. */
    current_version: model.text().nullable(),
    /** public = any merchant may apply it; private = assigned explicitly. */
    visibility: model.text().default("public"),
    /** draft | published | archived. Archiving retires a theme WITHOUT
     *  breaking the stores still rendering it. */
    status: model.text().default("draft"),
    uploaded_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_theme_handle",
      on: ["handle"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default Theme
