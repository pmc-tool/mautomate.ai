import { model } from "@medusajs/framework/utils"

/**
 * call_center_consent — the current consent state for a phone number.
 *
 * Tracks whether `phone` may be called for a given `purpose` (transactional vs
 * marketing): `status` is granted / revoked / dnc (do-not-call). `source`,
 * `jurisdiction`, and `proof` capture provenance for compliance.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const Consent = model
  .define("call_center_consent", {
    id: model.id({ prefix: "consent" }).primaryKey(),
    tenant_id: model.text(),
    phone: model.text(),
    purpose: model.enum(["transactional", "marketing"]),
    status: model.enum(["granted", "revoked", "dnc"]).default("granted"),
    source: model.text().nullable(),
    jurisdiction: model.text().nullable(),
    proof: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_call_center_consent_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Consent
