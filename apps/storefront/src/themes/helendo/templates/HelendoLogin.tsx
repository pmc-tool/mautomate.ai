"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo (furniture) renderer for the ACCOUNT LOGIN view. Converted   */
/* from the template's my-account.html: the account-form-box login and  */
/* register forms rendered side by side (col-lg-6 each) inside          */
/* myaccount-box-wrapper panels. The auth mechanics are EXACTLY the     */
/* shared ones the other themes reuse: the `login` and `signup` server  */
/* actions from @lib/data/customer driven by useActionState, with the   */
/* same error and verification_required handling as the shared          */
/* Login/Register form components — only the markup is Helendo's.       */
/* ------------------------------------------------------------------ */

const HelendoLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="helendo-theme">
      {/* Contained page heading: this template renders INSIDE the shared
          account layout's content column, so a full-bleed breadcrumb-area
          banner cannot span the page — use an in-flow title block instead. */}
      <div className="login-page-heading" style={{ marginBottom: 30 }}>
        <h2 className="breadcrumb-title" style={{ marginBottom: 8 }}>
          My Account
        </h2>
        <ul className="breadcrumb-list" style={{ marginBottom: 0 }}>
          <li className="breadcrumb-item">
            <LocalizedClientLink href="/">Home</LocalizedClientLink>
          </li>
          <li className="breadcrumb-item active">My Account</li>
        </ul>
      </div>

      {/* My-account form area (my-account.html). The template's ptb_120
          spacer is dropped because the page already sits inside the shared
          account layout's padded column. */}
      <div className="my-account-page-warpper">
        <div className="container">
          <div className="row">
            {/* Login form */}
            <div className="col-lg-6 col-md-7">
              <div className="myaccount-box-wrapper" data-testid="login-page">
                <form action={loginAction} className="account-form-box">
                  <h6>Login your account</h6>

                  {loginMessage?.state === "verification_required" && (
                    <p
                      className="mt-15"
                      data-testid="login-verification-message"
                    >
                      We sent a verification link to{" "}
                      <strong>{loginMessage.email}</strong>. Please verify your
                      email, then sign in.
                    </p>
                  )}

                  <div className="single-input">
                    <input
                      type="email"
                      name="email"
                      placeholder="Email address"
                      title="Enter a valid email address."
                      autoComplete="email"
                      required
                      data-testid="email-input"
                    />
                  </div>
                  <div className="single-input">
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      required
                      data-testid="password-input"
                    />
                  </div>

                  <ErrorMessage
                    error={
                      loginMessage?.state === "error"
                        ? loginMessage.error
                        : null
                    }
                    data-testid="login-error-message"
                  />

                  <div className="button-box mt-25">
                    <button
                      type="submit"
                      className="btn btn--full btn--black"
                      data-testid="sign-in-button"
                    >
                      Log in
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Register form */}
            <div className="col-lg-6 col-md-7">
              <div
                className="myaccount-box-wrapper"
                data-testid="register-page"
              >
                <form action={signupAction} className="account-form-box">
                  <h6>Register An Account</h6>

                  {signupMessage?.state === "verification_required" && (
                    <p
                      className="mt-15"
                      data-testid="register-verification-message"
                    >
                      We sent a verification link to{" "}
                      <strong>{signupMessage.email}</strong>. Please check your
                      inbox to verify your email, then sign in.
                    </p>
                  )}

                  <div className="single-input">
                    <input
                      type="text"
                      name="first_name"
                      placeholder="First name"
                      autoComplete="given-name"
                      required
                      data-testid="first-name-input"
                    />
                  </div>
                  <div className="single-input">
                    <input
                      type="text"
                      name="last_name"
                      placeholder="Last name"
                      autoComplete="family-name"
                      required
                      data-testid="last-name-input"
                    />
                  </div>
                  <div className="single-input">
                    <input
                      type="email"
                      name="email"
                      placeholder="Email address"
                      autoComplete="email"
                      required
                      data-testid="email-input"
                    />
                  </div>
                  <div className="single-input">
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Phone (optional)"
                      autoComplete="tel"
                      data-testid="phone-input"
                    />
                  </div>
                  <div className="single-input">
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      autoComplete="new-password"
                      required
                      data-testid="password-input"
                    />
                  </div>

                  <p className="mt-15">
                    Your personal data will be used to support your experience
                    throughout this website, to manage access to your account,
                    and for other purposes described in our{" "}
                    <LocalizedClientLink
                      href="/content/privacy-policy"
                      className="privacy-policy-link"
                    >
                      privacy policy
                    </LocalizedClientLink>
                    .
                  </p>

                  <ErrorMessage
                    error={
                      signupMessage?.state === "error"
                        ? signupMessage.error
                        : null
                    }
                    data-testid="register-error"
                  />

                  <div className="button-box mt-25">
                    <button
                      type="submit"
                      className="btn btn--full btn--black"
                      data-testid="register-button"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelendoLogin
