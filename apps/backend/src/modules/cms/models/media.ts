import { model } from "@medusajs/framework/utils"
import CmsMediaFolder from "./media-folder"

/**
 * cms_media — the CMS media catalog wrapping Medusa's built-in File Module.
 *
 * The File Module owns the bytes (local-in-dev, S3-in-prod). This row is the
 * catalog entry: it stores the File Module `file_id`, the absolute `url` the
 * active provider returned, plus the metadata the File Module does NOT keep
 * (original filename, mime, size, image dimensions, checksum, per-locale alt /
 * title, folder, uploader).
 *
 * LOCALIZATION: `alt` and `title` are per-locale maps `{ en?: string, bn?: string }`
 * (json, nullable) — see phase-0-architecture.md §2.9 and §7. At publish time the
 * alt for the requested locale is resolved into the page snapshot.
 *
 * > Naming note: model key `CmsMedia` ⇒ generated methods are pluralized as
 * > createCmsMedias / listCmsMedias / listAndCountCmsMedias / retrieveCmsMedia /
 * > updateCmsMedias / deleteCmsMedias / softDeleteCmsMedias / restoreCmsMedias.
 * > The awkward plural is accepted to keep the table named `cms_media`.
 */
const CmsMedia = model
  .define("cms_media", {
    id: model.id({ prefix: "cmsmed" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // Medusa File Module id (the provider key that owns the bytes).
    file_id: model.text(),
    // Absolute URL exactly as the active File Module provider returned it.
    url: model.text(),
    original_filename: model.text(),
    filename: model.text(),
    mime_type: model.text(),
    // Size in bytes.
    size: model.number(),
    // Pixel dimensions — images only; null for svg / video / extraction failure.
    width: model.number().nullable(),
    height: model.number().nullable(),
    // sha256 of the uploaded bytes (dedupe / integrity).
    checksum: model.text().nullable(),
    // Per-locale alt/title maps: { en?: string, bn?: string }.
    alt: model.json().nullable(),
    title: model.json().nullable(),
    // null folder = library root.
    folder: model
      .belongsTo(() => CmsMediaFolder, { mappedBy: "media" })
      .nullable(),
    // Admin user id that uploaded the asset (audit).
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_cms_media_file_id",
      on: ["file_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cms_media_checksum",
      on: ["checksum"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cms_media_folder_id",
      on: ["folder_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsMedia
