import { model } from "@medusajs/framework/utils"

/**
 * cms_audit_log — one row per CMS write.
 *
 * Written best-effort on every settings WRITE: actor, action, entity, key,
 * before/after snapshots, timestamp. `created_at` is added automatically by the
 * DML (alongside updated_at/deleted_at). `actor_email` is intentionally
 * denormalized — it records who the actor was AT THE TIME of the write.
 */
const CmsAuditLog = model
  .define("cms_audit_log", {
    id: model.id({ prefix: "cmsaud" }).primaryKey(),
    tenant_id: model.text().nullable(),
    actor_id: model.text(),
    actor_email: model.text().nullable(),
    action: model.text(),
    entity_type: model.text().nullable(),
    entity_key: model.text().nullable(),
    before: model.json().nullable(),
    after: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_cms_audit_log_entity_key",
      on: ["entity_key"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsAuditLog
