import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { dispatchOrderEmail } from "../modules/marketing/email/dispatch"

/** order.canceled -> the customer's order-canceled email. */
export default async function ({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await dispatchOrderEmail(container, data?.id, "order_canceled")
}
export const config: SubscriberConfig = { event: "order.canceled" }
