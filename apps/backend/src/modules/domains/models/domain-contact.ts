import { model } from "@medusajs/framework/utils"

/**
 * domain_contact — a registrant/contact profile used when registering or
 * transferring domains. Maps to a ResellerClub customer + contact pair
 * (`reseller_customer_id` + `reseller_contact_id`) which are provisioned on
 * first use and reused thereafter. One profile is the tenant default.
 *
 * MULTI-TENANT (HaaS-ready): `tenant_id` scopes every row.
 */
const DomainContact = model
  .define("domain_contact", {
    id: model.id({ prefix: "dct" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    email: model.text(),
    phone: model.text().nullable(),
    phone_country_code: model.text().nullable(),
    company: model.text().nullable(),
    address_line1: model.text().nullable(),
    address_line2: model.text().nullable(),
    city: model.text().nullable(),
    state: model.text().nullable(),
    postal_code: model.text().nullable(),
    country: model.text().nullable(),
    reseller_customer_id: model.text().nullable(),
    reseller_contact_id: model.text().nullable(),
    is_default: model.boolean().default(false),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_domain_contact_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default DomainContact
