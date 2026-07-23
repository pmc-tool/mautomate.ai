"use client"

import { useActionState, useState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)
  const [password, setPassword] = useState("")

  const passwordChecks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
    { label: "A special character", ok: /[^A-Za-z0-9]/.test(password) },
  ]

  return (
    <div
      className="max-w-sm flex flex-col items-center"
      data-testid="register-page"
    >
      <h1 className="text-large-semi uppercase mb-6">Create account</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-4">
        Create your member profile, and get access to an enhanced shopping
        experience.
      </p>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-4 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="register-verification-message"
        >
          We sent a verification link to <strong>{message.email}</strong>.
          Please check your inbox to verify your email, then sign in.
        </div>
      )}
      <form className="w-full flex flex-col" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="First name"
            name="first_name"
            required
            pattern=".*\S.*"
            title="First name cannot be blank"
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label="Last name"
            name="last_name"
            required
            pattern=".*\S.*"
            title="Last name cannot be blank"
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            label="Email"
            name="email"
            required
            type="email"
            pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
            title="Enter a valid email address, like name@example.com"
            autoComplete="email"
            data-testid="email-input"
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            label="Password"
            name="password"
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            data-testid="password-input"
          />
          {password.length > 0 && (
            <ul className="text-small-regular text-ui-fg-subtle grid grid-cols-1 gap-y-0.5 px-1">
              {passwordChecks.map((check) => (
                <li
                  key={check.label}
                  className={check.ok ? "text-ui-fg-interactive" : undefined}
                >
                  {check.ok ? "✓" : "•"} {check.label}
                </li>
              ))}
            </ul>
          )}
          <Input
            label="Confirm password"
            name="confirm_password"
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            data-testid="confirm-password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="register-error"
        />
        <label className="flex items-start gap-x-2 text-ui-fg-base text-small-regular mt-6 cursor-pointer">
          <input
            type="checkbox"
            name="terms_accepted"
            required
            className="mt-0.5"
            data-testid="terms-checkbox"
          />
          <span>
            I agree to the{" "}
            <LocalizedClientLink href="/terms-of-use" className="underline">
              Terms of Use
            </LocalizedClientLink>{" "}
            and{" "}
            <LocalizedClientLink href="/privacy-policy" className="underline">
              Privacy Policy
            </LocalizedClientLink>
            .
          </span>
        </label>
        <SubmitButton className="w-full mt-6" data-testid="register-button">
          Join
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        Already a member?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="underline"
        >
          Sign in
        </button>
        .
      </span>
    </div>
  )
}

export default Register
