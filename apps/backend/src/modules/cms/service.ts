import {
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import CmsSetting from "./models/setting"
import CmsAuditLog from "./models/audit-log"
import CmsMedia from "./models/media"
import CmsMediaFolder from "./models/media-folder"
import CmsPage from "./models/page"
import CmsPageDraft from "./models/page-draft"
import CmsTemplate from "./models/template"
import CmsPageTranslation from "./models/page-translation"
import CmsSection from "./models/section"
import CmsSectionTranslation from "./models/section-translation"
import CmsSnapshot from "./models/snapshot"
import CmsBlogPost from "./models/blog-post"
import CmsBlogPostTranslation from "./models/blog-post-translation"
import CmsBlogCategory from "./models/blog-category"
import CmsAuthor from "./models/author"
import CmsUserRole from "./models/user-role"

/**
 * CMS module service.
 *
 * Generated CRUD (verified against the contact module pattern):
 *   CmsSetting     -> createCmsSettings / listCmsSettings / listAndCountCmsSettings
 *                     / retrieveCmsSetting / updateCmsSettings / deleteCmsSettings
 *   CmsAuditLog    -> createCmsAuditLogs / listCmsAuditLogs / listAndCountCmsAuditLogs
 *                     / retrieveCmsAuditLog / updateCmsAuditLogs / deleteCmsAuditLogs
 *   CmsMedia       -> createCmsMedias / listCmsMedias / listAndCountCmsMedias
 *                     / retrieveCmsMedia / updateCmsMedias / deleteCmsMedias
 *                     / softDeleteCmsMedias / restoreCmsMedias
 *   CmsMediaFolder -> createCmsMediaFolders / listCmsMediaFolders
 *                     / listAndCountCmsMediaFolders / retrieveCmsMediaFolder
 *                     / updateCmsMediaFolders / deleteCmsMediaFolders
 *                     / softDeleteCmsMediaFolders / restoreCmsMediaFolders
 *
 * Phase 3 adds the page-builder + publish read-model:
 *   CmsPage              -> createCmsPages / listCmsPages / listAndCountCmsPages
 *                           / retrieveCmsPage / updateCmsPages / deleteCmsPages
 *                           / softDeleteCmsPages / restoreCmsPages
 *   CmsPageTranslation   -> createCmsPageTranslations / listCmsPageTranslations
 *                           / listAndCountCmsPageTranslations
 *                           / retrieveCmsPageTranslation / updateCmsPageTranslations
 *                           / deleteCmsPageTranslations / softDeleteCmsPageTranslations
 *                           / restoreCmsPageTranslations
 *   CmsSection           -> createCmsSections / listCmsSections / listAndCountCmsSections
 *                           / retrieveCmsSection / updateCmsSections / deleteCmsSections
 *                           / softDeleteCmsSections / restoreCmsSections
 *   CmsSectionTranslation-> createCmsSectionTranslations / listCmsSectionTranslations
 *                           / listAndCountCmsSectionTranslations
 *                           / retrieveCmsSectionTranslation
 *                           / updateCmsSectionTranslations / deleteCmsSectionTranslations
 *                           / softDeleteCmsSectionTranslations
 *                           / restoreCmsSectionTranslations
 *   CmsSnapshot          -> createCmsSnapshots / listCmsSnapshots / listAndCountCmsSnapshots
 *                           / retrieveCmsSnapshot / updateCmsSnapshots / deleteCmsSnapshots
 *                           / softDeleteCmsSnapshots / restoreCmsSnapshots
 *
 * Phase 8 adds the blog read/write models:
 *   CmsBlogPost            -> createCmsBlogPosts / listCmsBlogPosts / listAndCountCmsBlogPosts
 *                             / retrieveCmsBlogPost / updateCmsBlogPosts / deleteCmsBlogPosts
 *                             / softDeleteCmsBlogPosts / restoreCmsBlogPosts
 *   CmsBlogPostTranslation -> createCmsBlogPostTranslations / listCmsBlogPostTranslations
 *                             / listAndCountCmsBlogPostTranslations
 *                             / retrieveCmsBlogPostTranslation / updateCmsBlogPostTranslations
 *                             / deleteCmsBlogPostTranslations / softDeleteCmsBlogPostTranslations
 *                             / restoreCmsBlogPostTranslations
 *   CmsBlogCategory        -> createCmsBlogCategories / listCmsBlogCategories
 *                             / listAndCountCmsBlogCategories / retrieveCmsBlogCategory
 *                             / updateCmsBlogCategories / deleteCmsBlogCategories
 *                             / softDeleteCmsBlogCategories / restoreCmsBlogCategories
 *   CmsAuthor              -> createCmsAuthors / listCmsAuthors / listAndCountCmsAuthors
 *                             / retrieveCmsAuthor / updateCmsAuthors / deleteCmsAuthors
 *                             / softDeleteCmsAuthors / restoreCmsAuthors
 *
 * Phase 9 adds RBAC (phase-0-architecture.md §8). Role resolution + the access
 * matrix live in ./role-helper.ts (shared by the middleware + the roles routes);
 * the audit viewer reuses the existing CmsAuditLog CRUD:
 *   CmsUserRole            -> createCmsUserRoles / listCmsUserRoles
 *                             / listAndCountCmsUserRoles / retrieveCmsUserRole
 *                             / updateCmsUserRoles / deleteCmsUserRoles
 *                             / softDeleteCmsUserRoles / restoreCmsUserRoles
 */
/** Input for {@link CmsModuleService.publishSnapshot}. */
export type PublishSnapshotInput = {
  /** "page" (default) or "global" (settings singletons). */
  entity_type?: "page" | "global"
  /**
   * Owning tenant (pooled multi-tenant). REQUIRED for every production caller so
   * the (tenant_id, entity_type, slug, locale) live-unique index holds and stores
   * never collide. May be null only for legacy single-tenant seed scripts.
   */
  tenant_id: string | null
  /** cms_page.id (pages) or setting key (globals). */
  entity_id: string
  /** Denormalized route slug (== entity_id for globals). */
  slug: string
  /** Target locale (validated app-side by the caller). */
  locale: string
  /** Fully compiled, locale-resolved, immutable payload. */
  data: Record<string, unknown>
  published_by?: string | null
  note?: string | null
}

class CmsModuleService extends MedusaService({
  CmsSetting,
  CmsAuditLog,
  CmsMedia,
  CmsMediaFolder,
  CmsPage,
  CmsPageDraft,
  CmsTemplate,
  CmsPageTranslation,
  CmsSection,
  CmsSectionTranslation,
  CmsSnapshot,
  CmsBlogPost,
  CmsBlogPostTranslation,
  CmsBlogCategory,
  CmsAuthor,
  CmsUserRole,
}) {
  /**
   * Atomically promote a compiled payload to the live snapshot for
   * (entity_type, slug, locale) — the publish write half of the
   * publish-snapshot model (phase-0-architecture.md §5.2).
   *
   * Inside ONE transaction:
   *   1. compute the next monotonic `version` (max existing + 1),
   *   2. flip the prior live row to `is_live=false` FIRST — the partial-unique
   *      index `WHERE is_live = true` rejects a second live row, so the demote
   *      must precede the insert (a publish race then fails loudly, never
   *      corrupts reads),
   *   3. insert the new immutable `is_live=true` snapshot row.
   *
   * Returns the created snapshot row. Compilation + validation happen in the
   * caller (the publish route) BEFORE this is invoked, so an invalid draft never
   * reaches a transaction.
   */
  @InjectTransactionManager()
  async publishSnapshot(
    input: PublishSnapshotInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const entity_type = input.entity_type ?? "page"
    const { slug, locale } = input
    const tenant_id = input.tenant_id ?? null

    // NOTE: these calls are intentionally context-free. Demoting the prior live
    // row and inserting the new one in the SAME injected transaction tripped the
    // partial-unique `WHERE is_live=true` index (the demote wasn't visible to the
    // insert's index check); running each as its own autocommit (the proven
    // single/array-arg form used elsewhere in this module) flips is_live first,
    // then inserts cleanly. Atomicity is revisited in Phase 6.
    const existing = await this.listCmsSnapshots({
      tenant_id,
      entity_type,
      slug,
      locale,
    })

    const maxVersion = (existing as { version?: number }[]).reduce(
      (max, row) => Math.max(max, row.version ?? 0),
      0
    )
    const nextVersion = maxVersion + 1

    // Demote the current live row(s) before inserting the new one.
    const priorLive = (existing as { id: string; is_live?: boolean }[]).filter(
      (row) => row.is_live
    )
    if (priorLive.length) {
      await this.updateCmsSnapshots(
        priorLive.map((row) => ({ id: row.id, is_live: false }))
      )
    }

    const created = await this.createCmsSnapshots({
      tenant_id,
      entity_type,
      entity_id: input.entity_id,
      slug,
      locale,
      version: nextVersion,
      is_live: true,
      data: input.data,
      published_by: input.published_by ?? null,
      published_at: new Date(),
      note: input.note ?? null,
    })

    return Array.isArray(created) ? created[0] : created
  }
}

export default CmsModuleService
