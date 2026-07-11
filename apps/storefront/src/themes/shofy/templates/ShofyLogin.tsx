"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy (multipurpose) renderer for the ACCOUNT LOGIN view. Converted  */
/* from the template's login.html tp-login-wrapper (title, input boxes  */
/* with under-field labels, primary tp-login-btn) rendered twice — a    */
/* Login panel and a Sign Up panel side by side, mirroring the shared   */
/* login template's dual-form behavior. The auth mechanics are EXACTLY  */
/* the shared ones the Learts/Cignet logins reuse: the `login` and      */
/* `signup` server actions from @lib/data/customer driven by            */
/* useActionState, with the same error and verification_required        */
/* handling as the shared Login/Register form components — only the     */
/* form markup is Shofy's. The social sign-in buttons and the           */
/* full-bleed breadcrumb banner were dropped: this template renders     */
/* INSIDE the shared account layout's content column, so a contained    */
/* in-flow heading is used instead.                                     */
/* ------------------------------------------------------------------ */

const ShofyLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="shofy-theme">
      {/* Contained page heading: no full-bleed breadcrumb__area banner
          inside the account layout's column. */}
      <div className="breadcrumb__content p-relative z-index-1 mb-30">
        <h3 className="breadcrumb__title">My Account</h3>
        <div className="breadcrumb__list">
          <span>
            <LocalizedClientLink
              href="/"
              style={{ color: "var(--tp-theme-primary, #0989ff)" }}
            >
              Home
            </LocalizedClientLink>
          </span>
          <span>My Account</span>
        </div>
      </div>

      {/* login area start */}
      <div className="tp-login-area p-relative z-index-1 fix">
        <div className="row">
          {/* Login panel */}
          <div className="col-xl-6 col-lg-6">
            <div className="tp-login-wrapper mb-40">
              <div className="tp-login-top mb-30">
                <h3 className="tp-login-title">Login to your account.</h3>
                <p>
                  Access your orders, addresses and details. Enter your
                  credentials below to continue.
                </p>
              </div>
              <div className="tp-login-option" data-testid="login-page">
                <form action={loginAction}>
                  {loginMessage?.state === "verification_required" && (
                    <div
                      className="tp-login-mail mb-20"
                      data-testid="login-verification-message"
                    >
                      <p>
                        We sent a verification link to{" "}
                        <strong>{loginMessage.email}</strong>. Please verify
                        your email, then sign in.
                      </p>
                    </div>
                  )}

                  <div className="tp-login-input-wrapper">
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="login_email"
                          type="email"
                          name="email"
                          placeholder="Enter your e-mail"
                          title="Enter a valid email address."
                          autoComplete="email"
                          required
                          data-testid="email-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="login_email">Your Email</label>
                      </div>
                    </div>
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="login_password"
                          type="password"
                          name="password"
                          placeholder="Enter password"
                          autoComplete="current-password"
                          required
                          data-testid="password-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="login_password">Password</label>
                      </div>
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

                  <div className="tp-login-bottom">
                    <button
                      type="submit"
                      className="tp-login-btn w-100"
                      data-testid="sign-in-button"
                    >
                      Login
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Sign up panel */}
          <div className="col-xl-6 col-lg-6">
            <div className="tp-login-wrapper mb-40">
              <div className="tp-login-top mb-30">
                <h3 className="tp-login-title">Create a free account.</h3>
                <p>
                  Sign up to track your orders and enjoy a faster checkout.
                  Create your account in just a few steps.
                </p>
              </div>
              <div className="tp-login-option" data-testid="register-page">
                <form action={signupAction}>
                  {signupMessage?.state === "verification_required" && (
                    <div
                      className="tp-login-mail mb-20"
                      data-testid="register-verification-message"
                    >
                      <p>
                        We sent a verification link to{" "}
                        <strong>{signupMessage.email}</strong>. Please check
                        your inbox to verify your email, then sign in.
                      </p>
                    </div>
                  )}

                  <div className="tp-login-input-wrapper">
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="signup_first_name"
                          type="text"
                          name="first_name"
                          placeholder="Enter first name"
                          autoComplete="given-name"
                          required
                          data-testid="first-name-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="signup_first_name">First Name</label>
                      </div>
                    </div>
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="signup_last_name"
                          type="text"
                          name="last_name"
                          placeholder="Enter last name"
                          autoComplete="family-name"
                          required
                          data-testid="last-name-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="signup_last_name">Last Name</label>
                      </div>
                    </div>
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="signup_email"
                          type="email"
                          name="email"
                          placeholder="Enter your e-mail"
                          autoComplete="email"
                          required
                          data-testid="email-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="signup_email">Your Email</label>
                      </div>
                    </div>
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="signup_phone"
                          type="tel"
                          name="phone"
                          placeholder="Enter phone number"
                          autoComplete="tel"
                          data-testid="phone-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="signup_phone">Phone (optional)</label>
                      </div>
                    </div>
                    <div className="tp-login-input-box">
                      <div className="tp-login-input">
                        <input
                          id="signup_password"
                          type="password"
                          name="password"
                          placeholder="Min. 6 character"
                          autoComplete="new-password"
                          required
                          data-testid="password-input"
                        />
                      </div>
                      <div className="tp-login-input-title">
                        <label htmlFor="signup_password">Password</label>
                      </div>
                    </div>
                  </div>

                  <div className="tp-login-mail mb-20">
                    <p>
                      Your personal data will be used to support your
                      experience throughout this site, to manage access to
                      your account &amp; for other purposes described in our{" "}
                      <LocalizedClientLink
                        href="/content/privacy-policy"
                        style={{ color: "var(--tp-theme-primary, #0989ff)" }}
                      >
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

                  <div className="tp-login-bottom">
                    <button
                      type="submit"
                      className="tp-login-btn w-100"
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
      {/* login area end */}
    </div>
  )
}

export default ShofyLogin
