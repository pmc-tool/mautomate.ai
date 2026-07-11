"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo (electronics) renderer for the ACCOUNT LOGIN view. The template */
/* ships no login page, so this is built from Exzo's own form building  */
/* blocks (.simple-input rounded inputs, .checkbox-entry labels, the    */
/* .button.size-2.style-3 lime submit button and the .title-underline   */
/* headings), mirroring CignetLogin's structure: two side-by-side       */
/* panels (Login / Sign up). The auth mechanics are EXACTLY the shared  */
/* ones: the `login` and `signup` server actions from @lib/data/customer*/
/* driven by useActionState, with the same error and                    */
/* verification_required handling as the shared Login/Register form     */
/* components. Per the playbook this renders INSIDE the shared account  */
/* layout's content column — a contained in-flow heading, NO full-bleed */
/* banner.                                                              */
/* ------------------------------------------------------------------ */

const ExzoLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="exzo-theme">
      {/* Contained page heading: this template renders INSIDE the shared
          account layout's content column, so a full-bleed banner cannot
          span the page — use an in-flow title block instead. */}
      <div className="exzo-login-heading col-xs-b30">
        <div className="breadcrumbs" style={{ marginBottom: 10 }}>
          <LocalizedClientLink href="/" style={{ color: "#b8cd06" }}>
            home
          </LocalizedClientLink>
          <a>my account</a>
        </div>
        <div className="simple-article size-3 grey uppercase col-xs-b5">
          my account
        </div>
        <div className="h3">login or create an account</div>
        <div className="title-underline">
          <span></span>
        </div>
      </div>

      <div className="empty-space col-xs-b30"></div>

      {/* Login Content Start */}
      <div className="row" data-testid="login-page">
        {/* Login Panel Start */}
        <div className="col-md-6 col-xs-b50 col-md-b0">
          <form action={loginAction}>
            <div className="h5 col-xs-b10">login your account</div>
            <div className="simple-article size-2 col-xs-b25">
              Access your orders, addresses and details. Enter your
              credentials below to continue.
            </div>

            {loginMessage?.state === "verification_required" && (
              <div
                className="simple-article size-2 col-xs-b20"
                data-testid="login-verification-message"
              >
                <p>
                  We sent a verification link to{" "}
                  <strong>{loginMessage.email}</strong>. Please verify your
                  email, then sign in.
                </p>
              </div>
            )}

            <input
              className="simple-input"
              type="email"
              name="email"
              placeholder="Email address *"
              title="Enter a valid email address."
              autoComplete="email"
              required
              data-testid="email-input"
            />
            <div className="empty-space col-xs-b20"></div>

            <input
              className="simple-input"
              type="password"
              name="password"
              placeholder="Password *"
              autoComplete="current-password"
              required
              data-testid="password-input"
            />
            <div className="empty-space col-xs-b20"></div>

            <label className="checkbox-entry">
              <input type="checkbox" name="remember_me" />
              <span>remember me</span>
            </label>
            <div className="empty-space col-xs-b20"></div>

            <ErrorMessage
              error={
                loginMessage?.state === "error" ? loginMessage.error : null
              }
              data-testid="login-error-message"
            />

            <button
              type="submit"
              className="button size-2 style-3"
              data-testid="sign-in-button"
            >
              <span className="button-wrapper">
                <span className="icon">
                  <i className="fa fa-unlock-alt" aria-hidden="true"></i>
                </span>
                <span className="text">login</span>
              </span>
            </button>
          </form>
        </div>
        {/* Login Panel End */}

        {/* Sign Up Panel Start */}
        <div className="col-md-6">
          <form action={signupAction}>
            <div className="h5 col-xs-b10">sign up your account</div>
            <div className="simple-article size-2 col-xs-b25">
              Create an account to shop faster, track your orders and keep
              your details in one place.
            </div>

            <div data-testid="register-page">
              {signupMessage?.state === "verification_required" && (
                <div
                  className="simple-article size-2 col-xs-b20"
                  data-testid="register-verification-message"
                >
                  <p>
                    We sent a verification link to{" "}
                    <strong>{signupMessage.email}</strong>. Please check your
                    inbox to verify your email, then sign in.
                  </p>
                </div>
              )}

              <input
                className="simple-input"
                type="text"
                name="first_name"
                placeholder="First name *"
                autoComplete="given-name"
                required
                data-testid="first-name-input"
              />
              <div className="empty-space col-xs-b20"></div>

              <input
                className="simple-input"
                type="text"
                name="last_name"
                placeholder="Last name *"
                autoComplete="family-name"
                required
                data-testid="last-name-input"
              />
              <div className="empty-space col-xs-b20"></div>

              <input
                className="simple-input"
                type="email"
                name="email"
                placeholder="Email address *"
                autoComplete="email"
                required
                data-testid="email-input"
              />
              <div className="empty-space col-xs-b20"></div>

              <input
                className="simple-input"
                type="tel"
                name="phone"
                placeholder="Phone"
                autoComplete="tel"
                data-testid="phone-input"
              />
              <div className="empty-space col-xs-b20"></div>

              <input
                className="simple-input"
                type="password"
                name="password"
                placeholder="Password *"
                autoComplete="new-password"
                required
                data-testid="password-input"
              />
              <div className="empty-space col-xs-b20"></div>

              <div className="simple-article size-2 col-xs-b20">
                Your personal data will be used to support your experience
                throughout this site, to manage access to your account &amp;
                for other purposes described in our{" "}
                <LocalizedClientLink
                  href="/content/privacy-policy"
                  style={{ color: "#b8cd06" }}
                >
                  privacy policy.
                </LocalizedClientLink>
              </div>

              <ErrorMessage
                error={
                  signupMessage?.state === "error" ? signupMessage.error : null
                }
                data-testid="register-error"
              />

              <button
                type="submit"
                className="button size-2 style-3"
                data-testid="register-button"
              >
                <span className="button-wrapper">
                  <span className="icon">
                    <i className="fa fa-user-plus" aria-hidden="true"></i>
                  </span>
                  <span className="text">register</span>
                </span>
              </button>
            </div>
          </form>
        </div>
        {/* Sign Up Panel End */}
      </div>
      {/* Login Content End */}
    </div>
  )
}

export default ExzoLogin
