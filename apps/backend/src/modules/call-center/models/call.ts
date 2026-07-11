import { model } from "@medusajs/framework/utils"
import CallAttempt from "./call-attempt"

/**
 * call_center_call — one telephony call (inbound or outbound).
 *
 * The central record for a placed/received call: who/what it relates to
 * (order_id, customer_id), how it dialed (from_number/to_number/direction),
 * which playbook drove it, and the AI/telephony outcome (status, disposition,
 * summary, sentiment, recording_url, transcript, cost_total). One call can have
 * multiple `attempts` (call_center_call_attempt) when redialed.
 *
 * MULTI-TENANT: `tenant_id` scopes every row to a tenant (single-tenant run uses
 * a default constant). Indexed on tenant_id for scoped reads.
 */
const Call = model
  .define("call_center_call", {
    id: model.id({ prefix: "call" }).primaryKey(),
    tenant_id: model.text(),
    order_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    direction: model.enum(["inbound", "outbound"]),
    status: model
      .enum([
        "queued",
        "dialing",
        "in_progress",
        "completed",
        "failed",
        "no_answer",
        "voicemail",
        "canceled",
      ])
      .default("queued"),
    from_number: model.text().nullable(),
    to_number: model.text().nullable(),
    locale: model.text().nullable(),
    playbook_id: model.text().nullable(),
    playbook_version: model.text().nullable(),
    disposition: model.text().nullable(),
    summary: model.text().nullable(),
    sentiment: model.text().nullable(),
    recording_url: model.text().nullable(),
    transcript: model.json().nullable(),
    cost_total: model.number().default(0),
    provider_call_id: model.text().nullable(),
    campaign_id: model.text().nullable(),
    started_at: model.dateTime().nullable(),
    ended_at: model.dateTime().nullable(),
    attempts: model.hasMany(() => CallAttempt, { mappedBy: "call" }),
  })
  .indexes([
    {
      name: "IDX_call_center_call_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Call
