"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro (fashion) renderer for the ACCOUNT LOGIN view. The template   */
/* mirror ships NO login page, so this follows CignetLogin/ShofyLogin:  */
/* it renders INSIDE the shared account layout's container with a       */
/* contained in-flow heading (no full-bleed page-title banner) and two  */
/* side-by-side Login / Sign up panels styled with the template's own   */
/* form classes (product-details-review-input-box, aq-form-label,       */
/* aq-form-control, aq-btn-black). The auth mechanics are EXACTLY the   */
/* shared ones: the `login` and `signup` server actions from            */
/* @lib/data/customer driven by useActionState, with the same error     */
/* and verification_required handling as the shared Login/Register      */
/* form components — only the form markup is Bazaro's.                  */
/* ------------------------------------------------------------------ */

const BazaroLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="bazaro-theme">
      {/* Contained page heading: this template renders INSIDE the shared
          account layout's content column, so a full-bleed breadcrumb banner
          cannot span the page — use an in-flow title block instead. */}
      <div className="login-page-heading" style={{ marginBottom: 30 }}>
        <h1
          className="aq-breadcrumb-title"
          style={{
            fontFamily: '"Satoshi-Medium", sans-serif',
            color: "#141414",
            fontSize: "clamp(28px, 4vw, 42px)",
            marginBottom: 8,
          }}
        >
          Login &amp; Sign Up
        </h1>
        <nav>
          <div className="pd-breadcrumb-list" style={{ marginBottom: 0 }}>
            <span>
              <LocalizedClientLink href="/">home</LocalizedClientLink>
            </span>
            <span>/</span>
            <span>login &amp; sign up</span>
          </div>
        </nav>
      </div>

      {/* login area start */}
      <div className="aq-login-area pb-60">
        <div className="container">
          <div className="row" data-testid="login-page">
            {/* Login panel */}
            <div className="col-lg-6 mb-40">
              <form action={loginAction}>
                <div className="aq-login-form-content">
                  <h4
                    className="ff-satoshi-med mb-10"
                    style={{ color: "#141414", fontSize: 24 }}
                  >
                    Login your account
                  </h4>
                  <p className="mb-25">
                    Access your account to see your orders and continue where
                    you left off. Enter your details below to continue.
                  </p>

                  {loginMessage?.state === "verification_required" && (
                    <div
                      className="aq-login-form-info mb-20"
                      data-testid="login-verification-message"
                    >
                      <p>
                        We sent a verification link to{" "}
                        <strong>{loginMessage.email}</strong>. Please verify
                        your email, then sign in.
                      </p>
                    </div>
                  )}

                  <div className="product-details-review-input-wrapper">
                    <div className="product-details-review-input-box">
                      <label className="aq-form-label" htmlFor="login-email">
                        Email address *
                      </label>
                      <input
                        id="login-email"
                        className="aq-form-control"
                        type="email"
                        name="email"
                        placeholder="Enter your e-mail"
                        title="Enter a valid email address."
                        autoComplete="email"
                        required
                        data-testid="email-input"
                      />
                    </div>

                    <div className="product-details-review-input-box">
                      <label className="aq-form-label" htmlFor="login-password">
                        Password *
                      </label>
                      <input
                        id="login-password"
                        className="aq-form-control"
                        type="password"
                        name="password"
                        placeholder="Enter password"
                        autoComplete="current-password"
                        required
                        data-testid="password-input"
                      />
                    </div>
                  </div>

                  <ErrorMessage
                    error={
                      loginMessage?.state === "error"
                        ? loginMessage.error
                        : null
                    }
                    data-testid="login-error-message"
                  />

                  <div className="aq-login-btn-wrap mt-25">
                    <button
                      type="submit"
                      className="aq-btn-black"
                      data-testid="sign-in-button"
                    >
                      Login
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Sign up panel */}
            <div className="col-lg-6 mb-40">
              <form action={signupAction}>
                <div
                  className="aq-login-form-content"
                  data-testid="register-page"
                >
                  <h4
                    className="ff-satoshi-med mb-10"
                    style={{ color: "#141414", fontSize: 24 }}
                  >
                    Sign up your account
                  </h4>
                  <p className="mb-25">
                    Create your account in a few steps to shop faster and keep
                    track of your orders.
                  </p>

                  {signupMessage?.state === "verification_required" && (
                    <div
                      className="aq-login-form-info mb-20"
                      data-testid="register-verification-message"
                    >
                      <p>
                        We sent a verification link to{" "}
                        <strong>{signupMessage.email}</strong>. Please check
                        your inbox to verify your email, then sign in.
                      </p>
                    </div>
                  )}

                  <div className="product-details-review-input-wrapper">
                    <div className="product-details-review-input-box">
                      <label
                        className="aq-form-label"
                        htmlFor="register-first-name"
                      >
                        First name *
                      </label>
                      <input
                        id="register-first-name"
                        className="aq-form-control"
                        type="text"
                        name="first_name"
                        placeholder="Enter first name"
                        autoComplete="given-name"
                        required
                        data-testid="first-name-input"
                      />
                    </div>

                    <div className="product-details-review-input-box">
                      <label
                        className="aq-form-label"
                        htmlFor="register-last-name"
                      >
                        Last name *
                      </label>
                      <input
                        id="register-last-name"
                        className="aq-form-control"
                        type="text"
                        name="last_name"
                        placeholder="Enter last name"
                        autoComplete="family-name"
                        required
                        data-testid="last-name-input"
                      />
                    </div>

                    <div className="product-details-review-input-box">
                      <label className="aq-form-label" htmlFor="register-email">
                        Email address *
                      </label>
                      <input
                        id="register-email"
                        className="aq-form-control"
                        type="email"
                        name="email"
                        placeholder="Enter your e-mail"
                        autoComplete="email"
                        required
                        data-testid="email-input"
                      />
                    </div>

                    <div className="product-details-review-input-box">
                      <label className="aq-form-label" htmlFor="register-phone">
                        Phone
                      </label>
                      <input
                        id="register-phone"
                        className="aq-form-control"
                        type="tel"
                        name="phone"
                        placeholder="Enter phone number"
                        autoComplete="tel"
                        data-testid="phone-input"
                      />
                    </div>

                    <div className="product-details-review-input-box">
                      <label
                        className="aq-form-label"
                        htmlFor="register-password"
                      >
                        Password *
                      </label>
                      <input
                        id="register-password"
                        className="aq-form-control"
                        type="password"
                        name="password"
                        placeholder="Enter password"
                        autoComplete="new-password"
                        required
                        data-testid="password-input"
                      />
                    </div>
                  </div>

                  <div className="aq-login-form-info mt-15">
                    <p>
                      Your personal data will be used to support your
                      experience throughout this site, to manage access to your
                      account &amp; for other purposes described in our{" "}
                      <LocalizedClientLink href="/content/privacy-policy">
                        privacy policy.
                      </LocalizedClientLink>
                    </p>
                  </div>

                  <ErrorMessage
                    error={
                      signupMessage?.state === "error"
                        ? signupMessage.error
                        : null
                    }
                    data-testid="register-error"
                  />

                  <div className="aq-login-btn-wrap mt-25">
                    <button
                      type="submit"
                      className="aq-btn-black"
                      data-testid="register-button"
                    >
                      Register
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* login area end */}
    </div>
  )
}

export default BazaroLogin
