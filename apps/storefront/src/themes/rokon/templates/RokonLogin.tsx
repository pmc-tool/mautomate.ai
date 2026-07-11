"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the ACCOUNT LOGIN view. Converted from the        */
/* template's login.html: the two side-by-side account__login panels    */
/* (Login / Create an Account). The auth mechanics are EXACTLY the      */
/* shared ones the Learts/Cignet login reuses: the `login` and `signup` */
/* server actions from @lib/data/customer driven by useActionState,     */
/* with the same error and verification_required handling as the shared */
/* Login/Register form components — only the form markup is Rokon's.    */
/* Per the playbook this renders INSIDE the shared account layout's     */
/* container, so the template's full-bleed breadcrumb__bg banner is     */
/* replaced by a contained in-flow heading (see CignetLogin).           */
/* ------------------------------------------------------------------ */

const RokonLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="rokon-theme">
      {/* Contained page heading: this template renders INSIDE the shared
          account layout's content column, so a full-bleed breadcrumb__bg
          banner cannot span the page — use an in-flow title block instead. */}
      <div className="login-page-heading" style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            marginBottom: "8px",
          }}
        >
          Login &amp; Sign Up
        </h1>
        <nav aria-label="Breadcrumb">
          <ul
            className="breadcrumb__content--menu d-flex"
            style={{ marginBottom: 0 }}
          >
            <li className="breadcrumb__content--menu__items">
              <LocalizedClientLink href="/">Home</LocalizedClientLink>
            </li>
            <li className="breadcrumb__content--menu__items">
              <span className="text__secondary">Login &amp; Sign Up</span>
            </li>
          </ul>
        </nav>
      </div>

      {/* Start login section */}
      <div className="login__section">
        <div className="login__section--inner" data-testid="login-page">
          <div className="row row-cols-md-2 row-cols-1">
            <div className="col">
              <div className="account__login">
                <form action={loginAction}>
                  <div className="account__login--header mb-25">
                    <h2 className="account__login--header__title h3 mb-10">
                      Login
                    </h2>
                    <p className="account__login--header__desc">
                      Login if you are a returning customer.
                    </p>
                  </div>
                  <div className="account__login--inner">
                    {loginMessage?.state === "verification_required" && (
                      <p
                        className="account__login--header__desc"
                        data-testid="login-verification-message"
                      >
                        We sent a verification link to{" "}
                        <strong>{loginMessage.email}</strong>. Please verify
                        your email, then sign in.
                      </p>
                    )}

                    <label>
                      <input
                        className="account__login--input"
                        placeholder="Email Address"
                        type="email"
                        name="email"
                        title="Enter a valid email address."
                        autoComplete="email"
                        required
                        data-testid="email-input"
                      />
                    </label>
                    <label>
                      <input
                        className="account__login--input"
                        placeholder="Password"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        required
                        data-testid="password-input"
                      />
                    </label>

                    <ErrorMessage
                      error={
                        loginMessage?.state === "error"
                          ? loginMessage.error
                          : null
                      }
                      data-testid="login-error-message"
                    />

                    <button
                      className="account__login--btn primary__btn"
                      type="submit"
                      data-testid="sign-in-button"
                    >
                      Login
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="col">
              <div className="account__login register" data-testid="register-page">
                <form action={signupAction}>
                  <div className="account__login--header mb-25">
                    <h2 className="account__login--header__title h3 mb-10">
                      Create an Account
                    </h2>
                    <p className="account__login--header__desc">
                      Register here if you are a new customer.
                    </p>
                  </div>
                  <div className="account__login--inner">
                    {signupMessage?.state === "verification_required" && (
                      <p
                        className="account__login--header__desc"
                        data-testid="register-verification-message"
                      >
                        We sent a verification link to{" "}
                        <strong>{signupMessage.email}</strong>. Please check
                        your inbox to verify your email, then sign in.
                      </p>
                    )}

                    <label>
                      <input
                        className="account__login--input"
                        placeholder="First Name"
                        type="text"
                        name="first_name"
                        autoComplete="given-name"
                        required
                        data-testid="first-name-input"
                      />
                    </label>
                    <label>
                      <input
                        className="account__login--input"
                        placeholder="Last Name"
                        type="text"
                        name="last_name"
                        autoComplete="family-name"
                        required
                        data-testid="last-name-input"
                      />
                    </label>
                    <label>
                      <input
                        className="account__login--input"
                        placeholder="Email Address"
                        type="email"
                        name="email"
                        autoComplete="email"
                        required
                        data-testid="email-input"
                      />
                    </label>
                    <label>
                      <input
                        className="account__login--input"
                        placeholder="Phone (optional)"
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        data-testid="phone-input"
                      />
                    </label>
                    <label>
                      <input
                        className="account__login--input"
                        placeholder="Password"
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        required
                        data-testid="password-input"
                      />
                    </label>

                    <p className="account__login--header__desc">
                      Your personal data will be used to support your
                      experience throughout this site, to manage access to
                      your account &amp; for other purposes described in our{" "}
                      <LocalizedClientLink href="/content/privacy-policy">
                        privacy policy.
                      </LocalizedClientLink>
                    </p>

                    <ErrorMessage
                      error={
                        signupMessage?.state === "error"
                          ? signupMessage.error
                          : null
                      }
                      data-testid="register-error"
                    />

                    <button
                      className="account__login--btn primary__btn mb-10"
                      type="submit"
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
      {/* End login section */}
    </div>
  )
}

export default RokonLogin
