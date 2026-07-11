import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { dispatchFulfillmentEmail } from "../modules/marketing/email/dispatch"

/** delivery.created -> the customer's "order delivered" email. */
export default async function ({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await dispatchFulfillmentEmail(container, data?.id, "order_delivered")
}
export const config: SubscriberConfig = { event: "delivery.created" }
