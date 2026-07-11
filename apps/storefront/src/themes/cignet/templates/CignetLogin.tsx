"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet (jewellery) renderer for the ACCOUNT LOGIN view. Converted    */
/* from the template's login.html: page header + breadcrumb and the     */
/* two side-by-side login-content-form-item panels (Login / Sign up).   */
/* The auth mechanics are EXACTLY the shared ones the Aurora login      */
/* reuses: the `login` and `signup` server actions from                 */
/* @lib/data/customer driven by useActionState, with the same error     */
/* and verification_required handling as the shared Login/Register     */
/* form components — only the form markup is the Cignet template's.     */
/* ------------------------------------------------------------------ */

const CignetLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="cignet-theme">
      {/* Contained page heading: this template renders INSIDE the shared
          account layout's content column, so a full-bleed page-header banner
          cannot span the page — use an in-flow title block instead. */}
      <div className="login-page-heading" style={{ marginBottom: 30 }}>
        <h1
          style={{
            fontFamily: "var(--accent-font)",
            color: "var(--primary-color)",
            fontSize: "clamp(28px, 4vw, 42px)",
            marginBottom: 8,
          }}
        >
          Login &amp; Sign Up
        </h1>
        <nav>
          <ol className="breadcrumb" style={{ marginBottom: 0 }}>
            <li className="breadcrumb-item">
              <LocalizedClientLink href="/">home</LocalizedClientLink>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Login &amp; Sign Up
            </li>
          </ol>
        </nav>
      </div>

      {/* Page Login Section Start */}
      <div className="page-login">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              {/* Login Content Box Start */}
              <div className="login-content-box" data-testid="login-page">
                {/* Login Content Form Item Start */}
                <div className="login-content-form-item">
                  <form action={loginAction}>
                    <div className="login-form-content">
                      <div className="login-content-title-box">
                        <h2 className="text-anime-style-3">
                          Login your account
                        </h2>
                        <p className="wow fadeInUp">
                          Access your account to explore our latest collections
                          and track your orders. Enter your details below to
                          continue your journey with us.
                        </p>
                      </div>

                      <div className="checkout-login-form wow fadeInUp">
                        {loginMessage?.state === "verification_required" && (
                          <div
                            className="login-form-info"
                            data-testid="login-verification-message"
                          >
                            <p>
                              We sent a verification link to{" "}
                              <strong>{loginMessage.email}</strong>. Please
                              verify your email, then sign in.
                            </p>
                          </div>
                        )}

                        <div className="form-group">
                          <label>Email address *</label>
                          <input
                            type="email"
                            name="email"
                            className="form-control"
                            placeholder="Enter your e-mail"
                            title="Enter a valid email address."
                            autoComplete="email"
                            required
                            data-testid="email-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>Password *</label>
                          <input
                            type="password"
                            name="password"
                            className="form-control"
                            placeholder="Enter password"
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

                        <div className="checkout-login-form-footer">
                          <div className="checkout-login-btn">
                            <button
                              type="submit"
                              className="btn-default"
                              data-testid="sign-in-button"
                            >
                              Login
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
                {/* Login Content Form Item End */}

                {/* Login Content Form Item Start */}
                <div className="login-content-form-item">
                  <form action={signupAction}>
                    <div className="login-form-content">
                      <div className="login-content-title-box">
                        <h2 className="text-anime-style-3">
                          Sign up your account
                        </h2>
                        <p className="wow fadeInUp">
                          Sign up to explore our exclusive collections and track
                          your orders. Create your account in just a few steps.
                        </p>
                      </div>

                      <div
                        className="checkout-login-form wow fadeInUp"
                        data-testid="register-page"
                      >
                        {signupMessage?.state === "verification_required" && (
                          <div
                            className="login-form-info"
                            data-testid="register-verification-message"
                          >
                            <p>
                              We sent a verification link to{" "}
                              <strong>{signupMessage.email}</strong>. Please
                              check your inbox to verify your email, then sign
                              in.
                            </p>
                          </div>
                        )}

                        <div className="form-group">
                          <label>First name *</label>
                          <input
                            type="text"
                            name="first_name"
                            className="form-control"
                            placeholder="Enter first name"
                            autoComplete="given-name"
                            required
                            data-testid="first-name-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>Last name *</label>
                          <input
                            type="text"
                            name="last_name"
                            className="form-control"
                            placeholder="Enter last name"
                            autoComplete="family-name"
                            required
                            data-testid="last-name-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>Email address *</label>
                          <input
                            type="email"
                            name="email"
                            className="form-control"
                            placeholder="Enter your e-mail"
                            autoComplete="email"
                            required
                            data-testid="email-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>Phone</label>
                          <input
                            type="tel"
                            name="phone"
                            className="form-control"
                            placeholder="Enter phone number"
                            autoComplete="tel"
                            data-testid="phone-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>Password *</label>
                          <input
                            type="password"
                            name="password"
                            className="form-control"
                            placeholder="Enter password"
                            autoComplete="new-password"
                            required
                            data-testid="password-input"
                          />
                        </div>

                        <div className="login-form-info">
                          <p>
                            Your personal data will be used to support your
                            experience throughout this site, to manage access to
                            your account &amp; for other purposes described in
                            our{" "}
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

                        <div className="checkout-login-btn signup-form-btn">
                          <button
                            type="submit"
                            className="btn-default"
                            data-testid="register-button"
                          >
                            Register
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
                {/* Login Content Form Item End */}
              </div>
              {/* Login Content Box End */}
            </div>
          </div>
        </div>
      </div>
      {/* Page Login Section End */}
    </div>
  )
}

export default CignetLogin
