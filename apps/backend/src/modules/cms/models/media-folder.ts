import { model } from "@medusajs/framework/utils"
import CmsMedia from "./media"

/**
 * cms_media_folder — virtual folders for the Media Library (metadata only).
 *
 * Folders DO NOT change the underlying File Module storage key/prefix — moving a
 * file between folders is a metadata update, never a re-upload. `path` is a
 * materialized slash-path (e.g. `/banners/hero`) maintained app-side for cheap
 * breadcrumb / tree rendering. Self-referential parent/children model a tree.
 *
 * See phase-0-architecture.md §2.10.
 *
 * Generated CRUD (model key CmsMediaFolder):
 *   createCmsMediaFolders / listCmsMediaFolders / listAndCountCmsMediaFolders
 *   / retrieveCmsMediaFolder / updateCmsMediaFolders / deleteCmsMediaFolders
 *   / softDeleteCmsMediaFolders / restoreCmsMediaFolders
 */
const CmsMediaFolder = model
  .define("cms_media_folder", {
    id: model.id({ prefix: "cmsfld" }).primaryKey(),
    tenant_id: model.text().nullable(),
    name: model.text(),
    // Materialized slash-path, e.g. "/banners/hero". Root folders are "/<name>".
    path: model.text(),
    parent: model
      .belongsTo(() => CmsMediaFolder, { mappedBy: "children" })
      .nullable(),
    children: model.hasMany(() => CmsMediaFolder, { mappedBy: "parent" }),
    media: model.hasMany(() => CmsMedia, { mappedBy: "folder" }),
  })
  .indexes([
    {
      name: "IDX_cms_media_folder_parent_id",
      on: ["parent_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsMediaFolder
