import { redirect } from "next/navigation"

/**
 * Legacy route: /dashboard/discounts/[id] is replaced by the Promotions UX.
 * Discounts were already Medusa promotions under the hood (same ids), so deep
 * links keep working by redirecting to the new promotion detail page.
 */
export default async function LegacyDiscountDetailRedirect({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/promotions/${id}`)
}
