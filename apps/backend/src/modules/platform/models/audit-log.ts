import { model } from "@medusajs/framework/utils"

/**
 * audit_log — the immutable, append-only record of every SUPER-ADMIN /
 * cross-tenant action (list, suspend, impersonate, retry, config read). The
 * review required this for insider-risk: impersonation and cross-tenant access
 * must be logged and surfaceable to the affected tenant. Never updated/deleted.
 */
const AuditLog = model
  .define("audit_log", {
    id: model.id({ prefix: "alog" }).primaryKey(),
    actor: model.text(), // super-admin user id / email
    action: model.text(), // tenant.suspend, tenant.impersonate, ...
    tenant_id: model.text().nullable(),
    ip: model.text().nullable(),
    outcome: model.enum(["success", "denied", "error"]).default("success"),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_audit_log_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_audit_log_actor",
      on: ["actor"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default AuditLog
