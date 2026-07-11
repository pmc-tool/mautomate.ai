import { Metadata } from "next"
import { MerchantAuthProvider } from "@lib/merchant-admin/auth"
import { PageShell } from "@components/merchant-admin/page-shell"

export const metadata: Metadata = {
  title: "Merchant Admin",
  description: "mAutomate merchant administration",
}

export default function MerchantAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MerchantAuthProvider>
      <PageShell>{children}</PageShell>
    </MerchantAuthProvider>
  )
}
