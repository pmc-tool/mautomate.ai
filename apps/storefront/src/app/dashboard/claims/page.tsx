import { redirect } from "next/navigation"

/**
 * Removed for Medusa parity: Medusa's admin has no standalone page for this —
 * returns, claims and exchanges are managed from within each order's detail
 * page. Old bookmarks land on the orders list.
 */
export default function RemovedStubRedirect() {
  redirect("/dashboard/orders")
}
