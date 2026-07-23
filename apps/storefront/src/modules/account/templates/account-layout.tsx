import React from "react"

import UnderlineLink from "@modules/common/components/interactive-link"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <div
      className="learts-theme section section-fluid section-padding bg-white"
      data-testid="account-page"
    >
      <div className="container">
        <div className="row learts-mb-n30">
          {/* Tab list — only reserve the column when signed in; a logged-out
              visitor (login page) gets the full row width. */}
          {customer && (
            <div className="col-lg-4 col-12 learts-mb-30">
              <AccountNav customer={customer} />
            </div>
          )}

          {/* Content */}
          <div
            className={
              customer
                ? "col-lg-8 col-12 learts-mb-30"
                : "col-12 learts-mb-30"
            }
          >
            <div className="myaccount-content">{children}</div>
          </div>
        </div>

        {/* Got questions — only for signed-in customers; the logged-out
            login/signup view should show nothing but the auth forms. */}
        {customer && (
          <div
            className="row align-items-center learts-pt-30"
            style={{ borderTop: "1px solid #eee", marginTop: 40 }}
          >
            <div className="col-md-8 col-12">
              <h3 className="title" style={{ fontSize: 22, marginBottom: 8 }}>
                Got questions?
              </h3>
              <span style={{ color: "#777" }}>
                You can find frequently asked questions and answers on our
                contact page.
              </span>
            </div>
            <div className="col-md-4 col-12 text-md-right">
              <UnderlineLink href="/contact">Contact us</UnderlineLink>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountLayout
