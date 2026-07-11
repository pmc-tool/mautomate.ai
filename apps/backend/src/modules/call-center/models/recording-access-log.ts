import { model } from "@medusajs/framework/utils"

/**
 * call_center_recording_access_log — an append-only audit trail of recording
 * access.
 *
 * Every time a user plays / downloads / exports a call recording, one row is
 * written: `call_id`, `user_id`, `action`, and `accessed_at`. Supports
 * compliance review of who listened to what.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const RecordingAccessLog = model
  .define("call_center_recording_access_log", {
    id: model.id({ prefix: "racclog" }).primaryKey(),
    tenant_id: model.text(),
    call_id: model.text(),
    user_id: model.text(),
    action: model.enum(["play", "download", "export"]),
    accessed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_recording_access_log_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default RecordingAccessLog
