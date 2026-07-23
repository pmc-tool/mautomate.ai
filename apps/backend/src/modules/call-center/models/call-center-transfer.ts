import { model } from "@medusajs/framework/utils"

/**
 * call_center_transfer — a live "ring the store team" request created when an
 * AI agent hands a call to a human (transferToHuman tool).
 *
 * Lifecycle: ringing → answered (a merchant clicked Answer in the dashboard;
 * for web calls they join the SAME Daily room as the caller) | declined |
 * missed (nobody answered before the runtime's hold timeout) | canceled (the
 * caller hung up while ringing).
 *
 * The dashboard polls ringing rows (tenant-scoped); the voice runtime polls a
 * single row's status via /telephony/transfer-status while it holds the
 * caller. `channel=phone` rows exist but answer-in-browser for phone legs
 * ships with the live phone rollout (the row schema already carries what that
 * needs).
 */
const CallCenterTransfer = model
  .define("call_center_transfer", {
    id: model.id({ prefix: "cctr" }).primaryKey(),
    tenant_id: model.text(),
    call_id: model.text(),
    status: model
      .enum(["ringing", "answered", "declined", "missed", "canceled"])
      .default("ringing"),
    channel: model.enum(["web", "phone"]).default("web"),
    // Daily room coordinates for web calls (the human joins this room).
    room_url: model.text().nullable(),
    room_name: model.text().nullable(),
    caller_number: model.text().nullable(),
    // Merchant id that answered/declined (audit).
    answered_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_cc_transfer_tenant_status",
      on: ["tenant_id", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cc_transfer_call",
      on: ["call_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CallCenterTransfer
