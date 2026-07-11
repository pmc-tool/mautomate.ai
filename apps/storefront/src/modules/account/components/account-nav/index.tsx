"use client"

import { useParams, usePathname } from "next/navigation"

import { signout } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const AccountNav = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) => {
  const route = usePathname()
  const { countryCode } = useParams() as { countryCode: string }

  const handleLogout = async () => {
    await signout(countryCode)
  }

  const isActive = (href: string) =>
    route?.split(countryCode)[1] === href

  const items: { href: string; label: string; icon: string }[] = [
    { href: "/account", label: "Dashboard", icon: "ti-dashboard" },
    { href: "/account/profile", label: "Account Details", icon: "ti-user" },
    { href: "/account/addresses", label: "Addresses", icon: "ti-location-pin" },
    { href: "/account/orders", label: "Orders", icon: "ti-receipt" },
  ]

  return (
    <div className="learts-theme" data-testid="account-nav">
      <div className="myaccount-tab-list nav" style={{ display: "block" }}>
        {items.map((item) => (
          <LocalizedClientLink
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "active" : ""}
            data-testid={`${item.label.toLowerCase().split(" ")[0]}-link`}
          >
            {item.label} <i className={item.icon} />
          </LocalizedClientLink>
        ))}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            handleLogout()
          }}
          data-testid="logout-button"
        >
          Logout <i className="ti-power-off" />
        </a>
      </div>
    </div>
  )
}

export default AccountNav
