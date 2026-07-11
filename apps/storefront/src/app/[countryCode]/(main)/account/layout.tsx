import { retrieveCustomer } from "@lib/data/customer"
import AccountLayout from "@modules/account/templates/account-layout"

// Dynamic: the account chrome depends on the customer session (and, multi-tenant,
// the tenant resolved from headers). Was previously split across @login/@dashboard
// parallel slots — collapsed into a single route to avoid a Next.js 15 parallel-
// route manifest crash. AccountLayout renders the signed-in nav or bare login
// chrome based on `customer`.
export const dynamic = "force-dynamic"

export default async function AccountPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const customer = await retrieveCustomer().catch(() => null)

  return <AccountLayout customer={customer}>{children}</AccountLayout>
}
