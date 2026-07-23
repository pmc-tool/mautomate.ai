import { model } from "@medusajs/framework/utils"

/**
 * call_center_phone_number — maps a provider phone number (a DID) to ONE tenant
 * and the agent that answers when that number is called.
 *
 * This is the inbound trust anchor for phone: an inbound call is routed purely
 * by the DIALED number (`e164`), so a customer calling tenant A's number can
 * only ever reach tenant A's agent and (through the agent's tools) tenant A's
 * data. The number is globally unique, so there is no cross-tenant ambiguity.
 *
 * MULTI-TENANT: `tenant_id` scopes ownership; `e164` is the globally-unique DID;
 * `agent_id` is the answering call_center_playbook. Indexed unique on `e164`
 * (a number belongs to exactly one tenant) and on `tenant_id`.
 */
const CallCenterPhoneNumber = model
  .define("call_center_phone_number", {
    id: model.id({ prefix: "ccphone" }).primaryKey(),
    tenant_id: model.text(),
    // E.164 dialed number, e.g. "+61480123456". Globally unique.
    e164: model.text(),
    // The agent (call_center_playbook id) that answers this number.
    agent_id: model.text().nullable(),
    provider: model.enum(["twilio", "vonage"]).default("twilio"),
    // Carrier-side id for numbers bought THROUGH the platform (Twilio
    // IncomingPhoneNumber SID / Vonage msisdn). Null for BYO numbers that were
    // registered manually — those are never released at the carrier.
    provider_number_id: model.text().nullable(),
    // ISO country the DID was bought in (Vonage buy/cancel require it).
    country: model.text().nullable(),
    // Operator label, e.g. "Sydney support line".
    label: model.text().nullable(),
    // Inactive numbers reject inbound (fail-closed) without being deleted.
    active: model.boolean().default(true),
  })
  .indexes([
    {
      name: "IDX_cc_phone_e164_unique",
      on: ["e164"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_cc_phone_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CallCenterPhoneNumber
