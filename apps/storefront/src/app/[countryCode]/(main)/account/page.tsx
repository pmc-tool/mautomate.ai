import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"
import Overview from "@modules/account/components/overview"
import { getActiveTheme } from "@themes/registry"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"

// Dynamic: reads the customer session (and, multi-tenant, the tenant from
// headers). This route replaced the former @login/@dashboard parallel slots,
// which triggered a Next.js 15 route-group+parallel-route manifest bug (500).
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Account",
  description: "Overview of your account activity.",
}

export default async function AccountPage() {
  const customer = await retrieveCustomer().catch(() => null)

  // Signed out -> the login form (theme-specific when the active theme provides one).
  if (!customer) {
    const activeTheme = await getActiveTheme()
    const LoginView = activeTheme.templates?.login ?? LoginTemplate
    return <LoginView />
  }

  // Signed in -> the account overview.
  const orders = (await listOrders().catch(() => null)) || null
  return <Overview customer={customer} orders={orders} />
}
