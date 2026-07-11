import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { dispatchFulfillmentEmail } from "../modules/marketing/email/dispatch"

/** shipment.created -> the customer's "order shipped" email (with tracking). */
export default async function ({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await dispatchFulfillmentEmail(container, data?.id, "order_shipped")
}
export const config: SubscriberConfig = { event: "shipment.created" }
