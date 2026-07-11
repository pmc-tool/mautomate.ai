import { model } from "@medusajs/framework/utils"

/**
 * marketing_email_template — a reusable email definition (subject + body + kind).
 *
 * `html` holds the rendered/authored body (handlebars-style {{tokens}} allowed,
 * resolved at send time against contact/product/order context). `kind` groups
 * templates by purpose so the composer and journeys can filter them.
 *
 * MULTI-TENANT: `tenant_id` scopes every row.
 */
const MarketingEmailTemplate = model
  .define("marketing_email_template", {
    id: model.id({ prefix: "metpl" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    key: model.text().nullable(),
    subject: model.text().nullable(),
    preheader: model.text().nullable(),
    html: model.text().nullable(),
    kind: model
      .enum(["broadcast", "transactional", "journey", "recovery"])
      .default("broadcast"),
    from_name: model.text().nullable(),
    from_email: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_email_template_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_email_template_tenant_kind",
      on: ["tenant_id", "kind"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingEmailTemplate
