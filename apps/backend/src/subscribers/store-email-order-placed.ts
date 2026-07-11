import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { dispatchOrderEmail } from "../modules/marketing/email/dispatch"

/** order.placed -> the customer's order-confirmation email. */
export default async function ({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await dispatchOrderEmail(container, data?.id, "order_confirmation")
}
export const config: SubscriberConfig = { event: "order.placed" }
