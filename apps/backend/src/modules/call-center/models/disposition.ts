import { model } from "@medusajs/framework/utils"

/**
 * call_center_disposition — the recorded outcome of a call.
 *
 * A structured wrap-up for `call_id`: `outcome` + optional `reason` / `notes` /
 * arbitrary `data`, plus `set_by` (who/what dispositioned it).
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const Disposition = model
  .define("call_center_disposition", {
    id: model.id({ prefix: "cdisp" }).primaryKey(),
    tenant_id: model.text(),
    call_id: model.text(),
    outcome: model.text(),
    reason: model.text().nullable(),
    notes: model.text().nullable(),
    data: model.json().nullable(),
    set_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_disposition_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Disposition
