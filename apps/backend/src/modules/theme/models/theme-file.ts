import { model } from "@medusajs/framework/utils"

/**
 * theme_file — the bytes, keyed by path within a version.
 *
 * Kept in Postgres rather than on disk on purpose: a theme can then never
 * half-exist because a file server fell out of sync with the database, and a
 * new storefront node needs no warm-up — it reads the theme the same way it
 * reads everything else.
 */
const ThemeFile = model
  .define("theme_file", {
    id: model.id({ prefix: "thmf" }).primaryKey(),
    theme_version_id: model.text(),
    /** Package-relative: "templates/product.liquid", "assets/theme.css". */
    path: model.text(),
    /** text = templates/CSS/JS; binary = images and fonts (base64). */
    kind: model.text().default("text"),
    content: model.text(),
    content_type: model.text().nullable(),
    size_bytes: model.number().default(0),
  })
  .indexes([
    {
      name: "IDX_theme_file_version_path",
      on: ["theme_version_id", "path"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ThemeFile
