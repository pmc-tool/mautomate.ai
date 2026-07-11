import { model } from "@medusajs/framework/utils"

/**
 * marketing_contact — a person the tenant converses with across inbox channels.
 *
 * A unified identity that a conversation can attach to, optionally linked to a
 * core Customer via `customer_id`. `primary_channel` records where the contact
 * is most reachable; `tags`/`meta` carry free-form segmentation data.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; the composite
 * (tenant_id, customer_id) index backs customer-linked lookups.
 */
const MarketingContact = model
  .define("marketing_contact", {
    id: model.id({ prefix: "mcont" }).primaryKey(),
    tenant_id: model.text(),
    display_name: model.text().nullable(),
    avatar_url: model.text().nullable(),
    primary_channel: model.text().nullable(),
    customer_id: model.text().nullable(),
    phone: model.text().nullable(),
    email: model.text().nullable(),
    tags: model.json().nullable(),
    meta: model.json().nullable(),
    // Marketing Brain: engagement score + email consent lifecycle.
    score: model.number().default(0),
    consent_at: model.dateTime().nullable(),
    unsubscribed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_contact_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_contact_tenant_customer",
      on: ["tenant_id", "customer_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingContact
