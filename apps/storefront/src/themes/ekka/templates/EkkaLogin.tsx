"use client"

import { useActionState } from "react"

import { login, signup } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the ACCOUNT LOGIN view. Converted from the         */
/* template's login.html and register.html: the section-title heading,  */
/* the ec-login-wrapper form and the ec-register-wrapper form. The      */
/* auth mechanics are EXACTLY the shared ones the Aurora login reuses:  */
/* the `login` and `signup` server actions from @lib/data/customer      */
/* driven by useActionState, with the same error and                    */
/* verification_required handling as the shared Login/Register form     */
/* components — only the form markup is the Ekka template's.            */
/* ------------------------------------------------------------------ */

const EkkaLogin = () => {
  const [loginMessage, loginAction] = useActionState(login, null)
  const [signupMessage, signupAction] = useActionState(signup, null)

  return (
    <div className="ekka-theme">
      {/* Contained page heading: this template renders INSIDE the shared
          account layout's content column, so a full-bleed breadcrumb strip
          cannot span the page — use an in-flow title block instead. */}
      <div className="login-page-heading" style={{ marginBottom: 30 }}>
        <div className="section-title">
          <h2 className="ec-title">Login &amp; Register</h2>
          <p className="sub-title mb-3">
            Sign in to your account or create a new one
          </p>
        </div>
        <nav>
          <ul className="ec-breadcrumb-list" style={{ marginBottom: 0 }}>
            <li className="ec-breadcrumb-item">
              <LocalizedClientLink href="/">Home</LocalizedClientLink>
            </li>
            <li className="ec-breadcrumb-item active">Login</li>
          </ul>
        </nav>
      </div>

      {/* Ec login page */}
      <section className="ec-page-content section-space-p">
        <div className="container">
          <div className="row">
            {/* Login Form Start */}
            <div className="ec-login-wrapper" data-testid="login-page">
              <div className="ec-login-container">
                <div className="ec-login-form">
                  <form action={loginAction}>
                    {loginMessage?.state === "verification_required" && (
                      <span
                        className="ec-login-wrap"
                        data-testid="login-verification-message"
                      >
                        <p>
                          We sent a verification link to{" "}
                          <strong>{loginMessage.email}</strong>. Please verify
                          your email, then sign in.
                        </p>
                      </span>
                    )}

                    <span className="ec-login-wrap">
                      <label>Email Address*</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="Enter your email add..."
                        title="Enter a valid email address."
                        autoComplete="email"
                        required
                        data-testid="email-input"
                      />
                    </span>
                    <span className="ec-login-wrap">
                      <label>Password*</label>
                      <input
                        type="password"
                        name="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        data-testid="password-input"
                      />
                    </span>

                    <ErrorMessage
                      error={
                        loginMessage?.state === "error"
                          ? loginMessage.error
                          : null
                      }
                      data-testid="login-error-message"
                    />

                    <span className="ec-login-wrap ec-login-btn">
                      <button
                        className="btn btn-primary"
                        type="submit"
                        data-testid="sign-in-button"
                      >
                        Login
                      </button>
                    </span>
                  </form>
                </div>
              </div>
            </div>
            {/* Login Form End */}

            {/* Register Form Start */}
            <div className="ec-register-wrapper" data-testid="register-page">
              <div className="ec-register-container">
                <div className="ec-login-form ec-register-form">
                  <form action={signupAction}>
                    <div className="section-title">
                      <h2 className="ec-title">Register</h2>
                      <p className="sub-title mb-3">
                        Create your account in just a few steps
                      </p>
                    </div>

                    {signupMessage?.state === "verification_required" && (
                      <span
                        className="ec-register-wrap"
                        data-testid="register-verification-message"
                      >
                        <p>
                          We sent a verification link to{" "}
                          <strong>{signupMessage.email}</strong>. Please check
                          your inbox to verify your email, then sign in.
                        </p>
                      </span>
                    )}

                    <span className="ec-register-wrap ec-register-half">
                      <label>First Name*</label>
                      <input
                        type="text"
                        name="first_name"
                        placeholder="Enter your first name"
                        autoComplete="given-name"
                        required
                        data-testid="first-name-input"
                      />
                    </span>
                    <span className="ec-register-wrap ec-register-half">
                      <label>Last Name*</label>
                      <input
                        type="text"
                        name="last_name"
                        placeholder="Enter your last name"
                        autoComplete="family-name"
                        required
                        data-testid="last-name-input"
                      />
                    </span>
                    <span className="ec-register-wrap ec-register-half">
                      <label>Email*</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="Enter your email add..."
                        autoComplete="email"
                        required
                        data-testid="email-input"
                      />
                    </span>
                    <span className="ec-register-wrap ec-register-half">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="Enter your phone number"
                        autoComplete="tel"
                        data-testid="phone-input"
                      />
                    </span>
                    <span className="ec-register-wrap">
                      <label>Password*</label>
                      <input
                        type="password"
                        name="password"
                        placeholder="Enter your password"
                        autoComplete="new-password"
                        required
                        data-testid="password-input"
                      />
                    </span>

                    <span className="ec-register-wrap">
                      <p>
                        Your personal data will be used to support your
                        experience throughout this site, to manage access to
                        your account &amp; for other purposes described in our{" "}
                        <LocalizedClientLink href="/content/privacy-policy">
                          privacy policy.
                        </LocalizedClientLink>
                      </p>
                    </span>

                    <ErrorMessage
                      error={
                        signupMessage?.state === "error"
                          ? signupMessage.error
                          : null
                      }
                      data-testid="register-error"
                    />

                    <span className="ec-register-wrap ec-register-btn">
                      <button
                        className="btn btn-primary"
                        type="submit"
                        data-testid="register-button"
                      >
                        Register
                      </button>
                    </span>
                  </form>
                </div>
              </div>
            </div>
            {/* Register Form End */}
          </div>
        </div>
      </section>
      {/* Ec login page end */}
    </div>
  )
}

export default EkkaLogin
