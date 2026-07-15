import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from "../../modules/marketing"

/**
 * Bind a chat conversation to the SIGNED-IN customer behind it.
 *
 * Why this exists: a shopper who is already logged into the store should not be
 * interrogated by the chat bot. Asking a signed-in customer for their order
 * number and the email on the order — data the store is already holding for
 * them — is the hassle this removes.
 *
 * Once the conversation's contact carries a `customer_id`, everything downstream
 * follows for free: Customer360 grounds the reply in who they are, and the
 * order tools stop demanding proof of an identity the storefront already proved.
 *
 * SAFETY: the identity is only ever the one the storefront SERVER proved (see
 * `_identity.ts`) — the browser cannot name a customer it is not logged in as.
 * The binding therefore only ever attaches a shopper to THEMSELVES. What they
 * can then read stays tenant-scoped by the gateway, which AND-s this store's
 * sales channel into every order query: binding your own customer id in a
 * different store shows you your orders IN THAT STORE, and nothing else.
 *
 * Fail closed: anything unexpected leaves the conversation anonymous.
 */
export const bindConversationToCustomer = async (
  container: MedusaContainer,
  input: {
    tenantId: string
    conversation: any
    customerId: string
  }
): Promise<boolean> => {
  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

    // Already bound to this customer -> nothing to do.
    if (input.conversation?.contact_id) {
      const existing = await mk
        .retrieveMarketingContact(input.conversation.contact_id)
        .catch(() => null)
      if (existing?.customer_id === input.customerId) {
        return true
      }
    }

    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "phone"],
      filters: { id: input.customerId } as any,
    })
    const customer = data?.[0]
    if (!customer) {
      return false
    }

    const displayName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      customer.email ||
      null

    // Reuse the tenant's existing contact for this customer when there is one, so
    // a returning shopper keeps one identity across sessions and channels.
    const existing = await mk
      .listMarketingContacts({
        tenant_id: input.tenantId,
        customer_id: input.customerId,
      })
      .catch(() => [])

    let contactId: string | null = Array.isArray(existing)
      ? (existing[0]?.id ?? null)
      : null

    if (contactId) {
      await mk.updateMarketingContacts({
        id: contactId,
        display_name: displayName,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
      } as any)
    } else if (input.conversation?.contact_id) {
      // The conversation already has an anonymous contact (they typed a name
      // before signing in) — promote it rather than orphaning the thread.
      contactId = input.conversation.contact_id
      await mk.updateMarketingContacts({
        id: contactId,
        customer_id: input.customerId,
        display_name: displayName,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
      } as any)
    } else {
      const created = await mk.createMarketingContacts({
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        display_name: displayName,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        primary_channel: "web_widget",
      } as any)
      contactId = (Array.isArray(created) ? created[0] : created)?.id ?? null
    }

    if (!contactId) {
      return false
    }

    if (input.conversation?.contact_id !== contactId) {
      await mk.updateMarketingConversations({
        id: input.conversation.id,
        contact_id: contactId,
      } as any)
    }
    return true
  } catch {
    // Fail closed: an unbound conversation is merely anonymous, which is safe.
    return false
  }
}
