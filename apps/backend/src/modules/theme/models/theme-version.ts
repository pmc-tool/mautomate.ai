import { model } from "@medusajs/framework/utils"

/**
 * theme_version — one uploaded package.
 *
 * IMMUTABLE once stored. A merchant on 1.2.0 keeps rendering 1.2.0 even while
 * 1.3.0 sits in the library, so uploading can never silently change a live
 * store: the merchant decides when to move.
 */
const ThemeVersion = model
  .define("theme_version", {
    id: model.id({ prefix: "thmv" }).primaryKey(),
    theme_id: model.text(),
    /** semver, from theme.json */
    version: model.text(),
    /** The parsed manifest: tokens, settings schema, engine version. */
    manifest: model.json(),
    /** What the validator accepted, and what it warned about — the audit trail
     *  for "why is this theme in the library". */
    warnings: model.json().nullable(),
    /** preview.png as a data URL, so the library needs no file server. */
    preview: model.text().nullable(),
    size_bytes: model.number().default(0),
    file_count: model.number().default(0),
    uploaded_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_theme_version_unique",
      on: ["theme_id", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ThemeVersion
