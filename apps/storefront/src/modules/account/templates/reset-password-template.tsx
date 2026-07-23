"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"

import { updateCustomerPassword } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"

type Props = {
  countryCode: string
}

// Customer-facing recovery confirmation page. Reachable while SIGNED OUT: it is
// opened from the link in the reset email (/reset-password?token=&email=) and
// sets a new password via the tenant-scoped customer auth provider.
const ResetPasswordTemplate = ({ countryCode }: Props) => {
  const [token, setToken] = useState("")
  const [email, setEmail] = useState("")
  const [state, formAction] = useActionState(updateCustomerPassword, null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token") || "")
    setEmail(params.get("email") || "")
  }, [])

  const accountHref = `/${countryCode}/account`

  return (
    <div className="w-full flex justify-center px-8 py-12">
      <div className="max-w-sm w-full flex flex-col items-center">
        <h1 className="text-large-semi uppercase mb-6">Set a new password</h1>

        {state?.state === "success" ? (
          <div className="w-full flex flex-col items-center gap-y-4">
            <p
              className="text-center text-base-regular text-ui-fg-base"
              data-testid="reset-success-message"
              role="status"
            >
              Your password has been updated. You can now sign in with your new
              password.
            </p>
            <Link
              href={accountHref}
              className="underline text-ui-fg-base text-small-regular"
              data-testid="go-to-login-link"
            >
              Continue to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-center text-base-regular text-ui-fg-base mb-8">
              {email ? (
                <>
                  Choose a new password for{" "}
                  <strong>{email}</strong>.
                </>
              ) : (
                "Choose a new password for your account."
              )}
            </p>
            <form className="w-full" action={formAction}>
              <input type="hidden" name="token" value={token} readOnly />
              <div className="flex flex-col w-full gap-y-2">
                <Input
                  label="New password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  data-testid="new-password-input"
                />
                <Input
                  label="Confirm new password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  data-testid="confirm-password-input"
                />
              </div>
              <p className="text-small-regular text-ui-fg-subtle mt-2">
                At least 8 characters.
              </p>
              <ErrorMessage
                error={state?.state === "error" ? state.error : null}
                data-testid="reset-password-error-message"
              />
              <SubmitButton
                data-testid="set-new-password-button"
                className="w-full mt-6"
              >
                Set new password
              </SubmitButton>
            </form>
            <Link
              href={accountHref}
              className="underline text-ui-fg-base text-small-regular mt-6"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordTemplate
