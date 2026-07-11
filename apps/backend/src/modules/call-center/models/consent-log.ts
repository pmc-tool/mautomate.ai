import { model } from "@medusajs/framework/utils"

/**
 * call_center_consent_log — an append-only audit trail of consent changes.
 *
 * Every mutation to a phone's consent writes one row: `action` (what happened),
 * optional `purpose`, `actor` (who/what did it), and `consent_id` linking to the
 * affected call_center_consent row when known.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const ConsentLog = model
  .define("call_center_consent_log", {
    id: model.id({ prefix: "conlog" }).primaryKey(),
    tenant_id: model.text(),
    phone: model.text(),
    consent_id: model.text().nullable(),
    action: model.text(),
    purpose: model.text().nullable(),
    actor: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_consent_log_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default ConsentLog
