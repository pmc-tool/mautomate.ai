import { Metadata } from "next"

import ResetPasswordTemplate from "@modules/account/templates/reset-password-template"

// Dynamic: this recovery page reads live URL params (token/email) and must not
// be statically prerendered. Reachable while signed out — it is NOT under the
// /account chrome and has no auth guard.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new password for your account.",
}

export default async function ResetPasswordPage(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  return <ResetPasswordTemplate countryCode={countryCode} />
}
